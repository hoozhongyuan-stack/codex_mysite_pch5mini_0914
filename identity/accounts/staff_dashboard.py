"""Read-only, permission-scoped dashboard aggregates. No visitor records leave here."""
import re
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo
from django.contrib.auth.models import User
from django.db.models import Count
from django.db.models.functions import TruncDate
from .models import SalonEvent, SalonRegistration
from .permissions import effective_permissions
from .staff_auth import current

TZ = ZoneInfo('Asia/Shanghai')


def parse_period(data):
    values = []
    for key in ('start', 'end'):
        value = data.get(key)
        if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
            raise ValueError('统计日期格式无效')
        values.append(date.fromisoformat(value))
    start, end = values
    length = (end-start).days
    if not 1 <= length <= 366:
        raise ValueError('统计范围需要1—366天')
    if data.get('channel', 'all') not in ('all', 'website', 'mini', 'unknown'):
        raise ValueError('统计渠道无效')
    if data.get('dataMode', 'all') not in ('all', 'formal', 'demo'):
        raise ValueError('数据范围无效')
    try:
        previous = start-timedelta(days=length)
    except OverflowError as error:
        raise ValueError('统计日期超出范围') from error
    return start, end, previous


def aggregate(query, field, start, end, previous):
    lower = datetime.combine(previous, time.min, TZ)
    upper = datetime.combine(end, time.min, TZ)
    counts = dict(query.filter(**{field+'__gte': lower, field+'__lt': upper})
                  .annotate(day=TruncDate(field, tzinfo=TZ)).values('day')
                  .annotate(count=Count('pk')).values_list('day', 'count'))
    def days(first, last):
        return [{'date': (first+timedelta(days=i)).isoformat(),
                 'count': counts.get(first+timedelta(days=i), 0)}
                for i in range((last-first).days)]
    daily, previous_daily = days(start, end), days(previous, start)
    return {'available': True, 'current': sum(row['count'] for row in daily),
            'previous': sum(row['count'] for row in previous_daily),
            'daily': daily, 'previousDaily': previous_daily}


def metrics_for(account, data, start, end, previous):
    mode, channel = data.get('dataMode', 'all'), data.get('channel', 'all')
    permissions = effective_permissions(account)
    metrics = {}
    for name, permitted in [('newMembers', account.role == 'owner'),
                            ('validRegistrations', account.role == 'owner' or 'marketing.view' in permissions)]:
        if not permitted:
            metrics[name] = {'available': False, 'reason': 'permission'}
        elif channel != 'all':
            # Registration provider is not an acquisition channel. Salon submissions
            # have no persisted website/mini-program source; never infer from login.
            metrics[name] = {'available': False, 'reason': 'channel_unavailable'}
        else:
            if name == 'newMembers':
                query, field = User.objects.filter(is_staff=False, is_superuser=False), 'date_joined'
                if mode == 'formal': query = query.exclude(visitor_state__sandbox=True)
                if mode == 'demo': query = query.filter(visitor_state__sandbox=True)
            else:
                query, field = SalonRegistration.objects.filter(status='active'), 'created'
                if mode == 'formal':
                    query = query.exclude(event_id__in=SalonEvent.objects.filter(data__test=True).values('pk'))
                if mode == 'demo': query = query.filter(event__data__test=True)
            metrics[name] = aggregate(query, field, start, end, previous)
    return metrics


def dashboard(data):
    account = current(data.get('session', ''))
    if not account: raise PermissionError('请登录管理员账号')
    start, end, previous = parse_period(data)
    return {'timezone': 'Asia/Shanghai',
            'period': {'start': start.isoformat(), 'end': end.isoformat()},
            'previousPeriod': {'start': previous.isoformat(), 'end': start.isoformat()},
            'metrics': metrics_for(account, data, start, end, previous)}
