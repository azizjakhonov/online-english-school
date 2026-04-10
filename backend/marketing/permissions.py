from rest_framework.permissions import BasePermission


class IsMarketingUser(BasePermission):
    """Allow access to superusers, ADMIN users, and any future MARKETING role."""
    message = 'Marketing dashboard access required.'

    _ALLOWED_ROLES = {'ADMIN', 'MARKETING'}

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                request.user.is_superuser
                or str(getattr(request.user, 'role', '')).upper() in self._ALLOWED_ROLES
            )
        )
