import json
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from django.test import TestCase, RequestFactory
from django.conf import settings
from .models import VideoSource

class SourcePreviewTests(TestCase):
 def request(self, data, range_header=''):
  return RequestFactory().post('/video-source-preview',json.dumps(data),content_type='application/json',HTTP_AUTHORIZATION='Bearer '+settings.INTERNAL_KEY,HTTP_X_STAFF_SESSION='test',HTTP_RANGE=range_header)
 def test_private_preview_requires_owner_and_internal_gateway(self):
  from .source_preview import preview
  with patch('accounts.staff_auth.current',return_value=None):
   self.assertEqual(preview(self.request({'id':'invalid'})).status_code,403)
  with patch('accounts.staff_auth.current',return_value=SimpleNamespace(role='editor')):
   self.assertEqual(preview(self.request({'id':'invalid'})).status_code,403)
  req=self.request({});req.META['HTTP_AUTHORIZATION']='bad'
  self.assertEqual(preview(req).status_code,403)
 def test_ranges_and_missing_source(self):
  from .source_preview import preview
  with tempfile.TemporaryDirectory() as tmp,patch('accounts.source_preview.ROOT',Path(tmp)),patch('accounts.staff_auth.current',return_value=SimpleNamespace(role='owner')):
   folder=Path(tmp)/'originals';folder.mkdir();(folder/('a'*32)).write_bytes(b'0123456789')
   source=VideoSource.objects.create(name='demo.mp4',source='a'*32,size=10,received=10,status='ready',owner='test')
   response=preview(self.request({'id':str(source.pk)},'bytes=2-5'))
   self.assertEqual(response.status_code,206);self.assertEqual(b''.join(response.streaming_content),b'2345')
   self.assertEqual(response['Content-Range'],'bytes 2-5/10');self.assertEqual(response['Cache-Control'],'private, no-store')
   response=preview(self.request({'id':str(source.pk)},'bytes=-3'))
   self.assertEqual(b''.join(response.streaming_content),b'789')
   self.assertEqual(preview(self.request({'id':str(source.pk)},'bytes=100-')).status_code,416)
   self.assertEqual(preview(self.request({'id':'bad'})).status_code,404)

 def test_mime_uses_file_header_not_editable_name(self):
  from .source_preview import media_type
  self.assertEqual(media_type(b'\x1aE\xdf\xa3rest'),'video/webm')
  self.assertEqual(media_type(b'\0\0\0\x14ftypqt  '),'video/quicktime')
  self.assertEqual(media_type(b'\0\0\0\x14ftypisom'),'video/mp4')
