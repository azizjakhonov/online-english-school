from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
import random

# --- 0. CUSTOM USER MANAGER ---
class UserManager(BaseUserManager):
    def create_user(self, phone_number, password=None, **extra_fields):
        if not phone_number:
            raise ValueError("The Phone Number must be set")
        user = self.model(phone_number=phone_number, **extra_fields)
        user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, phone_number, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'ADMIN')
        
        user = self.create_user(phone_number, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

# --- 1. THE USER MODEL ---
class User(AbstractUser):
    class Roles(models.TextChoices):
        STUDENT = "STUDENT", "Student"
        TEACHER = "TEACHER", "Teacher"
        ADMIN = "ADMIN", "Admin"
        NEW = "NEW", "New User"

    username = None 
    email = models.EmailField(blank=True, null=True)
    phone_number = models.CharField(max_length=15, unique=True)
    full_name = models.CharField(max_length=255, blank=True)
    role = models.CharField(max_length=10, choices=Roles.choices, default=Roles.NEW)

    USERNAME_FIELD = 'phone_number'
    REQUIRED_FIELDS = [] 

    objects = UserManager()

    @property
    def is_student(self): return self.role == self.Roles.STUDENT
    @property
    def is_teacher(self): return self.role == self.Roles.TEACHER

    def __str__(self): return self.phone_number

# --- 2. OTP STORAGE ---
class PhoneOTP(models.Model):
    phone_number = models.CharField(max_length=15, unique=True)
    otp = models.CharField(max_length=6)
    count = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self): return f"{self.phone_number} -> {self.otp}"

# --- 3. PROFILES ---
class TeacherProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="teacher_profile")
    # Basic Info
    bio = models.TextField(blank=True, help_text="About me")
    headline = models.CharField(max_length=100, blank=True)
    
    # Marketplace Fields (The missing ones causing errors!)
    youtube_intro_url = models.URLField(blank=True, null=True)
    hourly_rate = models.DecimalField(max_digits=6, decimal_places=2, default=15.00)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=5.00)
    lessons_taught = models.IntegerField(default=0)
    is_accepting_students = models.BooleanField(default=True) # <--- This was missing
    
    def __str__(self): return f"Teacher: {self.user.phone_number}"

class StudentProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="student_profile")
    # Student Fields
    lesson_credits = models.IntegerField(default=0)
    level = models.CharField(max_length=50, blank=True, default="A1")
    goals = models.TextField(blank=True) # <--- This was missing
    
    def __str__(self): return f"Student: {self.user.phone_number}"

# --- 4. SIGNALS ---
@receiver(post_save, sender=User)
def manage_user_profile(sender, instance, created, **kwargs):
    if instance.role == User.Roles.TEACHER:
        TeacherProfile.objects.get_or_create(user=instance)
    elif instance.role == User.Roles.STUDENT:
        StudentProfile.objects.get_or_create(user=instance)