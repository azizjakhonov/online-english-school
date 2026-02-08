from django.db import models
from lessons.models import Lesson
from accounts.models import User

# =========================================================
# 1. THE HOMEWORK LIBRARY (Created by Admin)
# =========================================================

class Homework(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    level = models.CharField(max_length=50, help_text="e.g. A1, B2, IELTS")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.level})"

class Question(models.Model):
    class QuestionTypes(models.TextChoices):
        SINGLE_CHOICE = 'SC', 'Single Choice'

    homework = models.ForeignKey(Homework, on_delete=models.CASCADE, related_name="questions")
    text = models.TextField()
    question_type = models.CharField(max_length=2, choices=QuestionTypes.choices, default=QuestionTypes.SINGLE_CHOICE)
    points = models.IntegerField(default=1)

    def __str__(self):
        return f"{self.text[:50]}..."

class QuestionOption(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="options")
    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return self.text

# =========================================================
# 2. THE ACTIVE ASSIGNMENT (Teacher Assigns to Student)
# =========================================================

class HomeworkAssignment(models.Model):
    lesson = models.OneToOneField(Lesson, on_delete=models.CASCADE, related_name="assignment")
    homework = models.ForeignKey(Homework, on_delete=models.PROTECT)
    
    due_date = models.DateTimeField()
    assigned_at = models.DateTimeField(auto_now_add=True)

    # Grading
    is_completed = models.BooleanField(default=False)
    score = models.FloatField(default=0.0) 
    total_points = models.IntegerField(default=0)

    def __str__(self):
        # FIX: Robustly get student name for Admin Panel display
        try:
            student = self.lesson.student
            # If student is a Profile, grab .user. If it's a User, use it directly.
            user_obj = getattr(student, 'user', student)
            student_name = getattr(user_obj, 'full_name', str(user_obj))
            return f"Assignment: {self.homework.title} for {student_name}"
        except:
            return f"Assignment: {self.homework.title}"

class StudentAnswer(models.Model):
    assignment = models.ForeignKey(HomeworkAssignment, on_delete=models.CASCADE, related_name="answers")
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    selected_option = models.ForeignKey(QuestionOption, on_delete=models.CASCADE)
    
    is_correct = models.BooleanField(default=False)

    class Meta:
        unique_together = ('assignment', 'question')