import hashlib, secrets, math, json
from datetime import timedelta
from pathlib import Path
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.db.models import Sum, F
from .models import VideoSeries,VideoEpisode,VideoJob,VideoPlayback,VideoProgress,VideoSecurityLog,Audit
from .marketing import visitor_user
ROOT=settings.DATA_DIR/'videos'
ROOT.mkdir(exist_ok=True,mode=0o700)
def digest(s):return hashlib.sha256(str(s).encode()).hexdigest()
def words(data,key,maxlen=1000):
 v=data.get(key,'')
 if not isinstance(v,str) or len(v)>maxlen:raise ValueError('文字长度或格式无效')
 return v.strip()
def rich_body(data,key):
 value=data.get(key,'')
 if isinstance(value,str):return words(data,key,10000)
 if not isinstance(value,dict) or value.get('type')!='doc' or len(json.dumps(value))>1000000:raise ValueError('视频详情格式无效或过大')
 count=0;length=0
 def visit(node,depth=0):
  nonlocal count,length
  count+=1
  if not isinstance(node,dict) or depth>20 or count>6000:raise ValueError('视频详情结构无效或过大')
  if node.get('type')=='text':
   text=node.get('text','')
   if not isinstance(text,str):raise ValueError('视频详情文字格式无效')
   length+=len(text)
  children=node.get('content',[])
  if not isinstance(children,list):raise ValueError('视频详情结构无效')
  for child in children:visit(child,depth+1)
 visit(value)
 if length>10000:raise ValueError('视频详情文字不能超过10000字')
 return value
def viewer(data):
 if data.get('session'):return digest('user:'+str(visitor_user(data).pk))
 browser=data.get('browser','')
 if len(browser)!=43:raise PermissionError('播放会话无效')
 return digest('browser:'+browser)
def page(rows,data,serialize):
 n=max(1,int(data.get('page',1)));total=rows.count();pages=max(1,math.ceil(total/12));n=min(n,pages)
 return {'rows':[serialize(r) for r in rows[(n-1)*12:n*12]],'total':total,'page':n,'pages':pages}
def series_dict(s):return {**s.data,'id':str(s.pk),'status':s.status,'episodes':s.videoepisode_set.filter(status='published').exclude(version='').count()}
def episode_dict(e,admin=False):
 r={**e.data,'id':str(e.pk),'seriesId':str(e.series_id),'status':e.status,'duration':e.duration,'ready':bool(e.version)}
 if admin:r['job']=e.videojob_set.order_by('-updated').values('id','status','error').first()
 return r
def allowed(e,data):
 if e.status!='published' or e.series.status!='published' or not e.version:raise PermissionError('视频未发布 / Video unavailable')
 if not e.data.get('preview',False):visitor_user(data)
def public_action(action,data):
 from .views import rate
 if action=='asset-public':return {'allowed':any(s.data.get('imageId')==data.get('assetId') for s in VideoSeries.objects.filter(status='published')) or any(e.data.get('imageId')==data.get('assetId') for e in VideoEpisode.objects.filter(status='published',series__status='published'))}
 if action=='list':
  rows=VideoSeries.objects.filter(status='published').order_by('-updated')
  q=words(data,'q',100)
  if q:rows=rows.filter(data__titleZh__icontains=q)|rows.filter(data__titleEn__icontains=q)
  if data.get('type'):rows=rows.filter(data__type=data['type'])
  return page(rows,data,series_dict)
 if action=='detail':
  s=VideoSeries.objects.get(pk=data['id'],status='published')
  return {'series':series_dict(s),'episodes':[episode_dict(e) for e in s.videoepisode_set.filter(status='published').exclude(version='').order_by('data__sort','id')]}
 if action=='mine':
  visitor_user(data);v=viewer(data)
  rows=VideoProgress.objects.filter(viewer=v,episode__status='published',episode__series__status='published').select_related('episode').order_by('-updated')
  return page(rows,data,lambda p:{'episode':episode_dict(p.episode),'position':p.position,'completed':p.completed})
 if action=='authorize':
  rate('video-auth:'+data.get('browser',''),50)
  e=VideoEpisode.objects.select_related('series').get(pk=data['id']);allowed(e,data);v=viewer(data)
  with transaction.atomic():
   # serialize admission with SQLite write transaction
   VideoEpisode.objects.filter(pk=e.pk).update(status=F('status'))
   e=VideoEpisode.objects.select_related('series').get(pk=e.pk);allowed(e,data)
   existing=VideoPlayback.objects.filter(viewer=v,expires__gt=timezone.now())
   existing.filter(episode=e).update(expires=timezone.now())
   if existing.count()>=2:raise PermissionError('最多同时播放两个视频 / Too many active players')
   token=secrets.token_urlsafe(32)
   VideoPlayback.objects.create(digest=digest(token),episode=e,viewer=v,version=e.version,expires=timezone.now()+timedelta(minutes=15))
  progress,_=VideoProgress.objects.get_or_create(viewer=v,episode=e)
  progress.save(update_fields=['updated'])
  return {'token':token,'position':progress.position if progress else 0,'watermark':'Viewer '+v[:8],'duration':e.duration}
 if action=='renew':
  row=playback(data);row.expires=timezone.now()+timedelta(minutes=15);row.save(update_fields=['expires']);return {'ok':True}
 if action=='release':
  row=playback(data);row.expires=timezone.now();row.save(update_fields=['expires']);return {'ok':True}
 if action=='progress':
  p=playback(data);e=p.episode;position=float(data.get('position',0))
  if not math.isfinite(position) or not 0<=position<=e.duration+2:raise ValueError('进度无效')
  with transaction.atomic():
   row,created=VideoProgress.objects.get_or_create(viewer=p.viewer,episode=e)
   elapsed=0 if created else max(0,min(20,(timezone.now()-row.updated).total_seconds()))
   row.seconds+=min(elapsed,max(0,position-row.position));row.position=min(position,e.duration)
   row.completed=row.completed or (row.seconds>=e.duration*.9 and e.duration>0);row.save()
  return {'ok':True}
 raise ValueError('未知视频请求')
