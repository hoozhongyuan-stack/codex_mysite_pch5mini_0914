from types import SimpleNamespace
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from .models import VisitorState, PointEntry
from .admin_users import list_users
from .points import admin_action, adjust


class FormalListingsTests(TestCase):
    def test_synthetic_identities_and_ledger_are_preserved_but_not_listed(self):
        real = User.objects.create_user('formal-user', email='formal@example.test')
        simulated = User.objects.create_user('simulated-user', email='simulated@example.test')
        VisitorState.objects.create(user=simulated, sandbox=True)
        adjust(real, 5, 'real-credit', 'Opening credit', 'admin')
        adjust(simulated, 5, 'test-credit', 'Synthetic credit', 'admin')
        self.assertEqual([r['id'] for r in list_users({})['rows']], [real.pk])
        staff = SimpleNamespace(email='admin@example.test')
        self.assertEqual([r['id'] for r in admin_action('accounts', {}, staff)['rows']], [real.pk])
        self.assertEqual([r['user_id'] for r in admin_action('ledger', {}, staff)['rows']], [real.pk])
        self.assertEqual(admin_action('ledger', {'userId': simulated.pk}, staff)['total'], 0)
        self.assertTrue(PointEntry.objects.filter(user=simulated).exists())
        self.assertTrue(User.objects.filter(pk=simulated.pk).exists())

    def test_real_provider_sources_are_searchable(self):
        user = User.objects.create_user('google-user', email='google@example.test')
        VisitorState.objects.create(user=user, registration_source='google')
        self.assertEqual(list_users({'source': 'google'})['total'], 1)

    def test_phone_authorization_is_masked_and_filterable(self):
        user = User.objects.create_user('phone-list', email='phone-list@example.test')
        VisitorState.objects.create(user=user, phone_last4='8000', phone_verified_at=timezone.now())
        row = list_users({'q': '8000'})['rows'][0]
        self.assertEqual(row['phoneMasked'], '***8000')
        self.assertTrue(row['phoneVerified'])
        self.assertEqual(list_users({'phoneVerified': 'true'})['total'], 1)

    def test_event_list_hides_test_events_without_deleting_history(self):
        from .models import SalonEvent
        from .marketing_admin import admin_action as marketing_action
        SalonEvent.objects.create(id='normal', title='Normal', data={'test': False}, checkin_code='normal')
        SalonEvent.objects.create(id='legacy', title='Legacy', data={}, checkin_code='legacy')
        SalonEvent.objects.create(id='simulation', title='Simulation', data={'test': True}, checkin_code='simulation')
        result = marketing_action('list', {}, 'admin@example.test')
        self.assertEqual({r['id'] for r in result['rows']}, {'normal', 'legacy'})
        self.assertTrue(SalonEvent.objects.filter(pk='simulation').exists())
