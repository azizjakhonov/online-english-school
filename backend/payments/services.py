"""
payments/services.py

Atomic credit purchase logic.
Creates a Payment record and credits the student's balance in one transaction.
"""
from decimal import Decimal
from django.db import transaction
from django.contrib.auth import get_user_model

from .models import Payment, CreditPackage

User = get_user_model()


def get_packages():
    """Return all active credit packages from DB in frontend-ready format."""
    packages = list(CreditPackage.objects.filter(is_active=True).order_by('sort_order', 'price_uzs'))
    if not packages:
        return []

    # Cheapest price-per-credit is the baseline (discount % relative to it)
    base_price_per_credit = min(
        int(p.price_uzs) / p.credits for p in packages
    )

    result = []
    for pkg in packages:
        price_uzs = int(pkg.price_uzs)
        price_per_credit = price_uzs / pkg.credits
        discount_pct = max(0, round((1 - price_per_credit / base_price_per_credit) * 100))
        result.append({
            'id':                   pkg.id,
            'name':                 pkg.name,
            'credits':              pkg.credits,
            'price_uzs':            price_uzs,
            'is_popular':           pkg.is_popular,
            'features':             pkg.features,
            'validity_label':       pkg.validity_label,
            'discount_percent':     discount_pct,
            'price_per_credit_uzs': round(price_per_credit),
        })
    return result


def _get_package(package_id: int) -> CreditPackage:
    """Look up an active CreditPackage or raise ValueError."""
    try:
        return CreditPackage.objects.get(id=package_id, is_active=True)
    except CreditPackage.DoesNotExist:
        raise ValueError(f"Invalid package_id: {package_id}")


def create_stripe_checkout_session(user, package_id: int, amount_uzs_override: Decimal = None):
    """
    Create a PENDING Payment record and a Stripe Checkout Session.
    Returns (payment, checkout_url).
    """
    import stripe
    from django.conf import settings

    pkg = _get_package(package_id)
    final_amount_uzs = amount_uzs_override if amount_uzs_override is not None else pkg.price_uzs

    # Convert UZS to USD cents using a configurable rate (default ~12700 UZS/USD)
    uzs_to_usd_rate = float(getattr(settings, 'STRIPE_UZS_TO_USD_RATE', 12700))
    amount_usd_cents = max(50, round(int(final_amount_uzs) / uzs_to_usd_rate * 100))

    payment = Payment.objects.create(
        student=user,
        package=pkg,
        credits_amount=pkg.credits,
        amount_uzs=final_amount_uzs,
        method=Payment.Method.CARD,
        provider=Payment.Provider.STRIPE,
        status=Payment.Status.PENDING,
    )

    stripe.api_key = settings.STRIPE_SECRET_KEY
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')

    session = stripe.checkout.Session.create(
        payment_method_types=['card'],
        mode='payment',
        client_reference_id=str(payment.id),
        customer_email=getattr(user, 'email', None) or None,
        line_items=[{
            'price_data': {
                'currency': 'usd',
                'unit_amount': amount_usd_cents,
                'product_data': {
                    'name': f"{pkg.name} – {pkg.credits} Lesson Credits",
                    'description': f"Purchase {pkg.credits} credits for online English lessons.",
                },
            },
            'quantity': 1,
        }],
        success_url=f"{frontend_url}/buy-credits?payment=success&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{frontend_url}/buy-credits?payment=cancel",
    )

    return payment, session.url


def purchase_credits(
    user,
    package_id: int,
    method: str = 'test',
    provider: str = 'test',
    receipt_id: str = '',
    last4: str = '',
    card_brand: str = '',
    card_holder_name: str = '',
    metadata: dict = None,
    amount_uzs_override: Decimal = None,   # set by discount-code logic in the view
) -> Payment:
    """
    Atomically:
      1. Create a Payment record (PENDING).
      2. Add credits to the student's StudentProfile.
      3. Mark the Payment SUCCEEDED.
    If anything fails, mark the Payment FAILED and re-raise.
    """
    if metadata is None:
        metadata = {}

    pkg = _get_package(package_id)

    from accounts.models import StudentProfile  # avoid circular import at module level

    final_amount_uzs = amount_uzs_override if amount_uzs_override is not None else pkg.price_uzs

    payment = Payment.objects.create(
        student=user,
        package=pkg,
        credits_amount=pkg.credits,
        amount_uzs=final_amount_uzs,
        method=method,
        provider=provider,
        status=Payment.Status.PENDING,
        receipt_id=receipt_id,
        last4=last4,
        card_brand=card_brand,
        card_holder_name=card_holder_name,
        metadata=metadata,
    )

    try:
        with transaction.atomic():
            profile, _ = StudentProfile.objects.select_for_update().get_or_create(user=user)
            profile.lesson_credits = profile.lesson_credits + pkg.credits
            profile.save(update_fields=['lesson_credits'])

            payment.status = Payment.Status.SUCCEEDED
            payment.save(update_fields=['status', 'updated_at'])

    except Exception:
        payment.status = Payment.Status.FAILED
        payment.save(update_fields=['status', 'updated_at'])
        raise

    return payment


def grant_credits_for_payment(payment: Payment) -> None:
    """
    Atomically grant credits for an already-created PENDING payment.
    Used by PayMe / Click / Stripe webhook handlers.
    """
    from accounts.models import StudentProfile
    from marketing.models import DiscountCode, DiscountCodeUsage
    from django.db.models import F

    if payment.status == Payment.Status.SUCCEEDED:
        return

    with transaction.atomic():
        payment = Payment.objects.select_for_update().get(pk=payment.pk)
        if payment.status == Payment.Status.SUCCEEDED:
            return

        user = payment.student
        profile, _ = StudentProfile.objects.select_for_update().get_or_create(user=user)

        # 1. Grant package credits
        total_granted = payment.credits_amount

        # 2. Check for discount code in metadata
        discount_code_str = payment.metadata.get('discount_code')
        if discount_code_str:
            try:
                code = DiscountCode.objects.get(code=discount_code_str.upper())
                # Record usage
                DiscountCodeUsage.objects.create(
                    code=code,
                    user=user,
                    payment=payment,
                    discount_applied=float((payment.package.price_uzs if payment.package else payment.amount_uzs) - payment.amount_uzs),
                )
                DiscountCode.objects.filter(pk=code.pk).update(times_used=F('times_used') + 1)

                # Grant free credits if applicable
                if code.discount_type == 'free_credits':
                    total_granted += int(code.discount_value)
            except DiscountCode.DoesNotExist:
                pass

        profile.lesson_credits = profile.lesson_credits + total_granted
        profile.save(update_fields=['lesson_credits'])

        payment.status = Payment.Status.SUCCEEDED
        payment.save(update_fields=['status', 'updated_at'])
