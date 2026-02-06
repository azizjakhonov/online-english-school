from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """
    Custom User model (matches ERD: User + role-based access).

    Notes:
    - We keep Django's built-in username field for simplicity.
    - Email is unique (ERD requirement).
    - Role controls app-level access (Student / Teacher / Admin).
    """

    class Roles(models.TextChoices):
        STUDENT = "STUDENT", "Student"
        TEACHER = "TEACHER", "Teacher"
        ADMIN = "ADMIN", "Admin"

    # ✅ ERD: full_name (made optional to avoid createsuperuser / admin issues)
    full_name = models.CharField(max_length=255, blank=True)

    # ✅ ERD: email unique
    email = models.EmailField(unique=True)

    # ✅ ERD: role
    role = models.CharField(
        max_length=10,
        choices=Roles.choices,
        default=Roles.STUDENT,
    )

    # ✅ ERD: created_at
    created_at = models.DateTimeField(auto_now_add=True)

    # Django auth metadata
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = ["email"]

    # Convenience role checks (keeps views/permissions clean)
    @property
    def is_student(self) -> bool:
        return self.role == self.Roles.STUDENT

    @property
    def is_teacher(self) -> bool:
        return self.role == self.Roles.TEACHER

    @property
    def is_admin_role(self) -> bool:
        return self.role == self.Roles.ADMIN

    def __str__(self) -> str:
        return f"{self.username} ({self.role})"
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver


class TeacherProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="teacher_profile",
    )

    bio = models.TextField(blank=True)
    timezone = models.CharField(max_length=64, blank=True)  # e.g. "Asia/Tashkent"
    is_accepting_students = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"TeacherProfile<{self.user.username}>"


class StudentProfile(models.Model):
    class Levels(models.TextChoices):
        A1 = "A1", "A1"
        A2 = "A2", "A2"
        B1 = "B1", "B1"
        B2 = "B2", "B2"
        C1 = "C1", "C1"
        C2 = "C2", "C2"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="student_profile",
    )

    level = models.CharField(
        max_length=2,
        choices=Levels.choices,
        default=Levels.A1,
    )
    timezone = models.CharField(max_length=64, blank=True)
    goals = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"StudentProfile<{self.user.username}>"


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def ensure_role_profile_exists(sender, instance, created, **kwargs):
    """
    Auto-create the correct profile when a user is created.
    Keeps DB consistent: teachers always have TeacherProfile, students always have StudentProfile.
    """
    if not created:
        return

    if instance.role == instance.Roles.TEACHER:
        TeacherProfile.objects.get_or_create(user=instance)
    elif instance.role == instance.Roles.STUDENT:
        StudentProfile.objects.get_or_create(user=instance)
