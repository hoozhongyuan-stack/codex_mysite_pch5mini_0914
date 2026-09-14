"""Private media endpoints. Only the internal gateway may call these."""
import hmac, json, re, uuid
from django.conf import settings
from django.http import JsonResponse, FileResponse, HttpResponse
from django.db import transaction
from django.db.models import F
from .models import VideoEpisode,VideoJob,VideoSecurityLog,Audit
from .videos import ROOT, playback

def safe_file(name):
 if not re.fullmatch(r'(index\.m3u8|enc\.key|segment[0-9]{5,}\.ts)',str(name)):raise ValueError('文件无效')
 return name

def authorized(request):
 return request.method=='POST' and hmac.compare_digest(request.headers.get('Authorization',''),'Bearer '+settings.INTERNAL_KEY)

def upload(request):
 if not authorized(request):return JsonResponse({'error':'Forbidden'},status=403)
 try:
  from .staff_auth import current
  from .views import rate
  staff=current(request.headers.get('X-Staff-Session',''))
  if not staff or staff.role!='owner':raise PermissionError('仅管理员可上传视频')
  rate('video-upload:'+str(staff.pk),30)
  f=request.FILES.get('file')
  if not f or not 0<f.size<=200*1024*1024:raise ValueError('请上传 200 MB 以内的视频')
  if f.name.lower().split('.')[-1] not in ('mp4','webm','mov'):raise ValueError('支持 MP4、WebM、MOV')
  source=uuid.uuid4().hex
  folder=ROOT/'originals';folder.mkdir(exist_ok=True,mode=0o700)
  path=folder/source
  try:
   with transaction.atomic():
    episode=VideoEpisode.objects.get(pk=request.POST.get('episodeId'))
    VideoEpisode.objects.filter(pk=episode.pk).update(status=F('status'))
    if episode.videojob_set.filter(status__in=['queued','processing']).exists():raise ValueError('该集已有处理任务，请等待完成')
    with path.open('wb') as out:
     for chunk in f.chunks():out.write(chunk)
    job=VideoJob.objects.create(episode=episode,source=source)
    Audit.objects.create(actor=staff.email,action='video-upload')
  except Exception:
   path.unlink(missing_ok=True);raise
  return JsonResponse({'id':str(job.pk),'status':'queued'})
 except PermissionError as exc:return JsonResponse({'error':str(exc)},status=403)
 except (ValueError,VideoEpisode.DoesNotExist):return JsonResponse({'error':'视频不存在、文件无效或已有任务正在处理'},status=400)
 except Exception:return JsonResponse({'error':'上传失败，请重试'},status=503)

def file(request):
 if not authorized(request):return JsonResponse({'error':'Forbidden'},status=403)
 try:
  data=json.loads(request.body);row=playback(data);name=safe_file(data.get('file'))
  if not re.fullmatch('[a-f0-9]{32}',row.version):raise ValueError('版本无效')
  path=ROOT/'streams'/row.version/name
  if not path.is_file():raise ValueError('视频文件不存在')
  if name=='index.m3u8':
   # All media and key requests return through the same authenticated gateway.
   lines=[]
   prefix='/api/video/stream?token='+data['token']+'&file='
   for line in path.read_text().splitlines():
    if line.startswith('#EXT-X-KEY:'):line=re.sub(r'URI="[^"]+"','URI="'+prefix+'enc.key"',line)
    elif line and not line.startswith('#'):line=prefix+safe_file(line)
    lines.append(line)
   response=HttpResponse('\n'.join(lines)+'\n',content_type='application/vnd.apple.mpegurl')
  else:response=FileResponse(path.open('rb'),content_type='application/octet-stream' if name=='enc.key' else 'video/mp2t')
  response['Cache-Control']='private, no-store';response['X-Content-Type-Options']='nosniff'
  return response
 except Exception:
  from django.utils import timezone
  from datetime import timedelta
  reason='播放请求被拒绝：授权、状态或文件无效'
  if not VideoSecurityLog.objects.filter(reason=reason,created__gt=timezone.now()-timedelta(minutes=1)).exists():VideoSecurityLog.objects.create(reason=reason)
  VideoSecurityLog.objects.filter(created__lt=timezone.now()-timedelta(days=30)).delete()
  return JsonResponse({'error':'播放授权无效或文件不可用'},status=403)
