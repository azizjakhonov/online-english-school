# Security Audit Report — OnlineSchool Platform

**Date:** 2026-02-27
**Auditor:** Claude Code (automated static analysis)
**Scope:** Full codebase — `backend/`, `frontend/`, `mobileapp/`

---

## Executive Summary

A comprehensive security audit of the OnlineSchool platform identified **34 findings** across all three codebases. The most critical issues involve **live production secrets committed in plaintext** (`.env` file), a **hardcoded Django `SECRET_KEY`**, and **multiple financial endpoints that grant credits without real payment verification**. Several authentication vulnerabilities were also discovered, including no OTP brute-force protection, non-cryptographic OTP generation, and unrestricted role-escalation for authenticated users.

The platform should not be considered production-ready until the CRITICAL and HIGH findings are remediated.

---

## Findings Summary

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 6 |
| 🟠 HIGH | 14 |
| 🟡 MEDIUM | 9 |
| 🔵 LOW | 3 |
| ℹ️ INFO | 4 |
| **Total** | **36** |

---

## Remediation Priority Order

1. Rotate all leaked secrets immediately (CRITICAL-1)
2. Fix `SECRET_KEY` to load from environment (CRITICAL-2)
3. Disable or admin-gate free-credit endpoints (CRITICAL-3, 4, 5)
4. Add admin permission to `AdminLessonUpdateView` (CRITICAL-6)
5. Add OTP expiry + brute-force protection (HIGH-7, 8)
6. Switch OTP generation to `secrets` module (HIGH-9)
7. Set `DEBUG=False` / `ALLOWED_HOSTS` from env (HIGH-10, 11)
8. Address JWT storage in localStorage (HIGH-12)
9. Fix WebSocket room authorization (HIGH-16)
10. Fix timing-attack in Telegram verification (HIGH-15)

---

## Detailed Findings

---

### 🔴 CRITICAL-1 — Plaintext Secrets in `.env` File

**File:** `backend/.env`
**Lines:** 3, 8–14, 18, 22

**Description:**
The `.env` file contains live production credentials in plaintext. While `.env` is listed in `.gitignore`, the file currently exists on disk with real values and may have been committed or shared inadvertently.

```
ESKIZ_PASSWORD=Rustamjon1981                      # plaintext password
AGORA_APP_ID=244fec5c5f2c4f6784706c2032bda764    # live Agora credential
AGORA_APP_CERTIFICATE=d96a33931b7a48dab5c76e75d2b8ba51
DEVSMS_TOKEN=76971c27591bc4a1b1f823fb22e4156471aa8f356b7c7d7f93a0daf2f9656ed9
TELEGRAM_BOT_TOKEN=8524805398:AAGXIIgHeJCmXUyBVRxm9HYbwa0GEsOO0MI
GOOGLE_OAUTH_CLIENT_ID=995764843169-...apps.googleusercontent.com
```

**Impact:**
Any developer with repository access, any CI/CD log, or any backup that captured this file gains full access to SMS sending, video calling, Telegram bot control, and potentially payment flows.

**Fix:**
1. **Immediately rotate all credentials** listed above through their respective provider dashboards.
2. Verify `.env` is not tracked by git: `git ls-files backend/.env` (should be empty).
3. Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, or at minimum environment variables injected by your CI/CD system) rather than `.env` files in production.
4. Add a root-level `.gitignore` to protect all three `.env` files (backend, frontend, mobileapp).

---

### 🔴 CRITICAL-2 — Django `SECRET_KEY` Hardcoded in Settings

**File:** `backend/backend/settings.py`
**Line:** 13

```python
SECRET_KEY = 'django-insecure-^sd#!ed1ze$h9(k9s#mj#c@#k#d1wq#%mkk!m*2h9j@9_i96l*'
```

**Description:**
The Django `SECRET_KEY` is hardcoded with the `django-insecure-` prefix directly in `settings.py`. This key signs all JWT tokens, CSRF tokens, session cookies, and Django's signing framework. Anyone who has read access to this file can forge any of these.

**Impact:**
Full authentication bypass. An attacker knowing the `SECRET_KEY` can forge JWT tokens and log in as any user, including admins.

