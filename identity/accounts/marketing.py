"""Salon lifecycle. All visitor mutations serialize on the event before reading."""
import hashlib,hmac,secrets,uuid
from datetime import datetime,timezone as datetime_timezone
from zoneinfo import ZoneInfo,ZoneInfoNotFoundError
from django.conf import settings
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import F,Q,Count
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from .models import SalonEvent,SalonRegistration,SalonLog,SalonMail,Session
from .admin_users import disabled

DATE_KEYS=('starts','ends','registrationStarts','registrationEnds','checkinStarts','checkinEnds','cancelEnds')
def stamp(value):
    result=parse_datetime(str(value))
    if not result or timezone.is_naive(result):raise ValueError('请填写带时区的完整日期时间')
    return result

def clean(data):
    result={}
    for k in ('titleZh','titleEn','summaryZh','summaryEn','organizer','locationZh','locationEn','addressZh','addressEn','contact','phone','imageId'):
        value=data.get(k,'')
        if not isinstance(value,str) or len(value)> (1000 if 'summary' in k else 200):raise ValueError('活动文字过长或格式无效')
        result[k]=value.strip()
    if not result['titleZh']:raise ValueError('请填写活动名称')
    status=data.get('status','draft')
    if status not in ('draft','published','closed','cancelled','archived'):raise ValueError('活动状态无效')
    if status=='published' and not result['titleEn']:raise ValueError('发布时请填写英文名称')
    result['status']=status
    zone=data.get('timezone','Asia/Shanghai')
    try:ZoneInfo(zone)
    except (ZoneInfoNotFoundError,TypeError,ValueError):raise ValueError('时区无效')
    result['timezone']=zone
    for key in DATE_KEYS:result[key]=stamp(data.get(key)).astimezone(datetime_timezone.utc).isoformat()
    for start,end in [('starts','ends'),('registrationStarts','registrationEnds'),('checkinStarts','checkinEnds')]:
        if stamp(result[start])>=stamp(result[end]):raise ValueError('开始时间必须早于结束时间')
    if stamp(result['registrationEnds'])>stamp(result['ends']) or stamp(result['checkinEnds'])>stamp(result['ends']):raise ValueError('报名/签到截止不能晚于活动结束')
    capacity=data.get('capacity')
    if capacity is not None and (type(capacity) is not int or not 1<=capacity<=1000000):raise ValueError('人数上限须为正整数或留空')
    result['capacity']=capacity
    for key in ('allowCancel','test'):
        if type(data.get(key,False)) is not bool:raise ValueError('开关格式无效')
        result[key]=data.get(key,False)
    fields=data.get('fields',[])
    if not isinstance(fields,list) or len(fields)>30:raise ValueError('报名字段最多30项')
    ids=set();normalized=[]
    for f in fields:
        if not isinstance(f,dict):raise ValueError('字段无效')
        key=f.get('id','')
        if not isinstance(key,str) or not key or len(key)>64 or key in ids:raise ValueError('字段标识无效或重复')
        ids.add(key)
        if f.get('type') not in ('text','textarea','phone','email','image','time','date','number'):raise ValueError('字段类型无效')
        if any(not isinstance(f.get(k),str) or not f[k].strip() or len(f[k])>100 for k in ('labelZh','labelEn')):raise ValueError('请填写中英文字段名称')
        normalized.append({k:f[k] for k in ('id','type','labelZh','labelEn')}|{'required':bool(f.get('required'))})
    result['fields']=normalized
    # Rich documents are normalized at the CMS boundary; retain only supplied documents.
    for key in ('bodyZh','bodyEn'):result[key]=data.get(key,{'type':'doc','content':[]})
    result['assetIds']=list(dict.fromkeys(data.get('assetIds',[])))
    return result

def event_dict(event,private=False):
    d={**event.data,'id':event.pk,'status':event.status,'updated':event.updated.isoformat()}
    if private:d['checkinCode']=event.checkin_code
    now=timezone.now()
    d['phase']=event.status
    if event.status=='published':
        d['phase']=('ended' if now>=stamp(d['ends']) else 'ongoing' if now>=stamp(d['starts']) else 'upcoming' if now<stamp(d['registrationStarts']) else 'registrationClosed' if now>=stamp(d['registrationEnds']) else 'registering')
    return d

