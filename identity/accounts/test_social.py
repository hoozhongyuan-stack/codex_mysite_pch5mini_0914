"""Retired simulated login routes must stay unavailable, including local runs."""
import json
from datetime import timedelta
from django.test import TestCase, override_settings
from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone
from .models import Session, VisitorState, SocialConfig
from .social import digest

class SocialTests(TestCase):
 def call(self,action,data=None,actor=None):
  headers={'HTTP_AUTHORIZATION':'Bearer '+settings.INTERNAL_KEY}
  if actor:headers['HTTP_X_ADMIN_ACTOR']=actor
  return self.client.post('/'+action,json.dumps(data or {}),content_type='application/json',**headers)
 def test_simulated_routes_removed(self):
  for action in ('social-start','social-finish','social-unlink'):
   self.assertEqual(self.call(action,{'provider':'google','browser':'x'*43}).status_code,404)
 @override_settings(IDENTITY_SANDBOX=True)
 def test_old_environment_flag_cannot_restore_simulated_routes(self):
  SocialConfig.objects.create(provider='google',enabled=True)
  for action in ('social-start','social-finish','social-unlink'):
   self.assertEqual(self.call(action,{'provider':'google','browser':'x'*43}).status_code,404)
  self.assertEqual(User.objects.count(),0)
 @override_settings(IDENTITY_SANDBOX=True)
 def test_status_never_advertises_simulated_login(self):
  SocialConfig.objects.create(provider='google',enabled=True)
  status=self.call('social-status').json()
  self.assertFalse(status['sandboxAvailable'])
  self.assertEqual(status['mode'],'real')
  self.assertTrue(all(not p['enabled'] for p in status['providers']))
 def test_admin_cannot_enable_simulation(self):
  for mode in ('sandbox','production',None):
   self.assertEqual(self.call('admin-social-save',{'provider':'google','enabled':True,'sort':1,'mode':mode},actor='owner@test.invalid').status_code,400)
  self.assertFalse(SocialConfig.objects.exists())
 @override_settings(IDENTITY_SANDBOX=False)
 def test_retired_account_session_rejected_without_deleting_history(self):
  user=User.objects.create_user('old-test',email='old@sandbox.invalid')
  VisitorState.objects.create(user=user,sandbox=True,registration_source='sandbox:google')
  Session.objects.create(digest=digest('old-token'),password_stamp=digest(user.password),user=user,expires=timezone.now()+timedelta(hours=1))
  self.assertIsNone(self.call('session',{'session':'old-token'}).json()['user'])
  self.assertTrue(User.objects.filter(pk=user.pk).exists())
  self.assertEqual(user.visitor_state.registration_source,'sandbox:google')
