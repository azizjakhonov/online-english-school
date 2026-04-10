import stripe
from decimal import Decimal

from django.conf import settings as django_settings
from django.db import transaction
from django.db.models import F, Sum, Count
from rest_framework import generics, status, serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from accounts.api import IsAdminRole
from .models import Payment, CreditPackage, Package, StudentPackage
from .services import (
    purchase_credits, get_packages,
    create_stripe_checkout_session, grant_credits_for_payment,
)


# ─── Discount code helper ─────────────────────────────────────────────────────

def _apply_discount(code_str: str, user, base_amount_uzs: Decimal):
    """
    Validate a discount code for this user + amount and return
    (discounted_amount_uzs, code_obj).  Raises ValueError with a user-friendly
    message on any validation failure.
    """
    from marketing.models import DiscountCode, DiscountCodeUsage  # lazy to avoid circular

    try:
        code = DiscountCode.objects.get(code=code_str.upper())
    except DiscountCode.DoesNotExist:
        raise ValueError('Invalid discount code.')

    if not code.is_valid:
        raise ValueError('This discount code has expired or reached its usage limit.')

    used_count = DiscountCodeUsage.objects.filter(code=code, user=user).count()
    if used_count >= code.max_uses_per_user:
        raise ValueError('You have already used this discount code the maximum number of times.')

    if base_amount_uzs < Decimal(str(code.min_purchase_amount)):
        raise ValueError(
            f'Minimum purchase of {int(code.min_purchase_amount):,} UZS required for this code.'
        )

    if code.discount_type == 'percent':
        discount = (base_amount_uzs * Decimal(str(code.discount_value)) / Decimal('100')).quantize(Decimal('1'))
    elif code.discount_type == 'fixed':
        discount = min(Decimal(str(code.discount_value)), base_amount_uzs)
    else:  # free_credits — no UZS reduction; free credits added separately
        discount = Decimal('0')

    return base_amount_uzs - discount, code


# ============================================================
# 1. SERIALIZERS
# ============================================================

class PackageSerializer(serializers.Serializer):
    id                   = serializers.IntegerField()
    name                 = serializers.CharField()
    credits              = serializers.IntegerField()
    price_uzs            = serializers.IntegerField()
    is_popular           = serializers.BooleanField()
    features             = serializers.ListField(child=serializers.CharField())
    validity_label       = serializers.CharField()
    discount_percent     = serializers.IntegerField()
    price_per_credit_uzs = serializers.IntegerField()


class CreditPackageAdminSerializer(serializers.ModelSerializer):
    sales_count = serializers.SerializerMethodField(read_only=True)
    revenue_uzs = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model  = CreditPackage
        fields = [
            'id', 'name', 'credits', 'price_uzs', 'is_active', 'is_popular',
            'sort_order', 'features', 'validity_label',
            'created_at', 'updated_at',
            'sales_count', 'revenue_uzs',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'sales_count', 'revenue_uzs']

    def get_sales_count(self, obj):
        return obj.payments.filter(status=Payment.Status.SUCCEEDED).count()

    def get_revenue_uzs(self, obj):
        total = obj.payments.filter(status=Payment.Status.SUCCEEDED).aggregate(
            total=Sum('amount_uzs')
        )['total']
        return float(total or 0)


class PaymentSerializer(serializers.ModelSerializer):
    student_name     = serializers.SerializerMethodField()
    method_display   = serializers.CharField(source='get_method_display', read_only=True)
    provider_display = serializers.CharField(source='get_provider_display', read_only=True)
    status_display   = serializers.CharField(source='get_status_display', read_only=True)
    package_name     = serializers.SerializerMethodField()

    class Meta:
        model  = Payment
        fields = [
            'id', 'student_name', 'package_name',
            'credits_amount', 'amount_uzs', 'currency',
            'method', 'method_display',
            'provider', 'provider_display',
            'status', 'status_display',
            'receipt_id',
            'last4', 'card_brand', 'card_holder_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_student_name(self, obj):
        return obj.student.full_name or obj.student.phone_number

    def get_package_name(self, obj):
        return obj.package.name if obj.package else None


# ============================================================
# 2. STUDENT-FACING VIEWS
# ============================================================

class PackageListView(APIView):
    """
    GET /api/payments/packages/
    Returns active credit packages from DB (replaces hardcoded frontend list).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(get_packages())


class PurchaseCreditsView(APIView):
    """
    POST /api/payments/purchase/
    Student buys a credit package. Body: { "package_id": <id> }

    If STRIPE_SECRET_KEY is configured: returns { "checkoutUrl": "..." }.
    Otherwise (dev/demo mode): credits are granted immediately.

    For PayMe/Click flows, use POST /api/payments/initiate/ instead.
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

        try:
            pkg = CreditPackage.objects.get(id=package_id, is_active=True)
        except CreditPackage.DoesNotExist:
            return Response({'error': f'Invalid package_id: {package_id}'}, status=400)

        # ── Optional discount code ────────────────────────────────────────────
        discount_code_str = (request.data.get('discount_code') or '').strip()
        discount_code_obj = None
        amount_uzs_override = None

        if discount_code_str:
            try:
                amount_uzs_override, discount_code_obj = _apply_discount(
                    discount_code_str, user, pkg.price_uzs
                )
            except ValueError as exc:
                return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        stripe_key = getattr(django_settings, 'STRIPE_SECRET_KEY', '')
        if stripe_key:
            try:
                payment, checkout_url = create_stripe_checkout_session(
                    user, package_id, amount_uzs_override=amount_uzs_override
                )
                if discount_code_str:
                    payment.metadata = {**payment.metadata, 'discount_code': discount_code_str}
                    payment.save(update_fields=['metadata'])
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
                amount_uzs_override=amount_uzs_override,
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        except Exception:
            return Response({'error': 'Purchase failed. Please try again.'}, status=500)

        # Record discount usage after a successful payment
        if discount_code_obj is not None:
            from marketing.models import DiscountCode, DiscountCodeUsage
            DiscountCodeUsage.objects.create(
                code=discount_code_obj,
                user=user,
                payment=payment,
                discount_applied=pkg.price_uzs - payment.amount_uzs,
            )
            DiscountCode.objects.filter(pk=discount_code_obj.pk).update(
                times_used=F('times_used') + 1
            )
            if discount_code_obj.discount_type == 'free_credits':
                from accounts.models import StudentProfile
                free = int(discount_code_obj.discount_value)
                with transaction.atomic():
                    profile, _ = StudentProfile.objects.select_for_update().get_or_create(user=user)
                    profile.lesson_credits = profile.lesson_credits + free
                    profile.save(update_fields=['lesson_credits'])

        user.refresh_from_db()
        new_balance = getattr(user.student_profile, 'lesson_credits', 0)

        return Response({
            'message': 'Purchase successful.',
            'payment': PaymentSerializer(payment).data,
            'credits_added': payment.credits_amount,
            'new_balance': new_balance,
        }, status=status.HTTP_201_CREATED)


class InitiatePaymentView(APIView):
    """
    POST /api/payments/initiate/
    Body: { "package_id": <id>, "provider": "payme"|"click"|"stripe" }
    Returns: { "checkout_url": "..." }

    Creates a PENDING Payment record and returns the gateway checkout URL.
    The gateway then calls our webhook after the user pays.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        if not hasattr(user, 'student_profile'):
            return Response({'error': 'Only students can purchase credits.'}, status=403)

        try:
            package_id = int(request.data.get('package_id'))
        except (TypeError, ValueError):
            return Response({'error': 'package_id is required.'}, status=400)

        # ── Discount code support ─────────────────────────────────────────────
        discount_code_str = (request.data.get('discount_code') or '').strip()
        amount_uzs_override = None

        if discount_code_str:
            try:
                # Need to lookup package first for price
                pkg_check = CreditPackage.objects.get(id=package_id, is_active=True)
                amount_uzs_override, _ = _apply_discount(discount_code_str, user, pkg_check.price_uzs)
            except (CreditPackage.DoesNotExist, ValueError) as exc:
                return Response({'error': str(exc)}, status=400)

        provider = (request.data.get('provider') or 'payme').lower()
        if provider not in ('payme', 'click', 'stripe'):
            return Response({'error': 'Invalid provider. Choose: payme, click, stripe.'}, status=400)

        try:
            pkg = CreditPackage.objects.get(id=package_id, is_active=True)
        except CreditPackage.DoesNotExist:
            return Response({'error': 'Package not found or unavailable.'}, status=404)

        # Stripe: delegate to existing flow
        if provider == 'stripe':
            stripe_key = getattr(django_settings, 'STRIPE_SECRET_KEY', '')
            if not stripe_key:
                return Response({'error': 'Stripe is not configured.'}, status=503)
            try:
                payment, checkout_url = create_stripe_checkout_session(
                    user, package_id, amount_uzs_override=amount_uzs_override
                )
                if discount_code_str:
                    payment.metadata = {**payment.metadata, 'discount_code': discount_code_str}
                    payment.save(update_fields=['metadata'])
            except Exception:
                return Response({'error': 'Could not create Stripe session.'}, status=500)
            return Response({'checkout_url': checkout_url}, status=201)

        # Create PENDING payment record for PayMe / Click
        final_amount_uzs = amount_uzs_override if amount_uzs_override is not None else pkg.price_uzs
        metadata = {'discount_code': discount_code_str} if discount_code_str else {}

        provider_choice = Payment.Provider.PAYME if provider == 'payme' else Payment.Provider.CLICK
        payment = Payment.objects.create(
            student=user,
            package=pkg,
            credits_amount=pkg.credits,
            amount_uzs=final_amount_uzs,
            method=Payment.Method.CARD,
            provider=provider_choice,
            status=Payment.Status.PENDING,
            metadata=metadata,
        )

        frontend_url = getattr(django_settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')

        if provider == 'payme':
            payme_cfg = getattr(django_settings, 'PAYME', {})
            payme_id = payme_cfg.get('PAYME_ID', '')
            amount_tiyins = int(final_amount_uzs) * 100  # UZS → tiyins
            checkout_url = (
                f"https://checkout.paycom.uz/{payme_id}"
                f"?account[order_id]={payment.id}"
                f"&amount={amount_tiyins}"
            )
        else:  # click
            click_cfg = getattr(django_settings, 'CLICK', {})
            service_id  = click_cfg.get('CLICK_SERVICE_ID', '')
            merchant_id = click_cfg.get('CLICK_MERCHANT_ID', '')
            import urllib.parse
            return_url = f"{frontend_url}/buy-credits?payment=success"
            checkout_url = (
                f"https://my.click.uz/services/pay"
                f"?service_id={service_id}"
                f"&merchant_id={merchant_id}"
                f"&amount={int(final_amount_uzs)}"
                f"&transaction_param={payment.id}"
                f"&return_url={urllib.parse.quote(return_url, safe='')}"
            )

        return Response({'checkout_url': checkout_url}, status=201)


# ============================================================
# 3. STRIPE WEBHOOK
# ============================================================

class StripeWebhookView(APIView):
    """
    POST /api/payments/webhook/stripe/
    Receives Stripe webhook events. Authenticated by Stripe signature — no JWT.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        payload = request.body
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
            return

        try:
            payment = Payment.objects.get(id=payment_id)
        except Payment.DoesNotExist:
            return

        payment.receipt_id = stripe_session_id
        payment.save(update_fields=['receipt_id'])
        grant_credits_for_payment(payment)


# ============================================================
# 4. PAYMENT HISTORY
# ============================================================

class PaymentListView(generics.ListAPIView):
    """GET /api/payments/  — the authenticated student's own payment history."""
    serializer_class   = PaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Payment.objects.filter(student=self.request.user).order_by('-created_at')


class PaymentDetailView(generics.RetrieveAPIView):
    """GET /api/payments/<id>/  — single payment belonging to the authenticated student."""
    serializer_class   = PaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Payment.objects.filter(student=self.request.user)


# ============================================================
# 5. ADMIN — CREDIT PACKAGE CRUD
# ============================================================

class CreditPackageAdminListView(APIView):
    """
    GET  /api/payments/admin/packages/  — list all packages (admin only, includes inactive)
    POST /api/payments/admin/packages/  — create a new package
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        pkgs = CreditPackage.objects.all().order_by('sort_order', 'price_uzs')
        return Response(CreditPackageAdminSerializer(pkgs, many=True).data)

    def post(self, request):
        serializer = CreditPackageAdminSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CreditPackageAdminDetailView(APIView):
    """
    PATCH  /api/payments/admin/packages/<id>/  — update
    DELETE /api/payments/admin/packages/<id>/  — deactivate (soft-delete)
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def _get_pkg(self, pk):
        try:
            return CreditPackage.objects.get(pk=pk)
        except CreditPackage.DoesNotExist:
            return None

    def patch(self, request, pk):
        pkg = self._get_pkg(pk)
        if not pkg:
            return Response({'error': 'Package not found.'}, status=404)
        serializer = CreditPackageAdminSerializer(pkg, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    def delete(self, request, pk):
        pkg = self._get_pkg(pk)
        if not pkg:
            return Response({'error': 'Package not found.'}, status=404)
        pkg.is_active = False
        pkg.save(update_fields=['is_active', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


# ============================================================
# 6. LEGACY — LESSON PACKAGE SYSTEM (kept for backward-compat)
# ============================================================

class LessonPackageListView(generics.ListAPIView):
    """
    GET /api/payments/lesson-packages/
    Lists all active lesson packages (legacy — not connected to credit system).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        packages = Package.objects.filter(is_active=True).order_by('price')
        return Response([
            {
                'id':            p.id,
                'title':         p.title,
                'lessons_count': p.lessons_count,
                'price':         str(p.price),
                'currency':      p.currency,
                'validity_days': p.validity_days,
            }
            for p in packages
        ])


class StudentPackageView(APIView):
    """
    GET  /api/payments/my-packages/    — student's active lesson packages (legacy)
    POST /api/payments/my-packages/    — purchase a lesson package (legacy)
    """
    permission_classes = [IsAuthenticated]

    def _get_student(self, user):
        if not hasattr(user, 'student_profile'):
            return None, Response({'error': 'Only students can access packages.'}, status=403)
        return user.student_profile, None

    def get(self, request):
        profile, err = self._get_student(request.user)
        if err:
            return err
        pkgs = (
            StudentPackage.objects
            .filter(student=profile)
            .select_related('package')
            .order_by('-created_at')
        )
        return Response([
            {
                'id':                sp.id,
                'package_id':        sp.package.id,
                'package_title':     sp.package.title,
                'lessons_count':     sp.package.lessons_count,
                'remaining_lessons': sp.remaining_lessons,
                'expires_at':        sp.expires_at.isoformat() if sp.expires_at else None,
                'status':            sp.status,
                'status_label':      sp.get_status_display(),
                'created_at':        sp.created_at.isoformat(),
            }
            for sp in pkgs
        ])

    def post(self, request):
        profile, err = self._get_student(request.user)
        if err:
            return err

        package_id = request.data.get('package_id')
        try:
            pkg = Package.objects.get(pk=package_id, is_active=True)
        except Package.DoesNotExist:
            return Response({'error': 'Package not found or inactive.'}, status=404)

        from django.utils import timezone
        import datetime

        expires_at = None
        if pkg.validity_days:
            expires_at = timezone.now() + datetime.timedelta(days=pkg.validity_days)

        sp = StudentPackage.objects.create(
            student=profile,
            package=pkg,
            remaining_lessons=pkg.lessons_count,
            expires_at=expires_at,
            status=StudentPackage.Status.ACTIVE,
        )
        return Response({
            'id':                sp.id,
            'package_title':     sp.package.title,
            'remaining_lessons': sp.remaining_lessons,
            'expires_at':        sp.expires_at.isoformat() if sp.expires_at else None,
            'status':            sp.status,
        }, status=status.HTTP_201_CREATED)
