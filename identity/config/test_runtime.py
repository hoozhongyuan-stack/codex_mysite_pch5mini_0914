import json
import tempfile
import unittest
from pathlib import Path
from config.runtime import database_config, runtime_config


class RuntimeConfigTests(unittest.TestCase):
    def test_local_sqlite_compatibility(self):
        self.assertEqual(database_config({}, Path('/tmp/example'))['ENGINE'], 'django.db.backends.sqlite3')

    def test_uat_requires_postgres(self):
        with self.assertRaisesRegex(ValueError, 'IDENTITY_DATABASE_URL'):
            database_config({'IDENTITY_ENV': 'uat'}, Path('/tmp/example'))

    def test_postgres_decodes_credentials_without_url_options_injection(self):
        config = database_config({'IDENTITY_DATABASE_URL': 'postgresql://member:a%40b@127.0.0.1:5432/identity?sslmode=require'}, Path('/tmp/example'))
        self.assertEqual(config['PASSWORD'], 'a@b')
        self.assertEqual(config['OPTIONS']['sslmode'], 'require')
        self.assertEqual(config['NAME'], 'identity')
        self.assertTrue(config['CONN_HEALTH_CHECKS'])

    def test_invalid_urls_fail_without_exposing_password(self):
        for url in ['sqlite:///tmp/test', 'postgres://u:secret@host:bad/db', 'postgres://u:secret@host/db?options=-csearch_path=public']:
            with self.subTest(url=url), self.assertRaises(ValueError) as raised:
                database_config({'IDENTITY_DATABASE_URL': url}, Path('/tmp/example'))
            self.assertNotIn('secret', str(raised.exception))

    def test_uat_requires_https_and_persistent_path(self):
        with self.assertRaisesRegex(ValueError, 'IDENTITY_DATA_DIR'):
            runtime_config({'IDENTITY_ENV': 'uat'}, Path('/tmp/example'))

    def test_environment_secrets_do_not_need_local_secret_file(self):
        with tempfile.TemporaryDirectory() as temp:
            config = runtime_config({'IDENTITY_ENV': 'uat', 'IDENTITY_DATA_DIR': temp,
                'IDENTITY_DATABASE_URL': 'postgres://u:p@localhost/identity',
                'IDENTITY_SECRET_KEY': 'd' * 60, 'IDENTITY_INTERNAL_KEY': 'i' * 60,
                'PUBLIC_ORIGIN': 'https://aition.art'}, Path(temp))
            self.assertEqual(config['SECRET_KEY'], 'd' * 60)
            self.assertEqual(config['ALLOWED_HOSTS'], ['127.0.0.1', 'localhost', 'identity'])

    def test_local_secret_file_remains_supported(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp) / 'private-data'
            folder.mkdir()
            (folder / 'identity-secrets.json').write_text(json.dumps({'django_key': 'local', 'internal_key': 'internal'}))
            config = runtime_config({}, Path(temp))
            self.assertEqual(config['SECRET_KEY'], 'local')

    def test_uat_rejects_http_origin_and_wildcard_hosts(self):
        with tempfile.TemporaryDirectory() as temp:
            env = {'IDENTITY_ENV': 'uat', 'IDENTITY_DATA_DIR': temp,
                   'IDENTITY_DATABASE_URL': 'postgres://u:p@localhost/identity',
                   'IDENTITY_SECRET_KEY': 'd' * 60, 'IDENTITY_INTERNAL_KEY': 'i' * 60,
                   'PUBLIC_ORIGIN': 'https://aition.art'}
            for bad in [{'PUBLIC_ORIGIN': 'http://aition.art'}, {'IDENTITY_ALLOWED_HOSTS': '*'},
                        {'IDENTITY_DATA_DIR': 'relative'}, {'IDENTITY_SECRET_KEY': 'short'}]:
                with self.subTest(bad=bad), self.assertRaises(ValueError):
                    runtime_config({**env, **bad}, Path(temp))

    def test_missing_secret_file_fails_with_safe_message(self):
        with tempfile.TemporaryDirectory() as temp, self.assertRaisesRegex(ValueError, 'secrets are missing'):
            runtime_config({}, Path(temp))

    def test_database_rejects_ambiguous_ssl_and_missing_names(self):
        for suffix in ['/db?sslmode=oops', '/db?sslmode=require&sslmode=disable', '/', '/db#fragment']:
            with self.subTest(suffix=suffix), self.assertRaises(ValueError):
                database_config({'IDENTITY_DATABASE_URL': 'postgres://u:p@localhost' + suffix}, Path('/tmp'))

    def test_unknown_environment_rejected(self):
        with self.assertRaisesRegex(ValueError, 'IDENTITY_ENV'):
            runtime_config({'IDENTITY_ENV': 'uat-typo'}, Path('/tmp'))
