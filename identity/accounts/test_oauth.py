from unittest.mock import patch
from django.test import TestCase, override_settings
from . import oauth, social
from .models import SocialConfig, OAuthFlow, SocialIdentity, Session
from urllib.parse import urlparse,parse_qs

@override_settings(IDENTITY_SANDBOX=True,PUBLIC_ORIGIN='http://localhost:3001')
class OAuthTests(TestCase):
 def setUp(self):
  self.browser='a'*43
  social.save_config({'provider':'google','mode':'real','enabled':True,'sort':1,'clientId':'test-app','secret':'test-only-secret'},'test')
 def begin(self,p='google'):
  result=oauth.start({'provider':p,'browser':self.browser,'terms':1,'privacy':1})
  return parse_qs(urlparse(result['url']).query)['state'][0]
 def test_encrypted_and_masked(self):
  c=SocialConfig.objects.get(pk='google');self.assertNotIn('test-only-secret',c.secret_encrypted)
  self.assertNotIn('test-only-secret',str(social.config(True)))
  self.assertNotIn('clientId',social.config()['providers'][1])
 def test_disabled_and_incomplete(self):
  with self.assertRaises(ValueError):social.save_config({'provider':'facebook','mode':'real','enabled':True,'sort':0,'clientId':''},'test')
  SocialConfig.objects.filter(pk='google').update(real_enabled=False)
  with self.assertRaises(ValueError):self.begin()
 @patch('accounts.oauth.provider_identity',return_value={'subject':'b'*64,'email':'','first':'Test','last':''})
 def test_login_replay_browser_and_repeat(self,mock):
  state=self.begin();data={'state':state,'provider':'google','browser':self.browser,'code':'test-code'}
  with self.assertRaises(ValueError):oauth.finish({**data,'browser':'wrong'})
  result=oauth.finish(data);self.assertTrue(result['session']);self.assertEqual(SocialIdentity.objects.count(),1)
  with self.assertRaises(ValueError):oauth.finish(data)
  oauth.finish({**data,'state':self.begin()});self.assertEqual(SocialIdentity.objects.count(),1)
 @patch('accounts.oauth.request_json')
 def test_provider_adapters(self,mock):
  for p in ('google','facebook','wechat'):
   social.save_config({'provider':p,'mode':'real','enabled':True,'sort':0,'clientId':'test-app','secret':'test-only-secret'},'test')
   state=self.begin(p);flow=OAuthFlow.objects.get(pk=oauth.digest(state))
   mock.side_effect=[{'access_token':'test-token','openid':'subject'}, {'sub':'subject','id':'subject','openid':'subject','name':'Demo'}]
   result=oauth.provider_identity(flow,'test-code',SocialConfig.objects.get(pk=p));self.assertEqual(len(result['subject']),64)

 @patch('accounts.oauth.provider_identity',return_value={'subject':'c'*64,'email':'','first':'Linked','last':''})
 def test_explicit_binding_requires_same_session(self,mock):
  from django.contrib.auth.models import User
  from django.utils import timezone
  from datetime import timedelta
  from .models import VisitorState
  user=User.objects.create_user(username='existing',password='test-only-pass');VisitorState.objects.create(user=user)
  raw='s'*43;Session.objects.create(digest=oauth.digest(raw),user=user,password_stamp=oauth.digest(user.password),expires=timezone.now()+timedelta(hours=1))
  result=oauth.start({'provider':'google','browser':self.browser,'terms':1,'privacy':1,'intent':'link','session':raw})
  state=parse_qs(urlparse(result['url']).query)['state'][0]
  oauth.finish({'state':state,'provider':'google','browser':self.browser,'code':'test-code','session':raw})
  self.assertEqual(SocialIdentity.objects.get(subject='c'*64).user_id,user.pk)

 def test_return_path_rejects_open_redirect(self):
  self.assertEqual(oauth.safe_return('/zh/products/demo?mode=points'),'/zh/products/demo?mode=points')
  for path in ['//evil.test','https://evil.test','/zh/products/../admin','/zh/products/%2e%2e/admin','/zh/products/\\evil']:
   self.assertEqual(oauth.safe_return(path),'')

 @patch('accounts.oauth.provider_identity',return_value={'subject':'d'*64,'email':'','first':'Test','last':''})
 def test_revocation_and_wrong_provider(self,mock):
  state=self.begin();data={'state':state,'provider':'google','browser':self.browser,'code':'test-code'}
  with self.assertRaises(ValueError):oauth.finish({**data,'provider':'facebook'})
  SocialConfig.objects.filter(pk='google').update(real_enabled=False)
  with self.assertRaises(ValueError):oauth.finish(data)
  SocialConfig.objects.filter(pk='google').update(real_enabled=True)
  def revoked(*args):
   SocialConfig.objects.filter(pk='google').update(real_enabled=False)
   return {'subject':'d'*64,'email':'','first':'Test','last':''}
  mock.side_effect=revoked
  with self.assertRaises(ValueError):oauth.finish(data)
  self.assertFalse(SocialIdentity.objects.exists())

 @patch('accounts.oauth.provider_identity',return_value={'subject':'e'*64,'email':'existing@example.test','first':'Test','last':''})
 def test_matching_email_never_auto_merges(self,mock):
  from django.contrib.auth.models import User
  User.objects.create_user(username='existing',email='existing@example.test',password='test-password')
  with self.assertRaises(ValueError):oauth.finish({'state':self.begin(),'provider':'google','browser':self.browser,'code':'test-code'})
  self.assertEqual(User.objects.count(),1)
  self.assertFalse(SocialIdentity.objects.exists())

 @patch('accounts.oauth.provider_identity',return_value={'subject':'f'*64,'email':'','first':'Test','last':''})
 def test_binding_session_change_and_identity_owner_rejected(self,mock):
  from django.contrib.auth.models import User
  from django.utils import timezone
  from datetime import timedelta
  from .models import VisitorState
  users=[User.objects.create_user(username=f'owner{i}',password='test-password') for i in range(2)]
  for i,u in enumerate(users):
   VisitorState.objects.create(user=u)
   Session.objects.create(digest=oauth.digest(str(i)*43),user=u,password_stamp=oauth.digest(u.password),expires=timezone.now()+timedelta(hours=1))
  def flow():
   result=oauth.start({'provider':'google','browser':self.browser,'terms':1,'privacy':1,'intent':'link','session':'0'*43})
   return parse_qs(urlparse(result['url']).query)['state'][0]
  with self.assertRaises(ValueError):oauth.finish({'state':flow(),'provider':'google','browser':self.browser,'code':'test-code','session':'1'*43})
  SocialIdentity.objects.create(user=users[1],provider='google',subject='f'*64)
  with self.assertRaises(ValueError):oauth.finish({'state':flow(),'provider':'google','browser':self.browser,'code':'test-code','session':'0'*43})
  self.assertEqual(SocialIdentity.objects.count(),1)

 def test_expired_flow(self):
  from django.utils import timezone
  from datetime import timedelta
  state=self.begin();OAuthFlow.objects.update(expires=timezone.now()-timedelta(seconds=1))
  with self.assertRaises(ValueError):oauth.finish({'state':state,'provider':'google','browser':self.browser,'code':'test-code'})
