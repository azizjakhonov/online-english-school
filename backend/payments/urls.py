from django.urls import path
from .api import (
    PackageListView, PurchaseCreditsView, PaymentListView,
    PaymentDetailView, StripeWebhookView,
    LessonPackageListView, StudentPackageView,
)

urlpatterns = [
    path('packages/',         PackageListView.as_view(),      name='payment-packages'),
    path('purchase/',         PurchaseCreditsView.as_view(),  name='payment-purchase'),
    path('webhook/stripe/',   StripeWebhookView.as_view(),    name='stripe-webhook'),
    path('lesson-packages/',  LessonPackageListView.as_view(), name='lesson-packages'),
    path('my-packages/',      StudentPackageView.as_view(),    name='my-packages'),
    path('',                  PaymentListView.as_view(),       name='payment-list'),
    path('<int:pk>/',         PaymentDetailView.as_view(),    name='payment-detail'),
]
