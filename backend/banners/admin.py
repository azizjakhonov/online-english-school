from django.contrib import admin
from django.utils.html import format_html
from unfold.admin import ModelAdmin
from .models import BannerCampaign

@admin.register(BannerCampaign)
class BannerCampaignAdmin(ModelAdmin):
    list_display = (
        'name', 
        'placement', 
        'target_role',
        'target_platform',
        'is_active', 
        'priority', 
        'start_at', 
        'end_at',
        'image_preview'
    )
    list_filter = ('placement', 'target_role', 'target_platform', 'is_active')

    search_fields = ('name', 'title', 'subtitle')
    ordering = ('-priority', '-created_at')
    
    fieldsets = (
        (None, {
            'fields': ('name', 'is_active', 'priority')
        }),
        ('Targeting', {
            'fields': ('placement', 'target_role', 'target_platform', 'start_at', 'end_at')
        }),

        ('Content', {
            'fields': ('title', 'subtitle', 'cta_text', 'background_color', 'image_web', 'image_mobile')
        }),
        ('Action', {
            'fields': ('target_type', 'target_value')
        }),
    )

    def image_preview(self, obj):
        if obj.image_web:
            return format_html('<img src="{}" style="height: 50px; border-radius: 4px;" />', obj.image_web.url)
        return "No image"
    image_preview.short_description = 'Web Preview'
