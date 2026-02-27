import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
from corsheaders.defaults import default_headers

load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
# Must be set via SECRET_KEY env var in production. The insecure fallback is
# intentionally kept for local development only; never ship it to production.
SECRET_KEY = os.getenv(
    'SECRET_KEY',
    'django-insecure-^sd#!ed1ze$h9(k9s#mj#c@#k#d1wq#%mkk!m*2h9j@9_i96l*'
)

# SECURITY WARNING: don't run with debug turned on in production!
# Set DEBUG=False in .env for production.
DEBUG = os.getenv('DEBUG', 'True').lower() in ('true', '1', 'yes')

# Comma-separated list of allowed hosts, e.g. "api.allright.uz,localhost"
# Defaults to localhost only; override via ALLOWED_HOSTS env var in production.
ALLOWED_HOSTS = [
    h.strip()
    for h in os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
    if h.strip()
]

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
# Application definition

# backend/backend/settings.py

UNFOLD = {
    "SITE_TITLE": "Online School Admin",
    "SITE_HEADER": "School Dashboard",
    # Pointing to the NEW location in 'accounts'
    "DASHBOARD_CALLBACK": "accounts.dashboard.dashboard_callback",
    "SIDEBAR": {
        "navigation": [
            {
                "title": "Quick Links",
                "separator": False,
                "items": [
                    {
                        "title": "📊 Analytics",
                        "icon": "bar_chart",
                        "link": "/admin/analytics/",
                    },
                    {
                        "title": "📋 Activity Feed",
                        "icon": "timeline",
                        "link": "/admin/accounts/activityevent/",
                    },
                    {
                        "title": "🗂️ CRM Board",
                        "icon": "view_kanban",
                        "link": "/admin/crm/",
                    },
                ],
            },
        ]
    },
}


INSTALLED_APPS = [
    # 1. Add these lines at the very top of INSTALLED_APPS
    "unfold",              # The base theme
    "unfold.contrib.filters", # Beautiful sidebar filters
    "unfold.contrib.forms",   # Better looking forms
    "unfold.contrib.inlines", # Better inline tables
    "unfold.contrib.import_export", # (Optional) If we add import-export later
    'daphne', # Must be at the top for Channels
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party
    'rest_framework',
    'corsheaders',
    'channels',
    'drf_spectacular',
    'drf_spectacular_sidecar',
    "django.contrib.humanize", # <--- ADD THIS LINE
    # Local Apps
    'accounts',
    'scheduling',
    'lessons',
    'homework',
    'progress',
    'curriculum', # Ensure this is here
    'payments',   # Credit purchase history & billing
    'banners',
    'auth_telegram',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware', # Must be first
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    # Activates the request user's preferred timezone so that
    # timezone.localtime() / timezone.localdate() return local values.
    'accounts.middleware.UserTimezoneMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],   # project-level template overrides
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },

    },
]

WSGI_APPLICATION = 'backend.wsgi.application'
ASGI_APPLICATION = 'backend.asgi.application'

# Database
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "myproject"),
        "USER": os.getenv("DB_USER", "postgres"),
        "PASSWORD": os.getenv("DB_PASSWORD", ""),
        "HOST": os.getenv("DB_HOST", "localhost"),
        "PORT": os.getenv("DB_PORT", "5432"),
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'

# ── Timezone configuration ──────────────────────────────────────────────────
# Database always stores UTC (Django handles the conversion automatically).
# TIME_ZONE sets the *business* default: displayed times align with Tashkent.
# Per-request activation is handled by accounts.middleware.UserTimezoneMiddleware,
# which reads User.timezone and calls django.utils.timezone.activate() so that
# timezone.localtime() / timezone.localdate() return the correct local values
# in every view, signal, and admin page for that request.
TIME_ZONE = 'Asia/Tashkent'
USE_I18N = True
USE_TZ = True

# Static files (Daphne/ASGI does not serve these; we use BlackNoise in asgi.py)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static']

# Media Files (Important for PDFs and Images)
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

