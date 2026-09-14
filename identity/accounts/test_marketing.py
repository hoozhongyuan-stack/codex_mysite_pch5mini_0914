from datetime import timedelta
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from .models import Session, VisitorState
from .social import digest
from . import marketing

class MarketingTests(TestCase):
    def setUp(self):
        self.user=User.objects.create_user('event-user',email='event@example.test',password='example-pass')
        VisitorState.objects.create(user=self.user,registration_source='email')
        Session.objects.create(digest=digest('session'),user=self.user,password_stamp=digest(self.user.password),expires=timezone.now()+timedelta(days=1))
        now=timezone.now()
        self.data={'titleZh':'沙龙测试','titleEn':'Salon test','starts':(now+timedelta(hours=1)).isoformat(),'ends':(now+timedelta(hours=3)).isoformat(),'registrationStarts':(now-timedelta(days=1)).isoformat(),'registrationEnds':(now+timedelta(minutes=30)).isoformat(),'checkinStarts':(now-timedelta(minutes=10)).isoformat(),'checkinEnds':(now+timedelta(hours=2)).isoformat(),'cancelEnds':(now+timedelta(minutes=20)).isoformat(),'timezone':'Asia/Shanghai','capacity':1,'allowCancel':True,'test':False,'status':'published','fields':[]}
        self.event=marketing.save_event(self.data,'owner')['event']
    def call(self,action,**data):
        return marketing.visitor(action,{'id':self.event['id'],'session':'session',**data})
    def test_only_registered_can_checkin_and_repeat_preserves_time(self):
        with self.assertRaises(ValueError):self.call('checkin',code=self.event['checkinCode'])
        a=self.call('register',answers={},consent=True)['registration']
        b=self.call('register',answers={},consent=True)['registration']
        self.assertEqual(a['id'],b['id'])
        first=self.call('checkin',code=self.event['checkinCode'])['registration']
        second=self.call('checkin',code=self.event['checkinCode'])['registration']
        self.assertEqual(first['checkedAt'],second['checkedAt'])
        with self.assertRaises(ValueError):self.call('cancel')
    def test_cancel_releases_capacity(self):
        self.call('register',answers={},consent=True)
        self.call('cancel')
        self.assertEqual(marketing.statistics(self.event['id'])['valid'],0)
        self.call('register',answers={},consent=True)
        self.assertEqual(marketing.statistics(self.event['id'])['total'],1)
    def test_capacity_and_disabled_account(self):
        self.call('register',answers={},consent=True)
        other=User.objects.create_user('other',email='other@example.test',password='abc123')
        Session.objects.create(digest=digest('other'),user=other,password_stamp=digest(other.password),expires=timezone.now()+timedelta(days=1))
        with self.assertRaises(ValueError):marketing.visitor('register',{'id':self.event['id'],'session':'other','answers':{},'consent':True})
        VisitorState.objects.filter(user=self.user).update(disabled=True)
        with self.assertRaises(ValueError):self.call('checkin',code=self.event['checkinCode'])
    def test_status_and_code_and_window_guards(self):
        self.call('register',answers={},consent=True)
        with self.assertRaises(ValueError):self.call('checkin',code='wrong')
        marketing.save_event({**self.data,'id':self.event['id'],'status':'cancelled'},'owner')
        with self.assertRaises(ValueError):self.call('checkin',code=self.event['checkinCode'])
    def test_private_public_projection(self):
        self.call('register',answers={},consent=True)
        record=marketing.public_event(self.event['id'])
        self.assertNotIn('checkinCode',record)
        self.assertNotIn('registrations',record)
    def test_invalid_event(self):
        with self.assertRaises(ValueError):marketing.save_event({**self.data,'capacity':-1},'owner')
        with self.assertRaises(ValueError):marketing.save_event({**self.data,'timezone':'invalid'},'owner')
    def test_private_fields_never_in_visitor_response(self):
        from .models import SalonRegistration
        self.call('register',answers={},consent=True)
        SalonRegistration.objects.filter(event_id=self.event['id']).update(note='internal',checkin_actor='admin@example.test')
        public=self.call('registration')['registration']
        self.assertNotIn('note',public);self.assertNotIn('checkinActor',public)
    def test_sandbox_isolation(self):
        VisitorState.objects.filter(user=self.user).update(sandbox=True)
        with self.assertRaises(ValueError):self.call('register',answers={},consent=True)
    def test_mail_failure_retains_registration(self):
        from unittest.mock import patch
        from .marketing_admin import send_pending
        from .models import SalonMail
        self.call('register',answers={},consent=True)
        with patch('accounts.mailer.send',side_effect=ValueError('smtp unavailable')):send_pending(self.event['id'])
        self.assertEqual(self.call('registration')['registration']['status'],'active')
        self.assertEqual(SalonMail.objects.get().status,'failed')
    def test_required_field_and_invalid_email(self):
        fields=[{'id':'email','type':'email','labelZh':'邮箱','labelEn':'Email','required':True}]
        marketing.save_event({**self.data,'id':self.event['id'],'fields':fields},'owner')
        with self.assertRaises(ValueError):self.call('register',answers={},consent=True)
        from django.core.exceptions import ValidationError
        with self.assertRaises(ValidationError):self.call('register',answers={'email':'bad'},consent=True)
    def test_manual_checkin_reason_and_logs(self):
        from .marketing_admin import change_registration
        r=self.call('register',answers={},consent=True)['registration']
        data={'id':self.event['id'],'registrationId':r['id'],'operation':'checkin'}
        with self.assertRaises(ValueError):change_registration(data,'owner')
        change_registration({**data,'reason':'现场核实'},'owner')
        from .models import SalonLog
        self.assertTrue(SalonLog.objects.filter(action='checkin',reason='现场核实').exists())
        change_registration({**data,'operation':'undo','reason':'误签更正'},'owner')
        self.assertIsNone(self.call('registration')['registration']['checkedAt'])
    def test_filter_export_snapshot_and_capacity_change(self):
        from .marketing_admin import admin_action
        self.call('register',answers={},consent=True)
        exported=admin_action('export',{'id':self.event['id'],'q':'event@example.test'},'owner')
        self.assertEqual(len(exported['rows']),1)
        stats=marketing.statistics(self.event['id']);self.assertEqual(stats['remaining'],0)
        self.assertEqual(marketing.public_event(self.event['id'])['remaining'],0)
    def test_internal_http_requires_credential_and_admin_actor(self):
        import json
        from django.conf import settings
        self.assertEqual(self.client.post('/marketing-list',data='{}',content_type='application/json').status_code,403)
        response=self.client.post('/admin-marketing-list',data='{}',content_type='application/json',HTTP_AUTHORIZATION='Bearer '+settings.INTERNAL_KEY)
        self.assertEqual(response.status_code,403)
        from unittest.mock import patch
        with patch('accounts.mailer.send'):
            response=self.client.post('/marketing-register',data=json.dumps({'id':self.event['id'],'session':'session','answers':{},'consent':True}),content_type='application/json',HTTP_AUTHORIZATION='Bearer '+settings.INTERNAL_KEY)
        self.assertEqual(response.status_code,200)
    def test_public_list_search_only_returns_matching_public_events(self):
        import json
        from django.conf import settings
        marketing.save_event({**self.data,'titleZh':'另一场活动','summaryZh':'独立主题'},'owner')
        marketing.save_event({**self.data,'titleZh':'沙龙草稿','status':'draft'},'owner')
        for query, expected in [('沙龙',[self.event['id']]),('无匹配',[])]:
            response=self.client.post('/marketing-list',data=json.dumps({'q':query}),content_type='application/json',HTTP_AUTHORIZATION='Bearer '+settings.INTERNAL_KEY)
            self.assertEqual(response.status_code,200)
            self.assertEqual([row['id'] for row in response.json()['rows']],expected)
    def test_qr_png_contains_only_event_checkin_url(self):
        import base64,struct,zlib
        from unittest.mock import patch
        from .marketing_qr import render
        import segno
        with patch('accounts.marketing_qr.settings.PUBLIC_ORIGIN','https://events.example.test'):
            with patch('segno.make',wraps=segno.make) as encode:
                result=render({'id':self.event['id'],'lang':'en'})
        self.assertEqual(encode.call_args.args[0],result['url'])
        self.assertEqual(result['url'],'https://events.example.test/en/events/'+self.event['id']+'?checkin='+self.event['checkinCode'])
        self.assertNotIn(self.user.email,result['url'])
        png=base64.b64decode(result['png'],validate=True)
        self.assertEqual(png[:8],b'\x89PNG\r\n\x1a\n')
        width,height=struct.unpack('>II',png[16:24])
        self.assertEqual(width,height);self.assertGreater(width,200)
        offset=8;chunks=[]
        while offset<len(png):
            size=struct.unpack('>I',png[offset:offset+4])[0]
            chunk=png[offset+4:offset+8];content=png[offset+8:offset+8+size]
            crc=struct.unpack('>I',png[offset+8+size:offset+12+size])[0]
            self.assertEqual(zlib.crc32(chunk+content)&0xffffffff,crc)
            chunks.append(chunk);offset+=12+size
        self.assertEqual(chunks[-1],b'IEND');self.assertIn(b'IDAT',chunks)

    def test_test_event_hidden_from_public_list_detail_and_assets(self):
        import json
        from django.conf import settings
        from .models import SalonEvent
        event=SalonEvent.objects.get(pk=self.event['id'])
        event.data={**event.data,'test':True,'assetIds':['hidden-cover']}
        event.save(update_fields=['data'])
        def endpoint(action,payload):
            return self.client.post('/marketing-'+action,json.dumps(payload),content_type='application/json',HTTP_AUTHORIZATION='Bearer '+settings.INTERNAL_KEY)
        listing=endpoint('list',{}).json()
        self.assertNotIn(self.event['id'],str(listing))
        self.assertFalse(endpoint('asset-public',{'assetId':'hidden-cover'}).json()['allowed'])
        self.assertEqual(endpoint('detail',{'id':self.event['id']}).status_code,400)
        self.assertTrue(SalonEvent.objects.filter(pk=self.event['id']).exists())
