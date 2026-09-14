from datetime import date, datetime, time, timedelta, timezone
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q
from .models import VisitorState, Session, Token, Audit

def disabled(user):
    return VisitorState.objects.filter(user=user,disabled=True).exists()

def registration_source(user,state):
    if state and state.registration_source!='unknown':return state.registration_source
    import hashlib
    return 'email' if user.username==hashlib.sha256(user.email.lower().encode()).hexdigest() else 'unknown'

def profile(user):
    state=VisitorState.objects.filter(user=user).first()

    return {'id':user.pk,'email':user.email,'firstName':user.first_name,'lastName':user.last_name,'verified':user.is_active and not (state and state.sandbox),'enabled':not disabled(user),'created_at':user.date_joined.isoformat(),'lastLogin':user.last_login.isoformat() if user.last_login else None,'country':state.country if state else '', 'city':state.city if state else '', 'company':state.company if state else '', 'registrationSource':registration_source(user,state),'lastLoginMethod':state.last_login_method if state else '', 'sandbox':bool(state and state.sandbox),'providers':list(user.social_identities.values_list('provider',flat=True))}

def list_users(data):
    page=int(data.get('page') or 1);size=int(data.get('size') or 20)
    if str(page)!=str(data.get('page') or 1) or page<1 or page>1000000 or size not in (20,50,100):raise ValueError('分页参数无效')
    query=str(data.get('q') or '').strip()
    if len(query)>200:raise ValueError('检索内容过长')
    rows=User.objects.filter(is_staff=False,is_superuser=False)
    dashboard = str(data.get('dashboard', '')) == '1'
    if dashboard:
        from .staff_dashboard import parse_period, TZ
        start_date, end_date, _ = parse_period(data)
        rows = rows.filter(date_joined__gte=datetime.combine(start_date,time.min,TZ),
                           date_joined__lt=datetime.combine(end_date,time.min,TZ))
        mode = data.get('dataMode', 'all')
        if mode == 'formal': rows = rows.exclude(visitor_state__sandbox=True)
        if mode == 'demo': rows = rows.filter(visitor_state__sandbox=True)
    else:
        rows = rows.exclude(visitor_state__sandbox=True)
    if query:rows=rows.filter(Q(email__icontains=query)|Q(first_name__icontains=query)|Q(last_name__icontains=query))
    for key in ('verified','enabled'):
        value=data.get(key,'')
        if value not in ('','true','false'):raise ValueError('筛选值无效')
        if value:
            if key=='verified':
                rows=rows.filter(is_active=True).exclude(visitor_state__sandbox=True) if value=='true' else rows.filter(Q(is_active=False)|Q(visitor_state__sandbox=True))
            elif value=='false':rows=rows.filter(visitor_state__disabled=True)
            else:rows=rows.exclude(visitor_state__disabled=True)
    for key in ('country','city','company'):
        value=str(data.get(key) or '').strip()
        if len(value)>200:raise ValueError('检索内容过长')
        if value:rows=rows.filter(**{'visitor_state__'+key+('__iexact' if key=='country' else '__icontains'):value})
    source=data.get('source','')
    if source:
        if source not in ('email','unknown','google','wechat','facebook'):raise ValueError('注册来源无效')
        if source=='email':rows=rows.filter(visitor_state__registration_source='email')
        else:rows=rows.filter(visitor_state__registration_source=source)
    start='' if dashboard else data.get('from','');end='' if dashboard else data.get('to','')
    if start and end and start>end:raise ValueError('开始日期不能晚于结束日期')
    if start:rows=rows.filter(date_joined__gte=datetime.combine(date.fromisoformat(start),time.min,tzinfo=timezone.utc))
    if end:rows=rows.filter(date_joined__lt=datetime.combine(date.fromisoformat(end)+timedelta(days=1),time.min,tzinfo=timezone.utc))
    order=data.get('sort','')
    if order not in ('','asc','desc'):raise ValueError('排序无效')
    count=rows.count();pages=max(1,(count+size-1)//size);page=min(page,pages)
    prefix='' if order=='asc' else '-'
    result=[profile(u) for u in rows.order_by(prefix+'date_joined',prefix+'id')[(page-1)*size:page*size]]
    return {'rows':result,'users':result,'total':count,'page':page,'size':size,'pages':pages}

@transaction.atomic
def set_enabled(data,actor):
    if type(data.get('enabled')) is not bool:raise ValueError('启用状态无效')
    user=User.objects.filter(pk=data.get('id'),is_staff=False,is_superuser=False).first()
    if not user:raise ValueError('访客不存在')
    VisitorState.objects.update_or_create(user=user,defaults={'disabled':not data['enabled']})
    if not data['enabled']:
        Session.objects.filter(user=user).delete()
        Token.objects.filter(user=user).delete()
    Audit.objects.create(actor=actor,action='enable-user' if data['enabled'] else 'disable-user')
    return {'ok':True,'user':profile(user)}

@transaction.atomic
def save_profile(data,actor):
    if any(k in data for k in ('registrationSource','sandbox','providers')):raise ValueError('注册来源与登录身份不能手动修改')
    user=User.objects.filter(pk=data.get('id'),is_staff=False,is_superuser=False).first()
    if not user:raise ValueError('访客不存在')
    country=data.get('country','');city=data.get('city','');company=data.get('company','')
    import re
    if not isinstance(country,str) or (country and not re.fullmatch('[A-Z]{2}',country)):raise ValueError('国家代码须为两位大写字母')
    if not isinstance(city,str) or len(city)>100 or not isinstance(company,str) or len(company)>200:raise ValueError('城市最多100字，公司名称最多200字')
    state,_=VisitorState.objects.get_or_create(user=user)
    state.country=country;state.city=city.strip();state.company=company.strip();state.save(update_fields=['country','city','company'])
    Audit.objects.create(actor=actor,action='save-user-profile')
    return {'ok':True,'user':profile(user)}
