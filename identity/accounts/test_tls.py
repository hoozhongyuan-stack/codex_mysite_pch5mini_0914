import ssl
from unittest import TestCase
from unittest.mock import patch
from .smtp_backend import verified_context

class TLSContextTests(TestCase):
    def test_requires_verified_server_and_hostname(self):
        context = verified_context()
        self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
        self.assertTrue(context.check_hostname)
        self.assertGreater(context.cert_store_stats()['x509_ca'], 0)

    def test_missing_python_bundle_uses_system_ca(self):
        empty = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        with patch('accounts.smtp_backend.ssl.create_default_context',return_value=empty):
            context = verified_context()
        self.assertGreater(context.cert_store_stats()['x509_ca'],0)
        self.assertTrue(context.check_hostname)

    def test_missing_all_ca_fails_closed(self):
        empty = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        with patch('accounts.smtp_backend.ssl.create_default_context',return_value=empty), patch('accounts.smtp_backend.Path.is_file',return_value=False):
            with self.assertRaisesRegex(RuntimeError,'CA'):
                verified_context()
