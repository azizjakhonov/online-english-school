import requests
from django.core.management.base import BaseCommand
from django.conf import settings
from django.urls import reverse

class Command(BaseCommand):
    help = 'Sets or deletes the Telegram Bot Webhook'

    def add_arguments(self, parser):
        parser.add_argument('--delete', action='store_true', help='Delete the webhook')
        parser.add_argument('--url', type=str, help='The base URL of your site (e.g. https://yourdomain.com)')

    def handle(self, *args, **options):
        bot_token = settings.TELEGRAM_BOT_TOKEN
        secret = settings.TELEGRAM_WEBHOOK_SECRET
        
        if not bot_token or not secret:
            self.stderr.write('TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET not configured in settings')
            return

        if options['delete']:
            url = f"https://api.telegram.org/bot{bot_token}/deleteWebhook"
            response = requests.post(url)
            self.stdout.write(f"Response: {response.json()}")
            return

        base_url = options['url']
        if not base_url:
            self.stderr.write('Error: --url is required when setting a webhook')
            return

        # Ensure base_url doesn't end with slash
        base_url = base_url.rstrip('/')
        
        # Build the final webhook URL using our view's path
        webhook_path = reverse('telegram_webhook', kwargs={'secret': secret})
        webhook_url = f"{base_url}{webhook_path}"

        self.stdout.write(f"Setting webhook to: {webhook_url}")
        
        url = f"https://api.telegram.org/bot{bot_token}/setWebhook"
        payload = {
            'url': webhook_url,
            'allowed_updates': ['message']
        }
        
        response = requests.post(url, json=payload)
        self.stdout.write(f"Response: {response.json()}")
