from django.db import models
from django.utils import timezone
from accounts.models import User

class BannerCampaign(models.Model):
    class Placement(models.TextChoices):
        STUDENT_HOME_TOP = "student_home_top", "Student Home Top"
        TEACHER_HOME_TOP = "teacher_home_top", "Teacher Home Top"


    class TargetType(models.TextChoices):
        INTERNAL = "INTERNAL", "Internal Route"
        EXTERNAL = "EXTERNAL", "External URL"

    name = models.CharField(max_length=120)
    placement = models.CharField(
        max_length=40, 
        choices=Placement.choices, 
        default=Placement.STUDENT_HOME_TOP
    )
    
    # Simple approach: Checkbox-like field or just strings for roles.
    # The requirement says Many-to-many or CharField with choices. 
    # CharField with multiple choices might be tricky without a custom field, 
    # so I'll use a Many-to-many to User.Roles or just a simple boolean set for Student/Teacher.
    # Given the requirements: "roles: Many-to-many or CharField with choices (STUDENT, TEACHER)"
    # I'll use a JSONField or a string with comma separated values to keep it simple and portable.
    # Actually, a ManyToManyField to a 'Role' model is standard, but since roles are hardcoded in User,
    # let's just use two Booleans: show_to_students and show_to_teachers. It's the simplest.
    # WAIT, the prompt says "roles: Many-to-many or CharField with choices (STUDENT, TEACHER)".
    # I'll use a simple CharField with choices and allow multiples in the admin? No, that's not standard Django.
    # Let's use a Many-to-many relationship to a helper model if needed, but the prompt says 
    # "choose the simplest approach consistent with current project".
    # I'll use a CharField(max_length=20) for role targeting (STUDENT, TEACHER, or BOTH).
    
    TARGET_ROLES = (
        ('STUDENT', 'Student'),
        ('TEACHER', 'Teacher'),
        ('BOTH', 'Both'),
    )
    target_role = models.CharField(max_length=10, choices=TARGET_ROLES, default='STUDENT')

    TARGET_PLATFORMS = (
        ('WEB', 'Web only'),
        ('MOBILE', 'Mobile only'),
        ('BOTH', 'Both'),
    )
    target_platform = models.CharField(max_length=10, choices=TARGET_PLATFORMS, default='BOTH')


    image_web = models.ImageField(upload_to='banners/web/', null=True, blank=True)
    image_mobile = models.ImageField(upload_to='banners/mobile/', null=True, blank=True)
    
    background_color = models.CharField(max_length=16, blank=True, null=True, help_text="Hex color, e.g. #4A90E2")
    title = models.CharField(max_length=80, blank=True, null=True)
    subtitle = models.CharField(max_length=140, blank=True, null=True)
    cta_text = models.CharField(max_length=40, blank=True, null=True)
    
    target_type = models.CharField(max_length=10, choices=TargetType.choices, default=TargetType.INTERNAL, blank=True, null=True)
    target_value = models.CharField(max_length=255, blank=True, null=True, help_text="Route path for INTERNAL, full URL for EXTERNAL")

    
    priority = models.IntegerField(default=0, help_text="Higher shows first")
    is_active = models.BooleanField(default=True)
    
    start_at = models.DateTimeField(null=True, blank=True)
    end_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-priority', '-created_at']
        verbose_name = "Banner Campaign"
        verbose_name_plural = "Banner Campaigns"

    def __str__(self):
        return self.name

    @property
    def is_visible(self):
        now = timezone.now()
        if not self.is_active:
            return False
        if self.start_at and self.start_at > now:
            return False
        if self.end_at and self.end_at < now:
            return False
        return True
