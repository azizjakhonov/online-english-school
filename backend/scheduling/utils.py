import time
import os
from django.conf import settings

# Use relative import for the local agora_token_builder package
from .agora_token_builder.RtcTokenBuilder import RtcTokenBuilder

AGORA_APP_ID = getattr(settings, 'AGORA_APP_ID', os.environ.get('AGORA_APP_ID', ''))
AGORA_APP_CERTIFICATE = getattr(settings, 'AGORA_APP_CERTIFICATE', os.environ.get('AGORA_APP_CERTIFICATE', ''))

def generate_lesson_token(room_sid, uid, role_num=1):
    """
    Generates a secure Agora Token.

    Args:
        room_sid: The UUID of the lesson (acts as channel name)
        uid: The user's numeric ID
        role_num: 1 = Publisher (Teacher/Student), 2 = Subscriber
                  (Defaults to 1 so we don't have to pass it every time)
    """
    # Token valid for 2 hours (3600 * 2 seconds)
    expiration_in_seconds = 3600 * 2
    current_timestamp = int(time.time())
    privilege_expired_ts = current_timestamp + expiration_in_seconds

    # Ensure channel name is a string
    channel_name = str(room_sid)

    token = RtcTokenBuilder.buildTokenWithUid(
        AGORA_APP_ID,
        AGORA_APP_CERTIFICATE,
        channel_name,
        uid,
        role_num,
        privilege_expired_ts
    )
    return token