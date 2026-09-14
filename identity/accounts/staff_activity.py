"""Read-only, owner-scoped audit feed. Never serialize arbitrary request payloads."""
from datetime import datetime, timedelta, timezone
from django.db.models import Q
from .models import Audit, PermissionAudit, SalonLog

MODULES = {'accounts': ['staff-'], 'settings': ['save-smtp', 'test-smtp', 'admin-mini', 'social-'],
           'marketing': ['marketing-', 'salon-'], 'permissions': ['group-', 'member-', 'legacy-'],
           'content': ['video-'], 'users': ['user-', 'visitor-', 'enable-user', 'disable-user', 'save-user-profile'], 'other': []}
SAFE_FIELDS = {'id', 'name', 'permissions', 'active', 'revision', 'groupIds', 'username', 'role', 'mustChange', 'passwordReset'}


def snapshot(value):
    if isinstance(value, list):
        return [v for v in value[:100] if isinstance(v, str) and len(v) <= 100]
    if not isinstance(value, dict):
        return {}
    return {key: snapshot(val) if isinstance(val, (list, dict)) else val
            for key, val in value.items() if key in SAFE_FIELDS and isinstance(val, (str, bool, int, list, dict))}


def module_for(action):
    return next((module for module, prefixes in MODULES.items() if any(action.startswith(prefix) for prefix in prefixes)), 'other')


def filtered(query, data, account_target=False):
    actor = str(data.get('actor', '')).strip()[:254]
    if actor:
        match = Q(actor__icontains=actor)
        if account_target:
            match |= Q(target__icontains=actor)
        query = query.filter(match)
    if data.get('action'):
        query = query.filter(action=str(data['action'])[:80])
    for key, lookup in [('from', 'created__gte'), ('to', 'created__lt')]:
        if data.get(key):
            value = datetime.strptime(str(data[key]), '%Y-%m-%d').replace(tzinfo=timezone.utc)
            query = query.filter(**{lookup: value + (timedelta(days=1) if key == 'to' else timedelta())})
    return query


def listing(data):
    limit = data.get('limit', 50)
    if not isinstance(limit, int) or not 1 <= limit <= 5000:
        raise ValueError('日志分页无效')
    module = data.get('module', '')
    if module and module not in MODULES and module not in ('orders', 'assets', 'navigation', 'policies', 'submissions', 'geo', 'categories'):
        raise ValueError('日志模块无效')
    rows, total = [], 0
    audit = filtered(Audit.objects.all(), data, True)
    if module:
        prefixes = MODULES.get(module, [])
        condition = Q(pk__in=[])
        for prefix in prefixes:
            condition |= Q(action__startswith=prefix)
        if module == 'other':
            for items in MODULES.values():
                for prefix in items:
                    condition |= Q(action__startswith=prefix)
            audit = audit.exclude(condition)
        else:
            audit = audit.filter(condition)
    total += audit.count()
    for row in audit.order_by('-created', '-id')[:limit]:
        rows.append({'id':'identity:'+str(row.pk), 'actor':row.actor, 'action':row.action, 'target':row.target,
                     'created':row.created, 'module':module_for(row.action), 'result':'recorded', 'before':{}, 'after':{}})
    grants = filtered(PermissionAudit.objects.all(), data, True)
    if module and module != 'permissions' and module != 'accounts':
        grants = grants.none()
    elif module == 'accounts':
        grants = grants.filter(action__startswith='account-')
    elif module == 'permissions':
        grants = grants.exclude(action__startswith='account-')
    total += grants.count()
    for row in grants.order_by('-created', '-id')[:limit]:
        rows.append({'id':'permission:'+str(row.pk), 'actor':row.actor, 'action':row.action, 'target':row.target,
                     'created':row.created, 'module':'accounts' if row.action.startswith('account-') else 'permissions',
                     'result':'success', 'before':snapshot(row.before), 'after':snapshot(row.after)})
    salon = filtered(SalonLog.objects.all(), data)
    if module and module != 'marketing':
        salon = salon.none()
    total += salon.count()
    for row in salon.order_by('-created', '-id')[:limit]:
        rows.append({'id':'salon:'+str(row.pk), 'actor':row.actor, 'action':row.action, 'target':str(row.event_id),
                     'created':row.created, 'module':'marketing', 'result':'recorded', 'before':{}, 'after':{}})
    return {'rows':sorted(rows, key=lambda row:(row['created'],row['id']), reverse=True)[:limit], 'total':total}
