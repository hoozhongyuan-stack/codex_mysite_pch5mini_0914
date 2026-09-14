from django.test import TestCase
from .models import VideoSource,VideoEpisode,VideoSeries
class LibraryTests(TestCase):
 def test_limit(self):
  from .video_library import validate_size,MAX_SIZE
  self.assertEqual(validate_size(MAX_SIZE),1073741824)
  with self.assertRaises(ValueError):validate_size(MAX_SIZE+1)
  with self.assertRaises(ValueError):validate_size(0)
 def test_incomplete_source_cannot_associate(self):
  from .video_library import associate
  s=VideoSource.objects.create(source='a'*32,name='a.mp4',size=20)
  ep=VideoEpisode.objects.create(series=VideoSeries.objects.create())
  with self.assertRaises(ValueError):associate(ep,str(s.pk),'test')

 def test_new_episode_with_cover_and_preallocated_id(self):
  import uuid
  from .videos import admin_action
  series=VideoSeries.objects.create()
  pk=str(uuid.uuid4())
  admin_action('save-episode',{'id':pk,'seriesId':str(series.pk),'titleZh':'测试','imageId':'cover'},'test')
  episode=VideoEpisode.objects.get(pk=pk)
  self.assertEqual(episode.series_id,series.pk)
  self.assertEqual(episode.data['imageId'],'cover')

 def test_chunks_reject_replay_and_complete_before_association(self):
  import tempfile,uuid
  from pathlib import Path
  from types import SimpleNamespace
  from unittest.mock import patch
  from django.test import RequestFactory
  from .video_library import chunk,action,associate
  staff=SimpleNamespace(pk=uuid.uuid4(),role='owner',email='qa@example.invalid')
  s=VideoSource.objects.create(source='b'*32,name='clip.mp4',size=6,owner=str(staff.pk))
  with tempfile.TemporaryDirectory() as tmp, patch('accounts.video_library.ROOT',Path(tmp)),patch('accounts.videos.ROOT',Path(tmp)),patch('accounts.video_http.authorized',return_value=True),patch('accounts.staff_auth.current',return_value=staff):
   def send(offset,body):
    return chunk(RequestFactory().post('/?id='+str(s.pk)+'&offset='+str(offset),body,content_type='application/octet-stream'))
   self.assertEqual(send(0,b'abc').status_code,200)
   self.assertEqual(send(0,b'abc').status_code,400)
   with self.assertRaises(ValueError):action('source-complete',{'id':str(s.pk)},staff)
   self.assertEqual(send(3,b'defg').status_code,400)
   self.assertEqual(send(3,b'def').status_code,200)
   self.assertEqual(action('source-complete',{'id':str(s.pk)},staff)['status'],'ready')
   self.assertEqual((Path(tmp)/'originals'/s.source).read_bytes(),b'abcdef')
   ep=VideoEpisode.objects.create(series=VideoSeries.objects.create())
   associate(ep,str(s.pk),'test')
   self.assertEqual(ep.videojob_set.count(),1)
   associate(ep,str(s.pk),'test')
   self.assertEqual(ep.videojob_set.count(),1)
   with self.assertRaises(ValueError):action('source-delete',{'id':str(s.pk)},staff)

 def test_deleted_folder_is_unfiled(self):
  from .video_library import action
  VideoSource.objects.create(source='c'*32,name='clip.mp4',size=6,status='ready',folder='removed')
  self.assertEqual(action('library',{'folder':'unfiled','_folders':['existing']},None)['total'],1)

 def test_edit_preserves_concurrent_transcode(self):
  from unittest.mock import patch
  from . import videos
  ep=VideoEpisode.objects.create(series=VideoSeries.objects.create())
  original=videos.words
  def words(*args,**kwargs):
   VideoEpisode.objects.filter(pk=ep.pk).update(version='fresh-version',duration=18)
   return original(*args,**kwargs)
  with patch('accounts.videos.words',side_effect=words):
   videos.admin_action('save-episode',{'id':str(ep.pk),'titleZh':'新标题'},'test')
  ep.refresh_from_db()
  self.assertEqual(ep.version,'fresh-version')
  self.assertEqual(ep.duration,18)
