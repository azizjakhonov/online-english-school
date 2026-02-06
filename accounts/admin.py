from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    model = User

    # What columns you see in Django admin list
    list_display = ("username", "email", "full_name", "role", "is_active", "is_staff")
    list_filter = ("role", "is_active", "is_staff")

    # Add full_name + role to the user edit screen
    fieldsets = UserAdmin.fieldsets + (
        ("Extra fields", {"fields": ("full_name", "role")}),
    )

    add_fieldsets = UserAdmin.add_fieldsets + (
        (None, {"fields": ("full_name", "role", "email")}),
    )

    search_fields = ("username", "email", "full_name")
    ordering = ("username",)
