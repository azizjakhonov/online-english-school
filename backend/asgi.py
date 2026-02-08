import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack # ✅ This is the "Security Guard"
import lessons.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack( # ✅ Wraps your routes in authentication
        URLRouter(lessons.routing.websocket_urlpatterns)
    ),
})