"""
Management command: snapshot_marketing_metrics
-----------------------------------------------
Aggregates yesterday's KPIs into MarketingMetricsSnapshot.
Idempotent — safe to re-run for the same day.

Usage:
    python manage.py snapshot_marketing_metrics

Recommended cron (once daily, shortly after midnight):
    5 0 * * * /path/to/venv/bin/python /path/to/manage.py snapshot_marketing_metrics
"""
from django.core.management.base import BaseCommand

from marketing.tasks import snapshot_daily_metrics


class Command(BaseCommand):
    help = "Snapshot yesterday's marketing KPIs into MarketingMetricsSnapshot."

    def handle(self, *args, **options):
        self.stdout.write('Snapshotting daily marketing metrics…')
        snapshot_daily_metrics()
        self.stdout.write(self.style.SUCCESS('Done.'))
