from django.contrib import admin
from .models import Course, Unit, Lesson, Slide

# 1. Slide Configuration (Inline)
class SlideInline(admin.TabularInline):
    model = Slide
    extra = 0
    readonly_fields = ['image_preview']

    def image_preview(self, obj):
        from django.utils.html import mark_safe
        if obj.image:
            return mark_safe(f'<img src="{obj.image.url}" style="height: 50px;"/>')
        return ""

# 2. Lesson Configuration
@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ('title', 'unit', 'order', 'slide_count', 'created_at')
    list_filter = ('unit__course', 'unit')
    search_fields = ('title', 'unit__title')
    inlines = [SlideInline]

    def slide_count(self, obj):
        return obj.slides.count()
    slide_count.short_description = "Slides"

# 3. Unit Configuration
@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'order')
    list_filter = ('course',)
    ordering = ('course', 'order')

# 4. Course Configuration
@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('title', 'level', 'created_at')
    search_fields = ('title',)