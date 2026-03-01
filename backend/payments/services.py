"""
payments/services.py

Atomic credit purchase logic.
Creates a Payment record and credits the student's balance in one transaction.
"""
from decimal import Decimal
from django.db import transaction
from django.contrib.auth import get_user_model

from .models import Payment

User = get_user_model()

# -------------------------------------------------------------------
# Package catalogue (UZS prices + USD cents for Stripe)
# -------------------------------------------------------------------
PACKAGES = {
    1: {'credits': 5,  'amount_uzs': Decimal('500000'),  'label': 'Starter',  'amount_usd_cents': 500},
    2: {'credits': 20, 'amount_uzs': Decimal('1800000'), 'label': 'Standard', 'amount_usd_cents': 2000},
    3: {'credits': 50, 'amount_uzs': Decimal('4000000'), 'label': 'Pro',      'amount_usd_cents': 5000},
}


def get_packages():
    """Return the package catalogue in frontend-ready format with UZS pricing."""
    # Base price per credit: Starter package (500 000 UZS / 5 credits = 100 000 / credit)
    base_price_per_credit = int(PACKAGES[1]['amount_uzs']) // PACKAGES[1]['credits']
    result = []
    for pk, info in PACKAGES.items():
        credits = info['credits']
        price_uzs = int(info['amount_uzs'])
        price_per_credit = price_uzs // credits
        discount_pct = max(0, round((1 - price_per_credit / base_price_per_credit) * 100))
        result.append({
            'id':                   pk,
            'name':                 info['label'],
            'credits':              credits,
            'price_uzs':            price_uzs,
            'discount_percent':     discount_pct,
            'price_per_credit_uzs': price_per_credit,
        })
    return result


def create_stripe_checkout_session(user, package_id: int):
    """
    Create a PENDING Payment record and a Stripe Checkout Session.
    Returns (payment, checkout_url).

    Credits are NOT granted here — they are granted by the webhook handler
    (StripeWebhookView) once Stripe confirms the payment succeeded.
    """
    import stripe
    from django.conf import settings

    package = PACKAGES.get(package_id)
    if package is None:
        raise ValueError(f"Invalid package_id: {package_id}")

    payment = Payment.objects.create(
        student=user,
        credits_amount=package['credits'],
        amount_uzs=package['amount_uzs'],
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
                'unit_amount': package['amount_usd_cents'],
                'product_data': {
                    'name': f"{package['label']} – {package['credits']} Lesson Credits",
                    'description': f"Purchase {package['credits']} credits for online English lessons.",
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

    package = PACKAGES.get(package_id)
    if package is None:
        raise ValueError(f"Invalid package_id: {package_id}")

    from accounts.models import StudentProfile  # avoid circular import at module level

    final_amount_uzs = amount_uzs_override if amount_uzs_override is not None else package['amount_uzs']

    payment = Payment.objects.create(
        student=user,
        credits_amount=package['credits'],
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
            profile.lesson_credits = profile.lesson_credits + package['credits']
            profile.save(update_fields=['lesson_credits'])

            payment.status = Payment.Status.SUCCEEDED
            payment.save(update_fields=['status', 'updated_at'])

    except Exception:
        payment.status = Payment.Status.FAILED
        payment.save(update_fields=['status', 'updated_at'])
        raise

    return payment
