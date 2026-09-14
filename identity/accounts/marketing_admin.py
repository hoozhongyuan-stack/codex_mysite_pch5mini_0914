"""Admin queries, audited mutations and durable notification delivery."""
from datetime import timedelta
from django.db import transaction
from django.db.models import Q,Count
from django.utils import timezone
from .models import SalonEvent,SalonRegistration,SalonMail,SalonLog,MarketingGrant
from .marketing import event_dict,registration_dict,save_event,locked,log,statistics,stamp
from . import mailer

def paged(rows,data,render):
    try:page=max(1,int(data.get('page',1)));size=int(data.get('pageSize',20))
    except (ValueError,TypeError):raise ValueError('分页参数无效')
    if size not in (20,50,100):raise ValueError('分页大小无效')
    total=rows.count();pages=max(1,(total+size-1)//size);page=min(page,pages)
    return {'rows':[render(r) for r in rows[(page-1)*size:page*size]],'total':total,'page':page,'pages':pages,'pageSize':size}

def registrations(data):
    rows=SalonRegistration.objects.filter(event_id=data.get('id')).order_by('-created','id')
    q=str(data.get('q','')).strip()[:200]
    if q:rows=rows.filter(Q(name__icontains=q)|Q(email__icontains=q)|Q(answers__icontains=q)|Q(id__icontains=q))
    if data.get('company'):rows=rows.filter(answers__company__icontains=str(data['company'])[:200])
    if data.get('status') in ('active','cancelled'):rows=rows.filter(status=data['status'])
    if data.get('checked') in ('yes','no'):rows=rows.filter(checked_at__isnull=data['checked']=='no')
    for key,lookup in [('from','created__gte'),('to','created__lt')]:
        if data.get(key):rows=rows.filter(**{lookup:stamp(data[key])})
    return rows

def send_pending(event_id,maximum=1):
    SalonMail.objects.filter(status='sending',claimed_at__lt=timezone.now()-timedelta(minutes=2)).update(status='failed')
    pending=list(SalonMail.objects.filter(registration__event_id=event_id,status__in=['pending','failed'],attempts__lt=3).order_by('id').values_list('id',flat=True)[:maximum])
    for key in pending:
        # Claim before SMTP; a failed response never rolls back the registration.
        if not SalonMail.objects.filter(pk=key,status__in=['pending','failed']).update(status='sending',claimed_at=timezone.now()):continue
        item=SalonMail.objects.select_related('registration__event').get(pk=key)
        try:
            if item.registration.event.data.get('test') or item.registration.email.endswith('@sandbox.invalid'):state='skipped'
            else:mailer.send(item.registration.email,item.subject,item.body);state='sent'
        except Exception:state='failed'
        SalonMail.objects.filter(pk=key).update(status=state,attempts=item.attempts+1)
    return {'pending':SalonMail.objects.filter(registration__event_id=event_id,status__in=['pending','failed','sending']).count()}

@transaction.atomic
def change_registration(data,actor):
    event=locked(data.get('id'));r=SalonRegistration.objects.filter(event=event,pk=data.get('registrationId')).first()
    if not r:raise ValueError('报名不存在')
    operation=data.get('operation');reason=str(data.get('reason','')).strip()
    if len(reason)>500:raise ValueError('原因最多500字')
    if operation in ('checkin','undo','cancel') and not reason:raise ValueError('请填写操作原因')
    if operation=='checkin':
        if r.status!='active' or event.status in ('draft','cancelled','archived'):raise ValueError('当前不可补签')
        if r.checked_at:return {'registration':registration_dict(r,True)}
        r.checked_at=timezone.now();r.checkin_method='admin';r.checkin_actor=actor
    elif operation=='undo':r.checked_at=None;r.checkin_method='';r.checkin_actor=''
    elif operation=='cancel':
        if r.checked_at:raise ValueError('已签到，请先核实并撤销签到')
        r.status='cancelled'
    elif operation=='note':
        note=data.get('note','')
        if not isinstance(note,str) or len(note)>2000:raise ValueError('备注最多2000字')
        r.note=note
    else:raise ValueError('操作无效')
    r.save();log(event,actor,operation,r,reason)
    return {'registration':registration_dict(r,True)}

def admin_action(action,data,actor):
    if action=='batch-events':
        from .marketing_batch import batch_events
        return batch_events(data,actor)
    if action=='qr':
        from .marketing_qr import render
        return render(data)
    if action=='access':
        from .models import StaffAccount
        from .permissions import effective_permissions
        account = StaffAccount.objects.filter(email=actor.lower(), active=True).first()
        return {'permissions':[p.removeprefix('marketing.') for p in effective_permissions(account) if p.startswith('marketing.')] if account else []}
    if action=='grants':return {'rows':list(MarketingGrant.objects.values('email','permissions'))}
    if action=='save-grant':
        raise PermissionError('请在权限组设置中管理授权')

    if action=='save':
        result=save_event(data,actor)
        result['mail']=send_pending(result['event']['id'],1)
        return result
    if action=='change-registration':return change_registration(data,actor)
    if action=='retry-mail':
        SalonMail.objects.filter(registration__event_id=data.get('id'),status='failed').update(attempts=0)
        return send_pending(data.get('id'))
    if action=='list':
        rows=SalonEvent.objects.filter(Q(data__test=False)|Q(data__test__isnull=True)).order_by('-created','id')
        if data.get('q'):rows=rows.filter(title__icontains=str(data['q'])[:200])
        if data.get('status'):rows=rows.filter(status=data['status'])
        for key,lookup in [('from','data__starts__gte'),('to','data__starts__lt')]:
            if data.get(key):rows=rows.filter(**{lookup:stamp(data[key]).isoformat()})
        return paged(rows,data,lambda r:event_dict(r,True))
    event=SalonEvent.objects.filter(pk=data.get('id')).first()
    if not event:raise ValueError('活动不存在')
    if action=='detail':
        return {'event':event_dict(event,True),'stats':statistics(event.pk),'mail':list(SalonMail.objects.filter(registration__event=event).values('status').order_by('status').annotate(count=Count('id'))),'logs':list(SalonLog.objects.filter(event=event).order_by('-created').values('actor','action','reason','created','registration_id')[:100])}
    if action=='registrations':return paged(registrations(data),data,lambda r:registration_dict(r,True))
    if action=='export':
        rows=registrations(data)
        if data.get('selected'):
            if not isinstance(data['selected'],list) or len(data['selected'])>100:raise ValueError('选择记录过多')
            rows=rows.filter(pk__in=data['selected'])
        if rows.count()>10000:raise ValueError('单次最多导出10000条，请缩小日期范围')
        log(event,actor,'export')
        return {'rows':[registration_dict(r,True) for r in rows]}
    raise ValueError('未知操作')
