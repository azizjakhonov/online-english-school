from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


# ─────────────────────────────────────────
# BANNER / CAROUSEL
# ─────────────────────────────────────────
class Banner(models.Model):
    TARGET_CHOICES = [
        ('student', 'Student Dashboard'),
        ('teacher', 'Teacher Dashboard'),
        ('both', 'Both Dashboards'),
        ('landing', 'Landing Page'),
    ]
    TYPE_CHOICES = [
        ('carousel', 'Carousel Slide'),
        ('announcement', 'Top Announcement Bar'),
        ('modal', 'Modal Popup'),
        ('inline', 'Inline Banner'),
    ]

    title = models.CharField(max_length=200)
    subtitle = models.CharField(max_length=400, blank=True)
    image = models.ImageField(upload_to='banners/', null=True, blank=True)
    image_url = models.URLField(blank=True)          # alternative to uploaded image
    cta_text = models.CharField(max_length=100, blank=True)
    cta_url = models.URLField(blank=True)
    cta_open_new_tab = models.BooleanField(default=False)
    background_color = models.CharField(max_length=20, default='#ffffff')
    text_color = models.CharField(max_length=20, default='#000000')

    target_audience = models.CharField(max_length=20, choices=TARGET_CHOICES, default='both')
    banner_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='carousel')

    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)       # for drag-and-drop reordering

    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)

    # Analytics
    impressions = models.PositiveIntegerField(default=0)
    clicks = models.PositiveIntegerField(default=0)

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='banners_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', '-created_at']

    def __str__(self):
        return f"{self.title} ({self.target_audience})"

    @property
    def is_live(self):
        now = timezone.now()
        if not self.is_active:
            return False
        if self.starts_at and now < self.starts_at:
            return False
        if self.ends_at and now > self.ends_at:
            return False
        return True

    @property
    def ctr(self):
        if self.impressions == 0:
            return 0
        return round((self.clicks / self.impressions) * 100, 2)


# ─────────────────────────────────────────
# ANNOUNCEMENTS
# ─────────────────────────────────────────
class Announcement(models.Model):
    TARGET_CHOICES = [('student', 'Students'), ('teacher', 'Teachers'), ('both', 'Both')]

    title = models.CharField(max_length=300)
    body = models.TextField()
    target_audience = models.CharField(max_length=20, choices=TARGET_CHOICES, default='both')
    is_active = models.BooleanField(default=True)
    is_dismissible = models.BooleanField(default=True)
    priority = models.PositiveIntegerField(default=0)    # higher = shown first

    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


# ─────────────────────────────────────────
# EMAIL CAMPAIGNS
# ─────────────────────────────────────────
class EmailCampaign(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('scheduled', 'Scheduled'),
        ('sending', 'Sending'),
        ('sent', 'Sent'),
        ('paused', 'Paused'),
        ('failed', 'Failed'),
    ]
    AUDIENCE_CHOICES = [
        ('all', 'All Users'),
        ('students', 'All Students'),
        ('teachers', 'All Teachers'),
        ('inactive_students', 'Inactive Students (30+ days)'),
        ('paid_students', 'Paid Students'),
        ('free_students', 'Free / Trial Students'),
        ('new_signups', 'New Signups (last 7 days)'),
        ('custom', 'Custom Segment'),
    ]

    name = models.CharField(max_length=200)
    subject = models.CharField(max_length=300)
    preview_text = models.CharField(max_length=200, blank=True)
    html_body = models.TextField()
    plain_text_body = models.TextField(blank=True)

    audience = models.CharField(max_length=50, choices=AUDIENCE_CHOICES, default='all')
    custom_filter = models.JSONField(null=True, blank=True)  # for 'custom' audience

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    scheduled_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    # Stats (updated by webhook from SendGrid)
    recipients_count = models.PositiveIntegerField(default=0)
    delivered_count = models.PositiveIntegerField(default=0)
    opened_count = models.PositiveIntegerField(default=0)
    clicked_count = models.PositiveIntegerField(default=0)
    unsubscribed_count = models.PositiveIntegerField(default=0)
    bounced_count = models.PositiveIntegerField(default=0)

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.status})"

    @property
    def open_rate(self):
        if self.delivered_count == 0:
            return 0
        return round((self.opened_count / self.delivered_count) * 100, 2)

    @property
    def click_rate(self):
        if self.delivered_count == 0:
            return 0
        return round((self.clicked_count / self.delivered_count) * 100, 2)


# ─────────────────────────────────────────
# SMS CAMPAIGNS
# ─────────────────────────────────────────
class SmsCampaign(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'), ('scheduled', 'Scheduled'),
        ('sending', 'Sending'), ('sent', 'Sent'), ('failed', 'Failed'),
    ]
    AUDIENCE_CHOICES = EmailCampaign.AUDIENCE_CHOICES  # reuse same segments

    name = models.CharField(max_length=200)
    message = models.TextField(max_length=1600)         # up to 10 SMS segments
    audience = models.CharField(max_length=50, choices=AUDIENCE_CHOICES, default='all')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    scheduled_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    recipients_count = models.PositiveIntegerField(default=0)
    delivered_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.status})"


