from django.test import TestCase
from django.contrib.auth.hashers import make_password
from .models import StaffAccount, Audit, PermissionAudit
from .staff_auth import action


class StaffActivityTests(TestCase):
    def setUp(self):
        self.owner = StaffAccount.objects.create(username='owner', email='owner@example.test', role='owner', must_change=False, password=make_password('Local-test-123'))
        self.token = action('login', {'username':'owner','password':'Local-test-123'})['session']

    def test_account_filter_includes_target_and_redacts_snapshot(self):
        PermissionAudit.objects.create(actor=self.owner.email, action='member-assign', target='editor@example.test', before={'groupIds': [], 'password':'do-not-return'}, after={'groupIds':['group-1'],'secret':'do-not-return'})
        result = action('activity', {'session':self.token,'actor':'editor@example.test','module':'permissions','limit':50})
        self.assertEqual(result['total'],1)
        self.assertNotIn('do-not-return',str(result))
        self.assertEqual(result['rows'][0]['after'],{'groupIds':['group-1']})

    def test_filters_and_nonowner_rejection(self):
        Audit.objects.create(actor=self.owner.email, action='save-smtp', target='smtp')
        result = action('activity', {'session':self.token,'module':'settings','action':'save-smtp','limit':50})
        self.assertEqual(result['total'],1)
        self.assertEqual(result['rows'][0]['result'],'recorded')
        self.owner.role='editor';self.owner.save()
        with self.assertRaises(PermissionError):
            action('activity', {'session':self.token})

    def test_account_save_logs_safe_changes_and_disable_revokes_session(self):
        action('save',{'session':self.token,'username':'editor','email':'editor@example.test','role':'editor','active':True,'password':'New-editor-123'})
        editor=StaffAccount.objects.get(username='editor')
        editor.must_change=False;editor.save()
        token=action('login',{'username':'editor','password':'New-editor-123'})['session']
        action('save',{'session':self.token,'id':editor.pk,'username':'editor','email':editor.email,'role':'editor','active':False})
        self.assertIsNone(action('session',{'session':token})['user'])
        result=action('activity',{'session':self.token,'actor':editor.email,'module':'accounts','action':'account-save'})
        self.assertEqual(result['total'],2)
        self.assertNotIn('New-editor-123',str(result))
        self.assertFalse(result['rows'][0]['after']['active'])

    def test_visitor_actions_filter_as_users_and_not_other(self):
        actions=['enable-user','disable-user','save-user-profile']
        for operation in actions:
            Audit.objects.create(actor=self.owner.email,action=operation,target='visitor-test')
        result=action('activity',{'session':self.token,'module':'users'})
        self.assertEqual(result['total'],3)
        self.assertEqual({row['action'] for row in result['rows']},set(actions))
        self.assertTrue(all(row['module']=='users' for row in result['rows']))
        other=action('activity',{'session':self.token,'module':'other'})
        self.assertFalse(any(row['action'] in actions for row in other['rows']))