**Fix (applied automatically — see below):**
```python
SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-^sd#!ed1ze$h9(k9s#mj#c@#k#d1wq#%mkk!m*2h9j@9_i96l*')
```
Add `SECRET_KEY=<generated-value>` to `.env` and generate a new value with:
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

---

### 🔴 CRITICAL-3 — `AddCreditsView` Grants Credits Without Payment

**File:** `backend/accounts/views.py`
**Lines:** 175–195
**Routes:** `POST /api/student/add-credits/`, `POST /api/add-credits/`

```python
class AddCreditsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        amount = request.data.get('amount')
        # ...
        profile.lesson_credits += float(amount)
        profile.save()
```

**Description:**
Any authenticated student can call this endpoint with an arbitrary `amount` and add that many credits to their balance instantly, with no payment verification whatsoever.

**Impact:**
Students can give themselves unlimited free lessons, representing 100% financial loss for every lesson taken without payment.

**Fix:**
Remove this endpoint from production routing immediately, or restrict it to admin-only:
```python
from rest_framework.permissions import IsAdminUser
permission_classes = [IsAdminUser]
```

---

### 🔴 CRITICAL-4 — `MockPurchaseCreditsView` Active in Production Routes

**File:** `backend/accounts/views.py`
**Lines:** 141–174
**Route:** `POST /api/mock-purchase/`

```python
class MockPurchaseCreditsView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        # ...
        profile.lesson_credits += credits_to_add
        profile.save()
```

**Description:**
A mock payment view intended for development testing is registered in production URL routes. Any authenticated student can call it with `packageId` 1, 2, or 3 and receive 5, 20, or 50 credits respectively, for free.

**Impact:**
Same as CRITICAL-3 — unlimited free credits.

**Fix:**
Remove the `path('mock-purchase/', ...)` line from `accounts/urls.py` for any non-development environment. Use `settings.DEBUG` guard if needed:
```python
if settings.DEBUG:
    urlpatterns += [path('mock-purchase/', MockPurchaseCreditsView.as_view())]
```

---

### 🔴 CRITICAL-5 — `PurchaseCreditsView` Grants Credits Without Real Payment

**File:** `backend/payments/api.py`
**Lines:** 60–102
**Route:** `POST /api/payments/purchase/`

```python
payment = purchase_credits(
    user=user,
    package_id=package_id,
    # method defaults to 'test', provider defaults to 'test'
)
```

**File:** `backend/payments/services.py` — `purchase_credits()` defaults `method='test'`.

**Description:**
The payment purchase endpoint atomically credits the student's balance but does not integrate any real payment gateway. Calling this endpoint immediately grants credits with `method='test'` and `provider='test'`.

**Impact:**
Any student can acquire credits without paying. This is the production payment endpoint.

**Fix:**
The endpoint must only grant credits after receiving a verified callback from a real payment provider (Payme, Click, Stripe, etc.). Until real gateway integration exists, the endpoint should return HTTP 503:
```python
return Response({'error': 'Payment gateway not yet configured.'}, status=503)
```

---

### 🔴 CRITICAL-6 — `AdminLessonUpdateView` Has No Admin Permission Check

**File:** `backend/lessons/views.py`
**Lines:** 24–32
**Route:** `PUT/PATCH /api/lessons/<pk>/update/`

```python
class AdminLessonUpdateView(generics.UpdateAPIView):
    permission_classes = [IsAuthenticated]  # In production, use IsAdminUser
```

**Description:**
Despite the comment, any authenticated user (student, teacher) can update any curriculum lesson's fields via this endpoint.

**Impact:**
Students or teachers can modify any lesson's content, timing, or status.

**Fix (applied automatically — see below):**
```python
from rest_framework.permissions import IsAdminUser
permission_classes = [IsAdminUser]
```

---

### 🟠 HIGH-7 — No OTP Brute-Force Protection

**File:** `backend/accounts/views.py`, `backend/accounts/api.py`
**Lines:** `views.py:59–113`, `api.py:119–178`
**Routes:** `POST /api/verify-otp/`

