from datetime import datetime, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import TeacherProfile
from scheduling.models import AvailabilityRule, LessonSlot


class Command(BaseCommand):
    help = "Generate bookable LessonSlot rows from AvailabilityRule for the next N days."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=14, help="How many days ahead to generate slots")
        parser.add_argument("--slot-minutes", type=int, default=60, help="Slot length in minutes (e.g. 60)")
        parser.add_argument("--teacher-id", type=int, default=None, help="Generate slots only for one teacher profile id")

    def handle(self, *args, **options):
        days = options["days"]
        slot_minutes = options["slot_minutes"]
        teacher_id = options["teacher_id"]

        if slot_minutes <= 0:
            self.stderr.write("slot-minutes must be > 0")
            return

        now = timezone.now()
        start_date = now.date()
        end_date = start_date + timedelta(days=days)

        teachers_qs = TeacherProfile.objects.all()
        if teacher_id:
            teachers_qs = teachers_qs.filter(id=teacher_id)

        total_created = 0

        for teacher in teachers_qs:
            rules = AvailabilityRule.objects.filter(teacher=teacher, is_active=True)

            if not rules.exists():
                continue

            current = start_date
            while current <= end_date:
                weekday = current.weekday()  # Monday=0

                day_rules = rules.filter(weekday=weekday)
                for rule in day_rules:
                    # Build datetimes in the current timezone
                    start_dt = timezone.make_aware(datetime.combine(current, rule.start_time))
                    end_dt = timezone.make_aware(datetime.combine(current, rule.end_time))

                    # Skip if the whole window is in the past
                    if end_dt <= now:
                        continue

                    slot_start = start_dt
                    while slot_start + timedelta(minutes=slot_minutes) <= end_dt:
                        slot_end = slot_start + timedelta(minutes=slot_minutes)

                        # Do not create past slots
                        if slot_end <= now:
                            slot_start = slot_end
                            continue

                        obj, created = LessonSlot.objects.get_or_create(
                            teacher=teacher,
                            start_datetime=slot_start,
                            defaults={"end_datetime": slot_end},
                        )
                        if created:
                            total_created += 1

                        slot_start = slot_end

                current += timedelta(days=1)

        self.stdout.write(self.style.SUCCESS(f"Done. Created {total_created} slots."))
