from rest_framework import viewsets, permissions
from django.utils import timezone
from django.db.models import Q
from .models import BannerCampaign
from .serializers import BannerCampaignSerializer

class BannerViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Publicly accessible (to authenticated users) endpoint for banners.
    Filtered by placement and current user role.
    """
    serializer_class = BannerCampaignSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        placement = self.request.query_params.get('placement')
        platform = self.request.query_params.get('platform')
        now = timezone.now()

        queryset = BannerCampaign.objects.filter(is_active=True)

        if placement:
            queryset = queryset.filter(placement=placement)
            
        if platform:
            queryset = queryset.filter(target_platform__in=[platform.upper(), 'BOTH'])


        # Filtering by date
        queryset = queryset.filter(
            Q(start_at__isnull=True) | Q(start_at__lte=now),
            Q(end_at__isnull=True) | Q(end_at__gte=now)
        )

        # Infer role from request.user
        # User roles: STUDENT, TEACHER, ADMIN, NEW
        if user.role == 'STUDENT':
            queryset = queryset.filter(target_role__in=['STUDENT', 'BOTH'])
        elif user.role == 'TEACHER':
            queryset = queryset.filter(target_role__in=['TEACHER', 'BOTH'])
        elif user.role == 'ADMIN':
            # Admins see everything for testing purposes
            pass 
        else:
            # For NEW users or others, maybe no banners or just BOTH
            queryset = queryset.filter(target_role='BOTH')

        return queryset.order_by('-priority', '-created_at')
