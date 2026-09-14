"""Private reusable sources; bounded sequential uploads, never public originals."""
import uuid
from datetime import timedelta
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from django.http import JsonResponse
from .models import VideoSource,VideoJob,VideoEpisode,Audit
from .videos import ROOT,page,words
MAX_SIZE=1024**3
CHUNK_SIZE=8*1024**2

def validate_size(value):
 if isinstance(value,bool) or not isinstance(value,int) or not 0<value<=MAX_SIZE:raise ValueError('视频大小须在 1 GB 以内且不能为空')
 return value

def serialize(s):return {'id':str(s.pk),'name':s.name,'size':s.size,'folder':s.folder,'status':s.status,'received':s.received}

def associate(episode,source_id,actor):
 with transaction.atomic():
  VideoEpisode.objects.filter(pk=episode.pk).update(status=F('status'))
  source=VideoSource.objects.filter(pk=source_id,status='ready').first()
  if not source or not (ROOT/'originals'/source.source).is_file():raise ValueError('素材不存在或尚未上传完成')
  episode.refresh_from_db()
  if episode.data.get('sourceId')==str(source.pk):return
  if episode.videojob_set.filter(status__in=['queued','processing']).exists():raise ValueError('本集已有处理任务，请稍后更换素材')
  VideoJob.objects.create(episode=episode,source=source.source)
  episode.data={**episode.data,'sourceId':str(source.pk),'sourceName':source.name};episode.save()
  Audit.objects.create(actor=actor,action='video-associate-source')

def action(name,data,staff):
 if name=='library':
  rows=VideoSource.objects.filter(status='ready').order_by('-updated')
  if data.get('q'):rows=rows.filter(name__icontains=words(data,'q',100))
  if data.get('folder')=='unfiled':
   known=data.get('_folders',[])
   rows=rows.exclude(folder__in=known) if known else rows
  elif data.get('folder'):rows=rows.filter(folder=words(data,'folder',80))
  return page(rows,data,serialize)
 if name in ('source-update','source-delete'):
  with transaction.atomic():
   s=VideoSource.objects.select_for_update().get(pk=data['id'],status='ready')
   VideoSource.objects.filter(pk=s.pk).update(received=F('received'))
   if name=='source-delete':
    if VideoJob.objects.filter(source=s.source).exists() or VideoEpisode.objects.filter(data__sourceId=str(s.pk)).exists():raise ValueError('素材已关联视频，不能删除')
    path=ROOT/'originals'/s.source
    s.delete()
    transaction.on_commit(lambda:path.unlink(missing_ok=True))
   else:
    label=words(data,'name',200)
    if not label:raise ValueError('请输入素材名称')
    s.name=label;s.folder=words(data,'folder',80);s.save(update_fields=['name','folder','updated'])
   Audit.objects.create(actor=staff.email,action='video-'+name)
  return {'ok':True}
 if name=='source-init':
  from .views import rate
  rate('source-init:'+str(staff.pk),100)
  size=validate_size(data.get('size'));name=words(data,'name',200)
  if name.lower().split('.')[-1] not in ('mp4','webm','mov'):raise ValueError('支持 MP4 / WebM / MOV')
  with transaction.atomic():
   from .models import StaffAccount
   StaffAccount.objects.filter(pk=staff.pk).update(active=F('active'))
   # Expired partial files are not reusable and are pruned on next upload.
   for old in VideoSource.objects.filter(status='uploading',updated__lt=timezone.now()-timedelta(days=1)):
    (ROOT/'originals'/old.source).unlink(missing_ok=True);old.delete()
   if VideoSource.objects.filter(owner=str(staff.pk),status='uploading').count()>=5:raise ValueError('最多5个未完成上传，请取消或完成后重试')
   s=VideoSource.objects.create(source=uuid.uuid4().hex,name=name,size=size,owner=str(staff.pk),folder=words(data,'folder',80))
  return serialize(s)
 if name=='source-cancel':
  with transaction.atomic():
   s=VideoSource.objects.filter(pk=data.get('id'),owner=str(staff.pk),status='uploading').first()
   if s:(ROOT/'originals'/s.source).unlink(missing_ok=True);s.delete()
  return {'ok':True}
 if name=='source-complete':
  with transaction.atomic():
   s=VideoSource.objects.get(pk=data['id'],owner=str(staff.pk))
   VideoSource.objects.filter(pk=s.pk).update(received=F('received'));s.refresh_from_db()
   path=ROOT/'originals'/s.source
   if s.received!=s.size or not path.is_file() or path.stat().st_size!=s.size:raise ValueError('视频上传不完整')
   s.status='ready';s.save();Audit.objects.create(actor=staff.email,action='video-library-upload')
  return serialize(s)
 raise ValueError('未知素材操作')

def chunk(request):
 from .video_http import authorized
 from .staff_auth import current
 if not authorized(request):return JsonResponse({'error':'Forbidden'},status=403)
 try:
  staff=current(request.headers.get('X-Staff-Session',''))
  if not staff or staff.role!='owner':raise PermissionError('请登录管理员账号')
  blob=request.read(CHUNK_SIZE+1)
  if not 0<len(blob)<=CHUNK_SIZE:raise ValueError('分块大小无效')
  offset=int(request.GET.get('offset','-1'))
  with transaction.atomic():
   s=VideoSource.objects.get(pk=request.GET.get('id'),owner=str(staff.pk),status='uploading')
   VideoSource.objects.filter(pk=s.pk).update(received=F('received'));s.refresh_from_db()
   if offset!=s.received or offset+len(blob)>s.size:raise ValueError('分块位置无效，请重新上传')
   folder=ROOT/'originals';folder.mkdir(exist_ok=True,mode=0o700);path=folder/s.source
   with path.open('r+b' if path.exists() else 'wb') as out:
    out.truncate(s.received);out.seek(s.received);out.write(blob)
   s.received+=len(blob);s.save()
  return JsonResponse(serialize(s))
 except PermissionError as e:return JsonResponse({'error':str(e)},status=403)
 except (ValueError,VideoSource.DoesNotExist):return JsonResponse({'error':'上传分块无效或会话过期，请重试'},status=400)
 except Exception:return JsonResponse({'error':'上传失败，请检查空间并重试'},status=503)
