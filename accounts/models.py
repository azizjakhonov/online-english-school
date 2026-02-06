from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """
    Custom User model (matches ERD: User + role-based access).

    Notes:
    - We keep Django's built-in username field for simplicity.
    - Email is unique (your ERD requirement).
    - Role controls access (Student / Teacher / Admin).
    """

    class Roles(models.TextChoices):
        STUDENT = "STUDENT", "Student"
        TEACHER = "TEACHER", "Teacher"
        ADMIN = "ADMIN", "Admin"

    # ✅ ERD: full_name
    full_name = models.CharField(max_length=255)

    # ✅ ERD: email unique
    email = models.EmailField(unique=True)

    # ✅ ERD: role
    role = models.CharField(
        max_length=10,
        choices=Roles.choices,
        default=Roles.STUDENT,  # 🔁 CHANGE if you want default to be something else
    )

    # ✅ ERD: created_at
    created_at = models.DateTimeField(auto_now_add=True)

    # ✅ ERD: is_active already exists in AbstractUser
    # AbstractUser already provides:
    # - username
    # - password (hashed by Django)
    # - is_active
    # - is_staff, is_superuser
    # - first_name, last_name (we’re not relying on these)

    def __str__(self):
        return f"{self.username} ({self.role})"
