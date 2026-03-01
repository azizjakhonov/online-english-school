from rest_framework.permissions import BasePermission


class IsMarketingUser(BasePermission):
    """Allow access to superusers and users with role='marketing' (case-insensitive)."""
    message = 'Marketing dashboard access required.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                request.user.is_superuser
                or str(getattr(request.user, 'role', '')).lower() == 'marketing'
            )
        )
