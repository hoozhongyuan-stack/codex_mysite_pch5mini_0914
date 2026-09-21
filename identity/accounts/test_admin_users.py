import json
from django.test import TestCase
from django.conf import settings
from unittest.mock import patch
from django.contrib.auth.models import User
from .views import digest
from .models import Session,Token

class AdminUsersTests(TestCase):
    def call(self,action,data=None,actor=None):
        headers={'HTTP_AUTHORIZATION':'Bearer '+settings.INTERNAL_KEY}
        if actor:headers['HTTP_X_ADMIN_ACTOR']=actor
        return self.client.post('/'+action,json.dumps(data or {}),content_type='application/json',**headers)

    def test_disable_revokes_sessions_and_enable_does_not_verify(self):
        user=User.objects.create_user(digest('list@example.test'),email='list@example.test',password='Strong-993!')
        login=self.call('login',{'email':user.email,'password':'Strong-993!'}).json()
        self.assertIn('session',login)
        self.assertEqual(self.call('admin-set-user-enabled',{'id':user.pk,'enabled':False},actor='owner@test.example').status_code,200)
        self.assertIsNone(self.call('session',{'session':login['session']}).json()['user'])
        self.assertEqual(self.call('login',{'email':user.email,'password':'Strong-993!'}).status_code,401)
        self.assertFalse(Session.objects.filter(user=user).exists())
        self.call('admin-set-user-enabled',{'id':user.pk,'enabled':True},actor='owner@test.example')
        self.assertIsNone(self.call('session',{'session':login['session']}).json()['user'])
        user.is_active=False;user.save()
        self.assertEqual(self.call('admin-set-user-enabled',{'id':user.pk,'enabled':True},actor='owner@test.example').status_code,200)
        user.refresh_from_db();self.assertFalse(user.is_active)
        self.assertEqual(self.call('login',{'email':user.email,'password':'Strong-993!'}).status_code,401)
    def test_users_filters_and_pagination(self):
        User.objects.bulk_create([User(username=f'page{i}',email=f'page{i}@example.test',first_name='Page') for i in range(23)])
        result=self.call('admin-users',{'q':'page','page':'2','size':'20'},actor='owner@test.example').json()
        self.assertEqual(result['total'],23);self.assertEqual(len(result['rows']),3)
        self.assertEqual(self.call('admin-users',{'size':'5000'},actor='owner@test.example').status_code,400)
        staff=User.objects.create_user('staff',is_staff=True)
        self.assertEqual(self.call('admin-set-user-enabled',{'id':staff.pk,'enabled':False},actor='owner@test.example').status_code,400)

    @patch('accounts.mailer.read_config',return_value={'enabled':True})
    @patch('accounts.mailer.send')
    def test_disabled_visitor_cannot_get_new_mail_tokens(self,send,_config):
        user=User.objects.create_user(digest('disabled@example.test'),email='disabled@example.test',password='Strong-993!')
        self.call('admin-set-user-enabled',{'id':user.pk,'enabled':False},actor='owner@test.example')
        self.assertEqual(self.call('forgot',{'email':user.email}).status_code,200)
        self.assertEqual(self.call('register',{'email':user.email,'firstName':'A','lastName':'B','terms':1,'privacy':1}).status_code,200)
        send.assert_not_called()
        self.assertFalse(Token.objects.filter(user=user).exists())

    def test_phone_review_never_returns_full_number(self):
        from .models import VisitorState
        from django.utils import timezone
        user=User.objects.create_user('review-phone',email='review-phone@example.test',password='Strong-993!')
        VisitorState.objects.create(user=user,phone_encrypted='ciphertext',phone_digest='a'*64,phone_last4='8000',phone_verified_at=timezone.now())
        response=self.call('admin-review-user-phone',{'id':user.pk,'status':'approved'},actor='owner@test.example')
        self.assertEqual(response.status_code,200, response.content.decode())
        self.assertEqual(response.json()['user']['phoneReviewStatus'],'approved')
        self.assertNotIn('ciphertext',response.content.decode())
        self.assertEqual(self.call('admin-review-user-phone',{'id':user.pk,'status':'invalid'},actor='owner@test.example').status_code,400)
