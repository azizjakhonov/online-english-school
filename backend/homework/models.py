from django.db import models
from django.db.models import Sum, Avg
from lessons.models import Lesson
from accounts.models import User

# =========================================================
# 1. THE HOMEWORK TEMPLATE (Teacher Creates This)
# =========================================================

class Homework(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    level = models.CharField(max_length=50, help_text="e.g. A1, B2, IELTS")
    created_at = models.DateTimeField(auto_now_add=True)

    # Helper to calculate total possible points for this homework
    @property
    def total_max_score(self):
        return self.activities.aggregate(total=Sum('points'))['total'] or 0

    def __str__(self):
        return f"{self.title} ({self.level})"

class HomeworkActivity(models.Model):
    """
    Replaces 'Question'. 
    Can be a Quiz, Gap Fill, Matching, etc.
    Stores data in JSON format so it's flexible.
    """
    ACTIVITY_TYPES = [
        ('quiz', 'Multiple Choice Quiz'),
        ('gap_fill', 'Fill in the Blanks'),
        ('matching', 'Matching Pairs'),
        ('listening', 'Listening Task'),
    ]

    homework = models.ForeignKey(Homework, on_delete=models.CASCADE, related_name="activities")
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_TYPES)
    order = models.IntegerField(default=1)
    
    # Stores the question data:
    # Quiz: { "question": "What is 2+2?", "options": ["3", "4"], "correct_index": 1 }
    # Gap Fill: { "text": "The {sky} is blue." }
    content = models.JSONField(default=dict)
    
    # How many points is this specific task worth?
    points = models.IntegerField(default=10)

    class Meta:
        ordering = ['order']

    def check_answer(self, answer_data):
        """
        Grades the answer data and returns True if correct, False otherwise.
        """
        import re
        content = self.content
        
        if self.activity_type == 'quiz':
            correct_idx = content.get('correct_index')
            user_idx = answer_data.get('selected_index')
            return correct_idx is not None and str(user_idx) == str(correct_idx)
            
        elif self.activity_type == 'gap_fill':
            text = content.get('text', '')
            correct_gaps = [m.lower() for m in re.findall(r'\{([^}]+)\}', text)]
            student_gaps = answer_data.get('gaps', [])
            
            # Convert student_gaps to list if it's a dict
            if isinstance(student_gaps, dict):
                try:
                    sorted_keys = sorted(student_gaps.keys(), key=int)
                    student_gaps = [student_gaps[k] for k in sorted_keys]
                except (ValueError, TypeError):
                    student_gaps = list(student_gaps.values())
            
            if not correct_gaps:
                return True # No gaps to fill
            
            if len(student_gaps) < len(correct_gaps):
                return False
                
            for i, cg in enumerate(correct_gaps):
                if str(cg).lower() != str(student_gaps[i] or '').lower():
                    return False
            return True

        elif self.activity_type == 'matching':
            correct_pairs = content.get('pairs', [])
            student_pairs = answer_data.get('pairs', {})
            correct_dict = {str(p['left']): str(p['right']) for p in correct_pairs}
            student_dict = {str(k): str(v) for k, v in student_pairs.items()}
            return student_dict == correct_dict

        elif self.activity_type == 'listening':
            # Listen to both 'type' and 'sub_type' for compatibility
            sub_type = content.get('sub_type') or content.get('type') or 'quiz'
            if sub_type == 'quiz':
                correct_idx = content.get('correct_index')
                user_idx = answer_data.get('selected_index')
                return correct_idx is not None and str(user_idx) == str(correct_idx)
            elif sub_type == 'true_false':
                correct_bool = content.get('correct_bool')
                user_bool = answer_data.get('selected_bool')
                return correct_bool is not None and user_bool == correct_bool
            elif sub_type == 'open':
                keywords = content.get('keywords', [])
                student_text = str(answer_data.get('text', '')).lower()
                if keywords:
                    return any(str(kw).lower() in student_text for kw in keywords)
                return bool(student_text.strip())
        
        # Default for media-only tasks (image/video/pdf)
        return True

    def __str__(self):
        return f"{self.get_activity_type_display()} - {self.points} pts"


# =========================================================
# 2. THE ACTIVE ASSIGNMENT (Student Takes This)
# =========================================================

class HomeworkAssignment(models.Model):
    lesson = models.OneToOneField(Lesson, on_delete=models.CASCADE, related_name="assignment")
    homework = models.ForeignKey(Homework, on_delete=models.PROTECT)
    
    due_date = models.DateTimeField()
    assigned_at = models.DateTimeField(auto_now_add=True)

    # Grading
    is_completed = models.BooleanField(default=False)
    score = models.FloatField(default=0.0)  # Actual points earned (e.g. 85)
    percentage = models.FloatField(default=0.0) # Scale of 0-100%

    def calculate_score(self):
        """
        Run this whenever a student submits an answer.
        It sums up all correct answers and updates the score.
        """
        total_earned = 0
        activities = self.homework.activities.all()
        max_points = sum(a.points for a in activities)

        # Map responses by activity ID for easy lookup
        responses = {r.activity_id: r for r in self.student_answers.all()}

        for activity in activities:
            response = responses.get(activity.id)
            if response and response.is_correct:
                total_earned += activity.points

        self.score = float(total_earned)
        if max_points > 0:
            self.percentage = round((float(total_earned) / float(max_points)) * 100.0, 2)
        else:
            self.percentage = 0.0
        
        # We don't call self.save() here anymore to avoid nested saves during submission
        return self.score, self.percentage

    def __str__(self):
        return f"{self.homework.title} - {self.score}pts"


class StudentActivityResponse(models.Model):
    """
    Stores the student's answer for a specific activity.
    """
    assignment = models.ForeignKey(HomeworkAssignment, on_delete=models.CASCADE, related_name="student_answers")
    activity = models.ForeignKey(HomeworkActivity, on_delete=models.CASCADE)
    
    # Store answer as JSON because it might be an Index (Quiz) or Words (Gap Fill)
    # Quiz Answer: { "selected_index": 1 }
    # Gap Fill Answer: { "gaps": ["sky"] }
    answer_data = models.JSONField()
    
    is_correct = models.BooleanField(default=False)

    class Meta:
        unique_together = ('assignment', 'activity')



