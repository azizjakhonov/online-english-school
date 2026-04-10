"""
accounts/impersonation.py

Two-step impersonation flow:
  1. GET  /admin/impersonate/<user_id>/   (Django session auth — for admin panel)
       Verified via Django session cookie → generates a signed one-time token
       → redirects to https://app.allright.uz/?_impersonate_token=<token>

  2. POST /api/admin/impersonate/exchange/   (no JWT needed — token IS the proof)
       Accepts the signed token → returns JWT pair for the target user

  3. POST /api/admin/impersonate/exit/   (JWT auth)
       Best-effort audit log of when admin exits impersonation
"""
from django.contrib.auth import get_user_model
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect
from django.utils import timezone
from django.views import View

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import ActivityEvent

User = get_user_model()

FRONTEND_URL = "https://app.allright.uz"
TOKEN_MAX_AGE = 300  # 5 minutes


def _log_impersonation(actor, target, action: str):
    """Write an audit entry for every impersonation event."""
    ActivityEvent.objects.create(
        event_type=ActivityEvent.EventType.ADMIN_IMPERSONATION,
        actor=actor,
        summary=(
            f"Admin impersonation {action}: "
            f"{actor.full_name or actor.phone_number} → "
            f"{target.full_name or target.phone_number} ({target.role})"
        ),
        metadata={
            "action": action,
            "admin_id": actor.id,
            "admin_phone": actor.phone_number,
            "target_id": target.id,
            "target_phone": target.phone_number,
            "target_role": target.role,
            "timestamp": timezone.now().isoformat(),
        },
    )


# ─────────────────────────────────────────────────────────────────────────────
#  STEP 1 — Django admin URL (uses Django SESSION, not JWT)
# ─────────────────────────────────────────────────────────────────────────────
class ImpersonateRedirectView(View):
    """
    GET /admin/impersonate/<user_id>/

    Called directly from the Django admin panel button.
    Authenticated via Django session cookie (not JWT).
    Generates a short-lived signed token and redirects to the frontend.
    """
    def get(self, request, user_id: int):
        # Must be logged-in superuser via Django session
        if not request.user.is_authenticated or not request.user.is_superuser:
            return HttpResponse("Only superusers can use impersonation.", status=403)

        target = get_object_or_404(User, pk=user_id)

        if target.is_superuser:
            return HttpResponse("Cannot impersonate another superuser.", status=403)

        if not target.is_active:
            return HttpResponse("Cannot impersonate an inactive user.", status=400)

        # Sign a token: "admin_id:target_id"
        signer = TimestampSigner()
        token = signer.sign(f"{request.user.id}:{target.id}")

        _log_impersonation(actor=request.user, target=target, action="token_generated")

        # Redirect to frontend with the signed token
        return redirect(f"{FRONTEND_URL}/?_impersonate_token={token}")


# ─────────────────────────────────────────────────────────────────────────────
#  STEP 2 — Public token exchange (no JWT required)
# ─────────────────────────────────────────────────────────────────────────────
class ImpersonateExchangeView(APIView):
    """
    POST /api/admin/impersonate/exchange/
    Body: { "token": "<signed_token>" }

    No authentication required — the signed token IS the proof of authority.
    Returns a fresh JWT pair for the target user.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        token = request.data.get("token")
        if not token:
            return Response({"error": "No token provided."}, status=status.HTTP_400_BAD_REQUEST)

        signer = TimestampSigner()
        try:
            value = signer.unsign(token, max_age=TOKEN_MAX_AGE)
        except SignatureExpired:
            return Response({"error": "Impersonation token expired. Please try again from the admin panel."}, status=status.HTTP_400_BAD_REQUEST)
        except BadSignature:
            return Response({"error": "Invalid impersonation token."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            admin_id_str, target_id_str = value.split(":")
            admin_id = int(admin_id_str)
            target_id = int(target_id_str)
        except (ValueError, AttributeError):
            return Response({"error": "Malformed token."}, status=status.HTTP_400_BAD_REQUEST)

        target = get_object_or_404(User, pk=target_id)
        admin_user = get_object_or_404(User, pk=admin_id)

        # Extra safety — in case user was promoted to superuser after token issue
        if target.is_superuser:
            return Response({"error": "Cannot impersonate a superuser."}, status=status.HTTP_403_FORBIDDEN)

        # Generate JWT for target
        refresh = RefreshToken.for_user(target)
        refresh["_impersonated_by"] = admin_user.id
        refresh["_impersonated_by_phone"] = admin_user.phone_number

        _log_impersonation(actor=admin_user, target=target, action="started")

        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "impersonated_user": {
                "id": target.id,
                "name": target.full_name or target.phone_number,
                "phone": target.phone_number,
                "role": target.role,
            },
        })


# ─────────────────────────────────────────────────────────────────────────────
#  STEP 3 — Exit (JWT auth, best-effort audit log)
# ─────────────────────────────────────────────────────────────────────────────
class ImpersonateExitView(APIView):
    """
    POST /api/admin/impersonate/exit/

    Called when the admin clicks "Exit Impersonation" in the frontend banner.
    The frontend is responsible for restoring the original admin token.
    This endpoint just logs the exit action.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        impersonated_by_id = None
        try:
            impersonated_by_id = request.auth.payload.get("_impersonated_by")
        except AttributeError:
            pass

        if impersonated_by_id:
            try:
                admin_user = User.objects.get(pk=impersonated_by_id)
                _log_impersonation(
                    actor=admin_user,
                    target=request.user,
                    action="exited",
                )
            except User.DoesNotExist:
                pass

        return Response({"success": True, "message": "Impersonation exited."})
