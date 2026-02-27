"""
accounts/middleware.py

Activates the correct IANA timezone for each request so that:
  - django.utils.timezone.localtime()
  - django.utils.timezone.localdate()
  - Template {{ value|date }} / {{ value|time }}
  - Django admin date/time widgets

…all display times in the request user's preferred timezone.

Unauthenticated requests fall back to settings.TIME_ZONE (Asia/Tashkent).

Must be placed AFTER AuthenticationMiddleware in settings.MIDDLEWARE so that
request.user is already resolved when this runs.
"""
import zoneinfo

from django.conf import settings
from django.utils import timezone


class UserTimezoneMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        tz = self._resolve_timezone(request)
        timezone.activate(tz)
        try:
            response = self.get_response(request)
        finally:
            # Always deactivate so the timezone does not leak between requests
            # in persistent worker processes (gunicorn, daphne, etc.).
            timezone.deactivate()
        return response

    @staticmethod
    def _resolve_timezone(request):
        """
        Return a zoneinfo.ZoneInfo instance for this request.

        Priority:
          1. request.user.timezone  (authenticated users with a stored preference)
          2. settings.TIME_ZONE     (site default — Asia/Tashkent)
        """
        tz_name = None

        user = getattr(request, 'user', None)
        if user is not None and user.is_authenticated:
            tz_name = getattr(user, 'timezone', None) or None

        if not tz_name:
            tz_name = settings.TIME_ZONE  # 'Asia/Tashkent'

        try:
            return zoneinfo.ZoneInfo(tz_name)
        except (zoneinfo.ZoneInfoNotFoundError, Exception):
            # Invalid timezone stored on user — fall back gracefully
            return zoneinfo.ZoneInfo(settings.TIME_ZONE)
