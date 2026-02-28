import os
from django.conf import settings
from livekit import api
import logging as _logging

_log = _logging.getLogger(__name__)

LIVEKIT_URL = getattr(settings, 'LIVEKIT_URL', os.environ.get('LIVEKIT_URL', ''))
LIVEKIT_API_KEY = getattr(settings, 'LIVEKIT_API_KEY', os.environ.get('LIVEKIT_API_KEY', ''))
LIVEKIT_API_SECRET = getattr(settings, 'LIVEKIT_API_SECRET', os.environ.get('LIVEKIT_API_SECRET', ''))

def generate_lesson_token(room_name, user_id, user_name='', is_publisher=True):
    token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    token.with_identity(str(user_id))
    token.with_name(user_name or str(user_id))
    token.with_grants(api.VideoGrants(
        room_join=True,
        room=str(room_name),
        can_publish=is_publisher,
        can_subscribe=True,
    ))
    return token.to_jwt()
