import posthog
import mixpanel
from django.conf import settings


class AnalyticsService:
    """
    Single interface to fire events to PostHog and Mixpanel simultaneously.
    Usage: AnalyticsService.track(user_id, 'lesson_booked', {'lesson_id': 123})
    """

    _mixpanel = None
    _posthog_initialized = False

    @classmethod
    def _get_mixpanel(cls):
        if cls._mixpanel is None and settings.MIXPANEL_TOKEN:
            cls._mixpanel = mixpanel.Mixpanel(settings.MIXPANEL_TOKEN)
        return cls._mixpanel

    @classmethod
    def _init_posthog(cls):
        if not cls._posthog_initialized and settings.POSTHOG_API_KEY:
            posthog.project_api_key = settings.POSTHOG_API_KEY
            posthog.host = settings.POSTHOG_HOST
            cls._posthog_initialized = True

    @classmethod
    def track(cls, user_id: str, event: str, properties: dict = None):
        props = properties or {}
        try:
            mp = cls._get_mixpanel()
            if mp:
                mp.track(str(user_id), event, props)
        except Exception:
            pass  # never let analytics break the app

        try:
            cls._init_posthog()
            if settings.POSTHOG_API_KEY:
                posthog.capture(str(user_id), event, props)
        except Exception:
            pass

    @classmethod
    def identify(cls, user_id: str, traits: dict):
        try:
            mp = cls._get_mixpanel()
            if mp:
                mp.people_set(str(user_id), traits)
        except Exception:
            pass

        try:
            cls._init_posthog()
            if settings.POSTHOG_API_KEY:
                posthog.identify(str(user_id), traits)
        except Exception:
            pass
