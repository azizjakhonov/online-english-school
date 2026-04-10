"""
payments/payme_webhook.py

PayMe.uz JSONRPC webhook handler using the paytechuz library.

PayMe calls this endpoint with JSONRPC methods in order:
  CheckPerformTransaction → CreateTransaction → PerformTransaction
  (or CancelTransaction if user abandons / time expires)

Auth: Basic <base64(PAYME_ID:PAYME_KEY)> — verified by paytechuz automatically.
Amount: PayMe sends in tiyins (1 UZS = 100 tiyins) — paytechuz converts.

Settings required (backend/.env):
  PAYME_ID=your_merchant_id
  PAYME_KEY=your_merchant_key
  PAYME_TEST_KEY=your_test_key   (for test environment)
"""

from django.db import transaction as django_transaction

from .models import Payment
from .services import grant_credits_for_payment

try:
    from paytechuz.integrations.django.payme.views import BasePaymeWebhookView

    class PaymeWebhookView(BasePaymeWebhookView):
        """
        POST /api/payments/webhook/payme/
        Handles all PayMe JSONRPC callbacks.
        """

        def successfully_payment(self, params, transaction):
            """Called by paytechuz when PayMe confirms payment captured (PerformTransaction)."""
            payment_id = transaction.account_id
            try:
                payment = Payment.objects.get(id=payment_id)
            except Payment.DoesNotExist:
                return  # Unknown payment — paytechuz already logged an error

            payment.receipt_id = str(transaction.id)
            payment.provider   = Payment.Provider.PAYME
            payment.save(update_fields=['receipt_id', 'provider', 'updated_at'])

            grant_credits_for_payment(payment)

        def cancelled_payment(self, params, transaction):
            """Called when PayMe cancels/expires the transaction (CancelTransaction)."""
            payment_id = transaction.account_id
            Payment.objects.filter(
                id=payment_id,
                status=Payment.Status.PENDING,
            ).update(status=Payment.Status.CANCELED)

except ImportError:
    # paytechuz not installed — provide a stub that returns a clear error
    from rest_framework.views import APIView
    from rest_framework.response import Response

    class PaymeWebhookView(APIView):  # type: ignore[no-redef]
        """Stub shown when paytechuz is not installed."""
        authentication_classes = []
        permission_classes     = []

        def post(self, request):
            return Response(
                {'error': 'paytechuz library not installed. Run: pip install paytechuz'},
                status=503,
            )
