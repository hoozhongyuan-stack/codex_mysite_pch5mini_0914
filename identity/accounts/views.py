import hashlib
import hmac
import json
import secrets
import time
from datetime import timedelta
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction, IntegrityError
from django.db.models import F,Q
from django.http import JsonResponse
from django.utils import timezone
from django.utils.html import format_html
from .models import Session, Token, Consent, Throttle, Audit, VisitorState
from . import mailer
from .admin_users import disabled, profile, list_users, set_enabled, save_profile, review_phone
from . import social, marketing, marketing_admin

def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()
def rate(key, maximum):
    now = time.time()
    with transaction.atomic():
        obj, _ = Throttle.objects.get_or_create(key=digest(key), defaults={'start':now,'count':0})
        if now-obj.start>900: obj.start, obj.count = now, 0
        obj.count += 1
        obj.save()
        exceeded = obj.count > maximum
    if exceeded: raise ValueError('尝试过于频繁，请 15 分钟后重试')
def password(data,user=None):
    value = data.get('password','')
    if not isinstance(value,str) or len(value)>128: raise ValueError('密码最长 128 个字符')
    validate_password(value,user)
    return value

@transaction.atomic
def mail_token(user,purpose,lang):
    # Acquire SQLite write lock before checking administrative state.
    User.objects.filter(pk=user.pk).update(last_login=F("last_login"))
    user.refresh_from_db()
    if disabled(user): return
    if purpose == "reset" and not user.is_active: return
    if purpose == "verify" and user.is_active: return
    token = secrets.token_urlsafe(32)
    Token.objects.filter(user=user,purpose=purpose).delete()
    Token.objects.create(digest=digest(token),password_stamp=digest(user.password),user=user,purpose=purpose,expires=timezone.now()+timedelta(minutes=30))
    # Fragment prevents token leakage via Referer and ordinary access logs.
    url=f'{settings.PUBLIC_ORIGIN}/{lang}/account#{purpose}={token}'
    subject = 'Verify your email / 验证邮箱' if purpose=='verify' else 'Reset your password / 重置密码'
    try:
        label = '验证邮箱并设置密码 / Verify email' if purpose == 'verify' else '重置密码 / Reset password'
        note = '此链接30分钟内有效，且只能使用一次。若已重新申请，请使用最新邮件；若非本人操作，请忽略。'
        html = format_html(
            '<html><body style="font-family:Arial,sans-serif;line-height:1.7;color:#26382c">'
            '<h2>{}</h2><p>请点击下方按钮继续。Please use the button below to continue.</p>'
            '<p><a href="{}" style="display:inline-block;padding:14px 24px;background:#2e4936;color:#ffffff;text-decoration:underline;border-radius:8px">{}</a></p>'
            '<p>按钮无法打开时，请复制下面完整链接：<br><a href="{}">{}</a></p>'
            '<p>{}<br>This single-use link expires in 30 minutes. If requested again, use the latest email.</p>'
            '<p>本地测试链接需在运行本网站的电脑打开。Localhost links must be opened on the computer running this site.</p>'
            '</body></html>', subject, url, label, url, url, note)
        mailer.send(user.email, subject, f'{subject}\n\n{url}\n\nThis link expires in 30 minutes. {note}\n本地链接请在运行网站的电脑打开。', html=html)
    except Exception:
        Token.objects.filter(digest=digest(token)).delete()
        raise

@transaction.atomic
def consume(data,purpose):
    token = Token.objects.filter(digest=digest(str(data.get('token',''))),purpose=purpose,expires__gt=timezone.now()).first()
    if not token or disabled(token.user) or not hmac.compare_digest(token.password_stamp, digest(token.user.password)):
        raise ValueError('链接无效或已过期，请重新申请')
    claimed, _ = Token.objects.filter(pk=token.pk, expires__gt=timezone.now()).delete()
    if claimed != 1: raise ValueError('链接无效或已使用，请重新申请')
    user = token.user
    if purpose=='reset':
        user.set_password(password(data,user))
        Session.objects.filter(user=user).delete()
    else:
        user.set_password(password(data,user))
        user.is_active = True
    user.save()
    Token.objects.filter(user=user).delete()
    if purpose == 'verify':
        from .points import reward
        reward(user, 'registration')
    return {'ok':True}

