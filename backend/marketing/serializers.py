from rest_framework import serializers
from .models import (
    Banner, Announcement, EmailCampaign, SmsCampaign,
    DiscountCode, DiscountCodeUsage, PushCampaign, PushToken,
    MarketingMetricsSnapshot,
)


class BannerSerializer(serializers.ModelSerializer):
    is_live = serializers.BooleanField(read_only=True)
    ctr = serializers.FloatField(read_only=True)
    image_absolute_url = serializers.SerializerMethodField()

    class Meta:
        model = Banner
        fields = [
            'id', 'title', 'subtitle', 'image', 'image_url', 'image_absolute_url',
            'cta_text', 'cta_url', 'cta_open_new_tab',
            'background_color', 'text_color',
            'target_audience', 'banner_type',
            'is_active', 'order',
            'starts_at', 'ends_at',
            'impressions', 'clicks', 'ctr',
            'is_live',
            'created_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['impressions', 'clicks', 'created_at', 'updated_at', 'created_by']

    def get_image_absolute_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class AnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = [
            'id', 'title', 'body',
            'target_audience', 'is_active', 'is_dismissible', 'priority',
            'starts_at', 'ends_at',
            'created_by', 'created_at',
        ]
        read_only_fields = ['created_at', 'created_by']


class EmailCampaignSerializer(serializers.ModelSerializer):
    open_rate = serializers.FloatField(read_only=True)
    click_rate = serializers.FloatField(read_only=True)

    class Meta:
        model = EmailCampaign
        fields = [
            'id', 'name', 'subject', 'preview_text',
            'html_body', 'plain_text_body',
            'audience', 'custom_filter',
            'status', 'scheduled_at', 'sent_at',
            'recipients_count', 'delivered_count', 'opened_count',
            'clicked_count', 'unsubscribed_count', 'bounced_count',
            'open_rate', 'click_rate',
            'created_by', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'recipients_count', 'delivered_count', 'opened_count',
            'clicked_count', 'unsubscribed_count', 'bounced_count',
            'sent_at', 'created_at', 'updated_at', 'created_by',
        ]


class SmsCampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = SmsCampaign
        fields = [
            'id', 'name', 'message',
            'audience', 'status', 'scheduled_at', 'sent_at',
            'recipients_count', 'delivered_count', 'failed_count',
            'created_by', 'created_at',
        ]
        read_only_fields = [
            'recipients_count', 'delivered_count', 'failed_count',
            'sent_at', 'created_at', 'created_by',
        ]


class DiscountCodeSerializer(serializers.ModelSerializer):
    is_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = DiscountCode
        fields = [
            'id', 'code', 'description',
            'discount_type', 'discount_value',
            'min_purchase_amount', 'max_uses', 'max_uses_per_user', 'times_used',
            'is_active', 'starts_at', 'expires_at',
            'applicable_to', 'campaign_ref',
            'is_valid',
            'created_by', 'created_at',
        ]
        read_only_fields = ['times_used', 'created_at', 'created_by']


class DiscountCodeUsageSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiscountCodeUsage
        fields = ['id', 'code', 'user', 'payment', 'discount_applied', 'used_at']
        read_only_fields = ['used_at']


class PushCampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = PushCampaign
        fields = [
            'id', 'name', 'title', 'body', 'image_url', 'deep_link',
            'platform', 'audience',
            'status', 'scheduled_at', 'sent_at',
            'recipients_count', 'delivered_count', 'opened_count',
            'created_by', 'created_at',
        ]
        read_only_fields = [
            'recipients_count', 'delivered_count', 'opened_count',
            'sent_at', 'created_at', 'created_by',
        ]


class PushTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = PushToken
        fields = ['id', 'token', 'platform', 'is_active', 'created_at']
        read_only_fields = ['created_at']


class MarketingMetricsSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketingMetricsSnapshot
        fields = '__all__'
        read_only_fields = ['created_at']