AUTH_USER_MODEL = 'accounts.User'

# Rest Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser", # Enable File Uploads
        "rest_framework.parsers.FormParser",
    ],
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=6),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Online English School API",
    "DESCRIPTION": "Backend API for 1v1 lessons, scheduling, homework, and curriculum.",
    "VERSION": "1.0.0",
    "COMPONENTS": {
        "securitySchemes": {
            "BearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
            }
        }
    },
    "SECURITY": [{"BearerAuth": []}],
}

# CORS
# Keep explicit origins (no wildcard) so credentialed requests are valid in browser CORS checks.
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8081,http://192.168.1.30:8081,http://localhost:19006,http://192.168.1.30:8000',
    ).split(',')
    if origin.strip()
]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = list(default_headers) + [
    'authorization',
    'content-type',
]
CORS_EXPOSE_HEADERS = [
    'Content-Disposition',
    'Content-Length',
    'Content-Type',
]
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'

# In production (DEBUG=False / HTTPS), these MUST be True.
# They are automatically True when DEBUG is False.
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG

# CHANNELS
# In production set REDIS_URL in .env to enable Redis-backed channel layer,
# which is required for multi-process/multi-worker WebSocket support.
# In development (REDIS_URL not set) falls back to InMemoryChannelLayer.
_REDIS_URL = os.getenv('REDIS_URL', '')
if _REDIS_URL:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [_REDIS_URL],
            },
        }
    }
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer"
        }
    }

# SMS Provider (DevSms.uz)
DEVSMS_TOKEN = os.getenv('DEVSMS_TOKEN', '')
DEVSMS_SENDER_NAME = os.getenv('DEVSMS_SENDER_NAME', '4546')

# ESKIZ SMS (Deprecated)
ESKIZ_EMAIL = os.getenv('ESKIZ_EMAIL', '')
ESKIZ_PASSWORD = os.getenv('ESKIZ_PASSWORD', '')
ESKIZ_NICKNAME = os.getenv('ESKIZ_NICKNAME', '')

# AGORA VIDEO CALLS
AGORA_APP_ID = os.getenv('AGORA_APP_ID', '')
AGORA_APP_CERTIFICATE = os.getenv('AGORA_APP_CERTIFICATE', '')

# TELEGRAM AUTH
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_BOT_USERNAME = os.getenv('TELEGRAM_BOT_USERNAME', '')
TELEGRAM_WEBHOOK_SECRET = os.getenv('TELEGRAM_WEBHOOK_SECRET', '')

# GOOGLE AUTH
GOOGLE_OAUTH_CLIENT_ID = os.getenv('GOOGLE_OAUTH_CLIENT_ID', '')

# STRIPE PAYMENTS
STRIPE_SECRET_KEY  = os.getenv('STRIPE_SECRET_KEY', '')
STRIPE_PUBLIC_KEY  = os.getenv('STRIPE_PUBLIC_KEY', '')
STRIPE_WEBHOOK_SECRET = os.getenv('STRIPE_WEBHOOK_SECRET', '')
# Frontend origin used in Stripe success/cancel redirect URLs.
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')

# Allow Google OAuth popups to postMessage back to this page.
# Django's SecurityMiddleware defaults to 'same-origin' which kills the popup callback.
# 'same-origin-allow-popups' keeps the protection while allowing OAuth flows.
SECURE_CROSS_ORIGIN_OPENER_POLICY = 'same-origin-allow-popups'

# ── Security hardening (enforced by Django's SecurityMiddleware) ─────────────
# Prevent browsers from MIME-sniffing response content away from declared type.
SECURE_CONTENT_TYPE_NOSNIFF = True
# Redirect all plain-HTTP traffic to HTTPS in production. No-op when DEBUG=True.
SECURE_SSL_REDIRECT = not DEBUG
# HSTS: tell browsers to always use HTTPS for this domain (production only).
# Enable only after confirming HTTPS works correctly — it's hard to undo.
SECURE_HSTS_SECONDS = 0 if DEBUG else 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG
