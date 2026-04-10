from django.urls import path
from .api import (
    PackageListView, PurchaseCreditsView, PaymentListView,
    PaymentDetailView, StripeWebhookView,
    LessonPackageListView, StudentPackageView,
    InitiatePaymentView,
    CreditPackageAdminListView, CreditPackageAdminDetailView,
)
from .payme_webhook import PaymeWebhookView
from .click_webhook import ClickWebhookView

urlpatterns = [
    # ── Student: package catalogue (from DB) ─────────────────────────────
    path('packages/',         PackageListView.as_view(),      name='payment-packages'),

    # ── Student: credit purchase (test/demo or Stripe) ───────────────────
    path('purchase/',         PurchaseCreditsView.as_view(),  name='payment-purchase'),

    # ── Student: initiate PayMe / Click / Stripe checkout ────────────────
    path('initiate/',         InitiatePaymentView.as_view(),  name='payment-initiate'),

    # ── Webhooks (no JWT — each gateway authenticates its own way) ───────
    path('webhook/stripe/',   StripeWebhookView.as_view(),    name='stripe-webhook'),
    path('webhook/payme/',    PaymeWebhookView.as_view(),     name='payme-webhook'),
    path('click/webhook/',    ClickWebhookView.as_view(),     name='click-webhook'),

    # ── Admin: Credit Package CRUD ────────────────────────────────────────
    path('admin/packages/',       CreditPackageAdminListView.as_view(),         name='admin-packages'),
    path('admin/packages/<int:pk>/', CreditPackageAdminDetailView.as_view(),    name='admin-packages-detail'),

    # ── Student: payment history ──────────────────────────────────────────
    path('',                  PaymentListView.as_view(),       name='payment-list'),
    path('<int:pk>/',         PaymentDetailView.as_view(),    name='payment-detail'),

    # ── Legacy: lesson packages (orphaned system — kept for compatibility) ─
    path('lesson-packages/',  LessonPackageListView.as_view(), name='lesson-packages'),
    path('my-packages/',      StudentPackageView.as_view(),    name='my-packages'),
]
