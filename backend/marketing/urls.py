from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register('banners',         views.BannerViewSet,        basename='banner')
router.register('announcements',   views.AnnouncementViewSet,  basename='announcement')
router.register('email-campaigns', views.EmailCampaignViewSet, basename='email-campaign')
router.register('sms-campaigns',   views.SmsCampaignViewSet,   basename='sms-campaign')
router.register('push-campaigns',  views.PushCampaignViewSet,  basename='push-campaign')
router.register('discount-codes',  views.DiscountCodeViewSet,  basename='discount-code')

urlpatterns = [
    # ── Public / non-ViewSet endpoints FIRST (must come before router to avoid shadowing) ──

    # ── Discount code validation (public) ────────────────────────────────
    path('discount-codes/validate/', views.ValidateDiscountCodeView.as_view(), name='discount-validate'),

    # ── Banner tracking (public, no auth) ────────────────────────────────
    path('banners/active/',                          views.ActiveBannersView.as_view(),         name='banners-active'),
    path('banners/<int:pk>/track-impression/',        views.TrackBannerImpressionView.as_view(), name='banner-track-impression'),
    path('banners/<int:pk>/track-click/',             views.TrackBannerClickView.as_view(),      name='banner-track-click'),

    # ── Announcements (public active list) ───────────────────────────────
    path('announcements/active/', views.ActiveAnnouncementsView.as_view(), name='announcements-active'),

    # ── Push tokens (authenticated registration) ─────────────────────────
    path('push-tokens/', views.PushTokenView.as_view(), name='push-tokens'),

    # ── Resend webhook (no auth — verified by Svix signature) ────────────
    path('resend-webhook/', views.ResendWebhookView.as_view(), name='resend-webhook'),

    # ── KPI / Metrics (marketing-gated) ──────────────────────────────────
    path('metrics/kpis/',        views.KPIView.as_view(),         name='marketing-kpis'),
    path('metrics/funnel/',      views.FunnelView.as_view(),       name='marketing-funnel'),
    path('metrics/revenue/',     views.RevenueView.as_view(),      name='marketing-revenue'),
    path('metrics/retention/',   views.RetentionView.as_view(),    name='marketing-retention'),
    path('metrics/acquisition/', views.AcquisitionView.as_view(),  name='marketing-acquisition'),

    # ── ViewSet CRUD (router last — catch-all for /discount-codes/, /banners/, etc.) ──
    path('', include(router.urls)),
]
