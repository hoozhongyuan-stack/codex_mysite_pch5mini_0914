from django.test import TestCase
from django.contrib.auth.models import User
from .points import reward, adjust
from .models import PointRule, PointEntry, PointAccount

class PointsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('points-test')
        PointRule.objects.create(key='article.like', amount=5, enabled=True)

    def test_daily_quota_across_objects(self):
        self.assertEqual(reward(self.user, 'article.like', 'first'), 5)
        self.assertEqual(reward(self.user, 'article.like', 'second'), 0)
        self.assertEqual(PointEntry.objects.count(), 1)
        self.assertEqual(PointAccount.objects.get(user=self.user).balance, 5)

    def test_disabled_rule_and_user(self):
        self.assertEqual(reward(self.user, 'product.like', 'x'), 0)
        self.user.is_active = False
        self.user.save()
        self.assertEqual(reward(self.user, 'article.like', 'x'), 0)

    def test_adjust_is_idempotent_and_requires_reason(self):
        with self.assertRaises(ValueError):
            adjust(self.user, 10, 'request-1', '', 'admin')
        adjust(self.user, 10, 'request-1', '测试调整', 'admin')
        adjust(self.user, 10, 'request-1', '测试调整', 'admin')
        self.assertEqual(PointAccount.objects.get(user=self.user).balance, 10)

    def test_refund_can_make_negative_balance(self):
        adjust(self.user, -10, 'refund-1', '退款冲正', 'admin')
        self.assertEqual(PointAccount.objects.get(user=self.user).balance, -10)

    def test_next_day_and_separate_types(self):
        from datetime import datetime, timezone
        PointRule.objects.create(key='product.like', amount=3, enabled=True)
        before = datetime(2026, 9, 10, 15, 59, tzinfo=timezone.utc)
        after = datetime(2026, 9, 10, 16, 0, tzinfo=timezone.utc)
        self.assertEqual(reward(self.user, 'article.like', 'one', before), 5)
        self.assertEqual(reward(self.user, 'product.like', 'two', before), 3)
        self.assertEqual(reward(self.user, 'article.like', 'one', after), 5)

    def test_registration_once_and_rule_change_not_retroactive(self):
        PointRule.objects.create(key='registration', amount=20, enabled=True)
        self.assertEqual(reward(self.user, 'registration'), 20)
        self.assertEqual(reward(self.user, 'registration'), 0)
        reward(self.user, 'article.like', 'one')
        PointRule.objects.filter(pk='article.like').update(amount=100)
        self.assertEqual(reward(self.user, 'article.like', 'two'), 0)
        self.assertEqual(PointAccount.objects.get(user=self.user).balance, 25)

    def test_interaction_cancel_does_not_repeat_reward(self):
        from .point_interactions import interact
        data = {'kind': 'article', 'id': 'a', 'action': 'like', 'active': True}
        self.assertEqual(interact(self.user, data)['earned'], 5)
        interact(self.user, {**data, 'active': False})
        self.assertEqual(interact(self.user, data)['earned'], 0)
        with self.assertRaises(ValueError):
            interact(self.user, {**data, 'action': 'registration'})

    def test_admin_adjust_and_filtered_ledger(self):
        from types import SimpleNamespace
        from .points import admin_action
        staff = SimpleNamespace(email='admin@example.invalid')
        admin_action('adjust', {'userId': self.user.pk, 'amount': 12, 'requestId': 'one', 'reason': '测试'}, staff)
        data = admin_action('ledger', {'userId': self.user.pk}, staff)
        self.assertEqual(data['total'], 1)
        self.assertEqual(data['rows'][0]['amount'], 12)

    def test_activity_requires_end_and_checkin(self):
        from datetime import timedelta
        from django.utils import timezone
        from .models import SalonEvent, SalonRegistration
        from .point_activities import settle
        PointRule.objects.create(key='salon.complete', amount=30, enabled=True, enabled_since=timezone.now()-timedelta(days=1))
        event = SalonEvent.objects.create(id='event', title='Event', status='published', checkin_code='test', data={'ends': (timezone.now()+timedelta(hours=1)).isoformat()})
        row = SalonRegistration.objects.create(id='registration', event=event, user=self.user, name='Test', email='test@example.invalid', checked_at=timezone.now())
        self.assertEqual(settle(), 0)
        event.data = {'ends': (timezone.now()-timedelta(hours=1)).isoformat()}; event.save()
        self.assertEqual(settle(), 1)
        self.assertEqual(settle(), 0)
        self.assertEqual(PointAccount.objects.get(user=self.user).balance, 30)


    def test_old_activity_not_rewarded_after_enabling(self):
        from datetime import timedelta
        from django.utils import timezone
        from .models import SalonEvent, SalonRegistration
        from .point_activities import settle
        PointRule.objects.create(key='salon.complete', amount=30, enabled=True)
        event = SalonEvent.objects.create(id='old-event', title='Old', status='published', checkin_code='test', data={'ends': (timezone.now()-timedelta(days=1)).isoformat()})
        SalonRegistration.objects.create(id='old-reg', event=event, user=self.user, name='Test', email='test@example.invalid', checked_at=timezone.now()-timedelta(days=2))
        self.assertEqual(settle(), 0)

    def test_stale_active_user_cannot_receive_reward(self):
        User.objects.filter(pk=self.user.pk).update(is_active=False)
        self.assertEqual(reward(self.user, 'article.like', 'x'), 0)

    def test_public_api_requires_session_and_owner_for_admin(self):
        from django.conf import settings
        headers = {'HTTP_AUTHORIZATION': 'Bearer ' + settings.INTERNAL_KEY}
        response = self.client.post('/points-summary', {}, content_type='application/json', **headers)
        self.assertNotEqual(response.status_code, 200)
        response = self.client.post('/admin-points-adjust', {'userId': self.user.pk, 'amount': 99, 'requestId': 'forged', 'reason': 'test'}, content_type='application/json', **headers)
        self.assertEqual(response.status_code, 403)
        self.assertFalse(PointEntry.objects.exists())

    def test_pending_reward_uses_rule_at_submission_time(self):
        from types import SimpleNamespace
        from django.utils import timezone
        from datetime import timedelta
        from .points import admin_action
        from .models import PointRuleRevision
        staff = SimpleNamespace(email='admin@example.invalid')
        submitted = timezone.now() - timedelta(minutes=1)
        PointRule.objects.create(key='form', amount=5, enabled=True)
        PointRuleRevision.objects.create(key='form', amount=5, enabled=True, effective_at=submitted-timedelta(minutes=1))
        admin_action('save-rule', {'key': 'form', 'amount': 25, 'enabled': True}, staff)
        self.assertEqual(reward(self.user, 'form', 'submission', submitted), 5)

    def test_interaction_reads_do_not_write_throttle_rows(self):
        from unittest.mock import patch
        from django.conf import settings
        headers = {'HTTP_AUTHORIZATION': 'Bearer ' + settings.INTERNAL_KEY}
        with patch('accounts.views.marketing.visitor_user', return_value=self.user):
            for action in ['points-state','points-favorites']:
                with patch('accounts.views.rate') as limiter:
                    response = self.client.post('/'+action, {'kind':'product','id':'demo'}, content_type='application/json', **headers)
                    self.assertEqual(response.status_code, 200)
                    limiter.assert_not_called()