**Description:**
The OTP verification endpoint has no rate limiting or attempt counting. The `count` field exists on the `PhoneOTP` model but is never incremented. With 90,000 possible 5-digit OTPs, an automated attacker can brute-force any account in seconds.

**Impact:**
Complete account takeover for any phone number in the system.

**Fix:**
1. Add DRF throttling to the `VerifyOTPView`:
```python
from rest_framework.throttling import AnonRateThrottle

class OtpVerifyThrottle(AnonRateThrottle):
    rate = '5/hour'

class VerifyOTPView(APIView):
    throttle_classes = [OtpVerifyThrottle]
```
2. Increment and enforce `otp_record.count`; delete the record after 5 failed attempts.
3. Add throttling to `SendOTPView` as well (max 3 OTPs per phone per hour).

---

### 🟠 HIGH-8 — OTP Has No Expiry Time

**File:** `backend/accounts/models.py`
**Lines:** 91–97
**Files:** `backend/accounts/views.py:69`, `backend/accounts/api.py:129`

**Description:**
The `PhoneOTP` model has no `expires_at` field and no expiry is checked on verification. An OTP remains valid indefinitely until used. `updated_at` exists but is never compared against a max age.

**Impact:**
OTPs intercepted by SMS eavesdropping remain valid forever; attackers have unlimited time to use them.

**Fix:**
Add an expiry check in `VerifyOTPView.post()`:
```python
from django.utils import timezone
from datetime import timedelta

OTP_VALIDITY_MINUTES = 10

# In VerifyOTPView.post():
age = timezone.now() - otp_record.updated_at
if age > timedelta(minutes=OTP_VALIDITY_MINUTES):
    otp_record.delete()
    return Response({'error': 'OTP has expired. Please request a new one.'}, status=400)
```

---

### 🟠 HIGH-9 — OTP Uses Non-Cryptographic `random` Module

**File:** `backend/accounts/utils.py`
**Line:** 4
**File:** `backend/accounts/api.py`
**Line:** 98

```python
return str(random.randint(10000, 99999))  # NOT cryptographically secure
```

Also: `backend/scheduling/agora_token_builder/RtcTokenBuilder.py:27` uses `random.randint` for the token salt.

**Description:**
Python's `random` module is not cryptographically secure. Its state is predictable from a small number of observed outputs.

**Fix (applied automatically — see below):**
```python
import secrets
return str(secrets.randbelow(90000) + 10000)
```

---

### 🟠 HIGH-10 — `DEBUG=True` Hardcoded in Settings

**File:** `backend/backend/settings.py`
**Line:** 16

```python
DEBUG = True
```

**Description:**
`DEBUG=True` causes Django to return full stack traces (including local variable values and settings) in HTTP 500 responses, bypassing all error-handling. In the current state, any unhandled exception leaks the full source code context to the browser.

**Fix (applied automatically — see below):**
```python
DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
```

---

### 🟠 HIGH-11 — `ALLOWED_HOSTS = ['*']` Hardcoded

**File:** `backend/backend/settings.py`
**Line:** 18

```python
ALLOWED_HOSTS = ['*']
```

**Description:**
Wildcard `ALLOWED_HOSTS` bypasses Django's Host header validation, enabling HTTP Host header injection attacks that can be used for password reset poisoning and cache poisoning.

**Fix (applied automatically — see below):**
```python
ALLOWED_HOSTS = [
    h.strip()
    for h in os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
    if h.strip()
]
```

---

### 🟠 HIGH-12 — JWT Tokens Stored in `localStorage` (XSS Vulnerable)

**File:** `frontend/src/features/auth/AuthContext.tsx`
**Lines:** 56–57
**File:** `frontend/src/lib/api.ts`
**Line:** 27

```typescript
localStorage.setItem('access_token', access);
localStorage.setItem('refresh_token', refresh);
```

**Description:**
`localStorage` is accessible to any JavaScript running on the page. A single XSS vulnerability anywhere in the frontend (including in third-party libraries like react-player, react-pdf, or Konva) can exfiltrate the JWT tokens, giving an attacker full account access without triggering any server-side session invalidation.

**Impact:**
Full account compromise via any XSS vector. The 7-day refresh token makes this especially dangerous.

