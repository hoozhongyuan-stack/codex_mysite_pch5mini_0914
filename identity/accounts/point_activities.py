"""Idempotent settlement of checked-in participants after an event ends."""
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from .models import SalonRegistration, SalonEvent, PointEntry, PointRule
from .points import reward

def settle():
    rule = PointRule.objects.filter(pk='salon.complete', enabled=True, amount__gt=0).first()
    if not rule: return 0
    processed = 0
    # Exclude rewarded registrations before the batch limit so later rows are not starved.
    rewarded = PointEntry.objects.filter(source='salon.complete').values_list('user_id', 'target')
    done = set(rewarded)
    for row in SalonRegistration.objects.filter(status='active', checked_at__isnull=False, event__status__in=['published', 'closed']).select_related('event', 'user').iterator():
        if (row.user_id, row.event_id) in done: continue
        with transaction.atomic():
            SalonEvent.objects.filter(pk=row.event_id).update(title=F('title'))
            row.refresh_from_db(); row.event.refresh_from_db()
            ends = parse_datetime(str(row.event.data.get('ends', '')))
            if not ends or timezone.is_naive(ends) or ends > timezone.now() or ends < rule.enabled_since: continue
            if row.status != 'active' or not row.checked_at or row.event.status not in ('published', 'closed'): continue
            if reward(row.user, 'salon.complete', row.event_id): processed += 1
        if processed >= 100: break
    return processed
