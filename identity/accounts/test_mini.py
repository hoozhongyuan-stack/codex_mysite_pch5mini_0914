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
