import requests
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

class DevSmsService:
    """
    Service for sending SMS via devsms.uz
    API Docs: https://devsms.uz/api/docs.php?lang=ru
    """
    BASE_URL = "https://devsms.uz/api/send_sms.php"

    def __init__(self):
        self.token = getattr(settings, 'DEVSMS_TOKEN', '')
        self.sender = getattr(settings, 'DEVSMS_SENDER_NAME', '4546')

    def send_sms(self, phone, message):
        """
        Sends an SMS to the specified phone number.
        phone: 998XXXXXXXXX format (or +998...)
        """
        if not self.token:
            logger.error("❌ DEVSMS_TOKEN not configured in settings.")
            return {"success": False, "message": "DEVSMS_TOKEN missing"}

        # Clean phone: remove + and spaces
        clean_phone = phone.replace('+', '').replace(' ', '')

        payload = {
            "phone": clean_phone,
            "message": message,
            "from": self.sender
        }
        
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

        try:
            response = requests.post(self.BASE_URL, json=payload, headers=headers, timeout=10)
            data = response.json()
            
            if response.status_code == 200 and data.get('success'):
                logger.info("✅ SMS sent successfully via DevSms to %s", clean_phone)
            else:
                logger.error("❌ DevSms error: %s", data.get('message', 'Unknown error'))
            
            return data
        except Exception as e:
            logger.error("❌ DevSms request failed: %s", e)
            return {"success": False, "message": str(e)}
