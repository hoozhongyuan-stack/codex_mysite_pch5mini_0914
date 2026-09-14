"""Receives trusted CMS order snapshots; no public amount-setting endpoint."""
from django.db import transaction
from django.db.models import F
from django.contrib.auth.models import User
from .models import PointEntry
from .points import record
from .admin_users import disabled

@transaction.atomic
def reconcile(data):
    key, amount, phase = data.get('id'), data.get('points'), data.get('phase')
    if not isinstance(key, str) or not 1 <= len(key) <= 80 or type(amount) is not int or not 0 <= amount <= 30000000000 or phase not in ('completed', 'refunded'):
        raise ValueError('订单积分凭据无效')
    User.objects.filter(pk=data.get('userId')).update(last_login=F('last_login'))
    user = User.objects.get(pk=data.get('userId'))
    user.refresh_from_db()
    refund_key, award_key = 'order-refund:' + key, 'order-complete:' + key
    if 'refundedPoints' in data:
        from django.db.models import Sum
        refunded = data['refundedPoints']
        if type(refunded) is not int or not 0 <= refunded <= amount: raise ValueError('退款积分无效')
        # A durable marker preserves refunds arriving before completion; max handles stale retries.
        marker = max([0]+[int(x) for x in PointEntry.objects.filter(user=user,source='order.refund-marker',target=key).values_list('reason',flat=True)])
        effective=max(marker,refunded)
        if refunded>marker:
            record(user,0,'order-refund-marker:'+key+':'+str(refunded),'order.refund-marker',key,str(refunded))
            # Marker uses reason for business count; ledger balance remains actual account balance.
        markers=PointEntry.objects.filter(user=user,source='order.refund-marker',target=key).values_list('reason',flat=True)
        effective=max([refunded]+[int(x) for x in markers])
        original=PointEntry.objects.filter(user=user,key=award_key).first()
        if data.get('completed') and not original:
            if not user.is_active or disabled(user): raise ValueError('访客停用，积分暂待处理')
            record(user,amount,award_key,'order.complete',key,'订单完成赠分')
            original=PointEntry.objects.get(user=user,key=award_key)
        if original:
            if original.amount!=amount: raise ValueError('购买奖励与原订单快照不一致')
            reversed_amount=-(PointEntry.objects.filter(user=user,source='order.refund',target=key).aggregate(n=Sum('amount'))['n'] or 0)
            if effective>reversed_amount: record(user,-(effective-reversed_amount),refund_key+':'+str(effective),'order.refund',key,'按退款商品数量冲正')
        return {'ok':True}
    original = PointEntry.objects.filter(user=user, key=award_key).first()
    if original and original.amount != amount: raise ValueError('购买奖励与原订单快照不一致')
    if PointEntry.objects.filter(user=user, key=refund_key).exists(): return {'ok': True}
    if phase == 'refunded':
        prior = PointEntry.objects.filter(user=user, key=award_key).first()
        record(user, -prior.amount if prior else 0, refund_key, 'order.refund', key, '购买赠分退款冲正')
    elif user.is_active and not disabled(user):
        record(user, amount, award_key, 'order.complete', key, '订单完成赠分')
    else: raise ValueError('访客停用，积分暂待处理')
    return {'ok': True}

@transaction.atomic
def redemption(data):
    from .models import PointAccount
    User.objects.filter(pk=data.get('userId')).update(last_login=F('last_login'))
    user = User.objects.get(pk=data.get('userId'))
    key, amount, action = data.get('id'), data.get('points'), data.get('action')
    if not isinstance(key, str) or not 1 <= len(key) <= 80 or type(amount) is not int or not 1 <= amount <= 30000000000 or action not in ('debit','refund','status'):
        raise ValueError('兑换参数无效')
    debit_key, refund_key = 'redeem:' + key, 'redeem-refund:' + key
    debit = PointEntry.objects.filter(user=user,key=debit_key).first()
    refunded = PointEntry.objects.filter(user=user,key=refund_key).exists()
    if debit and debit.amount != -amount: raise ValueError('兑换金额与原记录不一致')
    if action == 'status': return {'debited':bool(debit),'refunded':refunded}
    if action == 'refund':
        record(user, amount if debit else 0, refund_key, 'redemption.refund',key,'积分兑换退回')
        return {'ok':True}
    if refunded: raise ValueError('兑换已取消')
    if debit: return {'ok':True}
    user.refresh_from_db()
    if not user.is_active or disabled(user): raise ValueError('访客账号不可用')
    balance = PointAccount.objects.filter(user=user).values_list('balance',flat=True).first() or 0
    if balance < amount: raise ValueError('积分不足 / Insufficient points')
    record(user,-amount,debit_key,'redemption.debit',key,'积分兑换')
    return {'ok':True}