**Fix (requires manual review):**
Store tokens in `httpOnly` cookies (inaccessible to JavaScript). This requires backend changes to set the cookie on login and clear it on logout, and frontend changes to use `withCredentials: true` in Axios. The backend already has CORS correctly configured with `CORS_ALLOW_CREDENTIALS = True`.

---

### 🟠 HIGH-13 — JWT Passed as URL Query Parameter for WebSocket

**File:** `backend/backend/middleware.py`
**Lines:** 31–35
**File:** `frontend/src/features/classroom/Classroom.tsx` (WebSocket connection)

```python
token = query_params.get("token", [None])[0]
```

**Description:**
WebSocket authentication passes the JWT as `?token=...` in the URL. URLs appear in server access logs, browser history, referrer headers, and proxy logs, permanently exposing the token.

**Fix (requires manual review):**
Authenticate WebSocket connections via the first message after connection (a handshake protocol), or use a short-lived, single-use WS-specific token issued by a dedicated endpoint.

---

### 🟠 HIGH-14 — `SelectRoleView` Allows Unrestricted Role Escalation

**File:** `backend/accounts/views.py`
**Lines:** 117–139
**File:** `backend/accounts/api.py`
**Lines:** 274–295
**Routes:** `POST /api/select-role/`

```python
class SelectRoleView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        role = request.data.get('role')
        user.role = User.Roles.STUDENT  # or TEACHER — no restriction
        user.save()
```

**Description:**
Any authenticated user can change their own role at any time. A student can instantly become a teacher (gaining access to teacher dashboards, lesson creation, homework assignment, and student data access), and vice versa.

**Impact:**
Privilege escalation. Students can access teacher functionality including managing lesson history, homework, and viewing all student phone numbers.

**Fix:**
Only allow role selection when `user.role == User.Roles.NEW`:
```python
if user.role != User.Roles.NEW:
    return Response({'error': 'Role already set.'}, status=400)
```

---

### 🟠 HIGH-15 — Timing Attack in Telegram Signature Verification

**File:** `backend/auth_telegram/telegram_utils.py`
**Line:** 50

```python
if computed_hash != received_hash:   # vulnerable to timing attack
    return False, "Invalid hash"
```

**Description:**
Standard string comparison (`!=`) short-circuits on the first differing byte, leaking information about how many bytes of the hash match via timing differences. A remote attacker making many requests can gradually determine the correct HMAC through statistical analysis.

**Fix (applied automatically — see below):**
```python
if not hmac.compare_digest(computed_hash, received_hash):
    return False, "Invalid hash"
```

---

### 🟠 HIGH-16 — WebSocket Consumer Allows Any User to Join Any Room

**File:** `backend/lessons/consumers.py`
**Lines:** 14–58

```python
async def connect(self):
    self.room_id = self.scope['url_route']['kwargs']['id']
    # No check: is this user the teacher or student for this lesson?
    await self.accept()
```

**Description:**
The `LessonConsumer` accepts any authenticated user into any lesson room. There is no check that the connecting user is either the teacher or student assigned to that lesson. Any logged-in user (another student, another teacher) can connect to any active classroom and observe all events, chat, whiteboard drawings, and lesson content.

**Impact:**
Privacy violation; unauthorized access to classroom content, student/teacher conversations.

**Fix (requires manual review):**
After accepting the connection, verify membership:
```python
from scheduling.models import Lesson

async def connect(self):
    self.room_id = self.scope['url_route']['kwargs']['id']
    user = self.scope['user']
    if not user or not user.is_authenticated:
        await self.close()
        return
    # Check lesson membership
    from channels.db import database_sync_to_async
    is_member = await database_sync_to_async(
        lambda: Lesson.objects.filter(
            room_sid=self.room_id
        ).filter(
            models.Q(teacher=user) | models.Q(student=user)
        ).exists()
    )()
    if not is_member and not user.is_superuser:
        await self.close()
        return
    await self.accept()
```

---

### 🟠 HIGH-17 — OTP Printed in Plaintext to Console

**File:** `backend/accounts/views.py`
**Lines:** 40–41

