import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from django.conf import settings
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from .models import StaffAccount, StaffSession, VisitorState, SalonEvent, SalonRegistration, MarketingGrant
from .staff_auth import digest


class StaffDashboardTests(TestCase):
    def setUp(self):
        self.owner = StaffAccount.objects.create(username='owner', email='owner@example.test', role='owner', must_change=False, password='hash')
        self.editor = StaffAccount.objects.create(username='editor', email='editor@example.test', must_change=False, password='hash')
        for account in (self.owner, self.editor):
            StaffSession.objects.create(account=account, digest=digest(account.username), password_stamp=digest(account.password), expires=timezone.now()+timedelta(hours=1))
        self.tz = ZoneInfo('Asia/Shanghai')

    def request(self, **overrides):
        data = {'session':'owner', 'start':'2026-09-10', 'end':'2026-09-12', 'channel':'all', 'dataMode':'all', **overrides}
        return self.client.post('/staff-dashboard', data=json.dumps(data), content_type='application/json', HTTP_AUTHORIZATION='Bearer '+settings.INTERNAL_KEY)

    def member(self, name, day, demo=False):
        user = User.objects.create(username=name, date_joined=datetime.fromisoformat(day).replace(tzinfo=self.tz))
        VisitorState.objects.create(user=user, sandbox=demo)
        return user

    def test_period_boundaries_and_zero_filled_days(self):
        self.member('before','2026-09-08T00:00:00')
        self.member('a','2026-09-10T00:00:00')
        self.member('b','2026-09-11T23:59:59')
        self.member('excluded','2026-09-12T00:00:00')
        response = self.request()
        self.assertEqual(response.status_code,200)
        metric = response.json()['metrics']['newMembers']
        self.assertEqual((metric['current'],metric['previous']), (2,1))
        self.assertEqual(metric['daily'], [{'date':'2026-09-10','count':1},{'date':'2026-09-11','count':1}])
        self.assertEqual(metric['previousDaily'][1]['count'], 0)

    def test_demo_filter_and_active_registration(self):
        normal = self.member('formal','2026-09-10T12:00:00')
        demo = self.member('demo','2026-09-10T13:00:00',True)
        for name,user,test,status in [('a',normal,False,'active'),('b',demo,True,'active'),('c',normal,False,'cancelled')]:
            event = SalonEvent.objects.create(id=name,title=name,data={'test':test},checkin_code=name)
            row = SalonRegistration.objects.create(id=name,event=event,user=user,email='sample@example.test',name='sample',status=status)
            SalonRegistration.objects.filter(pk=row.pk).update(created=datetime(2026,9,10,14,tzinfo=self.tz))
        for mode in ('formal','demo'):
            result = self.request(dataMode=mode).json()['metrics']
            self.assertEqual(result['newMembers']['current'],1)
            self.assertEqual(result['validRegistrations']['current'],1)
        self.assertEqual(self.request().json()['metrics']['validRegistrations']['current'],2)

    def test_permission_and_unknown_channel_do_not_leak_counts(self):
        result = self.request(session='editor').json()['metrics']
        self.assertEqual(result['newMembers'],{'available':False,'reason':'permission'})
        self.assertEqual(result['validRegistrations'],{'available':False,'reason':'permission'})
        MarketingGrant.objects.create(email=self.editor.email,permissions=['view'])
        result = self.request(session='editor').json()['metrics']
        self.assertTrue(result['validRegistrations']['available'])
        self.assertFalse(result['newMembers']['available'])
        result = self.request(channel='mini').json()['metrics']
        self.assertEqual(result['newMembers'],{'available':False,'reason':'channel_unavailable'})
        self.assertEqual(result['validRegistrations'],{'available':False,'reason':'channel_unavailable'})

    def test_session_required_and_inputs_validated(self):
        self.assertEqual(self.request(session='bad').status_code,403)
        self.assertEqual(self.request(start='2026-09-12').status_code,400)
        self.assertEqual(self.request(start='2024-01-01').status_code,400)
        self.assertEqual(self.request(start='0001-01-01',end='0001-01-02').status_code,400)
        self.assertEqual(self.request(channel='invented').status_code,400)
        self.assertEqual(self.request(dataMode='invented').status_code,400)
        self.assertEqual(self.client.post('/staff-dashboard',data='{}',content_type='application/json').status_code,403)

    def test_disabled_session_and_changed_password_are_rejected(self):
        self.owner.active=False
        self.owner.save()
        self.assertEqual(self.request().status_code,403)
        self.owner.active=True
        self.owner.password='new hash'
        self.owner.save()
        self.assertEqual(self.request().status_code,403)

    def test_legacy_unmarked_data_is_formal_and_zero_days_visible(self):
        user = User.objects.create(username='legacy', date_joined=datetime(2026,9,10,12,tzinfo=self.tz))
        event = SalonEvent.objects.create(id='legacy', title='legacy', data={}, checkin_code='legacy')
        row = SalonRegistration.objects.create(id='legacy',event=event,user=user,email='legacy@example.test',name='legacy')
        SalonRegistration.objects.filter(pk=row.pk).update(created=datetime(2026,9,10,14,tzinfo=self.tz))
        result = self.request(dataMode='formal').json()['metrics']
        self.assertEqual(result['newMembers']['current'],1)
        self.assertEqual(result['validRegistrations']['current'],1)
        self.assertEqual(result['validRegistrations']['daily'][1]['count'],0)

    def test_system_users_excluded_and_dashboard_list_matches(self):
        from .admin_users import list_users
        self.member('formal','2026-09-10T00:00:00')
        self.member('demo','2026-09-11T23:59:59',True)
        self.member('end','2026-09-12T00:00:00')
        User.objects.create(username='staff-system',is_staff=True,date_joined=datetime(2026,9,10,12,tzinfo=self.tz))
        User.objects.create(username='super-system',is_superuser=True,date_joined=datetime(2026,9,10,12,tzinfo=self.tz))
        metric=self.request().json()['metrics']['newMembers']
        self.assertEqual(metric['current'],2)
        for mode,total in [('all',2),('formal',1),('demo',1)]:
            result=list_users({'dashboard':'1','start':'2026-09-10','end':'2026-09-12','dataMode':mode})
            self.assertEqual(result['total'],total)
        # Existing list continues excluding sandbox and retaining inclusive UTC to.
        normal=list_users({})
        self.assertEqual(normal['total'],2)
        with self.assertRaises(ValueError):
            list_users({'dashboard':'1','start':'invalid','end':'2026-09-12'})
