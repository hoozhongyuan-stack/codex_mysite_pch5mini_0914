import importlib.util
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('uat_content', Path(__file__).resolve().parents[2] / 'scripts/uat-identity-content.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ContentTransferTests(unittest.TestCase):
    def test_only_explicit_content_and_no_owner_or_credentials(self):
        with tempfile.TemporaryDirectory() as temp:
            db = Path(temp) / 'source.sqlite3'
            connection = sqlite3.connect(db)
            connection.executescript('''
              CREATE TABLE accounts_videoseries (id TEXT,data TEXT,status TEXT);
              CREATE TABLE accounts_videoepisode (id TEXT,series_id TEXT,data TEXT,status TEXT);
              CREATE TABLE accounts_videosource (id TEXT,source TEXT,name TEXT,size INT,received INT,folder TEXT,status TEXT,owner TEXT);
              CREATE TABLE accounts_salonevent (id TEXT,title TEXT,status TEXT,data TEXT,checkin_code TEXT);
              CREATE TABLE accounts_pointrule (key TEXT,amount INT,enabled INT);
              CREATE TABLE auth_user (email TEXT,password TEXT);
            ''')
            connection.execute('INSERT INTO auth_user VALUES (?,?)', ('private@example.test','private-hash'))
            connection.execute('INSERT INTO accounts_videoseries VALUES (?,?,?)', ('a'*32,json.dumps({'titleZh':'公开课','secret':'private-secret','owner':'private-owner'}),'published'))
            connection.execute('INSERT INTO accounts_salonevent VALUES (?,?,?,?,?)', ('event','活动','published',json.dumps({'titleZh':'活动','fields':[{'id':'name','type':'text','labelZh':'姓名','required':True,'answers':'private-answer'}]}),'private-checkin'))
            connection.commit();connection.close()
            exported = module.export_content(db, Path(temp))
            text = json.dumps(exported)
            for value in ('private@example.test','private-hash','private-secret','private-owner','private-checkin','private-answer'):
                self.assertNotIn(value,text)
            self.assertEqual(exported['content']['VideoSeries'][0]['data'], {'titleZh':'公开课'})
            self.assertEqual(exported['content']['SalonEvent'][0]['data']['fields'][0]['labelZh'],'姓名')

    def test_legacy_and_library_episode_share_one_original(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);(root/'originals').mkdir()
            (root/'originals'/('c'*32)).write_bytes(b'video')
            db=root/'source.sqlite3';c=sqlite3.connect(db)
            c.executescript('''
              CREATE TABLE accounts_videoseries (id TEXT,data TEXT,status TEXT);
              CREATE TABLE accounts_videoepisode (id TEXT,series_id TEXT,data TEXT,status TEXT);
              CREATE TABLE accounts_videosource (id TEXT,source TEXT,name TEXT,size INT,received INT,folder TEXT,status TEXT,owner TEXT);
              CREATE TABLE accounts_videojob (episode_id TEXT,source TEXT,status TEXT,updated TEXT);
              CREATE TABLE accounts_salonevent (id TEXT,title TEXT,status TEXT,data TEXT);
              CREATE TABLE accounts_pointrule (key TEXT,amount INT,enabled INT);
            ''')
            c.execute('INSERT INTO accounts_videoseries VALUES (?,?,?)',('a'*32,'{}','published'))
            c.execute('INSERT INTO accounts_videosource VALUES (?,?,?,?,?,?,?,?)',('c'*32,'c'*32,'Original',5,5,'','ready','private-owner'))
            c.execute('INSERT INTO accounts_videoepisode VALUES (?,?,?,?)',('b'*32,'a'*32,'{}','published'))
            c.execute('INSERT INTO accounts_videoepisode VALUES (?,?,?,?)',('d'*32,'a'*32,json.dumps({'sourceId':'cccccccc-cccc-cccc-cccc-cccccccccccc'}),'published'))
            c.execute('INSERT INTO accounts_videojob VALUES (?,?,?,?)',('b'*32,'c'*32,'ready','2026-09-13'))
            c.commit();c.close()
            bundle=module.export_content(db,root)
            self.assertEqual(len(bundle['content']['VideoSource']),1)
            self.assertEqual(len(bundle['videoFiles']),1)
            ids={e['data']['sourceId'] for e in bundle['content']['VideoEpisode']}
            self.assertEqual(ids,{'cccccccc-cccc-cccc-cccc-cccccccccccc'})

    def test_rejects_unknown_model_and_unexpected_field(self):
        data = module.empty_bundle()
        data['content']['User'] = []
        with self.assertRaises(ValueError): module.validate_bundle(data)
        data = module.empty_bundle()
        data['content']['PointRule'] = [{'key':'test','amount':1,'enabled':False,'password':'x'}]
        with self.assertRaises(ValueError): module.validate_bundle(data)

    def test_video_paths_cannot_escape(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaises(ValueError): module.video_path(Path(temp), '../secret')

from unittest.mock import patch
from django.test import TestCase, override_settings
from django.db import connection
from accounts.models import VideoSeries,VideoEpisode,VideoSource,VideoJob,SalonEvent,PointRule,StaffAccount

class ContentImportTests(TestCase):
    def test_postgres_import_remaps_private_state_and_refuses_overwrite(self):
        if connection.vendor != 'postgresql': self.skipTest('Requires disposable PostgreSQL')
        with tempfile.TemporaryDirectory() as temp:
            staging=Path(temp)/'staging';target=Path(temp)/'target'
            (staging/'originals').mkdir(parents=True)
            original=staging/'originals'/('c'*32)
            original.write_bytes(b'isolated-video-content')
            bundle=module.empty_bundle()
            bundle['content']['VideoSeries']=[{'id':'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','status':'published','data':{'titleZh':'课程'}}]
            bundle['content']['VideoSource']=[{'id':'cccccccc-cccc-cccc-cccc-cccccccccccc','source':'c'*32,'name':'视频','size':original.stat().st_size,'folder':''}]
            bundle['content']['VideoEpisode']=[{'id':'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','series_id':'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','status':'published','data':{'titleZh':'第一集','sourceId':'cccccccc-cccc-cccc-cccc-cccccccccccc'}}]
            bundle['content']['SalonEvent']=[{'id':'event','title':'活动','status':'published','data':{'titleZh':'活动'}}]
            bundle['content']['PointRule']=[{'key':'share','amount':1,'enabled':True}]
            bundle['videoFiles']=[{'source':'c'*32,'size':original.stat().st_size,'sha256':module.file_digest(original)}]
            with patch.dict('os.environ',{'IDENTITY_ENV':'uat'}),override_settings(DATA_DIR=target):
                result=module.import_content(bundle,staging)
                self.assertEqual(result['VideoEpisode'],1)
                self.assertEqual(VideoEpisode.objects.get().version,'')
                self.assertEqual(VideoJob.objects.get().status,'queued')
                self.assertEqual(VideoSource.objects.get().owner,'')
                self.assertGreater(len(SalonEvent.objects.get().checkin_code),30)
                self.assertEqual(StaffAccount.objects.count(),0)
                self.assertEqual((target/'videos'/'originals'/('c'*32)).read_bytes(),original.read_bytes())
                with self.assertRaisesRegex(ValueError,'empty'):
                    module.import_content(bundle,staging)