```python
print(f"\n{border}\n  📱 OTP  |  {phone}  →  {otp}\n{border}\n", flush=True)
return Response({'message': 'OTP sent successfully'})
```

**Description:**
The real SMS sending is disabled and OTPs are printed to stdout. In any environment where stdout is captured (Docker logs, journald, log aggregators), all OTPs are permanently logged in plaintext. Anyone with access to logs can impersonate any user.

**Impact:**
Full authentication bypass for any user whose phone number is known, by reading server logs.

**Fix:**
Re-enable SMS sending for production. Remove or guard the print statement:
```python
if settings.DEBUG:
    logger.debug("DEV OTP for %s: %s", phone, otp)  # still log level DEBUG only
```

---

### 🟠 HIGH-18 — WebSocket Uses Plaintext `ws://` Instead of `wss://`

**File:** `frontend/.env`
**Line:** 3

```
VITE_WS_BASE_URL=ws://api.allright.uz
```

**Description:**
WebSocket connections to the production server use an unencrypted `ws://` URL. All classroom data (whiteboard drawings, chat messages, quiz answers, audio/video sync events) is transmitted in plaintext over the internet.

**Impact:**
Network-level eavesdropping of all classroom activity; token exposure in transit.

**Fix:**
Change to `wss://api.allright.uz` (requires the server to support TLS, which it should if serving `https://`).

---

### 🟠 HIGH-19 — No Rate Limiting on Any Endpoint

**File:** `backend/backend/settings.py` (no `DEFAULT_THROTTLE_CLASSES` configured)

**Description:**
The Django REST Framework throttling system is not configured at all. There is no protection against automated abuse of the OTP send/verify endpoints, login endpoints, or resource-intensive operations like PDF generation.

**Impact:**
SMS bombing (send unlimited OTPs to victims), credential stuffing, resource exhaustion.

**Fix:**
Add global throttling in `settings.py`:
```python
REST_FRAMEWORK = {
    ...
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "10/minute",
        "user": "100/minute",
    },
}
```

---

### 🟠 HIGH-20 — `SESSION_COOKIE_SECURE` and `CSRF_COOKIE_SECURE` Are False

**File:** `backend/backend/settings.py`
**Lines:** 234–235

```python
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
```

**Description:**
These settings allow session and CSRF cookies to be sent over unencrypted HTTP connections. In a production HTTPS environment, this means cookies can be transmitted insecurely if any HTTP request is made.

**Fix:**
Make these environment-dependent:
```python
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
```

---

### 🟡 MEDIUM-21 — Exception Details Exposed in API Responses

**Files and lines:**
- `backend/accounts/views.py:174` — `str(e)` returned in `MockPurchaseCreditsView`
- `backend/accounts/views.py:278` — `str(e)` in `AvatarUploadView`
- `backend/scheduling/api.py:190` — `str(e)` in `BookLessonView`
- `backend/curriculum/api.py:374` — `str(e)` in `preview()` action

```python
return Response({"error": str(e)}, status=500)
```

**Description:**
Internal exception messages are returned directly to clients. These can leak database schema details, file paths, library versions, and internal logic.

**Fix:**
Log the full exception server-side and return a generic message to the client:
```python
logger.exception("Unexpected error in <view>")
return Response({"error": "An unexpected error occurred."}, status=500)
```

---

### 🟡 MEDIUM-22 — Student Phone Numbers Exposed to Teachers

**File:** `backend/scheduling/api.py`
**Lines:** 305

```python
student_phone = serializers.CharField(source='student.phone_number', read_only=True)
```

**Description:**
The teacher lesson history endpoint exposes students' full phone numbers. While teachers may legitimately need contact info, providing raw phone numbers violates the principle of least privilege and data minimization.

**Fix:**
Consider masking the phone number (`+998 ** *** **78`) or removing this field, providing contact only through in-app messaging.

---

### 🟡 MEDIUM-23 — Audio/Video Assets Use Wildcard CORS

**File:** `backend/curriculum/api.py`
**Lines:** 403–405 (AudioAssetViewSet), **Lines:** 526–527 (VideoAssetViewSet)