def public_event(key):
    event=SalonEvent.objects.filter(Q(data__test=False)|Q(data__test__isnull=True),pk=key).exclude(status__in=['draft','archived']).first()
    if not event:raise ValueError('活动不存在或尚未发布')
    result=event_dict(event);valid=event.registrations.filter(status='active').count()
    result['remaining']=max(0,event.data['capacity']-valid) if event.data['capacity'] is not None else None
    return result

def log(event,actor,action,registration=None,reason=''):
    SalonLog.objects.create(event=event,actor=actor,action=action,registration=registration,reason=reason,snapshot={'answers':registration.answers,'fields':registration.fields} if registration else {})

def locked(key):
    # First statement is a write: SQLite serializes before subsequent reads; PostgreSQL locks the row.
    if not SalonEvent.objects.filter(pk=key).update(title=F('title')):raise ValueError('活动不存在')
    return SalonEvent.objects.get(pk=key)

@transaction.atomic
def save_event(data,actor):
    d=clean(data);key=str(data.get('id') or uuid.uuid4())
    event=locked(key) if data.get('id') and not data.get('create') else None
    if event:
        count=event.registrations.filter(status='active').count()
        if d['capacity'] is not None and d['capacity']<count:raise ValueError('人数上限不能低于有效报名人数')
        if event.registrations.exists() and (d['test']!=event.data['test'] or d['status']=='draft'):raise ValueError('已有报名不可修改测试模式或退回草稿')
        old=event.data
        if data.get('notify') and (any(d[k]!=old.get(k) for k in ('starts','ends','locationZh','addressZh','locationEn','addressEn')) or d['status']=='cancelled'):
            for registration in event.registrations.filter(status='active'):
                queue_mail(registration,'活动信息更新 / Event update',f"{d['titleZh']} / {d['titleEn']}\n状态 / Status: {d['status']}\n{d['starts']}\n{d['addressZh']} / {d['addressEn']}")
        event.data=d;event.status=d['status'];event.title=d['titleZh'];event.save()
    else:event=SalonEvent.objects.create(id=key,title=d['titleZh'],status=d['status'],data=d,checkin_code=secrets.token_urlsafe(32))
    log(event,actor,'save-event')
    return {'event':event_dict(event,True)}

def visitor_user(data):
    digest=lambda value:hashlib.sha256(value.encode()).hexdigest()
    current=Session.objects.select_related('user').filter(pk=digest(str(data.get('session',''))),expires__gt=timezone.now(),user__is_active=True).first()
    if not current or disabled(current.user) or not hmac.compare_digest(current.password_stamp,digest(current.user.password)):raise ValueError('请先登录 / Please sign in')
    if getattr(getattr(current.user,'visitor_state',None),'sandbox',False) and not settings.IDENTITY_SANDBOX:raise ValueError('沙箱会话已关闭')
    return current.user

def registration_dict(r,private=False):
    result={'id':r.pk,'eventId':r.event_id,'name':r.name,'email':r.email,'answers':r.answers,'fields':r.fields,'status':r.status,'checkedAt':r.checked_at.isoformat() if r.checked_at else None,'checkinMethod':r.checkin_method,'checkinActor':r.checkin_actor,'created':r.created.isoformat(),'note':r.note}
    if private:
        result['userId']=r.user_id
    else:
        result.pop('note');result.pop('checkinActor')
    return result

def answer_values(fields,data):
    if not isinstance(data,dict):raise ValueError('报名资料格式无效')
    result={}
    for f in fields:
        value=data.get(f['id'],'')
        if not isinstance(value,str) or len(value)>2000:raise ValueError('报名内容过长')
        value=value.strip()
        if f['required'] and not value:raise ValueError('请填写 / Required: '+f['labelZh']+' / '+f['labelEn'])
        if value:
            if f['type']=='email':validate_email(value)
            if f['type']=='number':
                from decimal import Decimal,InvalidOperation
                try:
                    if not Decimal(value).is_finite():raise ValueError('数字格式无效')
                except InvalidOperation:raise ValueError('数字格式无效')
            if f['type'] in ('date','time'):
                try:(datetime.fromisoformat(value) if f['type']=='date' else datetime.strptime(value,'%H:%M'))
                except ValueError:raise ValueError('日期或时间格式无效')
            if f['type']=='phone':
                import re
                if not re.fullmatch(r'[+()\d .-]{5,30}',value):raise ValueError('电话格式无效')
            if f['type']=='image' and not value.startswith('/api/submission-file/'):raise ValueError('请上传有效图片')
        result[f['id']]=value
    return result

