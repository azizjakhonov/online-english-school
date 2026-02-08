from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, PhoneOTP, TeacherProfile, StudentProfile

class CustomUserAdmin(UserAdmin):
    # 1. Sort by phone instead of username
    ordering = ('phone_number',)
    
    # 2. What columns to show in the list
    list_display = ('phone_number', 'role', 'full_name', 'is_staff')
    
    # 3. Search by phone or name
    search_fields = ('phone_number', 'full_name')

    # 4. The "Edit User" form layout
    fieldsets = (
        (None, {'fields': ('phone_number', 'password')}),
        ('Personal Info', {'fields': ('full_name', 'email', 'role')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )

    # 5. The "Add User" form layout
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('phone_number', 'role', 'full_name'),
        }),
    )

# Register models
admin.site.register(User, CustomUserAdmin)
admin.site.register(PhoneOTP)
admin.site.register(TeacherProfile)
admin.site.register(StudentProfile)