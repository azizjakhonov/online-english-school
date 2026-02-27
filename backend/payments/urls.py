from django.urls import path
from .api import PackageListView, PurchaseCreditsView, PaymentListView, PaymentDetailView, StripeWebhookView

urlpatterns = [
    path('packages/',         PackageListView.as_view(),    name='payment-packages'),
    path('purchase/',         PurchaseCreditsView.as_view(), name='payment-purchase'),
    path('webhook/stripe/',   StripeWebhookView.as_view(),  name='stripe-webhook'),
    path('',                  PaymentListView.as_view(),     name='payment-list'),
    path('<int:pk>/',         PaymentDetailView.as_view(),   name='payment-detail'),
]
