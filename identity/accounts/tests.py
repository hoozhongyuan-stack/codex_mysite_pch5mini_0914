import json
import re
import tempfile
from pathlib import Path
from unittest.mock import patch
from datetime import timedelta
from django.test import TestCase
from django.conf import settings
from django.utils import timezone
from django.contrib.auth.models import User
from .models import Token, Session
from .views import digest
from . import mailer

class IdentityTests(TestCase):
    def call(self,action,data=None,actor=None,auth=True):
        headers={'HTTP_AUTHORIZATION':'Bearer '+settings.INTERNAL_KEY} if auth else {}
        if actor: headers['HTTP_X_ADMIN_ACTOR']=actor
        return self.client.post('/'+action,json.dumps(data or {}),content_type='application/json',**headers)

    @patch('accounts.mailer.read_config',return_value={'enabled':True})
    @patch('accounts.mailer.send')
    def test_registration_verification_login_reset_logout(self,send,_config):
        data={'email':'visitor@example.test','firstName':'Jane','lastName':'Doe','password':'Start-Password-981!','terms':1,'privacy':1}
        self.assertEqual(self.call('register',data).status_code,200)
        user=User.objects.get(username=digest(data['email']))
        self.assertFalse(user.is_active)
        self.assertFalse(user.has_usable_password())
        raw=re.search(r'#verify=([^\s]+)',send.call_args.args[2]).group(1)
        self.assertNotEqual(Token.objects.get().digest,raw)
        self.assertEqual(self.call('login',data).status_code,401)
        self.assertEqual(self.call('verify',{'token':raw,'password':'Chosen-Password-729!'}).status_code,200)
        self.assertEqual(self.call('verify',{'token':raw,'password':'Chosen-Password-729!'}).status_code,400)
        self.assertEqual(self.call('login',data).status_code,401)
        login=self.call('login',{'email':data['email'],'password':'Chosen-Password-729!'}).json()
        self.assertIn('session',login)
        old=login['session']
        self.assertEqual(self.call('session',{'session':old}).json()['user']['email'],data['email'])
        self.assertEqual(self.call('forgot',{'email':data['email']}).status_code,200)
        reset=re.search(r'#reset=([^\s]+)',send.call_args.args[2]).group(1)
        self.assertEqual(self.call('reset',{'token':reset,'password':'Reset-Password-394!'}).status_code,200)
        self.assertIsNone(self.call('session',{'session':old}).json()['user'])
        self.assertEqual(self.call('reset',{'token':reset,'password':'Reset-Password-394!'}).status_code,400)
        new=self.call('login',{'email':data['email'],'password':'Reset-Password-394!'}).json()['session']
        self.call('logout',{'session':new})
        self.assertIsNone(self.call('session',{'session':new}).json()['user'])

    def test_auth_and_admin_boundary(self):
        self.assertEqual(self.call('admin-smtp',auth=False).status_code,403)
        self.assertEqual(self.call('admin-smtp').status_code,403)
        self.assertEqual(self.call('admin-users',actor='owner@example.test').status_code,200)

    def test_expired_token_and_weak_password(self):
        user=User.objects.create_user('expired@example.test',password='Password-981!',is_active=False)
        Token.objects.create(password_stamp=digest(user.password),digest=digest('old'),user=user,purpose='verify',expires=timezone.now()-timedelta(seconds=1))
        self.assertEqual(self.call('verify',{'token':'old','password':'Chosen-Password-729!'}).status_code,400)
        Token.objects.create(password_stamp=digest(user.password),digest=digest('new'),user=user,purpose='verify',expires=timezone.now()+timedelta(minutes=1))
        self.assertEqual(self.call('verify',{'token':'new','password':'123'}).status_code,400)
        self.assertTrue(Token.objects.filter(digest=digest('new')).exists())

    def test_smtp_redaction_retention_and_tls(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(mailer,'CONFIG',Path(directory)/'smtp.json'):
            data={'host':'smtp.example.test','port':465,'username':'mail@example.test','sender':'mail@example.test','senderName':'Brand','password':'synthetic-secret','enabled':True}
            response=self.call('admin-save-smtp',data,actor='owner@example.test')
            self.assertEqual(response.status_code,200)
            self.assertNotIn('synthetic-secret',response.content.decode())
            self.assertTrue(response.json()['passwordConfigured'])
            self.assertEqual(self.call('admin-save-smtp',{**data,'password':''},actor='owner@example.test').status_code,200)
            self.assertEqual(mailer.read_config()['password'],'synthetic-secret')
            self.assertEqual(self.call('admin-save-smtp',{**data,'port':25},actor='owner@example.test').status_code,400)
            self.assertEqual(mailer.CONFIG.stat().st_mode & 0o777,0o600)

    @patch('accounts.mailer.read_config',return_value={'enabled':True})
    @patch('accounts.mailer.send',side_effect=RuntimeError('SECRET SMTP ERROR'))
    def test_mail_failure_is_honest_and_sanitized(self,_send,_config):
        response=self.call('register',{'email':'failure@example.test','firstName':'Jane','lastName':'Doe','password':'Start-Password-981!','terms':1,'privacy':1})
        self.assertEqual(response.status_code,503)
        self.assertNotIn('SECRET',response.content.decode())
        self.assertFalse(Token.objects.exists())

    def test_stale_password_session_is_rejected_after_reset_race(self):
        user=User.objects.create_user(username=digest('race@example.test'),email='race@example.test',password='Original-Password-917!')
        original_create=Session.objects.create
        def reset_between_authentication_and_session(**kwargs):
            updated=User.objects.get(pk=user.pk)
            updated.set_password('Replacement-Password-612!')
            updated.save()
            Session.objects.filter(user=user).delete()
            return original_create(**kwargs)
        with patch('accounts.views.Session.objects.create',side_effect=reset_between_authentication_and_session):
            response=self.call('login',{'email':'race@example.test','password':'Original-Password-917!'})
        self.assertEqual(response.status_code,200)
        self.assertIsNone(self.call('session',{'session':response.json()['session']}).json()['user'])

    def test_password_minimum_is_six_characters(self):
        from .views import password
        from django.core.exceptions import ValidationError
        self.assertEqual(password({'password':'aB3!xZ'}),'aB3!xZ')
        with self.assertRaises(ValidationError):
            password({'password':'aB3!x'})
