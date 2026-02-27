# backend/lessons/routing.py

from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # 1. Primary Route: Matches UUIDs (containing hyphens) -> LessonConsumer
    re_path(r'ws/lesson/(?P<id>[a-f0-9-]+)/$', consumers.LessonConsumer.as_asgi()),

    # 2. Fallback Route: Matches simple alphanumeric IDs (optional, for old tests)
    re_path(r'ws/lesson/(?P<id>\w+)/$', consumers.LessonConsumer.as_asgi()),
]