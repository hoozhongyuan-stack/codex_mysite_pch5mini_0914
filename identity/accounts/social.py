"""Local sandbox only. No external OAuth authorization is claimed or performed."""
import hashlib,hmac,secrets
from datetime import timedelta
from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from .models import SocialConfig,SocialIdentity,SandboxFlow,VisitorState,Session,Consent,Audit
from .admin_users import profile,disabled
PROVIDERS=('wechat','google','facebook')
def digest(value):return hashlib.sha256(value.encode()).hexdigest()
def config(admin=False):
    from . import oauth
    providers=[]
    for i,p in enumerate(PROVIDERS):
        c=SocialConfig.objects.filter(pk=p).first()
        row={'provider':p,'enabled':False,'sort':c.sort if c else i,'realEnabled':bool(c and c.real_enabled and oauth.configured(c))}
        if admin: row.update(clientId=c.client_id if c else '',secretConfigured=bool(c and c.secret_encrypted),callbackUrl=oauth.callback(p))
        providers.append(row)
    return {'sandboxAvailable':False,'mode':'real','providers':providers,'realLoginAvailable':any(p['realEnabled'] for p in providers)}
def save_config(data,actor):
    from . import oauth
    p=data.get('provider')
    if p not in PROVIDERS or type(data.get('enabled')) is not bool or type(data.get('sort')) is not int or not 0<=data['sort']<=99:raise ValueError('渠道配置无效')
    if data.get('mode') != 'real':raise ValueError('仅支持快捷登录配置')
    c=SocialConfig.objects.filter(pk=p).first() or SocialConfig(provider=p)
    if data.get('mode','sandbox')=='real':
        client=data.get('clientId','')
        secret=data.get('secret','')
        if not isinstance(client,str) or not isinstance(secret,str) or len(client)>255 or len(secret)>2000:raise ValueError('应用配置无效')
        c.client_id=client.strip()
        if secret: c.secret_encrypted=oauth.cipher().encrypt(secret.encode()).decode()
        c.real_enabled=data['enabled']
        if c.real_enabled and not oauth.configured(c):raise ValueError('请先填写应用 ID 和密钥')
        if c.real_enabled and not settings.PUBLIC_ORIGIN.startswith('https://') and not settings.IDENTITY_SANDBOX:raise ValueError('真实登录需要正式 HTTPS 域名')
    else:c.enabled=data['enabled']
    c.sort=data['sort'];c.save()
    Audit.objects.create(actor=actor,action='social-config')
    return {'ok':True,**config(admin=True)}
def available(provider):
    if not settings.IDENTITY_SANDBOX:raise ValueError('沙箱登录仅限显式启用的本地开发环境')
    if provider not in PROVIDERS or not SocialConfig.objects.filter(pk=provider,enabled=True).exists():raise ValueError('登录渠道未启用')
def browser(data):
    value=data.get('browser','')
    if not isinstance(value,str) or len(value)!=43:raise ValueError('沙箱浏览器会话无效')
    return digest(value)
def active_session(raw):
    session=Session.objects.select_related('user').filter(pk=digest(str(raw or '')),expires__gt=timezone.now(),user__is_active=True).first()
    if not session or disabled(session.user) or not hmac.compare_digest(session.password_stamp,digest(session.user.password)):raise ValueError('请先登录有效的沙箱账号')
    if not settings.IDENTITY_SANDBOX or not VisitorState.objects.filter(user=session.user,sandbox=True).exists():raise ValueError('仅允许沙箱账号绑定模拟渠道')
    return session
def start(data):
    p=data.get('provider');available(p);b=browser(data);token=secrets.token_urlsafe(32)
    SandboxFlow.objects.filter(expires__lt=timezone.now()).delete()
    binding=active_session(data.get('session')).pk if data.get('intent')=='link' else ''
    SandboxFlow.objects.create(digest=digest(token),browser=b,provider=p,binding_session=binding,expires=timezone.now()+timedelta(minutes=5))
    return {'ticket':token,'provider':p,'sandbox':True}
@transaction.atomic
def finish(data):
    # First write takes SQLite lock; claiming the ticket and issuing a session are atomic.
    key=digest(str(data.get('ticket','')))
    SandboxFlow.objects.filter(pk=key).update(expires=F('expires'))
    flow=SandboxFlow.objects.filter(pk=key,expires__gt=timezone.now()).first()
    if not flow or not hmac.compare_digest(flow.browser,browser(data)):raise ValueError('模拟授权已失效，请重新开始')
    available(flow.provider)
    if not data.get('terms') or not data.get('privacy'):raise ValueError('请同意注册和隐私协议')
    first=data.get('firstName','');last=data.get('lastName','')
    if not isinstance(first,str) or not isinstance(last,str) or not first.strip() or not last.strip() or len(first)>100 or len(last)>100:raise ValueError('请填写姓和名，各不超过100字')
    subject=digest('sandbox:'+flow.browser+':'+flow.provider)
    ident=SocialIdentity.objects.filter(provider=flow.provider,subject=subject).select_related('user').first()
    if flow.binding_session:
        current=active_session(data.get('session'))
        if current.pk!=flow.binding_session:raise ValueError('登录状态已变化，请重新绑定')
        user=current.user
        if ident and ident.user_id!=user.pk:raise ValueError('该模拟身份已属于另一账号，不能自动合并')
        if not ident:
            if user.social_identities.filter(provider=flow.provider).exists():raise ValueError('该账号已绑定此渠道，请先解绑再更换')
            SocialIdentity.objects.create(user=user,provider=flow.provider,subject=subject)
    elif ident:user=ident.user
    else:
        user=User(username='sandbox:'+subject,email=subject[:20]+'@sandbox.invalid',first_name=first.strip(),last_name=last.strip(),is_active=True)
        user.set_unusable_password();user.save()
        VisitorState.objects.create(user=user,sandbox=True,registration_source='sandbox:'+flow.provider)
        SocialIdentity.objects.create(user=user,provider=flow.provider,subject=subject)
        Consent.objects.create(user=user,terms=int(data['terms']),privacy=int(data['privacy']))
        from .points import reward
        reward(user, 'registration')
    if disabled(user):raise ValueError('账号已停用')
    if not VisitorState.objects.filter(user=user,sandbox=True).exists():raise ValueError('沙箱禁止登录真实账号')
    flow.delete()
    VisitorState.objects.filter(user=user).update(last_login_method='sandbox:'+flow.provider)
    user.last_login=timezone.now();user.save(update_fields=['last_login'])
    token=secrets.token_urlsafe(32)
    Session.objects.create(digest=digest(token),password_stamp=digest(user.password),user=user,expires=timezone.now()+timedelta(hours=2))
    Audit.objects.create(actor=user.email,action='sandbox-login')
    return {'user':profile(user),'session':token,'sandbox':True}

@transaction.atomic
def unlink(data):
    Session.objects.filter(pk=digest(str(data.get('session','')))).update(expires=F('expires'))
    current=active_session(data.get('session'));p=data.get('provider')
    if p not in PROVIDERS:raise ValueError('渠道无效')
    if not current.user.social_identities.exclude(provider=p).exists():raise ValueError('至少保留一种登录方式')
    current.user.social_identities.filter(provider=p).delete()
    Audit.objects.create(actor=current.user.email,action='sandbox-unlink')
    return {'ok':True,'user':profile(current.user)}