def endpoint(request,action):
    if request.method!='POST': return JsonResponse({'error':'Method not allowed'},status=405)
    if not hmac.compare_digest(request.headers.get('Authorization',''), 'Bearer '+settings.INTERNAL_KEY):
        return JsonResponse({'error':'Forbidden'},status=403)
    if len(request.body)>(240000 if 'marketing' in action else 20000): return JsonResponse({'error':'提交过大'},status=413)
    try:
        data=json.loads(request.body)
        if not isinstance(data,dict): raise ValueError('请求格式错误')
        if action in ('mini-status','mini-login','mini-profile','mini-phone'):
            from . import mini
            if action=='mini-login':rate('mini:'+str(data.get('_ip','')),30)
            if action=='mini-status': result=mini.status()
            elif action=='mini-login': result=mini.login(data)
            elif action=='mini-profile': result=mini.save_profile(data)
            else: result=mini.bind_phone(data)
            return JsonResponse(result)
        if action.startswith('admin-points-'):
            from .staff_auth import current
            from .permissions import effective_permissions
            from .points import admin_action
            staff = current(data.pop('_staff', ''))
            sub = action.removeprefix('admin-points-')
            required = 'points.manage' if sub in ('save-rule', 'adjust') else 'points.view'
            if not staff or (staff.role != 'owner' and required not in effective_permissions(staff)):
                raise PermissionError('此账号没有积分模块权限')
            return JsonResponse(admin_action(sub, data, staff))
        if action in ('points-interact', 'points-state', 'points-favorites'):
            from .point_interactions import interact, state, favorites
            user = marketing.visitor_user(data)
            # Read-only state/favorites must not contend with daily reward writes.
            if action == 'points-interact': rate('points:' + str(user.pk), 100)
            return JsonResponse({'points-interact': interact, 'points-state': state, 'points-favorites': favorites}[action](user, data))
        if action == 'points-redemption':
            from .point_orders import redemption
            return JsonResponse(redemption(data))
        if action == 'points-order':
            from .point_orders import reconcile
            return JsonResponse(reconcile(data))
        if action == 'points-form':
            from .points import reward
            from django.utils.dateparse import parse_datetime
            user = User.objects.get(pk=data.get('userId'))
            at = parse_datetime(str(data.get('at', '')))
            if not at or timezone.is_naive(at) or at > timezone.now(): raise ValueError('提交时间无效')
            return JsonResponse({'earned': reward(user, 'form', str(data.get('id', '')), at)})
        if action == 'points-summary':
            from .points import summary
            return JsonResponse(summary(marketing.visitor_user(data), data))
        if action=='staff-directory':
            if not request.headers.get('X-Admin-Actor'):raise PermissionError('Forbidden')
            from .models import StaffAccount
            return JsonResponse({'rows':[{'email':a.email,'role':a.role,'status':'active' if a.active else 'disabled','name':a.username} for a in StaffAccount.objects.all()]})
        if action.startswith('video-'):
            from .videos import public_action
            return JsonResponse(public_action(action.removeprefix('video-'),data))
        if action.startswith('admin-video-'):
            from .videos import admin_action
            from .staff_auth import current
            from .permissions import effective_permissions
            staff=current(data.pop('_staff',''))
            sub=action.removeprefix('admin-video-')
            required = 'videos.view' if sub in ('list', 'detail', 'library') else 'videos.manage'
            if not staff or (staff.role != 'owner' and required not in effective_permissions(staff)):
                raise PermissionError('此账号没有视频模块权限')
            if sub=='library' or sub.startswith('source-'):
                from .video_library import action as library_action
                return JsonResponse(library_action(sub,data,staff))
            return JsonResponse(admin_action(sub,data,staff.email))
        if action.startswith('staff-'):
            from . import staff_auth
            return JsonResponse(staff_auth.action(action.removeprefix('staff-'),data))
        if action.startswith('admin-'):
            actor=request.headers.get('X-Admin-Actor','')
            if not actor: return JsonResponse({'error':'Forbidden'},status=403)
            if action.startswith('admin-marketing-'): return JsonResponse(marketing_admin.admin_action(action.removeprefix('admin-marketing-'),data,actor))
            if action in ('admin-mini','admin-mini-save'):
                from . import mini
                result=mini.status(True) if action=='admin-mini' else mini.save(data,actor)
            elif action=='admin-smtp': result=mailer.public_config()
            elif action=='admin-save-smtp':
                result=mailer.save_config(data)
                Audit.objects.create(actor=actor,action='save-smtp')
            elif action=='admin-test-smtp':
                rate('smtp-test:'+actor,5)
                to=str(data.get('to',''));validate_email(to)
                mailer.send(to,'GEO Studio SMTP 测试','SMTP 配置测试成功。This is a test email from GEO Studio.')
                Audit.objects.create(actor=actor,action='test-smtp')
                result={'ok':True}
            elif action=='admin-social': result=social.config(admin=True)
            elif action=='admin-social-save': result=social.save_config(data,actor)
            elif action=='admin-save-user-profile': result=save_profile(data,actor)
            elif action=='admin-users':
                result=list_users(data)
            elif action=='admin-set-user-enabled': result=set_enabled(data,actor)
            elif action=='admin-review-user-phone': result=review_phone(data,actor)
            else: raise ValueError('未知操作')
            return JsonResponse(result)
        if action.startswith('marketing-'):
            sub=action.removeprefix('marketing-')
            if sub=='asset-public': return JsonResponse({'allowed':any(data.get('assetId') in e.data.get('assetIds',[]) for e in marketing.SalonEvent.objects.filter(Q(data__test=False)|Q(data__test__isnull=True),status__in=['published','closed','cancelled']))})
            if sub=='detail': return JsonResponse({'event':marketing.public_event(data.get('id'))})
            if sub=='list':
                rows=marketing.SalonEvent.objects.filter(Q(data__test=False)|Q(data__test__isnull=True),status__in=['published','closed']).order_by('-created','id')
                q=str(data.get('q','')).strip()[:100]
                if q: rows=rows.filter(Q(title__icontains=q)|Q(data__summaryZh__icontains=q))
                return JsonResponse(marketing_admin.paged(rows,data,marketing.event_dict))
            if sub=='mine':
                user=marketing.visitor_user(data)
                return JsonResponse(marketing_admin.paged(marketing.SalonRegistration.objects.filter(user=user).select_related('event').order_by('-created','id'),data,lambda r:{**marketing.registration_dict(r),'event':marketing.event_dict(r.event)}))
            rate('marketing:'+str(data.get('session','')),100)
            result=marketing.visitor(sub,data)
            if sub in ('register','cancel'): result['mail']=marketing_admin.send_pending(data.get('id'),1)
            return JsonResponse(result)
        if action in ('oauth-start','oauth-finish'):
            from . import oauth
            rate('oauth:'+str(data.get('browser','')),20)
            return JsonResponse(oauth.start(data) if action=='oauth-start' else oauth.finish(data))
        if action=='social-status':return JsonResponse(social.config())
        if action in ('social-start','social-finish','social-unlink'):
            return JsonResponse({'error':'未知操作'},status=404)
        if action=='status': return JsonResponse({'enabled':bool(mailer.read_config().get('enabled'))})
        if action in ('session','logout'):
            hashed=digest(str(data.get('session','')))
            current=Session.objects.select_related('user').filter(digest=hashed,expires__gt=timezone.now(),user__is_active=True).first()
            if current and ((getattr(getattr(current.user,'visitor_state',None),'sandbox',False) and not settings.IDENTITY_SANDBOX) or disabled(current.user) or not hmac.compare_digest(current.password_stamp, digest(current.user.password))):
                current.delete()
                current = None
            if current and action == 'session':
                from .points import reward
                reward(current.user, 'login')
            if action=='logout': Session.objects.filter(digest=hashed).delete()
            return JsonResponse({'user':profile(current.user) if current and action=='session' else None})
        rate('ip:'+str(data.get('_ip','unknown')),50)
        if action in ('verify','reset'):
            return JsonResponse(consume(data,action))
        email=str(data.get('email','')).strip().lower()
        validate_email(email)
        if len(email)>254: raise ValueError('邮箱过长')
        rate('email:'+email,10)
        lang='en' if data.get('lang')=='en' else 'zh'
        user=User.objects.filter(username=digest(email)).first()
        if action=='login':
            value=data.get('password','')
            if not isinstance(value,str) or len(value)>128: raise ValueError('邮箱或密码错误')
            with transaction.atomic():
                # SQLite has no SELECT FOR UPDATE; this write serializes issuance with disable.
                User.objects.filter(username=digest(email)).update(last_login=F('last_login'))
                user=authenticate(username=digest(email),password=value)
                if not user or disabled(user): return JsonResponse({'error':'邮箱或密码错误，邮箱尚未验证或账号已停用'},status=401)
                token=secrets.token_urlsafe(32)
                Session.objects.filter(expires__lt=timezone.now()).delete()
                Session.objects.create(digest=digest(token),password_stamp=digest(user.password),user=user,expires=timezone.now()+timedelta(days=7))
                state,_=VisitorState.objects.get_or_create(user=user,defaults={'registration_source':'email'})
                state.last_login_method='email';state.save(update_fields=['last_login_method'])
                user.last_login=timezone.now();user.save(update_fields=['last_login'])
                return JsonResponse({'user':profile(user),'session':token})
        if user and disabled(user) and action in ('register','forgot'):
            return JsonResponse({'ok':True,'message':'若该邮箱符合条件，邮件将发送至你的收件箱，请检查垃圾邮件。'})
        if action=='register':
            if not data.get('terms') or not data.get('privacy'): raise ValueError('请确认注册和隐私协议')
            first=str(data.get('firstName','')).strip();last=str(data.get('lastName','')).strip()
            if not first or not last or len(first)>100 or len(last)>100: raise ValueError('请填写姓和名（各不超过 100 字）')
            if not mailer.read_config().get('enabled'): raise ValueError('邮件服务尚未启用，请联系管理员')
            if not user:
                with transaction.atomic():
                    user=User(username=digest(email),email=email,first_name=first,last_name=last,is_active=False)
                    user.set_unusable_password();user.save()
                    VisitorState.objects.create(user=user,registration_source='email')
                    Consent.objects.create(user=user,terms=int(data['terms']),privacy=int(data['privacy']))
            if not user.is_active:
                with transaction.atomic():
                    changed = User.objects.filter(pk=user.pk,is_active=False).update(first_name=first,last_name=last)
                    if changed:
                        Consent.objects.create(user=user,terms=int(data['terms']),privacy=int(data['privacy']))
                user.refresh_from_db()
                if not user.is_active: mail_token(user,'verify',lang)
        elif action=='forgot':
            if not mailer.read_config().get('enabled'): raise ValueError('邮件服务尚未启用，请联系管理员')
            if user and user.is_active: mail_token(user,'reset',lang)
        else: raise ValueError('未知操作')
        return JsonResponse({'ok':True,'message':'若该邮箱符合条件，邮件将发送至你的收件箱，请检查垃圾邮件。'})
    except (ValueError,ValidationError) as exc:
        msg='；'.join(exc.messages) if isinstance(exc,ValidationError) else str(exc)
        return JsonResponse({'error':msg},status=400)
    except PermissionError as exc:
        return JsonResponse({'error':str(exc)},status=403)
    except IntegrityError:
        return JsonResponse({'error':'请求冲突，请稍后重试'},status=409)
    except Exception:
        # Never expose SMTP responses, credentials, tokens or database errors.
        return JsonResponse({'error':'服务暂不可用，请检查邮件服务配置或稍后重试'},status=503)
