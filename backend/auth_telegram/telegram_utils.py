import hashlib
import hmac
import time
from django.conf import settings

def verify_telegram_data(data):
    """
    Verifies the authenticity of data received from the Telegram Login Widget.
    Spec: https://core.telegram.org/widgets/login#checking-authorization
    """
    bot_token = settings.TELEGRAM_BOT_TOKEN
    if not bot_token:
        return False, "TELEGRAM_BOT_TOKEN not configured"

    received_hash = data.get('hash')
    if not received_hash:
        return False, "Hash missing"

    # 1. Check age (auth_date should not be older than 24 hours)
    auth_date = data.get('auth_date')
    if not auth_date:
        return False, "auth_date missing"
    
    try:
        if time.time() - int(auth_date) > 86400:
            return False, "Session expired (older than 24h)"
    except (ValueError, TypeError):
        return False, "Invalid auth_date"

    # 2. Build data-check-string
    # String is formed by all received fields, sorted alphabetically by key,
    # joined by \n, excluding 'hash'.
    check_list = []
    for key, value in sorted(data.items()):
        if key != 'hash':
            check_list.append(f"{key}={value}")
    data_check_string = "\n".join(check_list)

    # 3. Compute secret_key = SHA256(bot_token)
    secret_key = hashlib.sha256(bot_token.encode()).digest()

    # 4. Compute hmac = HMAC-SHA256(secret_key, data_check_string)
    computed_hash = hmac.new(
        secret_key, 
        data_check_string.encode(), 
        hashlib.sha256
    ).hexdigest()

    # 5. Compare — use constant-time comparison to prevent timing attacks
    if not hmac.compare_digest(computed_hash, received_hash):
        return False, "Invalid hash"

    return True, "Verification successful"
