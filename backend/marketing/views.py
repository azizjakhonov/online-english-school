from datetime import timedelta

from django.db.models import Count, Sum, Avg, Q, F
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from payments.models import Payment
from scheduling.models import Lesson

from .models import (
    Banner, Announcement, EmailCampaign, SmsCampaign,
    DiscountCode, DiscountCodeUsage, PushCampaign, PushToken,
    MarketingMetricsSnapshot,
)
from .permissions import IsMarketingUser
from .serializers import (
    BannerSerializer, AnnouncementSerializer, EmailCampaignSerializer,
    SmsCampaignSerializer, DiscountCodeSerializer, DiscountCodeUsageSerializer,
    PushCampaignSerializer, PushTokenSerializer, MarketingMetricsSnapshotSerializer,
)


# ─────────────────────────────────────────────────────────────────────────────
# VIEWSETS  (full CRUD, marketing-gated)
# ─────────────────────────────────────────────────────────────────────────────

class BannerViewSet(viewsets.ModelViewSet):
    queryset = Banner.objects.all()
    serializer_class = BannerSerializer
    permission_classes = [IsAuthenticated, IsMarketingUser]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx


class AnnouncementViewSet(viewsets.ModelViewSet):
    queryset = Announcement.objects.all()
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAuthenticated, IsMarketingUser]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class EmailCampaignViewSet(viewsets.ModelViewSet):
    queryset = EmailCampaign.objects.all()
    serializer_class = EmailCampaignSerializer
    permission_classes = [IsAuthenticated, IsMarketingUser]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """POST /api/marketing/email-campaigns/<pk>/send/"""
        campaign = self.get_object()
        if campaign.status not in ('draft', 'scheduled', 'failed'):
            return Response(
                {'error': f'Cannot send a campaign with status "{campaign.status}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            from .tasks import send_email_campaign
            send_email_campaign(campaign.id)
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        campaign.refresh_from_db()
        return Response({
            'status':          campaign.status,
            'delivered_count': campaign.delivered_count,
            'bounced_count':   campaign.bounced_count,
        })


class SmsCampaignViewSet(viewsets.ModelViewSet):
    queryset = SmsCampaign.objects.all()
    serializer_class = SmsCampaignSerializer
    permission_classes = [IsAuthenticated, IsMarketingUser]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """POST /api/marketing/sms-campaigns/<pk>/send/"""
        campaign = self.get_object()
        if campaign.status not in ('draft', 'scheduled', 'failed'):
            return Response(
                {'error': f'Cannot send a campaign with status "{campaign.status}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            from .tasks import send_sms_campaign
            send_sms_campaign(campaign.id)
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        campaign.refresh_from_db()
        return Response({
            'status':          campaign.status,
            'delivered_count': campaign.delivered_count,
            'failed_count':    campaign.failed_count,
        })


class PushCampaignViewSet(viewsets.ModelViewSet):
    queryset = PushCampaign.objects.all()
    serializer_class = PushCampaignSerializer
    permission_classes = [IsAuthenticated, IsMarketingUser]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """POST /api/marketing/push-campaigns/<pk>/send/"""
        campaign = self.get_object()
        if campaign.status not in ('draft', 'scheduled', 'failed'):
            return Response(
                {'error': f'Cannot send a campaign with status "{campaign.status}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            from .tasks import send_push_campaign
            send_push_campaign(campaign.id)
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        campaign.refresh_from_db()
        return Response({
            'status':          campaign.status,
            'delivered_count': campaign.delivered_count,
            'recipients_count': campaign.recipients_count,
        })


class DiscountCodeViewSet(viewsets.ModelViewSet):
    queryset = DiscountCode.objects.all()
    serializer_class = DiscountCodeSerializer
    permission_classes = [IsAuthenticated, IsMarketingUser]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


# ─────────────────────────────────────────────────────────────────────────────
# BANNER: public endpoints (track impression/click, active list)
# ─────────────────────────────────────────────────────────────────────────────

class ActiveBannersView(APIView):
    """
    GET /api/marketing/banners/active/?audience=student|teacher|both|landing
    Public — no auth required. Returns currently live banners for the given audience.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        now = timezone.now()
        audience = request.query_params.get('audience', 'both')
        audience_q = Q(target_audience=audience) | Q(target_audience='both')

        banners = Banner.objects.filter(
            audience_q,
            is_active=True,
        ).filter(
            Q(starts_at__isnull=True) | Q(starts_at__lte=now),
            Q(ends_at__isnull=True)   | Q(ends_at__gte=now),
        ).order_by('order', '-created_at')

        serializer = BannerSerializer(banners, many=True, context={'request': request})
        return Response(serializer.data)


class TrackBannerImpressionView(APIView):
    """POST /api/marketing/banners/<pk>/track-impression/ — public, no auth."""
    permission_classes = [AllowAny]

    def post(self, request, pk):
        Banner.objects.filter(pk=pk).update(impressions=F('impressions') + 1)
        return Response(status=status.HTTP_204_NO_CONTENT)


class TrackBannerClickView(APIView):
    """POST /api/marketing/banners/<pk>/track-click/ — public, no auth."""
    permission_classes = [AllowAny]

    def post(self, request, pk):
        Banner.objects.filter(pk=pk).update(clicks=F('clicks') + 1)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# ANNOUNCEMENTS: public active list
# ─────────────────────────────────────────────────────────────────────────────

class ActiveAnnouncementsView(APIView):
    """
    GET /api/marketing/announcements/active/?audience=student|teacher|both
    Public — returns currently active announcements, sorted by priority desc.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        now = timezone.now()
        audience = request.query_params.get('audience', 'both')
        audience_q = Q(target_audience=audience) | Q(target_audience='both')

        announcements = Announcement.objects.filter(
            audience_q,
            is_active=True,
        ).filter(
            Q(starts_at__isnull=True) | Q(starts_at__lte=now),
            Q(ends_at__isnull=True)   | Q(ends_at__gte=now),
        ).order_by('-priority', '-created_at')

        serializer = AnnouncementSerializer(announcements, many=True)
        return Response(serializer.data)


# ─────────────────────────────────────────────────────────────────────────────
# DISCOUNT CODE: public validate endpoint
# ─────────────────────────────────────────────────────────────────────────────

class ValidateDiscountCodeView(APIView):
    """
    POST /api/marketing/discount-codes/validate/
    Body: { "code": "SUMMER20", "amount": 500000 }
    Public — validates a promo code before checkout. Returns discount details.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        code_str = request.data.get('code', '').strip().upper()
        amount = float(request.data.get('amount', 0) or 0)

        try:
            code = DiscountCode.objects.get(code=code_str)
        except DiscountCode.DoesNotExist:
            return Response({'valid': False, 'error': 'Invalid discount code.'}, status=400)

        if not code.is_valid:
            return Response({'valid': False, 'error': 'This code has expired or reached its usage limit.'}, status=400)

        if amount < float(code.min_purchase_amount):
            return Response({
                'valid': False,
                'error': f'Minimum purchase of {code.min_purchase_amount} required.',
            }, status=400)

        if code.discount_type == 'percent':
            discount_amount = round(amount * float(code.discount_value) / 100, 2)
        elif code.discount_type == 'fixed':
            discount_amount = min(float(code.discount_value), amount)
        else:  # free_credits
            discount_amount = 0

        return Response({
            'valid':           True,
            'code':            code.code,
            'discount_type':   code.discount_type,
            'discount_value':  float(code.discount_value),
            'discount_amount': discount_amount,
            'free_credits':    int(code.discount_value) if code.discount_type == 'free_credits' else 0,
        })


# ─────────────────────────────────────────────────────────────────────────────
# PUSH TOKENS: authenticated registration
# ─────────────────────────────────────────────────────────────────────────────

class PushTokenView(APIView):
    """
    POST /api/marketing/push-tokens/
    Register or refresh an Expo/web push token for the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get('token', '').strip()
        platform = request.data.get('platform', 'expo')
        if not token:
            return Response({'error': 'token is required.'}, status=400)

        obj, _ = PushToken.objects.get_or_create(
            user=request.user,
            token=token,
            defaults={'platform': platform, 'is_active': True},
        )
        obj.is_active = True
        obj.platform = platform
        obj.save(update_fields=['is_active', 'platform'])
        return Response(PushTokenSerializer(obj).data, status=status.HTTP_201_CREATED)

    def delete(self, request):
        token = request.data.get('token', '').strip()
        PushToken.objects.filter(user=request.user, token=token).update(is_active=False)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# KPI VIEW
# ─────────────────────────────────────────────────────────────────────────────

def _pct_change(current, previous):
    """Return percentage change from previous to current, or None if previous is 0."""
    if not previous:
        return None
    return round(((current - previous) / previous) * 100, 1)


class KPIView(APIView):
    """
    GET /api/marketing/metrics/kpis/?period=30
    Core KPI metrics for the marketing dashboard.
    """
    permission_classes = [IsAuthenticated, IsMarketingUser]

    def get(self, request):
        now = timezone.now()
        days = int(request.query_params.get('period', 30))
        start = now - timedelta(days=days)
        prev_start = start - timedelta(days=days)

        # ── New users ──────────────────────────────────────────────────────
        new_users = User.objects.filter(date_joined__gte=start).count()
        prev_new_users = User.objects.filter(
            date_joined__gte=prev_start, date_joined__lt=start
        ).count()

        # ── Revenue (UZS) ─────────────────────────────────────────────────
        revenue = (
            Payment.objects
            .filter(status='succeeded', created_at__gte=start)
            .aggregate(total=Sum('amount_uzs'))['total'] or 0
        )
        prev_revenue = (
            Payment.objects
            .filter(status='succeeded', created_at__gte=prev_start, created_at__lt=start)
            .aggregate(total=Sum('amount_uzs'))['total'] or 0
        )

        # ── Lessons completed ─────────────────────────────────────────────
        lessons_completed = Lesson.objects.filter(
            status='COMPLETED', start_time__gte=start
        ).count()

        # ── LTV ───────────────────────────────────────────────────────────
        total_paying_students = (
            Payment.objects
            .filter(status='succeeded')
            .values('student').distinct().count()
        )
        total_revenue_all_time = (
            Payment.objects
            .filter(status='succeeded')
            .aggregate(total=Sum('amount_uzs'))['total'] or 0
        )
        ltv = float(total_revenue_all_time / total_paying_students) if total_paying_students else 0

        # ── CAC (stored in latest snapshot; manual until ad-spend API) ────
        latest_snapshot = MarketingMetricsSnapshot.objects.order_by('-date').first()
        cac = float(latest_snapshot.cac) if latest_snapshot else 0

        # ── Conversion rate ───────────────────────────────────────────────
        signups_in_period = User.objects.filter(date_joined__gte=start).count()
        paid_in_period = (
            Payment.objects
            .filter(status='succeeded', created_at__gte=start)
            .values('student').distinct().count()
        )
        conversion_rate = (paid_in_period / signups_in_period * 100) if signups_in_period else 0

        return Response({
            'period_days': days,
            'new_leads': {
                'value':      new_users,
                'change_pct': _pct_change(new_users, prev_new_users),
            },
            'revenue': {
                'value':      float(revenue),
                'change_pct': _pct_change(float(revenue), float(prev_revenue)),
                'currency':   'UZS',
            },
            'lessons_completed': lessons_completed,
            'conversion_rate':   round(conversion_rate, 2),
            'ltv':               round(ltv, 2),
            'cac':               round(cac, 2),
            'ltv_cac_ratio':     round(ltv / cac, 2) if cac else None,
            'roas':              None,  # Requires ad-spend API (Phase 11)
        })


# ─────────────────────────────────────────────────────────────────────────────
# REVENUE VIEW
# ─────────────────────────────────────────────────────────────────────────────

class RevenueView(APIView):
    """
    GET /api/marketing/metrics/revenue/?period=90
    Daily revenue series + package breakdown.
    """
    permission_classes = [IsAuthenticated, IsMarketingUser]

    def get(self, request):
        now = timezone.now()
        days = int(request.query_params.get('period', 90))
        start = now - timedelta(days=days)

        # Daily revenue
        daily = (
            Payment.objects
            .filter(status='succeeded', created_at__gte=start)
            .annotate(date=TruncDate('created_at'))
            .values('date')
            .annotate(revenue=Sum('amount_uzs'), count=Count('id'))
            .order_by('date')
        )
        daily_revenue = [
            {'date': str(row['date']), 'revenue': float(row['revenue']), 'payments': row['count']}
            for row in daily
        ]

        # Summary totals
        total = (
            Payment.objects
            .filter(status='succeeded', created_at__gte=start)
            .aggregate(total=Sum('amount_uzs'), count=Count('id'))
        )
        total_revenue = float(total['total'] or 0)
        total_payments = total['count'] or 0
        avg_order = round(total_revenue / total_payments, 2) if total_payments else 0

        return Response({
            'period_days':    days,
            'total_revenue':  total_revenue,
            'total_payments': total_payments,
            'avg_order_value': avg_order,
            'currency':       'UZS',
            'daily_revenue':  daily_revenue,
        })


# ─────────────────────────────────────────────────────────────────────────────
# FUNNEL VIEW
# ─────────────────────────────────────────────────────────────────────────────

class FunnelView(APIView):
    """
    GET /api/marketing/metrics/funnel/?period=30
    Conversion funnel: Signup → Profile → Lesson booked → Lesson completed → Payment
    """
    permission_classes = [IsAuthenticated, IsMarketingUser]

    def get(self, request):
        from accounts.models import StudentProfile

        days = int(request.query_params.get('period', 30))
        start = timezone.now() - timedelta(days=days)

        signups = User.objects.filter(date_joined__gte=start).count()

        profiles_completed = StudentProfile.objects.filter(
            user__date_joined__gte=start
        ).count()

        first_lesson_booked = (
            Lesson.objects
            .filter(created_at__gte=start)
            .values('student').distinct().count()
        )

        first_lesson_completed = (
            Lesson.objects
            .filter(status='COMPLETED', start_time__gte=start)
            .values('student').distinct().count()
        )

        first_payment = (
            Payment.objects
            .filter(status='succeeded', created_at__gte=start)
            .values('student').distinct().count()
        )

        funnel = [
            {'step': 'Signed Up',             'count': signups},
            {'step': 'Profile Completed',     'count': profiles_completed},
            {'step': 'First Lesson Booked',   'count': first_lesson_booked},
            {'step': 'First Lesson Completed','count': first_lesson_completed},
            {'step': 'First Payment',         'count': first_payment},
        ]

        # Add drop-off % at each step
        for i, step in enumerate(funnel):
            prev = funnel[i - 1]['count'] if i > 0 else step['count']
            step['drop_off_pct'] = (
                round((1 - step['count'] / prev) * 100, 1) if prev else 0
            )

        return Response({'period_days': days, 'funnel': funnel})


# ─────────────────────────────────────────────────────────────────────────────
# RETENTION VIEW
# ─────────────────────────────────────────────────────────────────────────────

class RetentionView(APIView):
    """
    GET /api/marketing/metrics/retention/
    30-day active/churned student metrics.
    """
    permission_classes = [IsAuthenticated, IsMarketingUser]

    def get(self, request):
        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)
        sixty_days_ago  = now - timedelta(days=60)

        active_students = User.objects.filter(
            role='STUDENT', last_login__gte=thirty_days_ago
        ).count()

        churned_students = User.objects.filter(
            role='STUDENT',
            last_login__gte=sixty_days_ago,
            last_login__lt=thirty_days_ago,
        ).count()

        total_students = User.objects.filter(role='STUDENT').count()
        churn_rate = round(churned_students / total_students * 100, 2) if total_students else 0

        return Response({
            'active_students_30d':  active_students,
            'churned_students_30d': churned_students,
            'total_students':       total_students,
            'churn_rate':           churn_rate,
            'retention_rate':       round(100 - churn_rate, 2),
        })


# ─────────────────────────────────────────────────────────────────────────────
# ACQUISITION VIEW
# ─────────────────────────────────────────────────────────────────────────────

class AcquisitionView(APIView):
    """
    GET /api/marketing/metrics/acquisition/?period=30
    Daily signup counts + role breakdown.
    """
    permission_classes = [IsAuthenticated, IsMarketingUser]

    def get(self, request):
        days = int(request.query_params.get('period', 30))
        start = timezone.now() - timedelta(days=days)

        daily = (
            User.objects
            .filter(date_joined__gte=start)
            .annotate(date=TruncDate('date_joined'))
            .values('date')
            .annotate(count=Count('id'))
            .order_by('date')
        )
        daily_signups = [
            {'date': str(row['date']), 'signups': row['count']}
            for row in daily
        ]

        role_breakdown = (
            User.objects
            .filter(date_joined__gte=start)
            .values('role')
            .annotate(count=Count('id'))
        )
        by_role = {row['role']: row['count'] for row in role_breakdown}

        total = User.objects.filter(date_joined__gte=start).count()

        return Response({
            'period_days':   days,
            'total_signups': total,
            'by_role':       by_role,
            'daily_signups': daily_signups,
        })
