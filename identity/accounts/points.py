"""Server-owned points ledger. Public clients never choose reward amounts."""
from zoneinfo import ZoneInfo
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import F, Q, Sum
from django.utils import timezone
from .models import PointAccount, PointEntry, PointRule, PointRuleRevision
from .admin_users import disabled

RULES = {
    'registration': '注册验证', 'login': '每日访问', 'form': '提交表单',
    'salon.complete': '活动完成',
    **{f'{kind}.{action}': f'{label} · {verb}'
       for kind, label in [('article', '文章'), ('product', '商品'), ('salon', '沙龙'), ('video', '视频')]
       for action, verb in [('share', '分享操作'), ('like', '点赞'), ('favorite', '收藏')]},
}

@transaction.atomic
def record(user, amount, key, source, target='', reason='', actor='system'):
    User.objects.filter(pk=user.pk).update(last_login=F('last_login'))
    account, _ = PointAccount.objects.get_or_create(user=user)
    PointAccount.objects.filter(pk=account.pk).update(balance=F('balance'))
    if PointEntry.objects.filter(user=user, key=key).exists():
        return 0
    PointAccount.objects.filter(pk=account.pk).update(balance=F('balance') + amount)
    account.refresh_from_db()
    balance = account.balance
    PointEntry.objects.create(user=user, key=key, amount=amount, balance=balance,
                              source=source, target=target, reason=reason, actor=actor)
    return amount

@transaction.atomic
def reward(user, rule_key, target='', now=None):
    User.objects.filter(pk=user.pk).update(last_login=F('last_login'))
    user.refresh_from_db()
    if rule_key not in RULES or not user.is_active or disabled(user):
        return 0
    revisions = PointRuleRevision.objects.filter(key=rule_key)
    rule = revisions.filter(effective_at__lte=now).order_by('-effective_at', '-id').first() if now and revisions.exists() else PointRule.objects.filter(pk=rule_key).first()
    if not rule or not rule.enabled or not rule.amount:
        return 0
    day = (now or timezone.now()).astimezone(ZoneInfo('Asia/Shanghai')).date().isoformat()
    scope = 'once' if rule_key == 'registration' else str(target) if rule_key == 'salon.complete' else day
    return record(user, rule.amount, f'{rule_key}:{scope}', rule_key, str(target)[:100])

def adjust(user, amount, request_id, reason, actor):
    if type(amount) is not int or not amount or abs(amount) > 1000000:
        raise ValueError('调整积分须为非零整数，最多1000000')
    if not isinstance(reason, str) or not reason.strip() or len(reason) > 300:
        raise ValueError('请填写调整原因（最多300字）')
    if not isinstance(request_id, str) or not 1 <= len(request_id) <= 100:
        raise ValueError('请求标识无效')
    return record(user, amount, 'adjust:' + request_id, 'adjust', reason=reason.strip(), actor=actor)

def summary(user, data):
    page = max(1, min(int(data.get('page', 1)), 100000))
    rows = PointEntry.objects.filter(user=user).exclude(source='order.refund-marker')
    day = timezone.now().astimezone(ZoneInfo('Asia/Shanghai')).date().isoformat()
    completed = set(rows.filter(key__endswith=':' + day).values_list('source', flat=True))
    return {'earned': rows.filter(amount__gt=0).aggregate(n=Sum('amount'))['n'] or 0,
            'spent': -(rows.filter(amount__lt=0).aggregate(n=Sum('amount'))['n'] or 0),
            'tasks': [{'key': r.key, 'label': RULES.get(r.key, r.key), 'amount': r.amount, 'done': r.key in completed} for r in PointRule.objects.filter(enabled=True, amount__gt=0).exclude(key__in=['registration', 'salon.complete'])],
            'balance': PointAccount.objects.filter(user=user).values_list('balance', flat=True).first() or 0,
            'sandbox': bool(getattr(getattr(user, 'visitor_state', None), 'sandbox', False)),
            'total': rows.count(), 'page': page, 'pageSize': 20,
            'rows': list(rows[(page-1)*20:page*20].values('id', 'amount', 'balance', 'source', 'target', 'reason', 'created'))}

def admin_action(action, data, staff):
    if action == 'adjust':
        user = User.objects.filter(pk=data.get('userId')).first()
        if not user: raise ValueError('访客不存在')
        return {'ok': True, 'changed': adjust(user, data.get('amount'), data.get('requestId'), data.get('reason'), staff.email)}
    if action in ('ledger', 'accounts'):
        page = max(1, min(int(data.get('page', 1)), 100000))
        q = str(data.get('q', ''))[:100]
        if action == 'ledger':
            rows = PointEntry.objects.select_related('user').exclude(user__visitor_state__sandbox=True)
            if q: rows = rows.filter(Q(user__email__icontains=q) | Q(reason__icontains=q))
            if data.get('userId'): rows = rows.filter(user_id=data['userId'])
            if data.get('source'): rows = rows.filter(source=data['source'])
            fields = ('id', 'user_id', 'user__email', 'amount', 'balance', 'source', 'target', 'reason', 'actor', 'created')
        else:
            rows = User.objects.filter(is_staff=False, is_superuser=False).exclude(visitor_state__sandbox=True).order_by('-id')
            if q: rows = rows.filter(Q(email__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q))
            fields = ('id', 'email', 'first_name', 'last_name', 'pointaccount__balance', 'visitor_state__sandbox')
        return {'total': rows.count(), 'page': page, 'rows': list(rows[(page-1)*20:page*20].values(*fields))}
    if action == 'rules':
        saved = {r.key: r for r in PointRule.objects.all()}
        return {'rows': [{'key': key, 'label': label, 'amount': saved[key].amount if key in saved else 0,
                          'enabled': saved[key].enabled if key in saved else False} for key, label in RULES.items()]}
    if action == 'save-rule':
        key, amount, enabled = data.get('key'), data.get('amount'), data.get('enabled')
        if key not in RULES or type(amount) is not int or not 0 <= amount <= 1000000 or type(enabled) is not bool:
            raise ValueError('积分规则无效')
        from .models import Audit
        with transaction.atomic():
            previous = PointRule.objects.filter(pk=key).first()
            if previous and not PointRuleRevision.objects.filter(key=key).exists():
                PointRuleRevision.objects.create(key=key, amount=previous.amount, enabled=previous.enabled, effective_at=previous.enabled_since)
            PointRuleRevision.objects.create(key=key, amount=amount, enabled=enabled, effective_at=timezone.now())
            values = {'amount': amount, 'enabled': enabled}
            if enabled and (not previous or not previous.enabled): values['enabled_since'] = timezone.now()
            PointRule.objects.update_or_create(key=key, defaults=values)
            Audit.objects.create(actor=staff.email, action='points-rule:' + key)
        return {'ok': True}
    raise ValueError('未知积分操作')
