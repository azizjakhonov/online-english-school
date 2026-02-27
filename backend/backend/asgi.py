# backend/backend/asgi.py

import os
import django
from django.core.asgi import get_asgi_application

# 1. Set settings BEFORE importing anything else
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# 2. Setup Django
django.setup()

# 3. Initialize HTTP app and wrap with BlackNoise so static files are served under Daphne
django_asgi_app = get_asgi_application()
from django.conf import settings
from blacknoise import BlackNoise

http_app = BlackNoise(django_asgi_app)
http_app.add(settings.STATIC_ROOT, settings.STATIC_URL)
http_app.add(settings.MEDIA_ROOT, settings.MEDIA_URL)

# 4. Import Channels modules (Must be AFTER django.setup)
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

# 5. Import your custom middleware
from .middleware import TokenAuthMiddleware

# 6. Import your routing (Make sure this path is correct!)
# If your routing.py is in 'classroom/routing.py', use this:
from lessons import routing 

application = ProtocolTypeRouter({
    "http": http_app,
    "websocket": AllowedHostsOriginValidator(
        TokenAuthMiddleware(
            URLRouter(
                routing.websocket_urlpatterns
            )
        )
    ),
})