```python
if origin:
    response['Access-Control-Allow-Origin'] = origin
else:
    response['Access-Control-Allow-Origin'] = '*'  # ANY origin
```

**Description:**
When no `Origin` header is present (e.g., direct requests), audio and video download endpoints respond with `Access-Control-Allow-Origin: *`, allowing any webpage on the internet to request these assets cross-origin.

**Fix:**
Only respond to requests from allowed origins. Remove the `else` wildcard branch. If no Origin is present, either serve without CORS headers or reject.

---

### 🟡 MEDIUM-24 — No File Type Validation on Uploaded Assets

**Files:** `backend/curriculum/serializers.py`, `backend/homework/api.py`

**Description:**
PDF, audio, video, and homework submission files are accepted via `serializers.FileField()` without any MIME type or file extension validation. An attacker could upload malicious files (e.g., PHP scripts, SVG with embedded JavaScript, crafted PDFs).

**Impact:**
Stored XSS (via SVG uploads), zip bombs, polyglot files, or denial-of-service.

**Fix:**
Add validators to serializers:
```python
ALLOWED_AUDIO_TYPES = {'audio/mpeg', 'audio/mp4', 'audio/ogg'}
ALLOWED_VIDEO_TYPES = {'video/mp4', 'video/webm'}
ALLOWED_PDF_TYPES   = {'application/pdf'}

def validate_file(self, value):
    if value.content_type not in ALLOWED_AUDIO_TYPES:
        raise serializers.ValidationError("Unsupported file type.")
    if value.size > 50 * 1024 * 1024:  # 50 MB limit
        raise serializers.ValidationError("File too large.")
    return value
```

---

### 🟡 MEDIUM-25 — Agora Token Builder Uses Non-Cryptographic `random`

**File:** `backend/scheduling/agora_token_builder/RtcTokenBuilder.py`
**Line:** 27

```python
self.salt = random.randint(1, 10000)
```

**Description:**
The Agora token's salt is generated with Python's `random` module, which is not cryptographically secure. This weakens the token's unpredictability.

**Fix:**
```python
import secrets
self.salt = secrets.randbelow(10000) + 1
```

---

### 🟡 MEDIUM-26 — `ClassroomEntryView` Returns Hardcoded Test Credentials

**File:** `backend/lessons/views.py`
**Lines:** 42–46

```python
agora_data = {
    "token": "test_token_placeholder",
    "appId": "test_app_id",
    "channel": f"lesson_{lesson.id}",
    "uid": request.user.id
}
```

**Description:**
A `ClassroomEntryView` in `lessons/views.py` returns hard-coded placeholder Agora credentials. While the real classroom entry is handled by `EnterClassroomView` in `scheduling/api.py`, this endpoint is still accessible and returns fake tokens that could confuse clients or be exploited.

**Fix:**
Remove or redirect this legacy view to `EnterClassroomView`.

---

### 🟡 MEDIUM-27 — Telegram Webhook Secret Is a URL, Not a Secret

**File:** `backend/.env`
**Line:** 20

```
TELEGRAM_WEBHOOK_SECRET=https://your-ngrok-url.ngrok-free.app/api/auth/telegram/webhook/localhost/
```

**Description:**
The `TELEGRAM_WEBHOOK_SECRET` setting is supposed to be a secret token appended to the webhook URL path (`/webhook/<secret>/`). Instead, it's set to the full URL, making the "secret" predictable and the webhook completely unprotected from spoofed requests.

**Fix:**
Generate a proper random secret:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```
Set `TELEGRAM_WEBHOOK_SECRET=<generated-value>` and update the Telegram bot's webhook URL to include it.

---

### 🟡 MEDIUM-28 — Curriculum API Has No Role/Admin Check

**File:** `backend/curriculum/api.py`
**Lines:** 39–54 (CourseViewSet, UnitViewSet)

```python
class CourseViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
```

**Description:**
Any authenticated user (student, teacher, or new user) can create, update, and delete courses, units, and lesson templates. There is no admin or teacher restriction.

**Fix:**
At minimum restrict write operations to staff:
```python
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.decorators import action

def get_permissions(self):
    if self.action in ['list', 'retrieve']:
        return [IsAuthenticated()]
    return [IsAdminUser()]
