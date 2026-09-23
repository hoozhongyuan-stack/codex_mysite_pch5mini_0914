from unittest.mock import patch
from django.test import TestCase
from django.contrib.auth.models import User
from . import mini
from .models import SocialConfig, SocialIdentity
class MiniTests(TestCase):
 def setUp(self):
  mini.save({'clientId':'wx'+'a'*16,'secret':'fixture-only','enabled':True},'test')
 @patch('accounts.mini.request_json',return_value={'openid':'open-test','session_key':'never-return'})
 def test_login_repeat_identity_and_replay(self,platform):
  data={'code':'one','terms':1,'privacy':1}
  result=mini.login(data);self.assertNotIn('never-return',str(result));self.assertEqual(len(result['session']),43)
  again=mini.login({**data,'code':'two'});self.assertEqual(result['user']['id'],again['user']['id'])
  with self.assertRaises(ValueError):mini.login(data)
  self.assertEqual(SocialIdentity.objects.filter(provider='wechat-mini').count(),1)
 @patch('accounts.mini.request_json',return_value={'openid':'open-test'})
 def test_disabled_and_missing_consent(self,platform):
  with self.assertRaises(ValueError):mini.login({'code':'one'})
  SocialConfig.objects.filter(pk='wechat-mini').update(real_enabled=False)
  with self.assertRaises(ValueError):mini.login({'code':'two','terms':1,'privacy':1})
  platform.assert_not_called()
 def test_secret_masked_and_default_off(self):
  self.assertNotIn('fixture-only',str(mini.status(True)))
  self.assertNotIn('fixture-only',SocialConfig.objects.get(pk='wechat-mini').secret_encrypted)
  with self.assertRaises(ValueError):mini.save({'clientId':'bad','enabled':True},'test')
 @patch('accounts.mini.request_json',return_value={'access_token':'temporary-platform-token'})
 def test_release_token_uses_existing_encrypted_app_secret(self,platform):
  result=mini.release_access_token()
  self.assertEqual(result['appid'],'wx'+'a'*16)
  self.assertEqual(result['accessToken'],'temporary-platform-token')
  self.assertNotIn('fixture-only',str(result))
  self.assertIn('secret=fixture-only',platform.call_args.args[0])
 @patch('accounts.mini.request_json',return_value={'openid':'linked-open'})
 def test_explicit_binding_keeps_existing_account_and_rejects_takeover(self,platform):
  from .models import Session
  from .social import digest
  from django.utils import timezone
  from datetime import timedelta
  user=User.objects.create_user(username='existing',password='verified-fixture')
  token='a'*43
  Session.objects.create(digest=digest(token),user=user,password_stamp=digest(user.password),expires=timezone.now()+timedelta(hours=1))
  linked=mini.login({'code':'binding','terms':1,'privacy':1,'intent':'link','session':token})
  self.assertEqual(str(linked['user']['id']),str(user.pk));self.assertEqual(User.objects.count(),1)
  other=User.objects.create_user(username='other',password='other-fixture');other_token='b'*43
  Session.objects.create(digest=digest(other_token),user=other,password_stamp=digest(other.password),expires=timezone.now()+timedelta(hours=1))
  with self.assertRaises(ValueError):mini.login({'code':'takeover','terms':1,'privacy':1,'intent':'link','session':other_token})
  self.assertEqual(SocialIdentity.objects.get(provider='wechat-mini').user_id,user.pk)
 def test_public_status_does_not_exhaust_shared_login_rate(self):
  import json
  from django.conf import settings
  for _ in range(35):
   response=self.client.post('/mini-status',data=json.dumps({}),content_type='application/json',HTTP_AUTHORIZATION='Bearer '+settings.INTERNAL_KEY)
   self.assertEqual(response.status_code,200)
 def _session(self,user,token='c'*43):
  from .models import Session
  from .social import digest
  from django.utils import timezone
  from datetime import timedelta
  Session.objects.create(digest=digest(token),user=user,password_stamp=digest(user.password),expires=timezone.now()+timedelta(hours=1))
  return token
 def test_profile_is_limited_to_nickname_and_avatar(self):
  user=User.objects.create_user(username='profile-user',password='fixture-password')
  result=mini.save_profile({'session':self._session(user),'nickname':'小树','avatarId':'a0000000-0000-4000-8000-000000000000'})
  self.assertEqual(result['user']['nickname'],'小树')
  self.assertEqual(result['user']['avatarId'],'a0000000-0000-4000-8000-000000000000')
  with self.assertRaises(ValueError):mini.save_profile({'session':self._session(user,'d'*43),'nickname':'x'*25})
 @patch('accounts.mini.request_json',side_effect=[{'access_token':'platform-token','expires_in':7200},{'phone_info':{'purePhoneNumber':'13800138000','countryCode':'86'}},{'phone_info':{'purePhoneNumber':'13800138000','countryCode':'86'}}])
 def test_phone_is_encrypted_masked_and_unique(self,platform):
  user=User.objects.create_user(username='phone-user',password='fixture-password')
  result=mini.bind_phone({'session':self._session(user),'code':'phone-code'})
  self.assertTrue(result['user']['phoneVerified'])
  self.assertEqual(result['user']['phoneMasked'],'***8000')
  self.assertNotIn('13800138000',str(result))
  state=user.visitor_state
  self.assertNotIn('13800138000',state.phone_encrypted)
  other=User.objects.create_user(username='phone-other',password='fixture-password')
  with self.assertRaises(ValueError):mini.bind_phone({'session':self._session(other,'e'*43),'code':'another-code'})
  self.assertEqual(platform.call_count,3)
