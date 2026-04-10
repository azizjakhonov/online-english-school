"""
Management command: fire_scheduled_campaigns
--------------------------------------------
Fires any email / SMS / push campaigns whose scheduled_at has passed
and whose status is still 'scheduled'.

Usage:
    python manage.py fire_scheduled_campaigns

Recommended cron (every 5 minutes):
    */5 * * * * /path/to/venv/bin/python /path/to/manage.py fire_scheduled_campaigns
"""
from django.core.management.base import BaseCommand

from marketing.tasks import send_scheduled_campaigns


class Command(BaseCommand):
    help = 'Send any campaigns scheduled to fire at or before now.'

    def handle(self, *args, **options):
        self.stdout.write('Checking for scheduled campaigns…')
        send_scheduled_campaigns()
        self.stdout.write(self.style.SUCCESS('Done.'))
