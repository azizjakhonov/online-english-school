from django.db import models
from django.conf import settings
import uuid

class TelegramAccount(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='telegram_account'
    )
    telegram_id = models.BigIntegerField(unique=True)
    username = models.CharField(max_length=255, null=True, blank=True)
    first_name = models.CharField(max_length=255, null=True, blank=True)
    last_name = models.CharField(max_length=255, null=True, blank=True)
    photo_url = models.URLField(max_length=1024, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"TG:{self.telegram_id} -> User:{self.user.phone_number}"


class TelegramLoginToken(models.Model):
    token = models.CharField(max_length=64, unique=True, default=uuid.uuid4)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    
    # Telegram User Info (to be filled by webhook)
    telegram_id = models.BigIntegerField(null=True, blank=True)
    telegram_username = models.CharField(max_length=255, null=True, blank=True)
    first_name = models.CharField(max_length=255, null=True, blank=True)
    last_name = models.CharField(max_length=255, null=True, blank=True)
    photo_url = models.URLField(max_length=1024, null=True, blank=True)
    
    raw_update = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def is_expired(self):
        from django.utils import timezone
        return timezone.now() > self.expires_at

    @property
    def is_valid(self):
        return not self.is_expired and self.used_at is None

    def __str__(self):
        status = "Verified" if self.verified_at else "Pending"
        if self.is_expired: status = "Expired"
        return f"Token:{self.token[:8]}... ({status})"