def queue_mail(r,subject,body):
    if r.event.data.get('test'):return
    SalonMail.objects.create(registration=r,subject=subject,body=body)

@transaction.atomic
def visitor(action,data):
    event=locked(str(data.get('id','')));user=visitor_user(data)
    sandbox=getattr(getattr(user,'visitor_state',None),'sandbox',False)
    if sandbox!=event.data['test']:raise ValueError('测试活动与正式账号隔离 / Test account required for test events')
    r=SalonRegistration.objects.filter(event=event,user=user).first();now=timezone.now();d=event.data
    if action=='registration':return {'registration':registration_dict(r) if r else None}
    if event.status in ('draft','archived','cancelled'):raise ValueError('活动不接受操作 / Event unavailable')
    if action=='register':
        if r and r.status=='active':return {'registration':registration_dict(r)}
        if event.status!='published' or not stamp(d['registrationStarts'])<=now<stamp(d['registrationEnds']):raise ValueError('不在报名时间 / Registration closed')
        if d['capacity'] is not None and event.registrations.filter(status='active').count()>=d['capacity']:raise ValueError('名额已满 / Event full')
        if data.get('consent') is not True:raise ValueError('请确认报名信息的使用说明 / Please accept the registration notice')
        if data.get('_eventVersion') and data['_eventVersion']!=event.updated.isoformat():raise ValueError('活动已更新，请刷新后重试 / Event updated, please refresh')
        answers=answer_values(d['fields'],data.get('answers',{}))
        if r:
            log(event,str(user.pk),'before-reregister',r)
            r.status='active';r.answers=answers;r.fields=d['fields'];r.save()
        else:r=SalonRegistration.objects.create(id=str(uuid.uuid4()),event=event,user=user,name=(user.last_name+' '+user.first_name).strip(),email=user.email,answers=answers,fields=d['fields'])
        log(event,str(user.pk),'register',r)
        queue_mail(r,'报名成功 / Registration confirmed',d['titleZh']+' / '+d['titleEn']+'\n'+d['starts'])
    elif action=='cancel':
        if not r or r.status!='active':raise ValueError('无有效报名 / No active registration')
        if r.checked_at or not d['allowCancel'] or now>=stamp(d['cancelEnds']):raise ValueError('当前不可取消 / Cancellation unavailable')
        r.status='cancelled';r.save();log(event,str(user.pk),'cancel',r)
        queue_mail(r,'报名已取消 / Registration cancelled',d['titleZh']+' / '+d['titleEn'])
    elif action=='checkin':
        if not hmac.compare_digest(str(data.get('code','')),event.checkin_code):raise ValueError('签到码无效 / Invalid check-in code')
        if not r or r.status!='active':raise ValueError('请先报名 / Please register first')
        if r.checked_at:return {'registration':registration_dict(r)}
        if not stamp(d['checkinStarts'])<=now<stamp(d['checkinEnds']):raise ValueError('不在签到时间 / Check-in closed')
        r.checked_at=now;r.checkin_method='self';r.checkin_actor=str(user.pk);r.save();log(event,str(user.pk),'checkin',r)
    else:raise ValueError('未知操作')
    return {'registration':registration_dict(r)}

def statistics(key):
    event=SalonEvent.objects.get(pk=key);rows=event.registrations.all();valid=rows.filter(status='active').count();checked=rows.filter(status='active',checked_at__isnull=False).count()
    def histogram(values):
        counts={}
        for value in values:
            key=value.astimezone(ZoneInfo(event.data['timezone'])).strftime('%Y-%m-%d')
            counts[key]=counts.get(key,0)+1
        return [{'date':k,'count':v} for k,v in sorted(counts.items())]
    return {'total':rows.count(),'valid':valid,'cancelled':rows.filter(status='cancelled').count(),'checked':checked,'unchecked':valid-checked,'rate':round(checked/valid*100,1) if valid else None,'remaining':max(0,event.data['capacity']-valid) if event.data['capacity'] is not None else None,'registrationsByDay':histogram(rows.values_list('created',flat=True)),'checkinsByDay':histogram(rows.exclude(checked_at=None).values_list('checked_at',flat=True))}
