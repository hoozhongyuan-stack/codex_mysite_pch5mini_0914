"""Owner-managed additive permission groups, with explicit legacy-grant editing."""
from uuid import UUID
from django.db import transaction
from .models import (StaffAccount, MarketingGrant, PermissionGroup,
                     StaffPermissionAssignment, PermissionAudit)

CATALOG = [
    ('orders.view', '订单', '查看订单'), ('orders.manage', '订单', '管理订单备注'),
    ('orders.finance', '订单', '审核收款'), ('orders.fulfill', '订单', '履约与物流'),
    ('orders.aftersale', '订单', '售后处理'), ('orders.export', '订单', '导出订单'),
    ('orders.settings', '订单', '交易设置'),
    ('marketing.view', '营销', '查看活动与名单'), ('marketing.manage', '营销', '管理活动与报名'),
    ('marketing.checkin', '营销', '签到与撤销签到'), ('marketing.export', '营销', '导出报名'),
]
KEYS = frozenset(row[0] for row in CATALOG)
EDITOR_BASELINE = ['readContent', 'saveContent', 'deleteContent', 'saveCategory',
                   'deleteCategory', 'saveFolder', 'deleteFolder', 'moveAsset',
                   'renameAsset', 'deleteAsset', 'upload', 'readAssets']


def group_dict(group):
    return {'id': str(group.pk), 'name': group.name, 'permissions': group.permissions,
            'active': group.active, 'revision': group.revision}


def effective_permissions(account):
    if not account.active or account.must_change:
        return []
    if account.role == 'owner':
        return sorted(KEYS)
    groups = PermissionGroup.objects.filter(staffpermissionassignment__account=account, active=True)
    granted = {key for group in groups for key in group.permissions if key in KEYS}
    legacy = MarketingGrant.objects.filter(email=account.email.lower()).first()
    if legacy:
        granted.update('marketing.' + key for key in legacy.permissions if 'marketing.' + key in KEYS)
    return sorted(granted)


def listing():
    from .staff_auth import public
    assignments = {row.account_id: row for row in StaffPermissionAssignment.objects.prefetch_related('groups')}
    members = []
    for account in StaffAccount.objects.order_by('username'):
        assignment = assignments.get(account.pk)
        members.append({**public(account), 'groupIds': [str(g.pk) for g in assignment.groups.all()] if assignment else [],
                        'revision': assignment.revision if assignment else 0,
                        'effectivePermissions': effective_permissions(account)})
    return {'groups': [group_dict(g) for g in PermissionGroup.objects.order_by('name')], 'members': members,
            'catalog': [{'key': key, 'module': module, 'label': label} for key, module, label in CATALOG],
            'editorBaseline': EDITOR_BASELINE,
            'legacyMarketing': list(MarketingGrant.objects.order_by('email').values('email', 'permissions')),
            'logs': list(PermissionAudit.objects.order_by('-id').values('id', 'actor', 'action', 'target', 'before', 'after', 'created')[:200])}


def checked_permissions(value):
    if not isinstance(value, list) or len(value) > len(KEYS) or any(not isinstance(p, str) or p not in KEYS for p in value):
        raise ValueError('权限无效')
    return sorted(set(value))


def save_group(data, actor):
    name = data.get('name')
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80:
        raise ValueError('权限组名称需要1—80个字符')
    permissions = checked_permissions(data.get('permissions'))
    active = data.get('active', True)
    if not isinstance(active, bool):
        raise ValueError('权限组状态无效')
    group = None
    if data.get('id'):
        group = PermissionGroup.objects.select_for_update().filter(pk=UUID(str(data['id']))).first()
        if not group:
            raise ValueError('权限组不存在')
        if data.get('revision') != group.revision:
            raise ValueError('权限组已更新，请刷新后重试')
    before = group_dict(group) if group else {}
    if PermissionGroup.objects.filter(name=name.strip()).exclude(pk=group.pk if group else None).exists():
        raise ValueError('权限组名称已存在')
    group = group or PermissionGroup()
    group.name, group.permissions, group.active = name.strip(), permissions, active
    group.revision = group.revision + 1 if before else 1
    group.save()
    result = group_dict(group)
    PermissionAudit.objects.create(actor=actor.email, action='group-save', target=str(group.pk), before=before, after=result)
    return {'group': result}


def assign_groups(data, actor):
    account = StaffAccount.objects.select_for_update().filter(pk=data.get('accountId')).first()
    if not account:
        raise ValueError('管理员不存在')
    if account.role == 'owner':
        raise ValueError('超级管理员的完整权限不通过权限组修改')
    ids = data.get('groupIds')
    if not isinstance(ids, list) or len(ids) > 100:
        raise ValueError('权限组选择无效')
    ids = {UUID(str(value)) for value in ids}
    groups = list(PermissionGroup.objects.select_for_update().filter(pk__in=ids))
    if len(groups) != len(ids):
        raise ValueError('选择了不存在的权限组')
    assignment, _ = StaffPermissionAssignment.objects.get_or_create(account=account)
    if data.get('revision', 0) != assignment.revision:
        raise ValueError('成员授权已更新，请刷新后重试')
    before = {'groupIds': sorted(str(g.pk) for g in assignment.groups.all()), 'revision': assignment.revision}
    assignment.groups.set(groups)
    assignment.revision += 1
    assignment.save(update_fields=['revision'])
    after = {'groupIds': sorted(str(g.pk) for g in groups), 'revision': assignment.revision}
    PermissionAudit.objects.create(actor=actor.email, action='member-assign', target=account.email, before=before, after=after)
    return {'ok': True, **after}


def save_legacy_marketing(data, actor):
    email = str(data.get('email', '')).strip().lower()
    grant = MarketingGrant.objects.select_for_update().filter(email=email).first()
    if not grant:
        raise ValueError('历史授权不存在；新增授权请使用权限组')
    values = data.get('permissions')
    if not isinstance(values, list) or len(values) > 4 or any(not isinstance(p, str) or 'marketing.' + p not in KEYS for p in values):
        raise ValueError('权限无效')
    if data.get('previous') != grant.permissions:
        raise ValueError('历史授权已更新，请刷新后重试')
    before = list(grant.permissions)
    grant.permissions = sorted(set(values))
    grant.save(update_fields=['permissions'])
    PermissionAudit.objects.create(actor=actor.email, action='legacy-marketing', target=email, before=before, after=grant.permissions)
    return {'ok': True}


@transaction.atomic
def action(name, data):
    from .staff_auth import current
    actor = current(data.get('session', ''))
    if not actor or actor.role != 'owner':
        raise PermissionError('仅超级管理员可管理权限组')
    if name == 'list':
        return listing()
    if name == 'save':
        return save_group(data, actor)
    if name == 'assign':
        return assign_groups(data, actor)
    if name == 'legacy-marketing':
        return save_legacy_marketing(data, actor)
    raise ValueError('未知权限操作')
