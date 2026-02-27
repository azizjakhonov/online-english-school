from django.db import models
from django.conf import settings


class Payment(models.Model):
    """
    Records every credit purchase made by a student.
    Amounts are always stored in UZS. No card data stored (PCI safe).
    """

    class Status(models.TextChoices):
        PENDING   = 'pending',   'Pending'
        SUCCEEDED = 'succeeded', 'Succeeded'
        FAILED    = 'failed',    'Failed'
        REFUNDED  = 'refunded',  'Refunded'
        CANCELED  = 'canceled',  'Canceled'

    class Method(models.TextChoices):
        CARD     = 'card',     'Card'
        CASH     = 'cash',     'Cash'
        TRANSFER = 'transfer', 'Bank Transfer'
        MANUAL   = 'manual',   'Manual (Admin)'

    class Provider(models.TextChoices):
        CLICK   = 'click',   'Click'
        PAYME   = 'payme',   'Payme'
        APELSIN = 'apelsin', 'Apelsin'
        STRIPE  = 'stripe',  'Stripe'
        MANUAL  = 'manual',  'Manual'
        TEST    = 'test',    'Test (Demo)'

    # --- Core fields ---
    student        = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='payments',
        limit_choices_to={'role': 'STUDENT'},
    )
    credits_amount  = models.PositiveIntegerField(help_text='Credits purchased in this transaction')
    amount_uzs      = models.DecimalField(
        max_digits=14, decimal_places=0,
        help_text='Total amount paid in UZS (Uzbek soʻm)'
    )
    currency        = models.CharField(max_length=3, default='UZS', editable=False)
    # Use string literals as defaults to avoid class-body AttributeError
    method          = models.CharField(max_length=20, choices=Method.choices, default='test')
    provider        = models.CharField(max_length=20, choices=Provider.choices, default='test')
    status          = models.CharField(max_length=20, choices=Status.choices, default='pending')

    # --- Reference / receipt ---
    receipt_id      = models.CharField(max_length=255, blank=True, help_text='Provider transaction ID or reference')

    # --- Safe card info (last4 only – no full PAN, CVV, tokens) ---
    last4           = models.CharField(max_length=4, blank=True)
    card_brand      = models.CharField(max_length=20, blank=True)
    card_holder_name = models.CharField(max_length=100, blank=True)

    # --- Provider payload (safe: no raw card data) ---
    metadata        = models.JSONField(default=dict, blank=True)

    # --- Timestamps ---
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Payment'
        verbose_name_plural = 'Payments'

    def __str__(self):
        student_name = getattr(self.student, 'full_name', None) or self.student.phone_number
        return (
            f"Payment #{self.id} – {student_name} – "
            f"{self.credits_amount} credits – {self.amount_uzs} UZS – {self.status}"
        )
