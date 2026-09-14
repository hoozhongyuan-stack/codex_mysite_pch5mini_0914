from django.db import transaction
from django.contrib.auth.models import User
from django.db.models import F
from .models import ContentInteraction
from .points import reward

@transaction.atomic
def interact(user, data):
    kind, target, action = data.get('kind'), data.get('id'), data.get('action')
    if kind not in ('article', 'product', 'salon', 'video') or action not in ('like', 'favorite', 'share'):
        raise ValueError('互动类型无效')
    if not isinstance(target, str) or not 1 <= len(target) <= 100 or type(data.get('active')) is not bool:
        raise ValueError('互动参数无效')
    User.objects.filter(pk=user.pk).update(last_login=F('last_login'))
    if kind == 'salon':
        from .marketing import public_event
        event = public_event(target)
        data = {**data, '_title': event.get('titleZh', ''), '_path': '/zh/events/' + target}
    if kind == 'video':
        from .models import VideoEpisode
        episode = VideoEpisode.objects.filter(pk=target, status='published', series__status='published').exclude(version='').first()
        if not episode: raise ValueError('视频尚未发布')
        data = {**data, '_title': episode.data.get('titleZh', ''), '_path': '/zh/videos/' + str(episode.series_id) + '?episode=' + str(episode.pk)}
    active = data['active']
    ContentInteraction.objects.update_or_create(user=user, kind=kind, target=target, action=action,
        defaults={'active': active, 'title': str(data.get('_title', ''))[:200], 'path': str(data.get('_path', ''))[:300]})
    earned = reward(user, kind + '.' + action, target) if active else 0
    return {'ok': True, 'earned': earned, 'active': active}

def state(user, data):
    return {'actions': list(ContentInteraction.objects.filter(user=user, kind=data.get('kind'), target=data.get('id'), active=True).values_list('action', flat=True))}

def favorites(user, data):
    page = max(1, min(int(data.get('page', 1)), 100000))
    rows = ContentInteraction.objects.filter(user=user, action='favorite', active=True).order_by('-updated', '-id')
    if data.get('kind'): rows = rows.filter(kind=data['kind'])
    return {'total': rows.count(), 'page': page, 'rows': list(rows[(page-1)*20:page*20].values('kind', 'target', 'title', 'path'))}