# ─────────────────────────────────────────
# DISCOUNT / PROMO CODES  (hooks into payments app)
# ─────────────────────────────────────────
class DiscountCode(models.Model):
    TYPE_CHOICES = [
        ('percent', 'Percentage Off'),
        ('fixed', 'Fixed Amount Off'),
        ('free_credits', 'Free Credits'),
    ]

    code = models.CharField(max_length=50, unique=True)
    description = models.CharField(max_length=300, blank=True)
    discount_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)  # % or amount

    min_purchase_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    max_uses = models.PositiveIntegerField(null=True, blank=True)  # null = unlimited
    max_uses_per_user = models.PositiveIntegerField(default=1)
    times_used = models.PositiveIntegerField(default=0)

    is_active = models.BooleanField(default=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    # Targeting
    applicable_to = models.CharField(
        max_length=20,
        choices=[('all', 'All'), ('new_users', 'New Users Only'), ('returning', 'Returning Users')],
        default='all'
    )
    campaign_ref = models.CharField(max_length=100, blank=True)  # UTM / campaign tag

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.code} ({self.discount_type}: {self.discount_value})"

    @property
    def is_valid(self):
        now = timezone.now()
        if not self.is_active:
            return False
        if self.max_uses and self.times_used >= self.max_uses:
            return False
        if self.starts_at and now < self.starts_at:
            return False
        if self.expires_at and now > self.expires_at:
            return False
        return True


class DiscountCodeUsage(models.Model):
    code = models.ForeignKey(DiscountCode, on_delete=models.CASCADE, related_name='usages')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    payment = models.ForeignKey('payments.Payment', on_delete=models.SET_NULL, null=True, blank=True)
    discount_applied = models.DecimalField(max_digits=10, decimal_places=2)
    used_at = models.DateTimeField(auto_now_add=True)


# ─────────────────────────────────────────
# PUSH NOTIFICATION CAMPAIGNS
# ─────────────────────────────────────────
class PushCampaign(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'), ('scheduled', 'Scheduled'),
        ('sending', 'Sending'), ('sent', 'Sent'), ('failed', 'Failed'),
    ]
    PLATFORM_CHOICES = [
        ('all', 'All Platforms'),
        ('web', 'Web Browser'),
        ('mobile', 'Mobile (Expo)'),
    ]

    name = models.CharField(max_length=200)
    title = models.CharField(max_length=100)
    body = models.TextField(max_length=500)
    image_url = models.URLField(blank=True)
    deep_link = models.CharField(max_length=300, blank=True)    # e.g. myapp://lessons/123

    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES, default='all')
    audience = models.CharField(max_length=50, choices=EmailCampaign.AUDIENCE_CHOICES, default='all')

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    scheduled_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    recipients_count = models.PositiveIntegerField(default=0)
    delivered_count = models.PositiveIntegerField(default=0)
    opened_count = models.PositiveIntegerField(default=0)

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)


# ─────────────────────────────────────────
# PUSH TOKENS  (Phase 12)
# ─────────────────────────────────────────
class PushToken(models.Model):
    PLATFORM_CHOICES = [('expo', 'Expo Mobile'), ('web', 'Web Browser')]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='push_tokens')
    token = models.TextField()
    platform = models.CharField(max_length=10, choices=PLATFORM_CHOICES)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'token']


# ─────────────────────────────────────────
# MARKETING METRICS SNAPSHOT  (daily aggregated cache)
# ─────────────────────────────────────────
class MarketingMetricsSnapshot(models.Model):
    """
    Stored daily by a Celery beat task.
    Avoids expensive real-time queries on the dashboard.
    """
    date = models.DateField(unique=True)

    # Acquisition
    new_signups = models.PositiveIntegerField(default=0)
    new_students = models.PositiveIntegerField(default=0)
    new_teachers = models.PositiveIntegerField(default=0)
    total_users = models.PositiveIntegerField(default=0)

    # Conversion
    trial_to_paid_conversions = models.PositiveIntegerField(default=0)
    conversion_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # Revenue
    revenue_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    revenue_new_customers = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    revenue_returning_customers = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    avg_order_value = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # LTV / CAC (manual input or computed)
    ltv = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    cac = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Lessons
    lessons_booked = models.PositiveIntegerField(default=0)
    lessons_completed = models.PositiveIntegerField(default=0)
    lessons_canceled = models.PositiveIntegerField(default=0)

    # Retention
    active_students_30d = models.PositiveIntegerField(default=0)
    churned_students_30d = models.PositiveIntegerField(default=0)
    churn_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']
