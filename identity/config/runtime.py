"""Validated deployment settings. Never include connection strings in errors."""
import json
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit


def is_deployed(env):
    mode = env.get('IDENTITY_ENV', 'local')
    if mode not in {'local', 'test', 'uat', 'production'}:
        raise ValueError('IDENTITY_ENV must be local, test, uat or production')
    return mode in {'uat', 'production'}


def database_config(env, data_dir):
    url = env.get('IDENTITY_DATABASE_URL', '')
    if not url:
        if is_deployed(env):
            raise ValueError('IDENTITY_DATABASE_URL is required for UAT/production')
        return {'ENGINE': 'django.db.backends.sqlite3', 'NAME': data_dir / 'identity.sqlite3', 'OPTIONS': {'timeout': 20}}
    try:
        parsed = urlsplit(url)
        options = parse_qs(parsed.query, strict_parsing=True)
        if parsed.scheme not in {'postgres', 'postgresql'} or not parsed.hostname or not parsed.username:
            raise ValueError()
        name = unquote(parsed.path.removeprefix('/'))
        if not name or '/' in name or parsed.fragment or set(options) - {'sslmode', 'sslrootcert'}:
            raise ValueError()
        if any(len(values) != 1 for values in options.values()):
            raise ValueError()
        sslmode = options.get('sslmode', ['prefer'])[0]
        if sslmode not in {'disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'}:
            raise ValueError()
        return {'ENGINE': 'django.db.backends.postgresql', 'NAME': name,
                'USER': unquote(parsed.username), 'PASSWORD': unquote(parsed.password or ''),
                'HOST': parsed.hostname, 'PORT': parsed.port or 5432,
                'CONN_MAX_AGE': 60, 'CONN_HEALTH_CHECKS': True,
                'TEST': {'CHARSET': 'UTF8', 'TEMPLATE': 'template0'},
                'OPTIONS': {'connect_timeout': 10, **{key: values[0] for key, values in options.items()}}}
    except (ValueError, TypeError):
        raise ValueError('Invalid IDENTITY_DATABASE_URL PostgreSQL configuration') from None


def load_secrets(env, data_dir, deployed):
    django_key = env.get('IDENTITY_SECRET_KEY', '')
    internal_key = env.get('IDENTITY_INTERNAL_KEY', '')
    if not django_key or not internal_key:
        file = Path(env.get('IDENTITY_SECRETS_FILE', str(data_dir / 'identity-secrets.json')))
        try:
            values = json.loads(file.read_text())
            django_key = django_key or values['django_key']
            internal_key = internal_key or values['internal_key']
        except (OSError, ValueError, KeyError, TypeError):
            raise ValueError('Identity secrets are missing or invalid') from None
    if not isinstance(django_key, str) or not isinstance(internal_key, str):
        raise ValueError('Identity secrets must be strings')
    if deployed and (len(django_key) < 50 or len(internal_key) < 32):
        raise ValueError('UAT/production identity secrets require sufficient length')
    return django_key, internal_key


def runtime_config(env, base_dir):
    deployed = is_deployed(env)
    if deployed and not env.get('IDENTITY_DATA_DIR'):
        raise ValueError('IDENTITY_DATA_DIR must name a persistent directory')
    data_dir = Path(env.get('IDENTITY_DATA_DIR', str(base_dir / 'private-data')))
    if not data_dir.is_absolute():
        raise ValueError('IDENTITY_DATA_DIR must be absolute')
    origin = env.get('PUBLIC_ORIGIN', 'http://localhost:3001').rstrip('/')
    parsed = urlsplit(origin)
    if deployed and (parsed.scheme != 'https' or not parsed.hostname or parsed.path or parsed.query or parsed.fragment or parsed.username):
        raise ValueError('PUBLIC_ORIGIN must be an HTTPS origin')
    database = database_config(env, data_dir)
    django_key, internal_key = load_secrets(env, data_dir, deployed)
    defaults = '127.0.0.1,localhost,identity' + ('' if deployed else ',testserver')
    hosts = [host.strip() for host in env.get('IDENTITY_ALLOWED_HOSTS', defaults).split(',') if host.strip()]
    if not hosts or (deployed and '*' in hosts):
        raise ValueError('IDENTITY_ALLOWED_HOSTS must explicitly name hosts')
    return {'DATA_DIR': data_dir, 'SECRET_KEY': django_key, 'INTERNAL_KEY': internal_key,
            'DATABASES': {'default': database}, 'PUBLIC_ORIGIN': origin, 'ALLOWED_HOSTS': hosts}