```

---

### 🟡 MEDIUM-29 — No Content Security Policy (CSP) Headers

**File:** `backend/backend/settings.py`

**Description:**
No CSP headers are configured. Django's `SecurityMiddleware` can set CSP-like headers, but none are present. The frontend also has no CSP meta tag. A successful XSS attack has full script execution privileges.

**Fix:**
Add to `settings.py` for Django to inject via `SecurityMiddleware`:
```python
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True   # legacy IE header, harmless
```
For proper CSP, consider `django-csp` package:
```bash
pip install django-csp
```

---

### 🔵 LOW-30 — OTP Stored in Plaintext in Database

**File:** `backend/accounts/models.py`
**Lines:** 91–97

```python
class PhoneOTP(models.Model):
    otp = models.CharField(max_length=6)  # plaintext
```

**Description:**
OTPs are stored as plaintext. If the database is compromised, all outstanding OTPs are immediately usable. While OTPs are short-lived (ideally), the combination of no expiry (HIGH-8) makes this worse.

**Fix:**
Store a bcrypt/PBKDF2 hash of the OTP. Given OTPs are short-lived and computationally cheap to brute-force on the hash alone, this is LOW priority compared to adding expiry (HIGH-8).

---

### 🔵 LOW-31 — `/api/token/` Username+Password Auth Endpoint Exposed

**File:** `backend/backend/urls.py`
**Line:** 36

```python
path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
```

**Description:**
The standard DRF SimpleJWT username/password endpoint is exposed. Since the app uses phone+OTP auth (no passwords), this endpoint cannot be used to log in, but it provides an unnecessary attack surface and can be used for user enumeration.

**Fix:**
Remove this URL pattern if password-based login is not used:
```python
# path('api/token/', TokenObtainPairView.as_view()),   # REMOVED: app uses OTP auth
```

---

### 🔵 LOW-32 — Separate `.env` Files Not Covered by Root `.gitignore`

**Files:** `frontend/.env`, `mobileapp/.env`

**Description:**
The `backend/.gitignore` correctly excludes `.env`, but `frontend/.env` and `mobileapp/.env` contain the Google OAuth Client ID and have no corresponding `.gitignore` entry in those directories. There is also no root `.gitignore` protecting all three.

**Fix:**
Create a root-level `.gitignore`:
```gitignore
**/.env
**/.env.local
**/.env.production
```

---

### ℹ️ INFO-33 — Swagger UI Accessible Without Authentication

**File:** `backend/backend/urls.py`
**Line:** 41

```python
path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
```

**Description:**
The full OpenAPI schema and interactive Swagger UI are accessible without authentication. This exposes the complete API surface, all endpoint paths, request/response schemas, and authentication requirements to unauthenticated users.

**Fix:**
Restrict docs to staff users:
```python
from rest_framework.permissions import IsAdminUser
path('api/docs/', SpectacularSwaggerView.as_view(
    url_name='schema',
    permission_classes=[IsAdminUser]
), name='swagger-ui'),
```

---

### ℹ️ INFO-34 — Mobile App Uses HTTP, Not HTTPS

**File:** `mobileapp/src/api/client.ts`
**Lines:** 7–10

```typescript
const LOCAL_IP = '192.168.1.30';
export const BRIDGE_BASE_URL = Platform.OS === 'web'
  ? 'http://localhost:8000'     // HTTP
  : `http://${LOCAL_IP}:8000`;  // HTTP
```

**Description:**
The mobile app connects over unencrypted HTTP. This is appropriate for local development but must not be used in production. A local IP address is hardcoded.

**Fix:**
Use an environment variable for the base URL and ensure production builds use `https://`.

---

### ℹ️ INFO-35 — HSTS Not Configured

**File:** `backend/backend/settings.py`

**Description:**
`SECURE_HSTS_SECONDS` is not set. Without HSTS, browsers may use HTTP for the first request to the domain, enabling downgrade attacks.

**Fix:**
Add to production settings:
```python
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_SSL_REDIRECT = True  # force all HTTP → HTTPS
```

---

### ℹ️ INFO-36 — `seed.json` Contains User Data

