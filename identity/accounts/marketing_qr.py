"""PNG rendering adapter. Uses the approved, pinned Segno dependency."""
import base64
from io import BytesIO
from urllib.parse import urlencode
from django.conf import settings
from .models import SalonEvent

def render(data):
    try:import segno
    except ImportError:raise ValueError('二维码生成组件尚未安装，请先完成依赖配置')
    event=SalonEvent.objects.filter(pk=data.get('id')).first()
    if not event:raise ValueError('活动不存在')
    lang='en' if data.get('lang')=='en' else 'zh'
    url=f'{settings.PUBLIC_ORIGIN}/{lang}/events/{event.pk}?'+urlencode({'checkin':event.checkin_code})
    out=BytesIO();segno.make(url,micro=False,error='m').save(out,kind='png',scale=8,border=4)
    return {'png':base64.b64encode(out.getvalue()).decode('ascii'),'url':url}