def playback(data):
 from .views import rate
 rate('video-file:'+data.get('browser',''),3000)
 row=VideoPlayback.objects.select_related('episode__series').filter(pk=digest(data.get('token','')),expires__gt=timezone.now()).first()
 if not row or row.viewer!=viewer(data):raise PermissionError('播放授权无效或已过期 / Playback expired')
 allowed(row.episode,data)
 return row

def admin_action(action,data,actor):
 if action=='list':
  rows=VideoSeries.objects.order_by('-updated')
  if data.get('q'):rows=rows.filter(data__titleZh__icontains=words(data,'q',100))
  if data.get('status'):rows=rows.filter(status=data['status'])
  if data.get('type'):rows=rows.filter(data__type=data['type'])
  return page(rows,data,series_dict)
 if action=='detail':
  s=VideoSeries.objects.get(pk=data['id']);eps=s.videoepisode_set.order_by('data__sort','id')
  return {'series':series_dict(s),'episodes':[episode_dict(e,True) for e in eps],'stats':[{'id':str(e.pk),'plays':e.videoplayback_set.count(),'viewers':e.videoprogress_set.count(),'seconds':e.videoprogress_set.aggregate(n=Sum('seconds'))['n'] or 0,'completed':e.videoprogress_set.filter(completed=True).count()} for e in eps],'security':list(VideoSecurityLog.objects.order_by('-created').values('reason','created')[:30])}
 if action in ('save-series','save-episode'):
  is_series=action=='save-series';model=VideoSeries if is_series else VideoEpisode
  obj=model.objects.filter(pk=data['id']).first() if data.get('id') else None
  if obj is None:
   obj=model(**({'id':data['id']} if data.get('id') else {}))
  status=data.get('status','draft')
  if status not in ('draft','published','archived'):raise ValueError('状态无效')
  fields={k:words(data,k,1000) for k in ['titleZh','titleEn','summaryZh','summaryEn','imageId']}
  for key in ('bodyZh','bodyEn'):fields[key]=rich_body(data,key)
  if not fields['titleZh'] or (status=='published' and not fields['titleEn']):raise ValueError('请填写标题，发布需要中英文标题')
  fields['sort']=max(0,min(9999,int(data.get('sort',0))))
  if is_series:
   fields['type']=data.get('type','other');fields['finished']=data.get('finished') is True
   if fields['type'] not in ('drama','course','other'):raise ValueError('类型无效')
  else:
   if obj._state.adding:obj.series=VideoSeries.objects.get(pk=data['seriesId'])
   fields['preview']=data.get('preview') is True
   if status=='published' and not obj.version:raise ValueError('视频处理完成后才能发布')
  with transaction.atomic():
   if not obj._state.adding:
    model.objects.filter(pk=obj.pk).update(status=F('status'))
    obj.refresh_from_db()
   if not is_series:
    fields={**fields,**{k:obj.data[k] for k in ('sourceId','sourceName') if k in obj.data}}
   obj.data=fields;obj.status=status
   obj.save() if obj._state.adding else obj.save(update_fields=['data','status','updated'])
   if not is_series and data.get('sourceId'):
    from .video_library import associate
    associate(obj,data['sourceId'],actor)
   Audit.objects.create(actor=actor,action='video-'+action)
  return {'id':str(obj.pk)}
 if action=='retry':
  with transaction.atomic():
   job=VideoJob.objects.get(pk=data['id'],status='failed')
   VideoEpisode.objects.filter(pk=job.episode_id).update(status=F('status'))
   if VideoJob.objects.filter(episode_id=job.episode_id,status__in=['queued','processing']).exists():raise ValueError('已有处理任务')
   if VideoJob.objects.filter(episode_id=job.episode_id).order_by('-updated').first().pk!=job.pk:raise ValueError('旧任务已被替代，请重新上传视频')
   job.status='queued';job.error='';job.save()
  Audit.objects.create(actor=actor,action='video-retry');return {'ok':True}
 raise ValueError('未知管理操作')
