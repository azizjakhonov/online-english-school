import hmac
import struct
import secrets
import time
import base64
import zlib
from hashlib import sha256

VERSION = "006"

ROLE_PUBLISHER = 1
ROLE_SUBSCRIBER = 2

PRIVILEGE_JOIN_CHANNEL = 1
PRIVILEGE_PUBLISH_AUDIO_STREAM = 2
PRIVILEGE_PUBLISH_VIDEO_STREAM = 3
PRIVILEGE_PUBLISH_DATA_STREAM = 4


class AccessToken:
    def __init__(self, app_id, app_certificate, channel_name, uid):
        self.app_id = app_id
        self.app_certificate = app_certificate
        self.channel_name = channel_name
        self.uid = str(uid) if uid != 0 else ""
        self.ts = int(time.time()) + 100
        self.salt = secrets.randbelow(10000) + 1  # cryptographically secure
        self.privileges = {}

    def add_privilege(self, privilege, expire_timestamp):
        self.privileges[privilege] = expire_timestamp

    def build(self):
        msg = struct.pack('<I', self.salt) + struct.pack('<I', self.ts)
        for priv in sorted(self.privileges.keys()):
            msg += struct.pack('<H', priv) + struct.pack('<I', self.privileges[priv])

        val = (self.app_id + self.channel_name + self.uid).encode('utf-8')

        signing_key = hmac.new(
            hmac.new(
                self.app_certificate.encode('utf-8'),
                struct.pack('<I', self.ts),
                sha256
            ).digest(),
            struct.pack('<I', self.salt),
            sha256
        ).digest()

        signature = hmac.new(signing_key, val + msg, sha256).digest()

        crc_channel = zlib.crc32(self.channel_name.encode('utf-8')) & 0xFFFFFFFF
        crc_uid = zlib.crc32(self.uid.encode('utf-8')) & 0xFFFFFFFF

        content = (
            struct.pack('<H', len(signature)) + signature +
            struct.pack('<I', crc_channel) +
            struct.pack('<I', crc_uid) +
            struct.pack('<I', self.salt) +
            struct.pack('<I', self.ts) +
            struct.pack('<H', len(self.privileges))
        )
        for priv in sorted(self.privileges.keys()):
            content += struct.pack('<H', priv) + struct.pack('<I', self.privileges[priv])

        return VERSION + self.app_id + base64.b64encode(zlib.compress(content)).decode('utf-8')


class RtcTokenBuilder:
    @staticmethod
    def buildTokenWithUid(app_id, app_certificate, channel_name, uid, role, privilege_expired_ts):
        token = AccessToken(app_id, app_certificate, channel_name, uid)
        token.add_privilege(PRIVILEGE_JOIN_CHANNEL, privilege_expired_ts)
        if role == ROLE_PUBLISHER:
            token.add_privilege(PRIVILEGE_PUBLISH_AUDIO_STREAM, privilege_expired_ts)
            token.add_privilege(PRIVILEGE_PUBLISH_VIDEO_STREAM, privilege_expired_ts)
            token.add_privilege(PRIVILEGE_PUBLISH_DATA_STREAM, privilege_expired_ts)
        return token.build()
