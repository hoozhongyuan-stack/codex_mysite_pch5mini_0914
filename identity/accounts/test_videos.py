from django.test import TestCase
from .models import VideoSeries, VideoEpisode
from .videos import public_action, admin_action, playback

class VideoTests(TestCase):
 def setUp(self):
  self.series=VideoSeries.objects.create(status='published',data={'titleZh':'测试','titleEn':'Test'})
  self.episode=VideoEpisode.objects.create(series=self.series,status='published',version='a'*32,duration=30,data={'preview':True})
  self.context={'browser':'x'*43,'id':str(self.episode.pk)}
 def test_preview_requires_same_browser(self):
  token=public_action('authorize',self.context)['token']
  self.assertEqual(playback({**self.context,'token':token}).episode_id,self.episode.pk)
  with self.assertRaises(PermissionError):playback({**self.context,'token':token,'browser':'y'*43})
 def test_offline_revokes_access(self):
  token=public_action('authorize',self.context)['token']
  self.series.status='archived';self.series.save()
  with self.assertRaises(PermissionError):playback({**self.context,'token':token})
 def test_private_requires_login(self):
  self.episode.data={'preview':False};self.episode.save()
  with self.assertRaises((PermissionError,ValueError)):public_action('authorize',self.context)
 def test_unprocessed_cannot_publish(self):
  with self.assertRaises(ValueError):admin_action('save-episode',{'seriesId':str(self.series.pk),'status':'published','titleZh':'测试','titleEn':'Test'},'test')
 def test_stream_path_rejects_traversal(self):
  from .video_http import safe_file
  with self.assertRaises(ValueError):safe_file('../original.mp4')
 def test_renew_and_release(self):
  data={**self.context,**public_action('authorize',self.context)}
  self.assertTrue(public_action('renew',data)['ok'])
  public_action('release',data)
  with self.assertRaises(PermissionError):playback(data)
 def test_retry_blocked_by_newer_active_job(self):
  from .models import VideoJob
  old=VideoJob.objects.create(episode=self.episode,source='a'*32,status='failed')
  VideoJob.objects.create(episode=self.episode,source='b'*32,status='queued')
  with self.assertRaises(ValueError):admin_action('retry',{'id':str(old.pk)},'test')
  old.refresh_from_db();self.assertEqual(old.status,'failed')
 def test_watch_time_uses_server_elapsed(self):
  from .models import VideoProgress
  from django.utils import timezone
  from datetime import timedelta
  data={**self.context,**public_action('authorize',self.context)}
  row=VideoProgress.objects.get(episode=self.episode)
  VideoProgress.objects.filter(pk=row.pk).update(updated=timezone.now()-timedelta(seconds=2))
  public_action('progress',{**data,'position':30})
  row.refresh_from_db();self.assertLess(row.seconds,3);self.assertFalse(row.completed)
 def test_concurrent_player_limit(self):
  public_action('authorize',self.context)
  second=VideoEpisode.objects.create(series=self.series,status='published',version='b'*32,data={'preview':True})
  third=VideoEpisode.objects.create(series=self.series,status='published',version='c'*32,data={'preview':True})
  public_action('authorize',{**self.context,'id':str(second.pk)})
  with self.assertRaises(PermissionError):public_action('authorize',{**self.context,'id':str(third.pk)})

 def test_series_preserves_rich_body_and_historical_plain_text(self):
  doc={'type':'doc','content':[{'type':'paragraph','content':[{'type':'text','text':'内容'}]}]}
  result=admin_action('save-series',{'titleZh':'系列','bodyZh':doc,'bodyEn':'Legacy text'},'test')
  saved=VideoSeries.objects.get(pk=result['id'])
  self.assertEqual(saved.data['bodyZh'],doc)
  self.assertEqual(saved.data['bodyEn'],'Legacy text')
 def test_series_rejects_invalid_body_container(self):
  with self.assertRaises(ValueError):admin_action('save-series',{'titleZh':'系列','bodyZh':[]},'test')