**File:** `backend/seed.json`

**Description:**
A `seed.json` file exists in the backend directory. The `.gitignore` excludes it, but it was found locally. Seed files often contain hashed passwords, PII (names, phone numbers), and test user data.

**Fix:**
Verify this file doesn't contain production data. If it contains only test/fixture data, document that clearly. Ensure it remains gitignored.

---

## Changes Applied Automatically

The following safe, non-breaking fixes were applied directly:

| # | File | Change |
|---|------|--------|
| CRITICAL-2 | `backend/backend/settings.py` | `SECRET_KEY` now loaded from env with fallback |
| HIGH-10 | `backend/backend/settings.py` | `DEBUG` now loaded from env |
| HIGH-11 | `backend/backend/settings.py` | `ALLOWED_HOSTS` now loaded from env |
| HIGH-15 | `backend/auth_telegram/telegram_utils.py` | Switched to `hmac.compare_digest()` |
| HIGH-9 | `backend/accounts/utils.py` | OTP generation uses `secrets` module |
| HIGH-9 | `backend/accounts/api.py` | OTP generation uses `secrets` module |
| CRITICAL-6 | `backend/lessons/views.py` | `AdminLessonUpdateView` now requires `IsAdminUser` |
| MEDIUM-25 | `backend/scheduling/agora_token_builder/RtcTokenBuilder.py` | Salt uses `secrets` module |

---

## Changes Requiring Manual Review

The following issues require architectural decisions or significant code changes:

| Priority | Issue | Reason Manual Review Needed |
|----------|-------|------------------------------|
| P1 | CRITICAL-1: Rotate all leaked secrets | Requires action in external dashboards |
| P2 | CRITICAL-3,4: Remove free-credit endpoints | Need to confirm frontend usage first |
| P3 | CRITICAL-5: Payment gateway integration | Requires business decision on provider |
| P4 | HIGH-7,8: OTP rate limiting + expiry | Requires new model field + throttle config |
| P5 | HIGH-12: JWT storage migration | Requires frontend + backend architectural change |
| P6 | HIGH-13: WebSocket token passing | Requires new WS handshake protocol |
| P7 | HIGH-14: Role escalation | Requires product decision on allowed role changes |
| P8 | HIGH-16: WS room authorization | Requires async DB lookup in consumer |
| P9 | HIGH-17: Disable OTP console logging | Requires re-enabling SMS integration |
| P10 | HIGH-19: Global rate limiting | Requires DRF throttling config |

---

## Recommended Security Tooling to Add

1. **Secret Scanning in CI:**
   Add [Gitleaks](https://github.com/gitleaks/gitleaks) or [truffleHog](https://github.com/trufflesecurity/trufflehog) as a pre-commit hook and CI step to prevent credentials from entering the repository.

2. **SAST (Static Analysis):**
   - Backend: [`bandit`](https://bandit.readthedocs.io/) — Python security linter
   - Frontend: [`eslint-plugin-security`](https://github.com/eslint-community/eslint-plugin-security)

3. **Dependency Vulnerability Scanning:**
   - Backend: `pip-audit` or `safety`
   - Frontend: `npm audit` (run `npm audit` in `frontend/` and `mobileapp/`)

4. **Pre-commit Hooks:**
   ```yaml
   # .pre-commit-config.yaml
   repos:
     - repo: https://github.com/gitleaks/gitleaks
       rev: v8.18.0
       hooks:
         - id: gitleaks
     - repo: https://github.com/PyCQA/bandit
       rev: 1.7.7
       hooks:
         - id: bandit
           args: ["-r", "backend/", "-ll"]
   ```

5. **Django Security Checklist:**
   Run `python manage.py check --deploy` before every production deployment.

6. **Content Security Policy:**
   Install `django-csp` and configure a strict policy to prevent XSS exploitation.

7. **HTTP Security Headers:**
   Use [Mozilla Observatory](https://observatory.mozilla.org/) to validate headers after deployment.

---

*This report was generated by automated static analysis. Some findings may require additional context or may not apply in all deployment scenarios. All CRITICAL and HIGH findings should be reviewed by a qualified security engineer before deployment to production.*
