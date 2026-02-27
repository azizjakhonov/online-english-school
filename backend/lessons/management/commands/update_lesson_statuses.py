from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from lessons.models import Lesson


class Command(BaseCommand):
    help = (
        "Auto-update Lesson statuses after they end. "
        "SCHEDULED lessons become COMPLETED if there's evidence they happened; otherwise MISSED."
    )

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

    def _has_progress(self, lesson: Lesson) -> bool:
        # progress is OneToOne: lesson.progress
        return hasattr(lesson, "progress") and lesson.progress is not None

    def _has_homework_submission(self, lesson: Lesson) -> bool:
        # homework is OneToOne: lesson.homework, submission is OneToOne: homework.submission
        if not hasattr(lesson, "homework") or lesson.homework is None:
            return False
        return hasattr(lesson.homework, "submission") and lesson.homework.submission is not None

    def _has_teacher_notes(self, lesson: Lesson) -> bool:
        return bool((lesson.teacher_notes or "").strip())

    def handle(self, *args, **options):
        grace_minutes = options["grace_minutes"]
        dry_run = options["dry_run"]

        now = timezone.now()
        cutoff = now - timedelta(minutes=grace_minutes)

        # Only touch lessons still marked SCHEDULED and already ended (plus grace period)
        qs = (
            Lesson.objects.filter(
                status=Lesson.Status.SCHEDULED,
                end_datetime__lte=cutoff,
            )
            # OneToOne relations; select_related prevents N+1 queries
            .select_related("teacher__user", "student__user", "progress", "homework", "homework__submission")
        )

        updated_completed = 0
        updated_missed = 0

        for lesson in qs:
            evidence_completed = (
                self._has_progress(lesson)
                or self._has_teacher_notes(lesson)
                or self._has_homework_submission(lesson)
            )

            new_status = Lesson.Status.COMPLETED if evidence_completed else Lesson.Status.MISSED

            if dry_run:
                self.stdout.write(
                    f"[DRY RUN] Lesson {lesson.id}: {lesson.status} -> {new_status} "
                    f"({lesson.teacher.user.username} / {lesson.student.user.username} @ {lesson.start_datetime})"
                )
                continue

            lesson.status = new_status
            lesson.save(update_fields=["status"])

            if new_status == Lesson.Status.COMPLETED:
                updated_completed += 1
            else:
                updated_missed += 1

        msg = (
            f"Done. Updated COMPLETED={updated_completed}, MISSED={updated_missed}. "
            f"Cutoff={cutoff.isoformat()}."
        )
        self.stdout.write(self.style.SUCCESS(msg))
