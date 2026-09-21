"""Server-side OAuth; provider tokens are ephemeral and never returned to clients."""
import base64, hashlib, hmac, json, secrets, re
from datetime import timedelta
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.contrib.auth.models import User
from .models import SocialConfig, SocialIdentity, OAuthFlow, VisitorState, Session, Consent
from .social import digest, PROVIDERS
from .admin_users import profile, disabled


def cipher():
    from cryptography.fernet import Fernet
    key = hashlib.sha256(('oauth-secrets-v1:' + settings.SECRET_KEY).encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def callback(provider):
    return f'{settings.PUBLIC_ORIGIN}/api/social/callback/{provider}'


def configured(c):
    return bool(c and c.client_id and c.secret_encrypted)


def get_config(provider):
    c = SocialConfig.objects.filter(pk=provider, real_enabled=True).first()
    if provider not in PROVIDERS or not configured(c):
        raise ValueError('快捷登录渠道未启用或配置不完整')
    return c


def request_json(url, data=None, bearer=None, json_body=False):
    headers = {'Accept': 'application/json'}
    if bearer: headers['Authorization'] = 'Bearer ' + bearer
    body = (json.dumps(data).encode() if json_body else urlencode(data).encode()) if data is not None else None
    if json_body and body is not None: headers['Content-Type'] = 'application/json'
    try:
        with urlopen(Request(url, data=body, headers=headers), timeout=15) as response:
            result = json.loads(response.read(100000))
        if not isinstance(result, dict) or result.get('error') or result.get('errcode'):
            raise ValueError('平台授权失败，请重新登录')
        return result
    except Exception:
        raise ValueError('平台授权失败，请检查渠道配置或稍后重试') from None


def real_session(raw):
    session=Session.objects.select_related('user').filter(pk=digest(str(raw or '')),expires__gt=timezone.now(),user__is_active=True).first()
    if not session or disabled(session.user) or not hmac.compare_digest(session.password_stamp,digest(session.user.password)) or VisitorState.objects.filter(user=session.user,sandbox=True).exists():
        raise ValueError('请先登录有效的正式账号再绑定')
    return session


def safe_return(value):
    if not isinstance(value,str) or len(value)>1000 or re.search(r'[\\\x00-\x20]',value): return ''
    if not re.match(r'^/(zh|en)/(events|orders|cart|products|articles|videos|points-shop|account)(/|\?|$)',value): return ''
    path=value.split('?')[0]
    if '%' in path or any(x in ('.','..') for x in path.split('/')): return ''
    return value


def start(data):
    p = data.get('provider'); c = get_config(p)
    browser = data.get('browser', '')
    if not isinstance(browser, str) or len(browser) != 43: raise ValueError('登录会话无效')
    if not data.get('terms') or not data.get('privacy'): raise ValueError('请同意注册及隐私协议')
    binding=real_session(data.get('session')).pk if data.get('intent')=='link' else ''
    if data.get('session') and not binding: raise ValueError('请先退出当前账号或选择绑定渠道')
    state = secrets.token_urlsafe(32); verifier = secrets.token_urlsafe(48)
    lang = 'en' if data.get('lang') == 'en' else 'zh'
    OAuthFlow.objects.filter(expires__lt=timezone.now()).delete()
    OAuthFlow.objects.create(digest=digest(state), browser=digest(browser), provider=p,
        verifier=verifier, binding_session=binding, return_to=safe_return(data.get('returnTo')) if not binding else '', terms=int(data['terms']), privacy=int(data['privacy']), lang=lang,
        expires=timezone.now()+timedelta(minutes=5))
    params = {'client_id': c.client_id, 'redirect_uri': callback(p), 'response_type': 'code', 'state': state}
    if p == 'google':
        endpoint = 'https://accounts.google.com/o/oauth2/v2/auth'
        params.update(scope='openid email profile', code_challenge=base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('='), code_challenge_method='S256')
    elif p == 'facebook':
        endpoint = 'https://www.facebook.com/v23.0/dialog/oauth'; params.update(scope='public_profile,email')
    else:
        endpoint = 'https://open.weixin.qq.com/connect/qrconnect'
        params.pop('client_id'); params.update(appid=c.client_id, scope='snsapi_login')
    return {'url': endpoint + '?' + urlencode(params), 'real': True}


def provider_identity(flow, code, c):
    secret = cipher().decrypt(c.secret_encrypted.encode()).decode()
    common = {'client_id': c.client_id, 'client_secret': secret, 'redirect_uri': callback(flow.provider), 'code': code}
    if flow.provider == 'google':
        token = request_json('https://oauth2.googleapis.com/token', {**common, 'grant_type': 'authorization_code', 'code_verifier': flow.verifier})
        info = request_json('https://openidconnect.googleapis.com/v1/userinfo', bearer=token.get('access_token', ''))
        subject = info.get('sub'); email = info.get('email', '') if info.get('email_verified') is True else ''
    elif flow.provider == 'facebook':
        token = request_json('https://graph.facebook.com/v23.0/oauth/access_token', common)
        access = token.get('access_token', '')
        proof = hmac.new(secret.encode(), access.encode(), hashlib.sha256).hexdigest()
        info = request_json('https://graph.facebook.com/v23.0/me?' + urlencode({'fields': 'id,name,first_name,last_name,email', 'appsecret_proof': proof}), bearer=access)
        subject = info.get('id'); email = ''  # Do not treat Facebook email as locally verified.
    else:
        token = request_json('https://api.weixin.qq.com/sns/oauth2/access_token?' + urlencode({'appid': c.client_id, 'secret': secret, 'code': code, 'grant_type': 'authorization_code'}))
        info = request_json('https://api.weixin.qq.com/sns/userinfo?' + urlencode({'access_token': token.get('access_token',''), 'openid': token.get('openid','')}))
        subject = info.get('openid'); email = ''
        if subject != token.get('openid'): raise ValueError('平台身份不匹配')
    if not isinstance(subject, str) or not subject or len(subject)>255: raise ValueError('平台未返回有效身份')
    return {'subject': digest('real:' + c.client_id + ':' + subject), 'email': email,
        'first': str(info.get('given_name') or info.get('first_name') or info.get('nickname') or info.get('name') or flow.provider)[:100],
        'last': str(info.get('family_name') or info.get('last_name') or '')[:100]}


def finish(data):
    key = digest(str(data.get('state','')))
    with transaction.atomic():
        flow = OAuthFlow.objects.filter(pk=key, expires__gt=timezone.now()).first()
        if not flow or not hmac.compare_digest(flow.browser, digest(str(data.get('browser','')))):
            raise ValueError('授权已过期或浏览器会话不匹配，请重新登录')
        if flow.provider != data.get('provider'): raise ValueError('授权渠道不匹配')
        c = get_config(flow.provider)
        # Claim once before network access; failed provider calls require a fresh flow.
        claimed = OAuthFlow.objects.filter(pk=key).delete()[0]
        if not claimed: raise ValueError('授权已使用')
    code = data.get('code','')
    if not isinstance(code,str) or not 1<=len(code)<=4096: raise ValueError('授权已取消或无效')
    identity = provider_identity(flow, code, c)
    with transaction.atomic():
        get_config(flow.provider)  # Revocation during provider request takes effect.
        ident = SocialIdentity.objects.filter(provider=flow.provider, subject=identity['subject']).select_related('user').first()
        if flow.binding_session:
            current=real_session(data.get('session'))
            if current.pk!=flow.binding_session: raise ValueError('登录状态已变化，请重新绑定')
            user=current.user
            if ident and ident.user_id!=user.pk: raise ValueError('此平台身份已属于另一账号，不能合并')
            if not ident:
                if user.social_identities.filter(provider=flow.provider).exists(): raise ValueError('此账号已绑定该渠道')
                SocialIdentity.objects.create(user=user,provider=flow.provider,subject=identity['subject'])
        elif ident: user = ident.user
        else:
            # Never merge accounts on matching email. Require separately verified binding.
            if identity['email'] and User.objects.filter(email__iexact=identity['email']).exists():
                raise ValueError('此邮箱已有账号，请使用原登录方式；暂不自动合并账号')
            user = User(username='oauth:'+flow.provider+':'+identity['subject'], email=identity['email'], first_name=identity['first'], last_name=identity['last'])
            user.set_unusable_password(); user.save()
            VisitorState.objects.create(user=user, registration_source=flow.provider)
            SocialIdentity.objects.create(user=user, provider=flow.provider, subject=identity['subject'])
            Consent.objects.create(user=user, terms=flow.terms, privacy=flow.privacy)
            from .points import reward
            reward(user, 'registration')
        if not user.is_active or disabled(user) or VisitorState.objects.filter(user=user,sandbox=True).exists(): raise ValueError('账号不可用')
        VisitorState.objects.filter(user=user).update(last_login_method=flow.provider)
        user.last_login=timezone.now(); user.save(update_fields=['last_login'])
        token=secrets.token_urlsafe(32)
        Session.objects.create(digest=digest(token),password_stamp=digest(user.password),user=user,expires=timezone.now()+timedelta(hours=2))
        return {'user':profile(user),'session':token,'lang':flow.lang,'returnTo':flow.return_to,'linked':bool(flow.binding_session)}
