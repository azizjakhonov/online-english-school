from django.db.models.signals import post_save
from django.dispatch import receiver
from accounts.models import User
from scheduling.models import Lesson
from payments.models import Payment
from .services.analytics import AnalyticsService


@receiver(post_save, sender=User)
def track_user_signup(sender, instance, created, **kwargs):
    if created:
        AnalyticsService.track(instance.id, 'user_signed_up', {
            'role': instance.role,
            'email': instance.email,
        })
        AnalyticsService.identify(instance.id, {
            '$email': instance.email,
            'role': instance.role,
            'created_at': str(instance.date_joined),
        })


@receiver(post_save, sender=Lesson)
def track_lesson_events(sender, instance, created, **kwargs):
    # Lesson.student and Lesson.teacher are direct User FKs
    if created:
        AnalyticsService.track(instance.student.id, 'lesson_booked', {
            'lesson_id': instance.id,
            'teacher_id': instance.teacher.id,
            'scheduled_at': str(instance.start_time),
        })
    elif instance.status == 'COMPLETED':
        AnalyticsService.track(instance.student.id, 'lesson_completed', {
            'lesson_id': instance.id,
        })


@receiver(post_save, sender=Payment)
def track_payment(sender, instance, created, **kwargs):
    # Payment.student is a direct User FK; status 'succeeded' = paid
    if created and instance.status == 'succeeded':
        AnalyticsService.track(instance.student.id, 'payment_made', {
            'payment_id': instance.id,
            'amount': float(instance.amount_uzs),
            'currency': instance.currency,
        })
