from django.contrib import admin
from .models import Homework, Question, QuestionOption, HomeworkAssignment, StudentAnswer

# --- 1. THE LIBRARY (Content Creation) ---

class QuestionOptionInline(admin.TabularInline):
    model = QuestionOption
    extra = 4 # Default to 4 options (A, B, C, D)

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ['text', 'homework', 'question_type']
    inlines = [QuestionOptionInline]
    search_fields = ['text']

class QuestionInline(admin.StackedInline):
    model = Question
    extra = 1
    show_change_link = True # Allow clicking to edit question details (and options)

@admin.register(Homework)
class HomeworkAdmin(admin.ModelAdmin):
    list_display = ['title', 'level', 'created_at']
    list_filter = ['level']
    search_fields = ['title']
    inlines = [QuestionInline]

# --- 2. THE ASSIGNMENTS (Tracking) ---

class StudentAnswerInline(admin.TabularInline):
    model = StudentAnswer
    readonly_fields = ['question', 'selected_option', 'is_correct']
    extra = 0
    can_delete = False

@admin.register(HomeworkAssignment)
class HomeworkAssignmentAdmin(admin.ModelAdmin):
    list_display = ['homework', 'get_student', 'is_completed', 'score', 'due_date']
    list_filter = ['is_completed', 'homework__level']
    inlines = [StudentAnswerInline]
    
    def get_student(self, obj):
        return obj.lesson.student.user.full_name
    get_student.short_description = 'Student'

# Register the answer model just in case you need to debug specific answers
@admin.register(StudentAnswer)
class StudentAnswerAdmin(admin.ModelAdmin):
    list_display = ['assignment', 'question', 'is_correct']
    list_filter = ['is_correct']