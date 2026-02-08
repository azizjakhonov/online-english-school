import requests
import json
import os
from django.conf import settings

class EskizService:
    BASE_URL = "https://notify.eskiz.uz/api"
    
    def __init__(self):
        self.email = settings.ESKIZ_EMAIL
        self.password = settings.ESKIZ_PASSWORD
        self.token_file = settings.ESKIZ_TOKEN_FILE

    def _get_token(self):
        """
        Retrieves a valid token. 
        If saved token exists, use it. If not, log in and get a new one.
        """
        # 1. Try to load from file
        if os.path.exists(self.token_file):
            try:
                with open(self.token_file, 'r') as f:
                    data = json.load(f)
                    return data.get('data', {}).get('token')
            except:
                pass # If file is broken, just ignore it and login again

        # 2. If no file, Log In
        return self._login()

    def _login(self):
        """
        Logs in to Eskiz and saves the token to a file.
        """
        url = f"{self.BASE_URL}/auth/login"
        payload = {
            'email': self.email,
            'password': self.password
        }
        
        try:
            response = requests.post(url, data=payload)
            response.raise_for_status() # Raise error if login fails
            
            data = response.json()
            
            # Save the whole response to file (Token is valid for 30 days)
            with open(self.token_file, 'w') as f:
                json.dump(data, f)
                
            return data['data']['token']
            
        except Exception as e:
            print(f"❌ Eskiz Login Failed: {e}")
            return None

    def send_sms(self, phone, message):
        """
        Sends an SMS to the specified phone number.
        """
        token = self._get_token()
        if not token:
            return {"status": "error", "message": "Could not authenticate with Eskiz"}

        url = f"{self.BASE_URL}/message/sms/send"
        
        # Clean the phone number (remove + or spaces if needed)
        # Eskiz usually expects 998901234567 format (numbers only)
        clean_phone = phone.replace('+', '').replace(' ', '')
        
        payload = {
            'mobile_phone': clean_phone,
            'message': message,
            'from': settings.ESKIZ_NICKNAME,
            'callback_url': '' 
        }
        
        headers = {
            'Authorization': f'Bearer {token}'
        }

        try:
            response = requests.post(url, data=payload, headers=headers)
            
            # If token expired (401), try logging in again once
            if response.status_code == 401:
                print("🔄 Token expired. Refreshing...")
                self._login()
                return self.send_sms(phone, message) # Retry
                
            return response.json()
            
        except Exception as e:
            print(f"❌ SMS Send Failed: {e}")
            return {"status": "error", "message": str(e)}