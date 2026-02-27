from rest_framework import serializers
from .models import BannerCampaign

class BannerCampaignSerializer(serializers.ModelSerializer):
    image_web_url = serializers.SerializerMethodField()
    image_mobile_url = serializers.SerializerMethodField()

    class Meta:
        model = BannerCampaign
        fields = [
            'id', 'name', 'placement', 'title', 'subtitle', 'cta_text',
            'image_web_url', 'image_mobile_url', 'background_color',
            'target_type', 'target_value', 'priority'
        ]

    def get_image_web_url(self, obj):
        if obj.image_web:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image_web.url)
            return obj.image_web.url
        return None

    def get_image_mobile_url(self, obj):
        if obj.image_mobile:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image_mobile.url)
            return obj.image_mobile.url
        return None
