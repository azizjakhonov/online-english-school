"""
accounts/management/commands/backfill_activity_events.py

Management command to retroactively populate missing FK reference fields
in existing ActivityEvent records.

    python manage.py backfill_activity_events          # applies changes
    python manage.py backfill_activity_events --dry-run  # preview only

Rules:
- NEVER overwrites a non-null field.
- Only fills fields that are currently NULL.
- Processes in two passes for safety; reports counts.
"""
from django.core.management.base import BaseCommand
from django.db import models


class Command(BaseCommand):
    help = 'Backfill missing FK fields on ActivityEvent records (safe, idempotent)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            default=False,
            help='Print what would change without saving to the DB',
        )

    def handle(self, *args, **options):
        dry = options['dry_run']
        from accounts.models import ActivityEvent
        try:
            from scheduling.models import Lesson
        except ImportError:
            self.stderr.write('scheduling app not found — skipping lesson-based backfill')
            Lesson = None

        total_student = 0
        total_teacher = 0
        skipped       = 0

        # ── Pass 1: events with lesson_id_ref missing subject_student / subject_teacher ──
        if Lesson is not None:
            qs = ActivityEvent.objects.filter(
                lesson_id_ref__isnull=False,
            ).filter(
                models.Q(subject_student__isnull=True) | models.Q(subject_teacher__isnull=True)
            ).select_related('subject_student', 'subject_teacher')

            for event in qs.iterator():
                try:
                    lesson = (
                        Lesson.objects
                        .select_related('student__student_profile', 'teacher__teacher_profile')
                        .get(pk=event.lesson_id_ref)
                    )
                except Lesson.DoesNotExist:
                    skipped += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f'  [SKIP] Event #{event.pk}: lesson #{event.lesson_id_ref} not found'
                        )
                    )
                    continue

                save_fields: list[str] = []

                if event.subject_student is None:
                    sp = getattr(lesson.student, 'student_profile', None)
                    if sp:
                        event.subject_student = sp
                        save_fields.append('subject_student')
                        total_student += 1

                if event.subject_teacher is None:
                    tp = getattr(lesson.teacher, 'teacher_profile', None)
                    if tp:
                        event.subject_teacher = tp
                        save_fields.append('subject_teacher')
                        total_teacher += 1

                if save_fields:
                    if dry:
                        self.stdout.write(
                            f'  [DRY] Event #{event.pk} ({event.event_type}): '
                            f'would fill {", ".join(save_fields)}'
                        )
                    else:
                        event.save(update_fields=save_fields)

        # ── Pass 2: lesson_completed events missing earnings_event_id ───────────────────
        try:
            from accounts.models import EarningsEvent
            earnings_qs = ActivityEvent.objects.filter(
                event_type='lesson_completed',
                earnings_event_id__isnull=True,
                lesson_id_ref__isnull=False,
            )
            filled_earnings = 0
            for event in earnings_qs.iterator():
                ee = EarningsEvent.objects.filter(
                    lesson_id=event.lesson_id_ref, event_type='lesson_credit'
                ).first()
                if ee:
                    if dry:
                        self.stdout.write(
                            f'  [DRY] Event #{event.pk}: would set earnings_event_id={ee.pk}'
                        )
                    else:
                        event.earnings_event_id = ee.pk
                        event.save(update_fields=['earnings_event_id'])
                    filled_earnings += 1
        except Exception as exc:
            self.stderr.write(f'Earnings backfill skipped: {exc}')
            filled_earnings = 0

        suffix = ' (DRY RUN — no changes saved)' if dry else ''
        self.stdout.write(
            self.style.SUCCESS(
                f'\nBackfill complete{suffix}:\n'
                f'  subject_student filled : {total_student}\n'
                f'  subject_teacher filled : {total_teacher}\n'
                f'  earnings_event_id filled: {filled_earnings}\n'
                f'  skipped (lesson not found): {skipped}'
            )
        )
