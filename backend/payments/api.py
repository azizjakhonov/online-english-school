import stripe
from django.conf import settings as django_settings
from django.db import transaction
from rest_framework import generics, status, serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Payment
from .services import purchase_credits, get_packages, create_stripe_checkout_session


# ============================================================
# 1. SERIALIZERS
# ============================================================

class PackageSerializer(serializers.Serializer):
    id                   = serializers.IntegerField()
    name                 = serializers.CharField()
    credits              = serializers.IntegerField()
    price_uzs            = serializers.IntegerField()
    discount_percent     = serializers.IntegerField()
    price_per_credit_uzs = serializers.IntegerField()


class PaymentSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    method_display   = serializers.CharField(source='get_method_display', read_only=True)
    provider_display = serializers.CharField(source='get_provider_display', read_only=True)
    status_display   = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model  = Payment
        fields = [
            'id', 'student_name',
            'credits_amount', 'amount_uzs', 'currency',
            'method', 'method_display',
            'provider', 'provider_display',
            'status', 'status_display',
            'receipt_id',
            'last4', 'card_brand', 'card_holder_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields  # students never write through this serializer

    def get_student_name(self, obj):
        return obj.student.full_name or obj.student.phone_number


# ============================================================
# 2. VIEWS
# ============================================================

class PackageListView(APIView):
    """
    GET /api/payments/packages/
    Public list of available credit packages.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(get_packages())


class PurchaseCreditsView(APIView):
    """
    POST /api/payments/purchase/
    Student buys a credit package. Body: { "package_id": 1|2|3 }

    If STRIPE_SECRET_KEY is configured: returns { "checkoutUrl": "..." } and the
    browser is redirected to Stripe Checkout. Credits are granted by the webhook.

    If STRIPE_SECRET_KEY is not set (dev/demo mode): credits are granted immediately
    and the response contains the payment record and new balance.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        if not hasattr(user, 'student_profile'):
            return Response(
                {'error': 'Only students can purchase credits.'},
                status=status.HTTP_403_FORBIDDEN
            )

        package_id = request.data.get('package_id') or request.data.get('packageId')
        try:
            package_id = int(package_id)
        except (TypeError, ValueError):
            return Response({'error': 'package_id is required and must be an integer.'}, status=400)

        stripe_key = getattr(django_settings, 'STRIPE_SECRET_KEY', '')
        if stripe_key:
            # --- Stripe checkout flow ---
            try:
                payment, checkout_url = create_stripe_checkout_session(
                    user=user,
                    package_id=package_id,
                )
            except ValueError as e:
                return Response({'error': str(e)}, status=400)
            except Exception:
                return Response(
                    {'error': 'Could not create payment session. Please try again.'},
                    status=500,
                )
            return Response({'checkoutUrl': checkout_url}, status=status.HTTP_201_CREATED)

        # --- Test / demo flow (no real payment gateway) ---
        try:
            payment = purchase_credits(
                user=user,
                package_id=package_id,
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        except Exception:
            return Response({'error': 'Purchase failed. Please try again.'}, status=500)

        user.refresh_from_db()
        new_balance = getattr(user.student_profile, 'lesson_credits', 0)

        return Response({
            'message': 'Purchase successful.',
            'payment': PaymentSerializer(payment).data,
            'credits_added': payment.credits_amount,
            'new_balance': new_balance,
        }, status=status.HTTP_201_CREATED)


class StripeWebhookView(APIView):
    """
    POST /api/payments/webhook/stripe/
    Receives Stripe webhook events. Authenticated by Stripe signature — no JWT.
    Grants credits and marks the payment SUCCEEDED on checkout.session.completed.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        payload = request.body  # raw bytes — must be read before request.data
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')
        webhook_secret = getattr(django_settings, 'STRIPE_WEBHOOK_SECRET', '')

        if not webhook_secret:
            return Response({'error': 'Webhook secret not configured.'}, status=500)

        stripe.api_key = getattr(django_settings, 'STRIPE_SECRET_KEY', '')

        try:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        except ValueError:
            return Response({'error': 'Invalid payload.'}, status=400)
        except stripe.error.SignatureVerificationError:
            return Response({'error': 'Invalid signature.'}, status=400)

        if event['type'] == 'checkout.session.completed':
            self._handle_checkout_completed(event['data']['object'])

        return Response({'status': 'ok'})

    def _handle_checkout_completed(self, session):
        payment_id = session.get('client_reference_id')
        stripe_session_id = session.get('id')

        if not payment_id:
            return  # No reference — skip

        try:
            payment = Payment.objects.get(id=payment_id, status=Payment.Status.PENDING)
        except Payment.DoesNotExist:
            return  # Already processed or not found — idempotent

        from accounts.models import StudentProfile  # avoid circular import
        with transaction.atomic():
            profile, _ = StudentProfile.objects.select_for_update().get_or_create(
                user=payment.student
            )
            profile.lesson_credits = profile.lesson_credits + payment.credits_amount
            profile.save(update_fields=['lesson_credits'])

            payment.status = Payment.Status.SUCCEEDED
            payment.receipt_id = stripe_session_id
            payment.save(update_fields=['status', 'receipt_id', 'updated_at'])


class PaymentListView(generics.ListAPIView):
    """
    GET /api/payments/
    Returns the authenticated student's own payment history (newest first).
    """
    serializer_class   = PaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Payment.objects.filter(student=self.request.user).order_by('-created_at')


class PaymentDetailView(generics.RetrieveAPIView):
    """
    GET /api/payments/<id>/
    Returns a single payment – only if it belongs to the authenticated student.
    """
    serializer_class   = PaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Payment.objects.filter(student=self.request.user)
