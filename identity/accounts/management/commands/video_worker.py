"""Run as a private service; originals and encryption keys never enter public storage."""
import json, os, secrets, shutil, subprocess, time, uuid
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from accounts.models import VideoJob, VideoEpisode
from accounts.videos import ROOT

def process_one():
 with transaction.atomic():
  job=VideoJob.objects.filter(status='queued').order_by('updated').first()
  if not job:return False
  if not VideoJob.objects.filter(pk=job.pk,status='queued').update(status='processing',updated=timezone.now()):return True
 version=uuid.uuid4().hex;folder=ROOT/'streams'/version;folder.mkdir(parents=True,mode=0o700)
 try:
  ffmpeg=shutil.which('ffmpeg');ffprobe=shutil.which('ffprobe')
  if not ffmpeg or not ffprobe:raise RuntimeError('服务器未安装 FFmpeg')
  source=ROOT/'originals'/job.source
  probe=subprocess.run([ffprobe,'-v','error','-protocol_whitelist','file,pipe','-show_format','-show_streams','-of','json',str(source)],capture_output=True,timeout=30,check=True)
  info=json.loads(probe.stdout);duration=float(info['format']['duration'])
  if not 0<duration<=14400 or not any(s['codec_type']=='video' for s in info['streams']):raise ValueError('视频时长或格式不支持')
  (folder/'enc.key').write_bytes(secrets.token_bytes(16))
  keyinfo=folder/'keyinfo';keyinfo.write_text('enc.key\n'+str(folder/'enc.key')+'\n')
  subprocess.run([ffmpeg,'-nostdin','-v','error','-protocol_whitelist','file,pipe','-i',str(source),'-map','0:v:0','-map','0:a:0?','-vf',"scale=w='min(1280,iw)':h=-2",'-c:v','libx264','-preset','veryfast','-crf','24','-c:a','aac','-b:a','128k','-f','hls','-hls_time','6','-hls_playlist_type','vod','-hls_key_info_file',str(keyinfo),'-hls_segment_filename',str(folder/'segment%05d.ts'),str(folder/'index.m3u8')],capture_output=True,timeout=7200,check=True)
  keyinfo.unlink(missing_ok=True)
  with transaction.atomic():
   VideoEpisode.objects.filter(pk=job.episode_id).update(version=version,duration=duration)
   VideoJob.objects.filter(pk=job.pk).update(status='ready',error='',updated=timezone.now())
 except Exception:
  shutil.rmtree(folder,ignore_errors=True)
  VideoJob.objects.filter(pk=job.pk).update(status='failed',error='处理失败，请确认视频可播放且服务器已安装 FFmpeg 后重试',updated=timezone.now())
 return True

class Command(BaseCommand):
 help='Private video transcoding worker'
 def add_arguments(self,p):p.add_argument('--once',action='store_true')
 def handle(self,*args,**options):
  # Interrupted jobs become explicitly retryable; do not silently overwrite old versions.
  VideoJob.objects.filter(status='processing',updated__lt=timezone.now()-timedelta(hours=3)).update(status='failed',error='处理超时或进程中断，请重试')
  while True:
   worked=process_one()
   if options['once']:return
   if not worked:time.sleep(3)
