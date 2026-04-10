"""
payments/click_webhook.py

Click.uz prepare/complete webhook handler using the paytechuz library.

Click calls two endpoints in sequence:
  1. POST /api/payments/click/prepare/   (action=0) — verify order
  2. POST /api/payments/click/complete/  (action=1) — deliver goods

Both endpoints use the same ClickWebhookView which routes internally by action.

Signature verification: MD5 of concatenated fields using CLICK_SECRET_KEY.
Amount: Click sends in UZS directly (unlike PayMe which uses tiyins).

Settings required (backend/.env):
  CLICK_SERVICE_ID=your_service_id
  CLICK_MERCHANT_ID=your_merchant_id
  CLICK_SECRET_KEY=your_secret_key
"""

from .models import Payment
from .services import grant_credits_for_payment

try:
    from paytechuz.integrations.django.click.views import BaseClickWebhookView

    class ClickWebhookView(BaseClickWebhookView):
        """
        POST /api/payments/click/webhook/
        Handles both Click prepare (action=0) and complete (action=1) callbacks.
        """

        def successfully_payment(self, params, transaction):
            """Called by paytechuz when Click confirms payment (complete, action=1)."""
            payment_id = transaction.account_id
            try:
                payment = Payment.objects.get(id=payment_id)
            except Payment.DoesNotExist:
                return

            payment.receipt_id = str(transaction.id)
            payment.provider   = Payment.Provider.CLICK
            payment.save(update_fields=['receipt_id', 'provider', 'updated_at'])

            grant_credits_for_payment(payment)

        def cancelled_payment(self, params, transaction):
            """Called when Click cancels the transaction."""
            payment_id = transaction.account_id
            Payment.objects.filter(
                id=payment_id,
                status=Payment.Status.PENDING,
            ).update(status=Payment.Status.CANCELED)

except ImportError:
    from rest_framework.views import APIView
    from rest_framework.response import Response

    class ClickWebhookView(APIView):  # type: ignore[no-redef]
        """Stub shown when paytechuz is not installed."""
        authentication_classes = []
        permission_classes     = []

        def post(self, request):
            return Response(
                {'error': 'paytechuz library not installed. Run: pip install paytechuz'},
                status=503,
            )
