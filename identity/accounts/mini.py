"""Mini-program login: server-exchanged identity, never trust client OpenID."""
import re, secrets
from datetime import timedelta
from urllib.parse import urlencode
from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone
from .models import SocialConfig, SocialIdentity, VisitorState, Consent, Session, Audit
from .oauth import cipher, request_json, real_session
from .social import digest
from .admin_users import profile, disabled
PROVIDER = 'wechat-mini'
def status(admin=False):
 c=SocialConfig.objects.filter(pk=PROVIDER).first()
 result={'enabled':bool(c and c.real_enabled and c.client_id and c.secret_encrypted)}
 if admin: result.update(clientId=c.client_id if c else '',hasSecret=bool(c and c.secret_encrypted))
 return result
def save(data,actor):
 appid=str(data.get('clientId','')).strip()
 if appid and not re.fullmatch(r'wx[a-f0-9]{16}',appid): raise ValueError('小程序 AppID 格式无效')
 secret=data.get('secret','')
 if not isinstance(secret,str) or len(secret)>256: raise ValueError('密钥格式无效')
 c=SocialConfig.objects.filter(pk=PROVIDER).first() or SocialConfig(provider=PROVIDER)
 if appid!=c.client_id and not secret: c.secret_encrypted=''
 c.client_id=appid
 if secret:c.secret_encrypted=cipher().encrypt(secret.encode()).decode()
 c.real_enabled=data.get('enabled') is True
 if c.real_enabled and not (appid and c.secret_encrypted):raise ValueError('请先配置 AppID 和 AppSecret')
 c.save();Audit.objects.create(actor=actor,action='mini-config')
 return status(True)
def login(data):
 from .views import rate
 c=SocialConfig.objects.filter(pk=PROVIDER,real_enabled=True).first()
 if not c or not c.client_id or not c.secret_encrypted:raise ValueError('微信小程序登录未启用')
 if not isinstance(data.get('terms'),int) or not isinstance(data.get('privacy'),int) or data['terms']<1 or data['privacy']<1:raise ValueError('请先阅读并同意协议')
 code=data.get('code')
 if not isinstance(code,str) or not 1<=len(code)<=512:raise ValueError('登录凭证无效')
 binding=real_session(data['session']) if data.get('intent')=='link' else None
 if data.get('session') and not binding:raise ValueError('已登录账号请使用绑定微信入口')
 rate('mini-code:'+code,1)
 result=request_json('https://api.weixin.qq.com/sns/jscode2session?'+urlencode({'appid':c.client_id,'secret':cipher().decrypt(c.secret_encrypted.encode()).decode(),'js_code':code,'grant_type':'authorization_code'}))
 openid=result.get('openid')
 if not isinstance(openid,str) or not 1<=len(openid)<=128:raise ValueError('微信身份校验失败')
 subject=digest('real:'+c.client_id+':'+openid)
 with transaction.atomic():
  current=SocialConfig.objects.get(pk=PROVIDER)
  if not current.real_enabled or current.client_id!=c.client_id or current.secret_encrypted!=c.secret_encrypted:raise ValueError('登录配置已更新，请重试')
  ident=SocialIdentity.objects.filter(provider=PROVIDER,subject=subject).select_related('user').first()
  if binding:
   user=real_session(data['session']).user
   if ident and ident.user_id!=user.pk:raise ValueError('该微信已绑定其他账号，不能自动合并')
   if not ident:
    if SocialIdentity.objects.filter(provider=PROVIDER,user=user).exists():raise ValueError('此账号已绑定其他微信')
    SocialIdentity.objects.create(provider=PROVIDER,subject=subject,user=user)
  elif ident:user=ident.user
  else:
   user=User(username='mini:'+subject,first_name='微信用户');user.set_unusable_password();user.save()
   VisitorState.objects.create(user=user,registration_source=PROVIDER)
   Consent.objects.create(user=user,terms=data['terms'],privacy=data['privacy'])
   SocialIdentity.objects.create(provider=PROVIDER,subject=subject,user=user)
   from .points import reward
   reward(user,'registration')
  if not user.is_active or disabled(user) or VisitorState.objects.filter(user=user,sandbox=True).exists():raise ValueError('账号不可用')
  VisitorState.objects.filter(user=user).update(last_login_method=PROVIDER)
  user.last_login=timezone.now();user.save(update_fields=['last_login'])
  token=secrets.token_urlsafe(32)
  Session.objects.create(digest=digest(token),password_stamp=digest(user.password),user=user,expires=timezone.now()+timedelta(hours=2))
  from .points import reward
  reward(user,'login')
  return {'user':profile(user),'session':token,'linked':bool(binding)}
