from django.test import TestCase
from django.core import mail
from django.core.mail import get_connection
from django.contrib.auth.models import User
from unittest.mock import patch
from .views import mail_token

class VerificationMailTests(TestCase):
    @patch('accounts.mailer.get_connection')
    @patch('accounts.mailer.read_config')
    def test_verification_has_clickable_html_and_text_fallback(self, config, connection):
        config.return_value={'enabled':True,'password':'test-only','host':'smtp.example.test','port':465,'username':'sender@example.test','sender':'sender@example.test','senderName':'Demo'}
        connection.return_value=get_connection('django.core.mail.backends.locmem.EmailBackend')
        user=User.objects.create_user(username='mail-test',email='visitor@example.test',is_active=False)
        mail_token(user,'verify','zh')
        sent=mail.outbox[-1]
        self.assertIn('#verify=',sent.body)
        self.assertTrue(hasattr(sent,'alternatives'))
        html=sent.alternatives[0].content
        self.assertIn('href="http://localhost:3001/zh/account#verify=',html)
        self.assertIn('验证邮箱',html)
        self.assertIn('30',html)

    @patch('accounts.mailer.send')
    def test_latest_link_works_old_link_is_rejected_and_password_failure_keeps_link(self, send):
        import re
        from .views import consume
        user=User.objects.create_user(username='resend-test',email='resend@example.test',is_active=False)
        mail_token(user,'verify','zh')
        old=re.search(r'#verify=([^\s]+)',send.call_args.args[2]).group(1)
        mail_token(user,'verify','en')
        latest=re.search(r'#verify=([^\s]+)',send.call_args.args[2]).group(1)
        self.assertIn(latest,send.call_args.kwargs['html'])
        with self.assertRaises(ValueError): consume({'token':old,'password':'Test-Password-739!'},'verify')
        from django.core.exceptions import ValidationError
        with self.assertRaises(ValidationError): consume({'token':latest,'password':'abc'},'verify')
        self.assertEqual(consume({'token':latest,'password':'Test-Password-739!'},'verify'),{'ok':True})
        user.refresh_from_db()
        self.assertTrue(user.is_active)
        self.assertTrue(user.check_password('Test-Password-739!'))
        with self.assertRaises(ValueError): consume({'token':latest,'password':'Test-Password-739!'},'verify')

    @patch('accounts.mailer.send')
    def test_failed_resend_retains_previous_valid_link(self, send):
        import re
        from .views import consume
        user=User.objects.create_user(username='retry-test',email='retry@example.test',is_active=False)
        mail_token(user,'verify','zh')
        old=re.search(r'#verify=([^\s]+)',send.call_args.args[2]).group(1)
        send.side_effect=RuntimeError('Synthetic delivery failure')
        with self.assertRaises(RuntimeError): mail_token(user,'verify','zh')
        self.assertEqual(consume({'token':old,'password':'Test-Password-739!'},'verify'),{'ok':True})
