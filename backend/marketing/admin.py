from django.contrib import admin
from .models import (
    Banner, Announcement, EmailCampaign, SmsCampaign,
    DiscountCode, DiscountCodeUsage, PushCampaign, PushToken,
    MarketingMetricsSnapshot,
)


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    list_display = ('title', 'target_audience', 'banner_type', 'is_active', 'order', 'impressions', 'clicks', 'ctr', 'created_at')
    list_filter = ('is_active', 'target_audience', 'banner_type')
    search_fields = ('title', 'subtitle')
    ordering = ('order', '-created_at')
    readonly_fields = ('impressions', 'clicks', 'created_at', 'updated_at')

    @admin.display(description='CTR %')
    def ctr(self, obj):
        return f"{obj.ctr}%"


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ('title', 'target_audience', 'is_active', 'is_dismissible', 'priority', 'created_at')
    list_filter = ('is_active', 'target_audience')
    search_fields = ('title', 'body')
    ordering = ('-priority', '-created_at')


@admin.register(EmailCampaign)
class EmailCampaignAdmin(admin.ModelAdmin):
    list_display = ('name', 'subject', 'audience', 'status', 'recipients_count', 'open_rate', 'click_rate', 'created_at')
    list_filter = ('status', 'audience')
    search_fields = ('name', 'subject')
    readonly_fields = ('recipients_count', 'delivered_count', 'opened_count', 'clicked_count',
                       'unsubscribed_count', 'bounced_count', 'sent_at', 'created_at', 'updated_at')

    @admin.display(description='Open Rate %')
    def open_rate(self, obj):
        return f"{obj.open_rate}%"

    @admin.display(description='Click Rate %')
    def click_rate(self, obj):
        return f"{obj.click_rate}%"


@admin.register(SmsCampaign)
class SmsCampaignAdmin(admin.ModelAdmin):
    list_display = ('name', 'audience', 'status', 'recipients_count', 'delivered_count', 'failed_count', 'created_at')
    list_filter = ('status', 'audience')
    search_fields = ('name',)
    readonly_fields = ('recipients_count', 'delivered_count', 'failed_count', 'sent_at', 'created_at')


@admin.register(DiscountCode)
class DiscountCodeAdmin(admin.ModelAdmin):
    list_display = ('code', 'discount_type', 'discount_value', 'is_active', 'times_used', 'max_uses', 'expires_at', 'created_at')
    list_filter = ('is_active', 'discount_type', 'applicable_to')
    search_fields = ('code', 'description', 'campaign_ref')
    readonly_fields = ('times_used', 'created_at')


@admin.register(DiscountCodeUsage)
class DiscountCodeUsageAdmin(admin.ModelAdmin):
    list_display = ('code', 'user', 'discount_applied', 'used_at')
    list_filter = ('code',)
    readonly_fields = ('used_at',)


@admin.register(PushCampaign)
class PushCampaignAdmin(admin.ModelAdmin):
    list_display = ('name', 'title', 'platform', 'audience', 'status', 'recipients_count', 'delivered_count', 'opened_count', 'created_at')
    list_filter = ('status', 'platform', 'audience')
    search_fields = ('name', 'title')
    readonly_fields = ('recipients_count', 'delivered_count', 'opened_count', 'sent_at', 'created_at')


@admin.register(PushToken)
class PushTokenAdmin(admin.ModelAdmin):
    list_display = ('user', 'platform', 'is_active', 'created_at')
    list_filter = ('platform', 'is_active')
    search_fields = ('user__phone_number', 'user__full_name')
    readonly_fields = ('created_at',)


@admin.register(MarketingMetricsSnapshot)
class MarketingMetricsSnapshotAdmin(admin.ModelAdmin):
    list_display = ('date', 'new_signups', 'revenue_total', 'lessons_completed', 'churn_rate', 'ltv', 'cac')
    ordering = ('-date',)
    readonly_fields = ('created_at',)
