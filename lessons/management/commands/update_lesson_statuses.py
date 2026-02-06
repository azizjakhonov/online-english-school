from django.core.management.base import BaseCommand
from django.utils import timezone

from lessons.models import Lesson


class Command(BaseCommand):
    help = "Auto-update Lesson statuses based on time (e.g., mark past scheduled lessons as COMPLETED)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--grace-minutes",
            type=int,
            default=30,
            help="Grace period after lesson end before auto-updating status",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would change without saving",
        )

    def handle(self, *args, **options):
        grace_minutes = options["grace_minutes"]
        dry_run = options["dry_run"]

        now = timezone.now()
        cutoff = now - timezone.timedelta(minutes=grace_minutes)

        # Only touch lessons still marked SCHEDULED and already ended (plus grace period)
        qs = Lesson.objects.filter(
            status=Lesson.Status.SCHEDULED,
            end_datetime__lte=cutoff,
        )

        updated_completed = 0
        updated_missed = 0  # reserved for later attendance logic

        for lesson in qs.select_related("teacher__user", "student__user"):
            new_status = Lesson.Status.COMPLETED

            if dry_run:
                self.stdout.write(
                    f"[DRY RUN] Lesson {lesson.id}: {lesson.status} -> {new_status} "
                    f"({lesson.teacher.user.username} / {lesson.student.user.username} @ {lesson.start_datetime})"
                )
                continue

            lesson.status = new_status
            lesson.save(update_fields=["status"])
            updated_completed += 1

        total_considered = updated_completed + updated_missed

        msg = (
            f"Done. Updated COMPLETED={updated_completed}, MISSED={updated_missed}. "
            f"Considered {total_considered} lessons (cutoff={cutoff.isoformat()})."
        )
        self.stdout.write(self.style.SUCCESS(msg))
