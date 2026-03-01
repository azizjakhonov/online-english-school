# Marketing Dashboard — Implementation Guide
> **EdTech Platform** · Django + React + Vite + TypeScript + PostgreSQL  
> This document is the single source of truth for building the full marketing dashboard.  
> Work through each phase in order. Each phase is self-contained and deployable.

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Phase 1 — Django Backend: Models & Admin](#2-phase-1--django-backend-models--admin)
3. [Phase 2 — Analytics Integration](#3-phase-2--analytics-integration)
4. [Phase 3 — REST API Endpoints](#4-phase-3--rest-api-endpoints)
5. [Phase 4 — Frontend: Marketing Dashboard Shell](#5-phase-4--frontend-marketing-dashboard-shell)
6. [Phase 5 — Banner & Carousel Manager](#6-phase-5--banner--carousel-manager)
7. [Phase 6 — Announcements & Notifications](#7-phase-6--announcements--notifications)
8. [Phase 7 — Email & SMS Campaigns](#8-phase-7--email--sms-campaigns)
9. [Phase 8 — Discount & Promo Codes](#9-phase-8--discount--promo-codes)
10. [Phase 9 — KPI & Revenue Dashboard](#10-phase-9--kpi--revenue-dashboard)
11. [Phase 10 — Acquisition & Conversion Funnel](#11-phase-10--acquisition--conversion-funnel)
12. [Phase 11 — SEO, Social & Retention Panels](#12-phase-11--seo-social--retention-panels)
13. [Phase 12 — Push Notifications](#13-phase-12--push-notifications)
14. [File Tree Reference](#14-file-tree-reference)

--- 

## 1. Architecture Overview

### Who uses the Marketing Dashboard?
- A new Django role: `MARKETING` (separate from `superuser` / `is_staff`)
- Superusers can access everything
- Marketing users can access the dashboard but NOT the Django admin panel

### How it fits into the monorepo
```
/backend/marketing/          ← new Django app
/frontend/src/views/marketing/   ← new React views (protected route)
/frontend/src/components/marketing/  ← reusable marketing UI components
```

### Analytics Stack
| Tool | Purpose |
|------|---------|
| **Google Analytics 4** | Traffic, SEO, acquisition channels |
| **Mixpanel** | Product events (lesson booked, payment made, signup) |
| **PostHog** | Session replay, feature flags, funnel analysis |

### Key Design Decisions
- The marketing dashboard lives at `/marketing/*` on the frontend (protected, role-gated)
- All marketing data is aggregated server-side and served via `/api/marketing/*` endpoints
- Banners/carousels are managed via the `banners` Django app (already exists — extend it)
- Email campaigns use **SendGrid** (or swap for Mailgun — abstracted behind a service class)
- SMS uses **Twilio**
- Push notifications use **Expo Push API** (mobile) + **Web Push** (browser)
- Discount codes hook into the existing `payments` app

---

## 2. Phase 1 — Django Backend: Models & Admin

### 2.1 Create the `marketing` Django App

```bash
cd backend
python manage.py startapp marketing
```

Add to `backend/backend/settings.py` INSTALLED_APPS:
```python
'marketing',
```

### 2.2 Models

**File: `backend/marketing/models.py`**

```python
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


# ─────────────────────────────────────────
# BANNER / CAROUSEL  (extends existing banners app logic)
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
```

### 2.3 Extend the `accounts` User model with Marketing Role

In `backend/accounts/models.py`, add to the role choices:
```python
# Add to existing role/type choices
ROLE_MARKETING = 'marketing'
# Add to the roles tuple: ('marketing', 'Marketing')
```

### 2.4 Migrations

```bash
python manage.py makemigrations marketing
python manage.py migrate
```

---

## 3. Phase 2 — Analytics Integration

### 3.1 Install packages

```bash
pip install posthog mixpanel sendgrid twilio
```

Add to `backend/backend/settings.py`:
```python
# ─── Analytics ───────────────────────────
GOOGLE_ANALYTICS_MEASUREMENT_ID = env('GA_MEASUREMENT_ID', default='')  # G-XXXXXXXXXX
MIXPANEL_TOKEN = env('MIXPANEL_TOKEN', default='')
POSTHOG_API_KEY = env('POSTHOG_API_KEY', default='')
POSTHOG_HOST = env('POSTHOG_HOST', default='https://app.posthog.com')

# ─── Messaging ───────────────────────────
SENDGRID_API_KEY = env('SENDGRID_API_KEY', default='')
SENDGRID_FROM_EMAIL = env('SENDGRID_FROM_EMAIL', default='noreply@yourdomain.com')
TWILIO_ACCOUNT_SID = env('TWILIO_ACCOUNT_SID', default='')
TWILIO_AUTH_TOKEN = env('TWILIO_AUTH_TOKEN', default='')
TWILIO_FROM_NUMBER = env('TWILIO_FROM_NUMBER', default='')

# ─── Push ────────────────────────────────
EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
WEB_PUSH_VAPID_PUBLIC_KEY = env('VAPID_PUBLIC_KEY', default='')
WEB_PUSH_VAPID_PRIVATE_KEY = env('VAPID_PRIVATE_KEY', default='')
WEB_PUSH_VAPID_ADMIN_EMAIL = env('VAPID_ADMIN_EMAIL', default='')
```

### 3.2 Analytics Service

**File: `backend/marketing/services/analytics.py`**

```python
import posthog
import mixpanel
from django.conf import settings


class AnalyticsService:
    """
    Single interface to fire events to PostHog and Mixpanel simultaneously.
    Usage: AnalyticsService.track(user_id, 'lesson_booked', {'lesson_id': 123})
    """

    _mixpanel = None
    _posthog_initialized = False

    @classmethod
    def _get_mixpanel(cls):
        if cls._mixpanel is None and settings.MIXPANEL_TOKEN:
            cls._mixpanel = mixpanel.Mixpanel(settings.MIXPANEL_TOKEN)
        return cls._mixpanel

    @classmethod
    def _init_posthog(cls):
        if not cls._posthog_initialized and settings.POSTHOG_API_KEY:
            posthog.project_api_key = settings.POSTHOG_API_KEY
            posthog.host = settings.POSTHOG_HOST
            cls._posthog_initialized = True

    @classmethod
    def track(cls, user_id: str, event: str, properties: dict = None):
        props = properties or {}
        try:
            mp = cls._get_mixpanel()
            if mp:
                mp.track(str(user_id), event, props)
        except Exception:
            pass  # never let analytics break the app

        try:
            cls._init_posthog()
            if settings.POSTHOG_API_KEY:
                posthog.capture(str(user_id), event, props)
        except Exception:
            pass

    @classmethod
    def identify(cls, user_id: str, traits: dict):
        try:
            mp = cls._get_mixpanel()
            if mp:
                mp.people_set(str(user_id), traits)
        except Exception:
            pass

        try:
            cls._init_posthog()
            if settings.POSTHOG_API_KEY:
                posthog.identify(str(user_id), traits)
        except Exception:
            pass
```

### 3.3 Add tracking to key Django signals

**File: `backend/marketing/signals.py`**

```python
from django.db.models.signals import post_save
from django.dispatch import receiver
from accounts.models import User
from scheduling.models import Lesson
from payments.models import Payment
from .services.analytics import AnalyticsService


@receiver(post_save, sender=User)
def track_user_signup(sender, instance, created, **kwargs):
    if created:
        AnalyticsService.track(instance.id, 'user_signed_up', {
            'role': instance.role,
            'email': instance.email,
        })
        AnalyticsService.identify(instance.id, {
            '$email': instance.email,
            'role': instance.role,
            'created_at': str(instance.date_joined),
        })


@receiver(post_save, sender=Lesson)
def track_lesson_events(sender, instance, created, **kwargs):
    if created:
        AnalyticsService.track(instance.student.user.id, 'lesson_booked', {
            'lesson_id': instance.id,
            'teacher_id': instance.teacher.user.id,
            'scheduled_at': str(instance.scheduled_at),
        })
    elif instance.status == 'completed':
        AnalyticsService.track(instance.student.user.id, 'lesson_completed', {
            'lesson_id': instance.id,
        })


@receiver(post_save, sender=Payment)
def track_payment(sender, instance, created, **kwargs):
    if created and instance.status == 'paid':
        AnalyticsService.track(instance.student.user.id, 'payment_made', {
            'payment_id': instance.id,
            'amount': float(instance.amount),
            'currency': instance.currency,
        })
```

### 3.4 Frontend Analytics Setup

**File: `frontend/src/lib/analytics.ts`**

```typescript
import posthog from 'posthog-js'
import mixpanel from 'mixpanel-browser'

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID
const MIXPANEL_TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com'

export function initAnalytics() {
  if (POSTHOG_KEY) {
    posthog.init(POSTHOG_KEY, { api_host: POSTHOG_HOST, capture_pageview: false })
  }
  if (MIXPANEL_TOKEN) {
    mixpanel.init(MIXPANEL_TOKEN, { debug: import.meta.env.DEV })
  }
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  try { posthog.capture(event, properties) } catch {}
  try { mixpanel.track(event, properties) } catch {}
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  try { posthog.identify(userId, traits) } catch {}
  try { mixpanel.identify(userId); if (traits) mixpanel.people.set(traits) } catch {}
}

export function trackPageView(path: string) {
  try { posthog.capture('$pageview', { $current_url: path }) } catch {}
  // GA4 pageview is handled by the gtag script in index.html
}
```

Add to `frontend/index.html` `<head>`:
```html
<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=%VITE_GA_MEASUREMENT_ID%"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '%VITE_GA_MEASUREMENT_ID%');
</script>
```

Add `.env` variables:
```
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_MIXPANEL_TOKEN=your_token
VITE_POSTHOG_KEY=phc_your_key
VITE_POSTHOG_HOST=https://app.posthog.com
```

---

## 4. Phase 3 — REST API Endpoints

### 4.1 Permissions

**File: `backend/marketing/permissions.py`**

```python
from rest_framework.permissions import BasePermission

class IsMarketingUser(BasePermission):
    """Allow access to superusers and users with role='marketing'."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (request.user.is_superuser or getattr(request.user, 'role', None) == 'marketing')
        )
```

### 4.2 URL Structure

**File: `backend/marketing/urls.py`**

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register('banners', views.BannerViewSet)
router.register('announcements', views.AnnouncementViewSet)
router.register('email-campaigns', views.EmailCampaignViewSet)
router.register('sms-campaigns', views.SmsCampaignViewSet)
router.register('push-campaigns', views.PushCampaignViewSet)
router.register('discount-codes', views.DiscountCodeViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('metrics/kpis/', views.KPIView.as_view(), name='marketing-kpis'),
    path('metrics/funnel/', views.FunnelView.as_view(), name='marketing-funnel'),
    path('metrics/revenue/', views.RevenueView.as_view(), name='marketing-revenue'),
    path('metrics/retention/', views.RetentionView.as_view(), name='marketing-retention'),
    path('metrics/acquisition/', views.AcquisitionView.as_view(), name='marketing-acquisition'),
    path('banners/<int:pk>/track-impression/', views.TrackBannerImpressionView.as_view()),
    path('banners/<int:pk>/track-click/', views.TrackBannerClickView.as_view()),
    path('banners/active/', views.ActiveBannersView.as_view()),      # public endpoint for dashboards
    path('announcements/active/', views.ActiveAnnouncementsView.as_view()),  # public
    path('discount-codes/validate/', views.ValidateDiscountCodeView.as_view()),  # public
]
```

Register in `backend/backend/urls.py`:
```python
path('api/marketing/', include('marketing.urls')),
```

### 4.3 KPI View (most important endpoint)

**File: `backend/marketing/views.py`** (KPI section)

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Sum, Avg, Q
from django.utils import timezone
from datetime import timedelta
from accounts.models import User
from payments.models import Payment
from scheduling.models import Lesson
from .models import MarketingMetricsSnapshot
from .permissions import IsMarketingUser


class KPIView(APIView):
    permission_classes = [IsAuthenticated, IsMarketingUser]

    def get(self, request):
        now = timezone.now()
        period = request.query_params.get('period', '30')  # days
        days = int(period)
        start = now - timedelta(days=days)
        prev_start = start - timedelta(days=days)

        # Current period
        new_users = User.objects.filter(date_joined__gte=start).count()
        prev_new_users = User.objects.filter(
            date_joined__gte=prev_start, date_joined__lt=start
        ).count()

        revenue = Payment.objects.filter(
            status='paid', created_at__gte=start
        ).aggregate(total=Sum('amount'))['total'] or 0
        prev_revenue = Payment.objects.filter(
            status='paid', created_at__gte=prev_start, created_at__lt=start
        ).aggregate(total=Sum('amount'))['total'] or 0

        lessons_completed = Lesson.objects.filter(
            status='completed', scheduled_at__gte=start
        ).count()

        # Students who paid at least once (total paid base for LTV calc)
        total_paying_students = Payment.objects.filter(
            status='paid'
        ).values('student').distinct().count()

        total_revenue_all_time = Payment.objects.filter(
            status='paid'
        ).aggregate(total=Sum('amount'))['total'] or 0

        ltv = float(total_revenue_all_time / total_paying_students) if total_paying_students else 0

        # CAC: you'll want to pull ad spend from Google/Meta APIs later
        # For now return a placeholder that can be updated manually
        latest_snapshot = MarketingMetricsSnapshot.objects.order_by('-date').first()
        cac = float(latest_snapshot.cac) if latest_snapshot else 0

        # Conversion: signups who became paying students
        signups_in_period = User.objects.filter(date_joined__gte=start).count()
        paid_in_period = Payment.objects.filter(
            status='paid', created_at__gte=start
        ).values('student__user').distinct().count()
        conversion_rate = (paid_in_period / signups_in_period * 100) if signups_in_period else 0

        def pct_change(current, previous):
            if previous == 0:
                return None
            return round(((current - previous) / previous) * 100, 1)

        return Response({
            'period_days': days,
            'new_leads': {
                'value': new_users,
                'change_pct': pct_change(new_users, prev_new_users),
            },
            'revenue': {
                'value': float(revenue),
                'change_pct': pct_change(float(revenue), float(prev_revenue)),
                'currency': 'USD',
            },
            'lessons_completed': lessons_completed,
            'conversion_rate': round(conversion_rate, 2),
            'ltv': ltv,
            'cac': cac,
            'ltv_cac_ratio': round(ltv / cac, 2) if cac else None,
            'roas': None,  # Requires ad spend API integration (Phase 11)
        })
```

---

## 5. Phase 4 — Frontend: Marketing Dashboard Shell

### 5.1 Install frontend dependencies

```bash
cd frontend
npm install recharts @tanstack/react-query axios date-fns
npm install @dnd-kit/core @dnd-kit/sortable   # for drag-and-drop banner ordering
npm install react-quill                         # rich text editor for email campaigns
npm install posthog-js mixpanel-browser
```

### 5.2 Route Setup

**File: `frontend/src/router.tsx`** — add marketing routes:

```tsx
import { lazy } from 'react'
import { RouteObject } from 'react-router-dom'

const MarketingLayout = lazy(() => import('./views/marketing/MarketingLayout'))
const MarketingOverview = lazy(() => import('./views/marketing/Overview'))
const BannerManager = lazy(() => import('./views/marketing/BannerManager'))
const AnnouncementManager = lazy(() => import('./views/marketing/AnnouncementManager'))
const EmailCampaigns = lazy(() => import('./views/marketing/EmailCampaigns'))
const SmsCampaigns = lazy(() => import('./views/marketing/SmsCampaigns'))
const PushCampaigns = lazy(() => import('./views/marketing/PushCampaigns'))
const DiscountCodes = lazy(() => import('./views/marketing/DiscountCodes'))
const RevenuePanel = lazy(() => import('./views/marketing/RevenuePanel'))
const FunnelPanel = lazy(() => import('./views/marketing/FunnelPanel'))
const RetentionPanel = lazy(() => import('./views/marketing/RetentionPanel'))

export const marketingRoutes: RouteObject[] = [
  {
    path: '/marketing',
    element: <MarketingLayout />,   // checks role === 'marketing' || is_superuser
    children: [
      { index: true, element: <MarketingOverview /> },
      { path: 'banners', element: <BannerManager /> },
      { path: 'announcements', element: <AnnouncementManager /> },
      { path: 'email', element: <EmailCampaigns /> },
      { path: 'sms', element: <SmsCampaigns /> },
      { path: 'push', element: <PushCampaigns /> },
      { path: 'discounts', element: <DiscountCodes /> },
      { path: 'revenue', element: <RevenuePanel /> },
      { path: 'funnel', element: <FunnelPanel /> },
      { path: 'retention', element: <RetentionPanel /> },
    ],
  },
]
```

### 5.3 Marketing Layout with Sidebar

**File: `frontend/src/views/marketing/MarketingLayout.tsx`**

```tsx
import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const NAV = [
  { label: 'Overview',      path: '/marketing',             icon: '📊' },
  { label: 'Banners',       path: '/marketing/banners',     icon: '🖼️' },
  { label: 'Announcements', path: '/marketing/announcements', icon: '📢' },
  { label: 'Email',         path: '/marketing/email',       icon: '✉️' },
  { label: 'SMS',           path: '/marketing/sms',         icon: '💬' },
  { label: 'Push',          path: '/marketing/push',        icon: '🔔' },
  { label: 'Discounts',     path: '/marketing/discounts',   icon: '🏷️' },
  { label: 'Revenue',       path: '/marketing/revenue',     icon: '💰' },
  { label: 'Funnel',        path: '/marketing/funnel',      icon: '🔽' },
  { label: 'Retention',     path: '/marketing/retention',   icon: '🔄' },
]

export default function MarketingLayout() {
  const { user } = useAuth()

  if (!user?.is_superuser && user?.role !== 'marketing') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="flex h-screen bg-stone-50 font-sans">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-stone-200 flex flex-col py-6 px-3 gap-1 shrink-0">
        <div className="px-3 mb-4">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Marketing</p>
        </div>
        {NAV.map(({ label, path, icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/marketing'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors
               ${isActive
                 ? 'bg-amber-50 text-amber-800 font-medium'
                 : 'text-stone-600 hover:bg-stone-100'}`
            }
          >
            <span>{icon}</span>
            {label}
          </NavLink>
        ))}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  )
}
```

### 5.4 KPI Card Component

**File: `frontend/src/components/marketing/KpiCard.tsx`**

```tsx
interface KpiCardProps {
  label: string
  value: string | number
  change?: number | null
  prefix?: string
  suffix?: string
  description?: string
}

export function KpiCard({ label, value, change, prefix, suffix, description }: KpiCardProps) {
  const isPositive = change !== null && change !== undefined && change > 0
  const isNegative = change !== null && change !== undefined && change < 0

  return (
    <div className="bg-white rounded-lg border border-stone-200 p-5 flex flex-col gap-1">
      <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold text-stone-800">
        {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
      </p>
      {change !== null && change !== undefined && (
        <p className={`text-xs font-medium ${isPositive ? 'text-emerald-600' : isNegative ? 'text-red-500' : 'text-stone-400'}`}>
          {isPositive ? '↑' : isNegative ? '↓' : '–'} {Math.abs(change)}% vs prev period
        </p>
      )}
      {description && <p className="text-xs text-stone-400 mt-1">{description}</p>}
    </div>
  )
}
```

### 5.5 Overview Page

**File: `frontend/src/views/marketing/Overview.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query'
import { KpiCard } from '../../components/marketing/KpiCard'
import { api } from '../../lib/api'
import { useState } from 'react'

export default function MarketingOverview() {
  const [period, setPeriod] = useState(30)

  const { data, isLoading } = useQuery({
    queryKey: ['marketing-kpis', period],
    queryFn: () => api.get(`/marketing/metrics/kpis/?period=${period}`).then(r => r.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-800">Marketing Overview</h1>
        <select
          value={period}
          onChange={e => setPeriod(Number(e.target.value))}
          className="border border-stone-200 rounded-md px-3 py-1.5 text-sm text-stone-600"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-stone-200 p-5 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="New Leads" value={data?.new_leads?.value} change={data?.new_leads?.change_pct} />
          <KpiCard label="Revenue" value={data?.revenue?.value} prefix="$" change={data?.revenue?.change_pct} />
          <KpiCard label="Conversion Rate" value={data?.conversion_rate} suffix="%" />
          <KpiCard label="LTV" value={data?.ltv?.toFixed(0)} prefix="$" description="Avg lifetime value" />
          <KpiCard label="CAC" value={data?.cac?.toFixed(0)} prefix="$" description="Customer acq. cost" />
          <KpiCard label="LTV:CAC" value={data?.ltv_cac_ratio ?? '—'} description="Target: > 3x" />
          <KpiCard label="ROAS" value={data?.roas ?? '—'} description="Return on ad spend" />
          <KpiCard label="Lessons Done" value={data?.lessons_completed} />
        </div>
      )}

      {/* Charts row — wired up in Phase 9 */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-stone-200 p-5 h-64 flex items-center justify-center text-stone-300 text-sm">
          Revenue chart — Phase 9
        </div>
        <div className="bg-white rounded-lg border border-stone-200 p-5 h-64 flex items-center justify-center text-stone-300 text-sm">
          Funnel chart — Phase 10
        </div>
      </div>
    </div>
  )
}
```

---

## 6. Phase 5 — Banner & Carousel Manager

### 6.1 Banner Manager View

**File: `frontend/src/views/marketing/BannerManager.tsx`**

Features to implement:
- List all banners with live/scheduled/expired status badges
- Drag-and-drop reordering (uses `@dnd-kit/sortable`)
- Create/edit modal with fields: title, subtitle, image upload, CTA, colors, target audience, date range
- Toggle active/inactive
- Impression & CTR stats per banner
- Preview pane showing how it looks on student vs teacher dashboard

```tsx
// Full implementation: use DndContext + SortableContext from @dnd-kit
// PATCH /api/marketing/banners/<id>/ to update order
// POST /api/marketing/banners/ to create
// DELETE /api/marketing/banners/<id>/ to delete
// GET /api/marketing/banners/active/?audience=student for the student dashboard
```

### 6.2 Wire banners into Student Dashboard

**File: `frontend/src/views/student/Dashboard.tsx`** — add at top:

```tsx
import { BannerCarousel } from '../../components/marketing/BannerCarousel'

// Inside JSX, at the top of the dashboard:
<BannerCarousel audience="student" />
```

**File: `frontend/src/components/marketing/BannerCarousel.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { api } from '../../lib/api'

interface Banner {
  id: number
  title: string
  subtitle: string
  image_url: string
  cta_text: string
  cta_url: string
  background_color: string
  text_color: string
}

export function BannerCarousel({ audience }: { audience: 'student' | 'teacher' }) {
  const [index, setIndex] = useState(0)

  const { data: banners = [] } = useQuery<Banner[]>({
    queryKey: ['active-banners', audience],
    queryFn: () => api.get(`/marketing/banners/active/?audience=${audience}`).then(r => r.data),
    staleTime: 5 * 60 * 1000,  // cache 5 min
  })

  // Track impression
  useEffect(() => {
    if (banners[index]) {
      api.post(`/marketing/banners/${banners[index].id}/track-impression/`)
    }
  }, [index, banners])

  if (!banners.length) return null

  const banner = banners[index]

  return (
    <div
      className="rounded-xl p-6 mb-6 flex items-center justify-between relative overflow-hidden"
      style={{ backgroundColor: banner.background_color, color: banner.text_color }}
    >
      <div className="space-y-1 z-10">
        <h2 className="text-lg font-semibold">{banner.title}</h2>
        {banner.subtitle && <p className="text-sm opacity-80">{banner.subtitle}</p>}
        {banner.cta_text && (
          <a
            href={banner.cta_url}
            onClick={() => api.post(`/marketing/banners/${banner.id}/track-click/`)}
            className="inline-block mt-2 px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-md text-sm font-medium transition-colors"
          >
            {banner.cta_text}
          </a>
        )}
      </div>

      {banners.length > 1 && (
        <div className="flex gap-1.5 absolute bottom-3 left-1/2 -translate-x-1/2">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === index ? 'bg-current w-3' : 'bg-current opacity-40'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

---

## 7. Phase 6 — Announcements & Notifications

### 7.1 Announcement Bar Component

**File: `frontend/src/components/marketing/AnnouncementBar.tsx`**

```tsx
// Fetches active announcements for the current user role
// Shows as a dismissible top bar
// Stores dismissed IDs in localStorage so they don't reappear
// Cycles through multiple announcements if more than one
```

Wire into `frontend/src/layouts/AppLayout.tsx` above the main nav.

---

## 8. Phase 7 — Email & SMS Campaigns

### 8.1 Email Service

**File: `backend/marketing/services/email.py`**

```python
import sendgrid
from sendgrid.helpers.mail import Mail, To
from django.conf import settings
from django.contrib.auth import get_user_model
from ..models import EmailCampaign

User = get_user_model()


class EmailCampaignService:

    @staticmethod
    def get_audience_queryset(campaign: EmailCampaign):
        from django.utils import timezone
        from datetime import timedelta
        qs = User.objects.filter(is_active=True)
        audience = campaign.audience
        if audience == 'students':
            qs = qs.filter(role='student')
        elif audience == 'teachers':
            qs = qs.filter(role='teacher')
        elif audience == 'inactive_students':
            cutoff = timezone.now() - timedelta(days=30)
            qs = qs.filter(role='student', last_login__lt=cutoff)
        elif audience == 'new_signups':
            cutoff = timezone.now() - timedelta(days=7)
            qs = qs.filter(date_joined__gte=cutoff)
        return qs

    @classmethod
    def send_campaign(cls, campaign: EmailCampaign):
        sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        recipients = cls.get_audience_queryset(campaign)
        campaign.status = 'sending'
        campaign.recipients_count = recipients.count()
        campaign.save(update_fields=['status', 'recipients_count'])

        # Send in batches of 1000 (SendGrid limit)
        batch = []
        for user in recipients.iterator():
            batch.append(To(email=user.email, dynamic_template_data={'name': user.full_name}))
            if len(batch) >= 1000:
                cls._send_batch(sg, campaign, batch)
                batch = []
        if batch:
            cls._send_batch(sg, campaign, batch)

        from django.utils import timezone
        campaign.status = 'sent'
        campaign.sent_at = timezone.now()
        campaign.save(update_fields=['status', 'sent_at'])

    @staticmethod
    def _send_batch(sg, campaign, recipients):
        message = Mail(
            from_email=settings.SENDGRID_FROM_EMAIL,
            subject=campaign.subject,
            html_content=campaign.html_body,
        )
        message.to = recipients
        sg.send(message)
```

### 8.2 Celery Task for Campaign Sending

**File: `backend/marketing/tasks.py`**

```python
from celery import shared_task


@shared_task(bind=True, max_retries=3)
def send_email_campaign_task(self, campaign_id):
    from .models import EmailCampaign
    from .services.email import EmailCampaignService
    try:
        campaign = EmailCampaign.objects.get(id=campaign_id)
        EmailCampaignService.send_campaign(campaign)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


@shared_task
def send_scheduled_campaigns():
    """Run every 5 minutes via Celery beat."""
    from django.utils import timezone
    from .models import EmailCampaign, SmsCampaign, PushCampaign

    now = timezone.now()
    due_emails = EmailCampaign.objects.filter(
        status='scheduled', scheduled_at__lte=now
    )
    for campaign in due_emails:
        send_email_campaign_task.delay(campaign.id)


@shared_task
def snapshot_daily_metrics():
    """Run at midnight via Celery beat. Stores daily KPI snapshot."""
    from django.utils import timezone
    from datetime import timedelta
    from django.db.models import Sum
    from accounts.models import User
    from payments.models import Payment
    from scheduling.models import Lesson
    from .models import MarketingMetricsSnapshot

    today = timezone.now().date()
    yesterday = today - timedelta(days=1)

    snap, _ = MarketingMetricsSnapshot.objects.get_or_create(date=yesterday)
    snap.new_signups = User.objects.filter(date_joined__date=yesterday).count()
    snap.revenue_total = Payment.objects.filter(
        status='paid', created_at__date=yesterday
    ).aggregate(t=Sum('amount'))['t'] or 0
    snap.lessons_booked = Lesson.objects.filter(created_at__date=yesterday).count()
    snap.lessons_completed = Lesson.objects.filter(
        status='completed', scheduled_at__date=yesterday
    ).count()
    snap.save()
```

Add to Celery beat schedule in settings:
```python
CELERY_BEAT_SCHEDULE = {
    'send-scheduled-campaigns': {
        'task': 'marketing.tasks.send_scheduled_campaigns',
        'schedule': 300,  # every 5 minutes
    },
    'snapshot-daily-metrics': {
        'task': 'marketing.tasks.snapshot_daily_metrics',
        'schedule': crontab(hour=0, minute=5),  # 12:05am daily
    },
}
```

---

## 9. Phase 8 — Discount & Promo Codes

### 9.1 Integrate with Payments App

In `backend/payments/views.py` (wherever payment is processed), add:

```python
from marketing.models import DiscountCode, DiscountCodeUsage

def apply_discount_code(code_str: str, user, amount: float) -> float:
    try:
        code = DiscountCode.objects.get(code=code_str.upper())
    except DiscountCode.DoesNotExist:
        raise ValueError("Invalid discount code")

    if not code.is_valid:
        raise ValueError("This code has expired or reached its usage limit")

    already_used = DiscountCodeUsage.objects.filter(code=code, user=user).count()
    if already_used >= code.max_uses_per_user:
        raise ValueError("You have already used this code")

    if amount < float(code.min_purchase_amount):
        raise ValueError(f"Minimum purchase of ${code.min_purchase_amount} required")

    if code.discount_type == 'percent':
        discount = amount * float(code.discount_value) / 100
    elif code.discount_type == 'fixed':
        discount = min(float(code.discount_value), amount)
    else:
        discount = 0  # free_credits handled separately

    return round(discount, 2)
```

---

## 10. Phase 9 — KPI & Revenue Dashboard

### 10.1 Revenue Chart

**File: `frontend/src/views/marketing/RevenuePanel.tsx`**

```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

export default function RevenuePanel() {
  const { data } = useQuery({
    queryKey: ['marketing-revenue'],
    queryFn: () => api.get('/marketing/metrics/revenue/').then(r => r.data),
  })

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-stone-800">Revenue & Pipeline</h1>
      <div className="bg-white rounded-lg border border-stone-200 p-5">
        <h2 className="text-sm font-medium text-stone-500 mb-4">Revenue (last 90 days)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data?.daily_revenue || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe2" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="revenue" stroke="#d97706" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

---

## 11. Phase 10 — Acquisition & Conversion Funnel

### 11.1 Funnel Steps

Define the conversion funnel for the EdTech platform:

```
Landing Page Visit → Signup → Profile Completed → First Lesson Booked → First Lesson Completed → First Payment
```

### 11.2 Funnel API Endpoint

**File: `backend/marketing/views.py`** (add FunnelView):

```python
class FunnelView(APIView):
    permission_classes = [IsAuthenticated, IsMarketingUser]

    def get(self, request):
        from datetime import timedelta
        from django.utils import timezone
        from accounts.models import StudentProfile
        from scheduling.models import Lesson
        from payments.models import Payment

        days = int(request.query_params.get('period', 30))
        start = timezone.now() - timedelta(days=days)

        signups = User.objects.filter(date_joined__gte=start).count()
        profiles_completed = StudentProfile.objects.filter(
            user__date_joined__gte=start
        ).count()
        first_lesson_booked = Lesson.objects.filter(
            created_at__gte=start
        ).values('student').distinct().count()
        first_lesson_completed = Lesson.objects.filter(
            status='completed', scheduled_at__gte=start
        ).values('student').distinct().count()
        first_payment = Payment.objects.filter(
            status='paid', created_at__gte=start
        ).values('student').distinct().count()

        return Response({
            'funnel': [
                {'step': 'Signed Up',               'count': signups},
                {'step': 'Profile Completed',        'count': profiles_completed},
                {'step': 'First Lesson Booked',      'count': first_lesson_booked},
                {'step': 'First Lesson Completed',   'count': first_lesson_completed},
                {'step': 'First Payment',            'count': first_payment},
            ]
        })
```

---

## 12. Phase 11 — SEO, Social & Retention Panels

### 12.1 Retention (Churn) View

```python
class RetentionView(APIView):
    permission_classes = [IsAuthenticated, IsMarketingUser]

    def get(self, request):
        from datetime import timedelta
        from django.utils import timezone

        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)
        sixty_days_ago = now - timedelta(days=60)

        active_students = User.objects.filter(
            role='student', last_login__gte=thirty_days_ago
        ).count()
        churned_students = User.objects.filter(
            role='student',
            last_login__lt=thirty_days_ago,
            last_login__gte=sixty_days_ago
        ).count()
        total_students = User.objects.filter(role='student').count()

        churn_rate = (churned_students / total_students * 100) if total_students else 0

        return Response({
            'active_students_30d': active_students,
            'churned_students_30d': churned_students,
            'total_students': total_students,
            'churn_rate': round(churn_rate, 2),
            'retention_rate': round(100 - churn_rate, 2),
        })
```

### 12.2 SEO Panel

The SEO panel pulls from Google Search Console API. Add:

```python
# settings.py
GOOGLE_SEARCH_CONSOLE_SITE_URL = env('GSC_SITE_URL', default='')
GOOGLE_SERVICE_ACCOUNT_KEY_PATH = env('GOOGLE_SA_KEY_PATH', default='')
```

For now, the SEO panel displays:
- Manual input fields for key metrics (domain authority, top keywords)
- Embedded iframe to Google Search Console (with SSO if available)
- Link-outs to GSC, Ahrefs, Semrush

### 12.3 Social Media Panel

Display-only panel that embeds or links to:
- Social media stats (manually updated or via Buffer/Hootsuite API)
- Top performing posts (manual input initially)
- Follower growth chart (data from `MarketingMetricsSnapshot`)

---

## 13. Phase 12 — Push Notifications

### 13.1 Store Device Tokens

**File: `backend/marketing/models.py`** — add:

```python
class PushToken(models.Model):
    PLATFORM_CHOICES = [('expo', 'Expo Mobile'), ('web', 'Web Browser')]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='push_tokens')
    token = models.TextField()
    platform = models.CharField(max_length=10, choices=PLATFORM_CHOICES)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'token']
```

### 13.2 Expo Push Service

**File: `backend/marketing/services/push.py`**

```python
import requests
from django.conf import settings
from ..models import PushToken, PushCampaign


class PushService:

    @staticmethod
    def send_to_user(user_id: int, title: str, body: str, data: dict = None):
        tokens = PushToken.objects.filter(user_id=user_id, platform='expo', is_active=True)
        messages = [
            {
                'to': t.token,
                'title': title,
                'body': body,
                'data': data or {},
                'sound': 'default',
            }
            for t in tokens
        ]
        if messages:
            PushService._send_expo_batch(messages)

    @staticmethod
    def _send_expo_batch(messages: list):
        response = requests.post(
            settings.EXPO_PUSH_URL,
            json=messages,
            headers={'Content-Type': 'application/json'},
            timeout=30,
        )
        return response.json()
```

### 13.3 Register Expo Token (Mobile)

In `mobileapp/src/`, add a hook:

```typescript
// mobileapp/src/hooks/usePushToken.ts
import * as Notifications from 'expo-notifications'
import { api } from '../lib/api'

export async function registerPushToken() {
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return

  const token = (await Notifications.getExpoPushTokenAsync()).data
  await api.post('/marketing/push-tokens/', { token, platform: 'expo' })
}
```

---

## 14. File Tree Reference

```
backend/
├── marketing/
│   ├── __init__.py
│   ├── admin.py
│   ├── apps.py
│   ├── models.py              ← All marketing models
│   ├── permissions.py         ← IsMarketingUser
│   ├── serializers.py         ← DRF serializers for all models
│   ├── signals.py             ← Analytics event tracking
│   ├── tasks.py               ← Celery tasks (campaigns, snapshots)
│   ├── urls.py                ← All /api/marketing/* routes
│   ├── views.py               ← ViewSets + KPI/Funnel/Retention views
│   └── services/
│       ├── __init__.py
│       ├── analytics.py       ← PostHog + Mixpanel wrapper
│       ├── email.py           ← SendGrid campaign service
│       ├── sms.py             ← Twilio SMS service
│       └── push.py            ← Expo + Web Push service

frontend/src/
├── lib/
│   └── analytics.ts           ← GA4 + PostHog + Mixpanel init
├── components/marketing/
│   ├── KpiCard.tsx
│   ├── BannerCarousel.tsx     ← Used in student/teacher dashboards
│   ├── AnnouncementBar.tsx    ← Used in AppLayout
│   └── charts/
│       ├── RevenueChart.tsx
│       ├── FunnelChart.tsx
│       └── RetentionChart.tsx
└── views/marketing/
    ├── MarketingLayout.tsx    ← Sidebar + role guard
    ├── Overview.tsx           ← Main KPI dashboard
    ├── BannerManager.tsx      ← Drag-drop banner CRUD
    ├── AnnouncementManager.tsx
    ├── EmailCampaigns.tsx     ← List + rich text editor
    ├── SmsCampaigns.tsx
    ├── PushCampaigns.tsx
    ├── DiscountCodes.tsx
    ├── RevenuePanel.tsx
    ├── FunnelPanel.tsx
    └── RetentionPanel.tsx

mobileapp/src/
└── hooks/
    └── usePushToken.ts        ← Register Expo push token
```

---

## Implementation Order (Recommended)

| # | Task | Why first |
|---|------|-----------|
| 1 | Phase 1 — Models + migrations | Everything depends on this |
| 2 | Phase 2 — Analytics wiring | Capture data from day 1 |
| 3 | Phase 3 — API endpoints | Frontend needs these |
| 4 | Phase 4 — Dashboard shell + KPI cards | Visible value immediately |
| 5 | Phase 5 — Banner/Carousel | Replaces Django admin for banners |
| 6 | Phase 6 — Announcements | Quick win, high visibility |
| 7 | Phase 8 — Discount codes | Revenue impact |
| 8 | Phase 7 — Email campaigns | Biggest marketing lever |
| 9 | Phase 12 — Push notifications | Mobile engagement |
| 10 | Phase 9–11 — Charts & deep analytics | Refinement |

---

## Environment Variables Checklist

```bash
# backend/.env
GA_MEASUREMENT_ID=G-XXXXXXXXXX
MIXPANEL_TOKEN=
POSTHOG_API_KEY=
POSTHOG_HOST=https://app.posthog.com
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=hello@yourdomain.com
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=+1xxxxxxxxxx
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_ADMIN_EMAIL=admin@yourdomain.com
GSC_SITE_URL=https://yourdomain.com

# frontend/.env
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_MIXPANEL_TOKEN=
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=https://app.posthog.com
```

---

*Generated for: EdTech Platform · Django + React + Vite + PostgreSQL + Expo*  
*Start with Phase 1 and work through each phase in sequence.*
