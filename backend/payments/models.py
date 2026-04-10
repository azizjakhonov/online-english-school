from django.db import models
from django.conf import settings


class CreditPackage(models.Model):
    """
    Admin-managed catalogue of credit packages shown to students on the Buy Credits page.
    Replaces the hardcoded PACKAGES dict in services.py.
    """
    name           = models.CharField(max_length=100)
    credits        = models.PositiveIntegerField(help_text='Lesson credits the student receives')
    price_uzs      = models.DecimalField(max_digits=14, decimal_places=0, help_text='Price in UZS')
    is_active      = models.BooleanField(default=True, help_text='Hidden from students when False')
    is_popular     = models.BooleanField(default=False, help_text='Show "Popular" badge')
    sort_order     = models.PositiveIntegerField(default=0, help_text='Lower = shown first')
    features       = models.JSONField(default=list, help_text='List of feature strings shown on card')
    validity_label = models.CharField(max_length=100, blank=True, help_text='Display text only, e.g. "Valid 90 days"')
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'price_uzs']
        verbose_name = 'Credit Package'
        verbose_name_plural = 'Credit Packages'

    def __str__(self):
        return f"{self.name} – {self.credits} credits – {int(self.price_uzs):,} UZS"


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
    package        = models.ForeignKey(
        CreditPackage,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='payments',
        help_text='Credit package purchased (null for legacy/manual payments)',
    )
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


# --- PACKAGE / SUBSCRIPTION SYSTEM ---
class Package(models.Model):
    """
    A purchasable bundle of lessons offered to students.
    """
    title         = models.CharField(max_length=200)
    lessons_count = models.PositiveIntegerField(help_text='Number of lessons included in this package')
    price         = models.DecimalField(max_digits=14, decimal_places=2)
    currency      = models.CharField(max_length=3, default='UZS')
    validity_days = models.PositiveIntegerField(help_text='Days from purchase until the package expires')
    is_active     = models.BooleanField(default=True, help_text='Only active packages are shown to students')
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Package'
        verbose_name_plural = 'Packages'
        ordering = ['price']

    def __str__(self):
        return f"{self.title} ({self.lessons_count} lessons – {self.price} {self.currency})"


class StudentPackage(models.Model):
    """
    Records a student's purchase of a Package.
    Tracks remaining lessons and expiry.
    """
    class Status(models.TextChoices):
        ACTIVE  = 'ACTIVE',  'Active'
        EXPIRED = 'EXPIRED', 'Expired'
        USED    = 'USED',    'Used'

    student           = models.ForeignKey(
        'accounts.StudentProfile',
        on_delete=models.CASCADE,
        related_name='student_packages',
        db_index=True,
    )
    package           = models.ForeignKey(
        Package,
        on_delete=models.PROTECT,
        related_name='student_packages',
    )
    remaining_lessons = models.PositiveIntegerField()
    expires_at        = models.DateTimeField()
    status            = models.CharField(
        max_length=10, choices=Status.choices, default=Status.ACTIVE,
    )
    created_at        = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Student Package'
        verbose_name_plural = 'Student Packages'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.student} | {self.package.title} | {self.remaining_lessons} left [{self.status}]"
