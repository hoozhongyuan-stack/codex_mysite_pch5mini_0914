"""Independent administrator identity; never shares visitor User/session tables."""
import hashlib
import secrets
from datetime import timedelta
from django.conf import settings
from django.contrib.auth.hashers import make_password, check_password
from django.db import transaction
from django.utils import timezone
from .models import StaffAccount, StaffSession, Audit

def digest(v): return hashlib.sha256(v.encode()).hexdigest()
def valid_password(value):
    if not isinstance(value,str) or not 10<=len(value)<=128: raise ValueError('管理员密码需要10—128个字符')
    return value

def current(token, allow_initial=False):
    row=StaffSession.objects.select_related('account').filter(digest=digest(str(token)),expires__gt=timezone.now(),account__active=True).first()
    if not row or row.password_stamp!=digest(row.account.password): return None
    if row.account.must_change and not allow_initial: raise ValueError('请先修改初始密码')
    return row.account

def public(account):
    from .permissions import effective_permissions
    return {'id':str(account.id),'username':account.username,'email':account.email,'role':account.role,'active':account.active,'mustChange':account.must_change,'bootstrap':account.bootstrap,'permissions':effective_permissions(account)}

def action(name,data):
    from .views import rate
    if name == 'dashboard':
        from .staff_dashboard import dashboard
        return dashboard(data)
    if name.startswith('permissions-'):
        from .permissions import action as permissions_action
        return permissions_action(name.removeprefix('permissions-'), data)
    if name=='login':
        username=str(data.get('username','')).strip().lower()
        rate('staff-ip:'+str(data.get('_ip','')),30);rate('staff-login:'+username,10)
        a=StaffAccount.objects.filter(username=username,active=True).first()
        if not a or not check_password(str(data.get('password','')),a.password): raise ValueError('账号或密码不正确')
        token=secrets.token_urlsafe(32)
        StaffSession.objects.create(digest=digest(token),account=a,password_stamp=digest(a.password),expires=timezone.now()+timedelta(hours=8))
        Audit.objects.create(actor=a.email,action='staff-login')
        return {'user':public(a),'session':token}
    if name=='logout':
        StaffSession.objects.filter(digest=digest(str(data.get('session','')))).delete();return {'ok':True}
    a=current(data.get('session',''),allow_initial=True)
    if name=='session':return {'user':public(a) if a else None}
    if not a: raise PermissionError('请登录管理员账号')
    if name=='profile':
        if not check_password(str(data.get('oldPassword','')),a.password):raise ValueError('当前密码不正确')
        new=valid_password(data.get('password',''))
        if check_password(new,a.password):raise ValueError('新密码不能与原密码相同')
        username=str(data.get('username',a.username)).strip().lower()
        if not 3<=len(username)<=80 or not all(c.isalnum() or c in '._-@' for c in username):raise ValueError('用户名格式无效')
        with transaction.atomic():
            a.username=username;a.password=make_password(new);a.must_change=False;a.save()
            StaffSession.objects.filter(account=a).delete()
            Audit.objects.create(actor=a.email,action='staff-change-password')
        return {'ok':True}
    if a.must_change:raise PermissionError('请先修改初始密码')
    if a.role!='owner':raise PermissionError('仅超级管理员可管理子账号')
    if name=='activity':
        from .staff_activity import listing
        return listing(data)
    if name=='list':return {'rows':[public(x) for x in StaffAccount.objects.order_by('username')]}
    if name=='save':
        from django.core.validators import validate_email
        email=str(data.get('email','')).strip().lower();validate_email(email)
        username=str(data.get('username','')).strip().lower()
        if not 3<=len(username)<=80 or not all(c.isalnum() or c in '._-@' for c in username):raise ValueError('用户名格式无效')
        role=data.get('role','editor')
        if role not in ('owner','editor'):raise ValueError('权限无效')
        obj=StaffAccount.objects.filter(id=data.get('id')).first() if data.get('id') else None
        if obj and obj.bootstrap:raise ValueError('初始超级管理员请使用个人设置修改')
        if obj and obj.id==a.id:raise ValueError('不能在此修改自己的账号')
        if not obj:obj=StaffAccount(email=email)
        before = {'username':obj.username,'role':obj.role,'active':obj.active,'mustChange':obj.must_change} if obj.pk else {}
        if obj.pk and obj.email!=email:raise ValueError('邮箱用于关联权限，不支持修改')
        obj.username=username;obj.email=email;obj.role=role;obj.active=data.get('active') is True
        if data.get('password') or not obj.pk:obj.password=make_password(valid_password(data.get('password','')));obj.must_change=True
        with transaction.atomic():
            obj.save();StaffSession.objects.filter(account=obj).delete()
            from .models import PermissionAudit
            PermissionAudit.objects.create(actor=a.email,action='account-save',target=obj.email,before=before,
                after={'username':obj.username,'role':obj.role,'active':obj.active,'mustChange':obj.must_change,'passwordReset':bool(data.get('password'))})
        return {'ok':True}
    raise ValueError('未知管理员操作')
