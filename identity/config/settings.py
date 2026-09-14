import os
from pathlib import Path
from .runtime import runtime_config

BASE_DIR = Path(__file__).resolve().parents[2]
_runtime = runtime_config(os.environ, BASE_DIR)
globals().update(_runtime)
DATA_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
os.chmod(DATA_DIR, 0o700)
os.umask(0o077)
DEBUG = False
WSGI_APPLICATION = 'config.wsgi.application'
INSTALLED_APPS = ['django.contrib.auth', 'django.contrib.contenttypes', 'accounts']
ROOT_URLCONF = 'config.urls'
MIDDLEWARE = []
USE_TZ = True
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_PASSWORD_VALIDATORS = [
 {'NAME':'django.contrib.auth.password_validation.MinimumLengthValidator','OPTIONS':{'min_length':6}},
 {'NAME':'django.contrib.auth.password_validation.CommonPasswordValidator'},
 {'NAME':'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
 {'NAME':'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

DATA_UPLOAD_MAX_MEMORY_SIZE = 240000

# Retained only for isolated test overrides and historical account isolation.
# Runtime environments cannot re-enable simulated sign-in.
IDENTITY_SANDBOX = False
