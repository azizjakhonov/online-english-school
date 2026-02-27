from django.urls import path
from .views import (
    TelegramWebVerifyView,
    TelegramMobileStartView,
    TelegramMobileStatusView,
    TelegramWebhookView
)

urlpatterns = [
    path('web/verify/', TelegramWebVerifyView.as_view(), name='telegram_web_verify'),
    path('mobile/start/', TelegramMobileStartView.as_view(), name='telegram_mobile_start'),
    path('mobile/status/', TelegramMobileStatusView.as_view(), name='telegram_mobile_status'),
    path('webhook/<str:secret>/', TelegramWebhookView.as_view(), name='telegram_webhook'),
]
