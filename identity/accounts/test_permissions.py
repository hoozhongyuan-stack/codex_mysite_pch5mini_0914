from django.test import TestCase
from django.contrib.auth.hashers import make_password
from .models import StaffAccount, MarketingGrant
from .staff_auth import action as staff_action
from .permissions import action, effective_permissions


class PermissionGroupTests(TestCase):
    def setUp(self):
        self.owner = StaffAccount.objects.create(username='root', email='root@example.test', role='owner', must_change=False, password=make_password('Test-owner-123'))
        self.editor = StaffAccount.objects.create(username='editor', email='editor@example.test', role='editor', must_change=False, password=make_password('Test-editor-123'))
        self.token = staff_action('login', {'username': 'root', 'password': 'Test-owner-123'})['session']

    def call(self, operation, **data):
        return action(operation, {**data, 'session': self.token})

    def test_assignment_is_explicit_and_revoke_takes_effect(self):
        group = self.call('save', name='收款', permissions=['orders.finance'])['group']
        self.assertNotIn('orders.finance', effective_permissions(self.editor))
        self.call('assign', accountId=str(self.editor.pk), groupIds=[group['id']])
        self.assertIn('orders.finance', effective_permissions(self.editor))
        self.assertNotIn('orders.export', effective_permissions(self.editor))
        self.call('assign', accountId=str(self.editor.pk), groupIds=[], revision=1)
        self.assertNotIn('orders.finance', effective_permissions(self.editor))
        self.assertEqual(len(self.call('list')['logs']), 3)

    def test_legacy_marketing_does_not_widen_and_disabled_group_denies(self):
        MarketingGrant.objects.create(email=self.editor.email, permissions=['checkin'])
        self.assertEqual([p for p in effective_permissions(self.editor) if p.startswith('marketing.')], ['marketing.checkin'])
        group = self.call('save', name='订单查看', permissions=['orders.view'])['group']
        self.call('assign', accountId=str(self.editor.pk), groupIds=[group['id']])
        self.call('save', id=group['id'], revision=group['revision'], name='订单查看', permissions=['orders.view'], active=False)
        self.assertNotIn('orders.view', effective_permissions(self.editor))

    def test_nonowner_and_forged_actor_rejected(self):
        token = staff_action('login', {'username': 'editor', 'password': 'Test-editor-123'})['session']
        with self.assertRaises(PermissionError):
            action('save', {'session': token, 'actor': self.owner.email, 'name': '越权', 'permissions': ['orders.view']})
        with self.assertRaises(PermissionError):
            action('list', {'session': 'invalid'})

    def test_unknown_permissions_and_owner_assignment_rejected(self):
        with self.assertRaises(ValueError):
            self.call('save', name='错误', permissions=['owner'])
        group = self.call('save', name='合法', permissions=[])['group']
        with self.assertRaises(ValueError):
            self.call('assign', accountId=str(self.owner.pk), groupIds=[group['id']])

    def test_conflict_and_inactive_account(self):
        group = self.call('save', name='编辑', permissions=[])['group']
        with self.assertRaises(ValueError):
            self.call('save', id=group['id'], revision=0, name='过期', permissions=[])
        self.editor.active=False
        self.editor.save()
        self.assertEqual(effective_permissions(self.editor), [])

    def test_legacy_revoke_preserves_group_and_records_snapshot(self):
        MarketingGrant.objects.create(email=self.editor.email, permissions=['view', 'checkin'])
        group = self.call('save', name='查看活动', permissions=['marketing.view'])['group']
        self.call('assign', accountId=str(self.editor.pk), groupIds=[group['id']])
        self.call('legacy-marketing', email=self.editor.email, previous=['view', 'checkin'], permissions=[])
        self.assertEqual([p for p in effective_permissions(self.editor) if p.startswith('marketing.')], ['marketing.view'])
        with self.assertRaises(ValueError):
            self.call('legacy-marketing', email=self.editor.email, previous=['view'], permissions=['export'])
        self.assertEqual(self.call('list')['logs'][0]['before'], ['view', 'checkin'])
