from django.test import TestCase
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import User
from .models import StaffAccount
from .staff_auth import action,current
class StaffAuthTests(TestCase):
 def setUp(self):self.account=StaffAccount.objects.create(username='owner',email='owner@example.test',password=make_password('Initial-Only-772'),role='owner')
 def test_first_password_change_and_revoke(self):
  result=action('login',{'username':'owner','password':'Initial-Only-772'})
  self.assertTrue(result['user']['mustChange'])
  with self.assertRaises(ValueError):current(result['session'])
  action('profile',{'session':result['session'],'username':'owner-new','oldPassword':'Initial-Only-772','password':'Changed-Pass-992'})
  self.assertIsNone(current(result['session']))
  self.assertFalse(action('login',{'username':'owner-new','password':'Changed-Pass-992'})['user']['mustChange'])
  self.assertEqual(User.objects.count(),0)
 def test_visitor_cannot_login_as_staff(self):
  User.objects.create_user('visitor',password='Visitor-Secret-888')
  with self.assertRaises(ValueError):action('login',{'username':'visitor','password':'Visitor-Secret-888'})
 def test_disable_invalidates_session(self):
  self.account.must_change=False;self.account.save()
  token=action('login',{'username':'owner','password':'Initial-Only-772'})['session']
  self.account.active=False;self.account.save();self.assertIsNone(current(token))
 def test_initialization_does_not_overwrite(self):
  from django.core.management import call_command
  from io import StringIO
  original=self.account.password
  call_command('init_staff',stdout=StringIO())
  self.account.refresh_from_db();self.assertEqual(self.account.password,original);self.assertEqual(StaffAccount.objects.count(),1)
 def test_editor_cannot_manage_staff(self):
  self.account.role='editor';self.account.must_change=False;self.account.save()
  token=action('login',{'username':'owner','password':'Initial-Only-772'})['session']
  with self.assertRaises(PermissionError):action('list',{'session':token})
