# OnlineSchool (Allright.uz) — Comprehensive Project Documentation

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & Tech Stack](#2-architecture--tech-stack)
3. [Backend (Django)](#3-backend-django)
   - [Accounts App](#31-accounts-app)
   - [Scheduling App](#32-scheduling-app)
   - [Lessons App](#33-lessons-app)
   - [Homework App](#34-homework-app)
   - [Curriculum App](#35-curriculum-app)
   - [Payments App](#36-payments-app)
   - [Marketing App](#37-marketing-app)
   - [Banners App](#38-banners-app)
   - [Gamification App](#39-gamification-app)
   - [Progress App](#310-progress-app)
   - [Backend Core (settings, urls, middleware, asgi)](#311-backend-core)
4. [Frontend (React + Vite)](#4-frontend-react--vite)
5. [Mobile App (React Native + Expo)](#5-mobile-app-react-native--expo)
6. [Landing Page](#6-landing-page)
7. [Real-Time Features (WebSocket)](#7-real-time-features-websocket)
8. [External Integrations](#8-external-integrations)
9. [API Endpoint Reference](#9-api-endpoint-reference)
10. [Database Models Summary](#10-database-models-summary)

---

## 1. Project Overview

**Allright.uz** is a full-stack interactive online English school platform. It enables 1-on-1 live lessons between teachers and students with real-time video, a collaborative whiteboard, interactive activities (quizzes, gap-fill, matching games, listening exercises), homework assignments, progress tracking, a gamification system, and a marketing/CRM dashboard.

The platform consists of four deployable units:

| Component      | Technology                    | Purpose                                   |
|----------------|-------------------------------|-------------------------------------------|
| **Backend**    | Django 5 + DRF + Channels     | REST API, WebSocket, business logic       |
| **Frontend**   | React 18 + Vite + TailwindCSS | Student/Teacher/Admin web dashboard       |
| **Mobile App** | React Native + Expo           | iOS & Android native app                  |
| **Landing**    | Static HTML/CSS/JS            | Marketing landing page at allright.uz     |

**Production URLs:**
- API: `https://api.allright.uz`
- Web App: `https://app.allright.uz`
- Landing: `https://allright.uz`

---

## 2. Architecture & Tech Stack

### Backend
- **Framework:** Django 5.x with Django REST Framework (DRF)
- **Auth:** JWT via `djangorestframework-simplejwt` (phone + OTP login, no passwords)
- **Real-time:** Django Channels with WebSocket for live classroom sync
- **Database:** PostgreSQL (via `DATABASE_URL` env var)
- **Static/Media:** BlackNoise for ASGI static serving; media uploads to `media/`
- **Task Queue:** Celery (for marketing campaign sending)
- **Admin:** Django Unfold admin theme

### Frontend
- **Framework:** React 18 with TypeScript
- **Build:** Vite
- **Styling:** TailwindCSS
- **Icons:** Lucide React
- **State:** React Context (AuthContext) + TanStack React Query
- **Routing:** React Router v6 with lazy-loaded marketing routes
- **Video:** LiveKit (`livekit-client`)
- **HTTP:** Axios with JWT interceptor

### Mobile App
- **Framework:** React Native with Expo
- **Navigation:** React Navigation (Stack + Bottom Tabs)
- **Icons:** Lucide React Native
- **Storage:** `expo-secure-store` (native) / `localStorage` (web)
- **Push:** Expo Notifications
- **Video:** LiveKit
- **HTTP:** Axios with JWT interceptor + automatic silent token refresh

### Landing Page
- **Stack:** Vanilla HTML + CSS + JavaScript
- **Features:** Scroll reveal animations, tab-based platform demo, FAQ accordion, animated counters, pricing toggle, responsive hamburger menu

---

## 3. Backend (Django)

### 3.1 Accounts App

**Location:** `backend/accounts/`

The accounts app manages users, authentication, profiles, earnings, and the CRM/activity audit log.

#### Models (`accounts/models.py`)

| Model | Purpose |
|-------|---------|
| **User** | Custom `AbstractUser`. Uses `phone_number` as `USERNAME_FIELD` (no username). Roles: `STUDENT`, `TEACHER`, `ADMIN`, `NEW`. Has `profile_picture`, `timezone` fields. |
| **UserIdentity** | Links social providers (Google, Telegram) to a User. Unique per `(provider, provider_id)`. |
| **PhoneOTP** | Stores OTP codes for phone-based authentication. One active code per phone number. |
| **TeacherProfile** | One-to-one with User. Fields: `bio`, `headline`, `status` (pending/active/inactive for admin approval), `languages` (JSON), `language_certificates` (JSON), `subjects`, `youtube_intro_url`, `rating`, `lessons_taught`, `is_accepting_students`, `rate_per_lesson_uzs`, `payout_day`. |
| **Subject** | Normalized subject entity (name, unique). |
| **TeacherSubject** | M2M link between TeacherProfile and Subject. |
| **StudentProfile** | One-to-one with User. Fields: `level`, `lesson_credits`, `credits_reserved`, `goals`, `crm_status` (lead/trial/paying/inactive/churned), `tags`, `churn_reason`. Property: `available_credits` = `lesson_credits - credits_reserved`. |
| **AdminNote** | Timestamped admin notes on a StudentProfile. Append-only. |
| **CreditTransaction** | Immutable ledger of every credit change. Reasons: purchase, lesson, student_absent, admin_add, admin_sub, refund. Links to Payment and Lesson. |
| **EarningsEvent** | Immutable ledger of teacher earnings. Types: lesson_credit, adjustment, payout, correction. Tracks `amount_uzs`. |
| **TeacherPayout** | Explicit payout request workflow: REQUESTED → APPROVED → PAID / REJECTED. |
| **ActivityEvent** | Immutable audit log of key business events (registration, payments, lessons, payouts, impersonation). Used for admin activity feed. |

#### Signals (in `accounts/models.py`)

- **`manage_user_profile`** — Auto-creates TeacherProfile or StudentProfile when User role is set.
- **`handle_lesson_credit_lifecycle`** — On Lesson status change: charges credit on COMPLETED/STUDENT_ABSENT, releases hold on CANCELLED. Creates EarningsEvent for teachers on COMPLETED. Idempotent via `credits_consumed` flag.
- **`on_payment_change`** — Records ActivityEvent on payment status changes.
- **`on_lesson_activity`** — Records ActivityEvent for lesson scheduling and status changes.
- **`on_teacher_payout`** — Records ActivityEvent when a payout EarningsEvent is created.

#### Views (`accounts/views.py`)

| View | Method | Auth | Purpose |
|------|--------|------|---------|
| `SendOTPView` | POST | Public | Generates OTP and sends via DevSms (or prints in DEBUG mode) |
| `VerifyOTPView` | POST | Public | Verifies OTP, creates/gets user, returns JWT tokens + `is_new_user` flag |
| `SelectRoleView` | POST | Auth | Sets user role and full_name after initial registration |
| `AddCreditsView` | POST | Auth | Legacy: adds credits to student profile |
| `MockPurchaseCreditsView` | POST | Auth | Dev/test: simulates a credit purchase |
| `AvatarUploadView` | POST | Auth | Uploads profile picture (multipart) |

#### API (`accounts/api.py`)

| View | Method | Auth | Purpose |
|------|--------|------|---------|
| `MeView` | GET | Auth | Returns current user with nested profiles |
| `TeachersListView` | GET | Public | Lists active teachers with profiles |
| `TeacherDetailView` | GET | Public | Single teacher detail |
| `TeacherEarningsSummaryView` | GET | Teacher | Earnings summary (total, pending, paid) |
| `TeacherEarningsHistoryView` | GET | Teacher | Paginated earnings history |
| `StudentProfileView` | GET/PATCH | Auth | View/update student profile |
| `TeacherSettingsView` | GET/PATCH | Teacher | View/update teacher settings |
| `AdminTeacherListView` | GET | Admin | List all teachers for admin |
| `AdminTeacherApproveView` | POST | Admin | Approve a pending teacher |
| `AdminTeacherDeactivateView` | POST | Admin | Deactivate a teacher |
| `TeacherRatingsView` | GET | Public | List ratings for a teacher |
| `SubjectListView` | GET | Auth | List all subjects |
| `TeacherSubjectView` | GET/POST | Teacher | Manage teacher's subjects |
| `TeacherPayoutListCreateView` | GET/POST | Teacher | List/request payouts |

#### Impersonation (`accounts/impersonation.py`)

Two-step admin impersonation flow:
1. Admin clicks "Impersonate" in Django admin → generates a signed one-time token
2. Frontend exchanges token via `ImpersonateExchangeView` → receives JWT pair for the target user
3. `ImpersonateExitView` logs when admin exits impersonation

---

### 3.2 Scheduling App

**Location:** `backend/scheduling/`

Manages teacher availability, lesson booking, and lesson lifecycle.

#### Models (`scheduling/models.py`)

| Model | Purpose |
|-------|---------|
| **Availability** | Teacher's recurring time slots. Fields: `teacher`, `day_of_week`, `start_time`, `end_time`. |
| **Lesson** | Booked lesson. Fields: `teacher`, `student`, `lesson_date`, `start_time`, `end_time`, `room_sid`, `status` (SCHEDULED/IN_PROGRESS/COMPLETED/CANCELLED/STUDENT_ABSENT), `credits_reserved`, `credits_consumed`, `meeting_link`. |
| **LessonWrapUp** | Teacher notes after a lesson: `pronunciation_score`, `grammar_score`, `vocabulary_score`, `listening_score`, `teacher_notes`, `homework_assigned`. |
| **LessonRescheduleHistory** | Audit log for lesson time changes. |
| **LessonRating** | Student feedback on a lesson: `rating` (1-5), `comment`. |
| **LessonTemplate** | Reusable lesson templates. |
| **Activity** | Interactive lesson content (type: image/video/matching/gap_fill/quiz/pdf/listening). Ordered within a lesson. |

#### API (`scheduling/api.py`)

Key views:
- **AvailabilityViewSet** — Teachers manage recurring schedule slots.
- **BookLessonView** — Students book lessons (reserves 1 credit atomically).
- **StudentLessonsView / TeacherLessonsView** — List booked lessons.
- **ClassroomEntryView** — Generates LiveKit token for authenticated classroom access.
- **UpdateLessonStatusView** — Teachers update lesson status (complete/cancel/absent).
- **TeacherStatsView** — Teacher statistics (total lessons, students, rating).
- **TeacherLessonHistoryView** — Past lessons with status.
- **TeacherWrapUpView** — Submit/retrieve lesson wrap-up data.
- **LessonRatingView** — Students rate lessons.
- **RescheduleHistoryView** — View reschedule audit log.

#### Utilities (`scheduling/utils.py`)

- `generate_livekit_token(room_name, user_id, user_name, is_publisher)` — Creates a LiveKit `AccessToken` with room join, publish, and subscribe grants.

---

### 3.3 Lessons App

**Location:** `backend/lessons/`

Supplementary lesson content and classroom entry logic.

#### Models (`lessons/models.py`)

| Model | Purpose |
|-------|---------|
| **LessonContent** | One-to-one with `scheduling.Lesson`. Stores `teacher_notes` and `whiteboard_data` (JSON). |

#### Views (`lessons/views.py`)

| View | Purpose |
|------|---------|
| `AdminLessonUpdateView` | Admin updates to lesson time or status |
| `ClassroomEntryView` | Handles secure classroom access, generates LiveKit token |

---

### 3.4 Homework App

**Location:** `backend/homework/`

Manages homework templates, assignments, and auto-grading.

#### Models (`homework/models.py`)

| Model | Purpose |
|-------|---------|
| **Homework** | Template for an assignment. Fields: `title`, `description`, `created_by` (teacher). |
| **HomeworkActivity** | Individual task within homework. Types: `quiz`, `gap_fill`, `matching`, `listening`. Content stored as JSON. Ordered. |
| **HomeworkAssignment** | Specific instance assigned to a student for a lesson. Fields: `homework`, `student`, `lesson`, `status` (pending/submitted/graded), `score`, `submitted_at`. |
| **StudentActivityResponse** | Student's answer to an activity. Fields: `assignment`, `activity`, `student_answer` (JSON), `is_correct`, `score`. |

#### Views (`homework/views.py`)

Key views:
- **HomeworkTemplateList/Create/Detail** — CRUD for homework templates.
- **DuplicateHomework** — Clone a template.
- **ReplaceActivities** — Bulk-replace activities in a template.
- **AssignHomework** — Teacher assigns homework to a lesson.
- **TeacherAssignmentList** — Teacher views assigned homeworks.
- **StudentAssignmentList/Detail** — Student views and submits assignments.
- **SubmitAssignment** — Student submits answers; auto-grades and returns score.
- **LeaderboardView** — Ranked students by homework performance.

---

### 3.5 Curriculum App

**Location:** `backend/curriculum/`

Manages structured course content: courses → units → lessons → activities + media assets.

#### Models (`curriculum/models.py`)

| Model | Purpose |
|-------|---------|
| **Course** | Top-level course entity. Fields: `title`, `description`, `level`, `is_published`. |
| **Unit** | Chapter within a course. Ordered. |
| **Lesson** | Lesson within a unit (distinct from scheduling.Lesson). Ordered. |
| **LessonActivity** | Interactive element within a curriculum lesson. Types: image, video, matching, gap_fill, quiz, pdf, listening. Content as JSON. |
| **PdfAsset** | Uploaded PDF file for lessons. |
| **AudioAsset** | Uploaded audio file. |
| **VideoAsset** | Uploaded video file. |
| **Enrollment** | Tracks student enrollment in a course with progress percentage. |

#### API (`curriculum/api.py`)

Key views:
- **CourseViewSet / UnitViewSet / LessonViewSet / LessonActivityViewSet** — Full CRUD.
- **PdfAssetViewSet / AudioAssetViewSet / VideoAssetViewSet** — Media upload and management.
- **DuplicateLesson** — Clone a lesson with all activities.
- **GenerateFromPDF** — Upload a PDF → auto-generate lesson activities (slide-per-page).
- **AuthenticatedDownloadView / AuthenticatedPreviewView** — Secure media access with range-request support for audio/video streaming.
- **EnrollmentView** — Manage student course enrollments.

---

### 3.6 Payments App

**Location:** `backend/payments/`

Handles credit purchases, payment processing, and multiple payment gateways.

#### Models (`payments/models.py`)

| Model | Purpose |
|-------|---------|
| **CreditPackage** | Admin-defined bundles. Fields: `name`, `credits`, `price_uzs`, `is_active`, `is_popular`, `features` (JSON), `validity_label`, `discount_percent`. Property: `price_per_credit_uzs`. |
| **Payment** | Records a student credit purchase. Fields: `student`, `credit_package`, `credits_amount`, `amount_uzs`, `status` (pending/succeeded/failed), `method` (card/manual), `provider` (stripe/payme/click), `receipt_id`, `discount_code`. |
| **Package** | Legacy: purchasable bundles of lessons. |
| **StudentPackage** | Legacy: tracks remaining lessons and expiry. |

#### Services (`payments/services.py`)

- `get_active_packages()` — Retrieves active credit packages ordered by price.
- `create_stripe_checkout_session(user, package, discount_code)` — Creates a Stripe checkout session with line items, metadata, and optional discount.
- `purchase_credits_atomic(student_profile, package, method, provider, receipt_id, discount_code)` — Atomically: creates Payment record, updates student's `lesson_credits` via F-expression, creates CreditTransaction ledger entry. Applies discount if provided.
- `grant_credits_for_payment(payment)` — Called on webhook: grants credits for pending payments.

#### API (`payments/api.py`)

| View | Purpose |
|------|---------|
| `CreditPackageListView` | List active packages (public for students) |
| `PurchaseCreditsView` | Purchase credits (test/demo flow with atomic transaction) |
| `InitiatePaymentView` | Initiate payment via Payme, Click, or Stripe |
| `StripeWebhookView` | Process Stripe `checkout.session.completed` webhooks |
| `PaymentHistoryView` | Student's payment history |
| `AdminCreditPackageView` | Admin CRUD for credit packages |

#### Webhooks

- `payments/click_webhook.py` — Click.uz payment gateway webhook handler
- `payments/payme_webhook.py` — Payme.uz payment gateway webhook handler

---

### 3.7 Marketing App

**Location:** `backend/marketing/`

Full marketing automation: campaigns, banners, announcements, discount codes, analytics.

#### Models (`marketing/models.py`)

| Model | Purpose |
|-------|---------|
| **Banner** | Configurable banners (carousel/announcement/modal). Fields: `placement`, `target_role`, `target_platform`, images (web/mobile), styling, CTA, priority, scheduling. Property: `is_live`. |
| **Announcement** | Text announcements with CTA button, role targeting, and scheduling. |
| **EmailCampaign** | Email campaign with subject, HTML body, recipient filtering, scheduling, open/click tracking. Sends via Resend/SendGrid. |
| **SmsCampaign** | SMS campaign with recipient filtering and scheduling. |
| **DiscountCode** | Promotional codes. Types: `percent`, `fixed`, `free_credits`. Fields: `code`, `max_uses`, `uses`, `valid_from/until`, `min_credits`, `applies_to_package`. Method: `validate_for(student)`. |
| **DiscountCodeUsage** | Tracks which students used which codes. |
| **PushCampaign** | Push notification campaign with targeting and scheduling. |
| **PushToken** | Stores Expo push tokens per user/platform. Upserts by `(user, token)`. |
| **MarketingMetricsSnapshot** | Daily KPI snapshots: total/new students, revenue, active students, churn rate. |

#### Views (`marketing/views.py`)

Admin CRUD (require marketing user permission):
- `BannerViewSet`, `AnnouncementViewSet`, `EmailCampaignViewSet`, `SmsCampaignViewSet`, `PushCampaignViewSet`, `DiscountCodeViewSet`

Public endpoints:
- `ActiveBannersView` — Returns currently live banners by placement.
- `ActiveAnnouncementsView` — Returns live announcements.
- `ValidateDiscountCodeView` — Validates a promo code for a student.
- `BannerImpressionView / BannerClickView` — Tracks banner engagement.
- `RegisterPushTokenView` — Registers Expo push tokens.
- `ResendWebhookView` — Processes Resend email delivery webhooks.

Analytics endpoints:
- `MarketingKPIView` — Key marketing metrics.
- `RevenueView` — Revenue analytics.
- `FunnelView` — Conversion funnel data.
- `RetentionView` — Student retention metrics.
- `AcquisitionView` — New student acquisition data.

#### Services

- `marketing/services/email.py` — Email sending (Resend/SendGrid integration)
- `marketing/services/sms.py` — SMS sending (DevSms.uz/Twilio)
- `marketing/services/push.py` — Push notifications (Expo)
- `marketing/services/analytics.py` — Analytics integration (Mixpanel/PostHog)

#### Management Commands

- `fire_scheduled_campaigns` — Triggers pending scheduled campaigns.
- `snapshot_marketing_metrics` — Takes daily KPI snapshots.

---

### 3.8 Banners App

**Location:** `backend/banners/`

#### Models (`banners/models.py`)

| Model | Purpose |
|-------|---------|
| **BannerCampaign** | Configurable banners with placement targeting, role/platform targeting, web/mobile images, styling (background color, title, subtitle, CTA), target type (internal route / external URL), priority, activity status, and date scheduling. Property: `is_visible`. |

Uses `DefaultRouter` with `BannerViewSet` for CRUD.

---

### 3.9 Gamification App

**Location:** `backend/gamification/`

Coin-based reward system for student engagement.

#### Models (`gamification/models.py`)

| Model | Purpose |
|-------|---------|
| **CoinTransaction** | Immutable ledger of coin changes. Fields: `student`, `amount` (positive or negative), `reason`, `created_at`. |
| **Reward** | Items students can redeem. Fields: `name`, `description`, `coin_cost`, `image`, `is_active`. |
| **StudentReward** | Records of claimed rewards. Fields: `student`, `reward`, `status` (pending/approved/rejected), `claimed_at`. |

#### API (`gamification/api.py`)

| View | Purpose |
|------|---------|
| `CoinBalanceView` | GET: Returns student's coin balance (sum of all transactions) and transaction history |
| `RewardListView` | GET: Lists active rewards available for redemption |
| `StudentRewardView` | GET: Student's claimed rewards. POST: Claim a reward (deducts coins, creates StudentReward). |

---

### 3.10 Progress App

**Location:** `backend/progress/`

Tracks per-lesson performance scores and student dashboard stats.

#### Models (`progress/models.py`)

| Model | Purpose |
|-------|---------|
| **LessonProgress** | One-to-one with `scheduling.Lesson`. Fields: `speaking_score`, `grammar_score`, `vocabulary_score`, `listening_score` (each 0-100), `teacher_feedback`. Property: `average_score`. |

#### API (`progress/api.py`)

| View | Purpose |
|------|---------|
| `SubmitLessonProgressView` | POST (teacher): Submit scores and feedback for a completed lesson |
| `MyProgressView` | GET (student): Progress history across all lessons |
| `student_dashboard_stats` | GET (student): Aggregated dashboard stats — completed lessons, next class, level |

---

### 3.11 Backend Core

#### Settings (`backend/settings.py`)

Key configuration areas:
- **Installed Apps:** accounts, scheduling, lessons, homework, curriculum, payments, banners, marketing, gamification, progress + DRF, Channels, CORS, Unfold admin
- **Auth:** Custom User model (`accounts.User`), JWT with 7-day access / 30-day refresh tokens
- **Database:** PostgreSQL via `DATABASE_URL`
- **CORS:** Allowed origins configurable, includes localhost:5173 for dev
- **Channels:** Redis channel layer for WebSocket
- **External API Keys (env vars):** `STRIPE_SECRET_KEY`, `PAYME_ID`, `PAYME_KEY`, `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`, `RESEND_API_KEY`, `SENDGRID_API_KEY`, `TWILIO_*`, `MIXPANEL_TOKEN`, `POSTHOG_API_KEY`

#### URL Configuration (`backend/urls.py`)

Top-level URL mounting:

```
/admin/                → Django Admin
/api/                  → accounts URLs
/api/                  → scheduling URLs (availability, lessons, classroom)
/api/                  → lessons URLs
/api/homework/         → homework URLs
/api/curriculum/       → curriculum URLs
/api/payments/         → payments URLs
/api/banners/          → banners URLs
/api/marketing/        → marketing URLs
/api/gamification/     → gamification URLs
/api/progress/         → progress URLs
/api/token/            → JWT obtain/refresh
/api/schema/           → OpenAPI schema (drf-spectacular)
```

#### ASGI Configuration (`backend/asgi.py`)

- HTTP: Django + BlackNoise (static + media serving)
- WebSocket: `TokenAuthMiddleware` → `URLRouter` → lesson consumer
- Uses `ProtocolTypeRouter` to handle both HTTP and WS

#### Middleware (`backend/middleware.py`)

- **TokenAuthMiddleware** — ASGI middleware for WebSocket JWT authentication. Extracts token from query string, decodes JWT, attaches user to scope. Handles expired/invalid tokens by assigning `AnonymousUser`.

---

## 4. Frontend (React + Vite)

**Location:** `frontend/`

### Entry Point

- `main.tsx` — React 18 `createRoot`, wraps App in `StrictMode` + `QueryClientProvider` (TanStack React Query with 1-min stale time).
- `App.tsx` — `AuthProvider` + `BrowserRouter`. Defines all routes.

### Authentication

- **AuthContext** (`features/auth/AuthContext.tsx`) — React Context providing `user`, `isLoading`, `login()`, `logout()`, `refreshUser()`. Stores JWT in `localStorage`. On mount, checks `access_token` and fetches `/api/me/`.
- **Login** (`features/auth/Login.tsx`) — 3-step OTP login: (1) Enter phone, (2) Verify OTP, (3) Onboarding (name + role selection). UI in Uzbek language.
- **API Client** (`lib/api.ts`) — Axios instance with base URL from `VITE_API_BASE_URL` (defaults to `https://api.allright.uz`). Request interceptor attaches `Bearer` token.

### Route Structure

| Route | Component | Access |
|-------|-----------|--------|
| `/login` | Login | Public |
| `/teacher/login\|register\|verify-otp\|onboarding\|pending-approval` | Teacher auth flow | Public |
| `/dashboard` | DashboardPage (Teacher or Student) | Protected |
| `/classroom/:id` | Classroom (full-screen) | Protected |
| `/admin/*` | AdminLayout → AdminLessons, AdminUpload | Protected |
| `/marketing/*` | MarketingLayout (lazy-loaded) → Overview, Banners, Email, SMS, Push, Discounts, Revenue, Funnel, Retention, Packages | Protected |
| `/teacher/*` | Teacher pages (settings, schedule, students, earnings, history, homework) | Protected |
| `/student/*` | Student pages (profile, schedule, achievements, goals, homework, leaderboard, enrollments, packages, coins) | Protected |
| `/find-teachers` | FindTeachersPage | Protected |
| `/buy-credits` | BuyCredits | Protected |
| `/builder/*` | LessonBuilder | Protected |
| `*` | Redirect to /dashboard | — |

### Key Components

#### DashboardPage (`features/dashboard/DashboardPage.tsx`)
- Fetches user data (`/api/me/`) and lessons (`/api/my-lessons/`)
- Detects role (teacher vs student) and renders appropriate dashboard
- **TeacherDashboard:** Sidebar nav, stats (students, lessons taught, hourly rate), class schedule with join/start buttons
- **StudentDashboard:** Sidebar nav, stats (credits, level, next lesson), lesson schedule, "Browse Teachers" and "Refill Credits" CTAs
- Both include `BannerCarousel` and `InlineBanner` marketing components

#### Classroom (`features/classroom/Classroom.tsx`)
- ~1500 lines; the core real-time teaching experience
- **Secure Entry:** Calls `/api/classroom/enter/:id/` to get LiveKit token, URL, channel, role, and initial lesson
- **WebSocket:** Connects to `wss://api.allright.uz/ws/lesson/:id/` for real-time sync
- **Message Types:** `chat_message`, `lesson_update`, `lesson_state`, `ZONE_STATE_UPDATE`, `ZONE_ACTION`, `VIDEO_PLAY/PAUSE/SYNC/SEEK/STATE`, `AUDIO_*`, `history_dump`
- **Activities:** Renders based on `activity_type`: image, video (YouTube with sync), matching (`MatchingGame`), gap_fill (`GapFill`), quiz (`Quiz`), pdf (`PdfActivity`), listening (`Listening`)
- **Layout:** 2-column desktop (content + sidebar with Chat/Library/People tabs), mobile bottom nav
- **Features:** Whiteboard (Konva), LiveKit video (PiP), chat with auto-scroll, lesson library, slide navigation, leave confirmation modal, teacher wrap-up modal, browser-back guard

#### VideoRoom (`features/classroom/VideoRoom.tsx`)
- LiveKit integration with `Room`, `RoomEvent`, `Track`
- Adaptive streaming and dynamic broadcasting (dynacast)
- Local + remote video tiles with network quality indicator
- Camera/mic toggle, connection quality display, waiting overlay

#### BuyCredits (`features/dashboard/BuyCredits.tsx`)
- Fetches credit packages from `/api/payments/packages/`
- Package selection UI with popular highlighting
- Promo code input with real-time validation (`/api/marketing/discount-codes/validate/`)
- Payment provider selection: Payme, Click, Stripe
- Initiates payment via `/api/payments/initiate/`
- Handles payment success/cancel URL params

### Other Notable Components

- **ImpersonationBanner** — Shows alert bar when admin is impersonating a user
- **AppLayout** — Wraps pages with announcement bar from marketing
- **Marketing components** (`components/marketing/`) — AnnouncementBar, BannerCarousel, InlineBanner, ModalBanner, KpiCard
- **Avatar** — Reusable avatar component with image/initials fallback
- **LessonBuilder** (`features/teachers/LessonBuilder.tsx`) — Teacher content creation tool

---

## 5. Mobile App (React Native + Expo)

**Location:** `mobileapp/`

### Entry Point

`App.tsx` — Wraps everything in `SafeAreaProvider` → `AuthProvider` → `StatusBar` + `RootNavigator`.

### Navigation

**RootNavigator** (`src/navigation/RootNavigator.tsx`):
- **Unauthenticated:** Login → OTP → Onboarding
- **Authenticated:** Main (tabs) + standalone screens (TeacherProfile, Classroom, BuyCredits, TeacherEarnings, TeacherHistory, Schedule, Notifications, HomeworkPlayer, EditProfile, StudentHistory)

**MainTabNavigator** (`src/navigation/MainTabNavigator.tsx`):
- Registers push token on mount via `usePushToken()` hook
- **Teacher tabs:** Dashboard, Schedule, Students, Earnings, Profile
- **Student tabs:** Home, Homework, Leaderboard, Teachers, Profile

### Authentication (`src/features/auth/AuthContext.tsx`)

- Same pattern as web: Context with `user`, `isLoading`, `login()`, `logout()`, `refreshUser()`, `selectRole()`
- Uses `expo-secure-store` for token storage (native) or `localStorage` (web)
- Login flow: OTP verification via `/api/accounts/verify-otp/`
- Returns `is_new_user` flag to trigger onboarding

### API Client (`src/api/client.ts`)

- Axios with base URL from `EXPO_PUBLIC_API_URL` (falls back to `https://api.allright.uz`)
- **Request interceptor:** Attaches JWT from secure storage
- **Response interceptor:** On 401, attempts silent token refresh with `refresh_token`. Queues concurrent requests during refresh. Clears tokens and forces logout on refresh failure.

### Storage (`src/lib/storage.ts`)

Cross-platform abstraction:
- **Native (iOS/Android):** `expo-secure-store` (encrypted)
- **Web:** `localStorage`

### Push Notifications (`src/hooks/usePushToken.ts`)

- Requests Expo push notification permission
- Gets Expo push token via `Notifications.getExpoPushTokenAsync()`
- Registers with backend: `POST /api/marketing/push-tokens/` with `{token, platform}`
- Runs once on mount (MainTabNavigator is only mounted when authenticated)
- Handles simulator errors silently

### MobileClassroom (`src/features/classroom/MobileClassroom.tsx`)

- React Native equivalent of the web Classroom
- Entry via `/api/classroom/enter/:sessionId/`
- WebSocket for real-time lesson sync
- Renders activities: MobileWhiteboard, QuizMobile, MatchingGameMobile, GapFillMobile, PdfActivityMobile, VideoActivityMobile, ListeningActivityMobile
- LiveKitVideoRoom for video
- Native controls: mic, camera, chat, hand raise, end session

### Theme (`src/theme/index.ts`)

Defines `Colors` (primary blue-600, background gray-50, etc.), `Spacing` (xs through xxl), and `Shadows` (sm, md, lg) constants.

---

## 6. Landing Page

**Location:** `landing/`

Static marketing website for **Allright.uz**.

### Structure (`index.html`)

| Section | Content |
|---------|---------|
| **Navbar** | Logo, nav links (Platform, Programs, Teachers, Pricing, FAQ), Login/CTA buttons, hamburger for mobile |
| **Hero** | Headline "Master English with Live Interactive Lessons", CTA buttons, trust badges (24,000+ students, 4.9/5 rating), interactive classroom UI mockup |
| **Trusted By** | Oxford, Cambridge, Google, Microsoft, Deloitte, British Council logos |
| **Features** | 6 feature cards: HD Live Lessons, Interactive Whiteboard, Live Quizzes & Gap Fill, Smart Homework, Progress Analytics, iOS & Android App |
| **Platform Demo** | Tab-based showcase: Live Lesson, Whiteboard, Quizzes, Progress — each with interactive SVG mockup |
| **How It Works** | 3 steps: Free Level Check → Choose Program & Teacher → Learn, Practice & Level Up |
| **Programs** | Academic English, Business English, IELTS prep, CEFR progression |
| **Teachers** | Teacher profiles showcase |
| **Pricing** | Monthly/yearly toggle with animated price transitions |
| **FAQ** | Accordion-style FAQ |
| **CTA / Footer** | Final call-to-action and site footer |

### JavaScript (`script.js`)

- **Navbar:** Sticky scroll shadow, hamburger toggle
- **Scroll Reveal:** IntersectionObserver with staggered delay
- **Platform Tabs:** Tab switching for demo panels
- **Pricing Toggle:** Animated number transitions (easeOutCubic)
- **FAQ Accordion:** Open/close with maxHeight animation
- **Animated Counters:** IntersectionObserver triggers count-up animation
- **Smooth Scroll:** For anchor links with header offset
- **Live Effects:** Classroom timer ticking in the hero mockup

---

## 7. Real-Time Features (WebSocket)

### Architecture

- Django Channels with Redis channel layer
- WebSocket endpoint: `wss://api.allright.uz/ws/lesson/<lesson_id>/`
- Authentication via JWT query parameter (handled by `TokenAuthMiddleware`)

### Message Protocol

| Message Type | Direction | Payload | Purpose |
|--------------|-----------|---------|---------|
| `chat_message` | Bidirectional | `{name, text, time}` | Real-time chat |
| `lesson_update` | Teacher → All | `{lesson, slideIndex}` | Teacher loads/changes lesson or slide |
| `lesson_state` | Server → Client | `{lesson, slideIndex}` | Current lesson state broadcast |
| `history_dump` | Server → Client | `[{type, payload}, ...]` | Chat + lesson history on connect |
| `ZONE_ACTION` | Bidirectional | `{activity_type, action, ...}` | Interactive activity state changes |
| `ZONE_STATE_UPDATE` | Server → Client | Activity-specific | Zone state sync |
| `VIDEO_PLAY/PAUSE/SEEK/SYNC` | Teacher → Student | `{t}` | YouTube video synchronization |
| `VIDEO_STATE` | Server → Client | `{state, t}` | Full video state on connect |
| `AUDIO_PLAY/PAUSE/SYNC/STATE` | Bidirectional | Audio position data | Audio activity sync |

### Persistence

- Lesson state stored in sessionStorage (lightweight snapshot: id + title only, never base64 content)
- Full activity data re-fetched from server on reconnect
- WebSocket history_dump replays missed messages

---

## 8. External Integrations

| Service | Purpose | Configuration |
|---------|---------|---------------|
| **LiveKit** | Real-time video/audio for classroom | `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` |
| **Stripe** | International payment processing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| **Payme** | Uzbekistan payment gateway | `PAYME_ID`, `PAYME_KEY` |
| **Click** | Uzbekistan payment gateway | `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY` |
| **DevSms.uz** | SMS OTP delivery | Via `DevSmsService` |
| **Resend** | Transactional email | `RESEND_API_KEY` |
| **SendGrid** | Email campaigns | `SENDGRID_API_KEY` |
| **Twilio** | SMS campaigns (international) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` |
| **Expo Push** | Mobile push notifications | Via Expo SDK (projectId from app.json) |
| **Mixpanel** | Product analytics | `MIXPANEL_TOKEN` |
| **PostHog** | Product analytics | `POSTHOG_API_KEY` |
| **YouTube IFrame API** | Video playback in classroom | Loaded dynamically |

---

## 9. API Endpoint Reference

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/send-otp/` | Public | Send OTP to phone |
| POST | `/api/verify-otp/` | Public | Verify OTP, get JWT |
| POST | `/api/select-role/` | Auth | Set role after registration |
| POST | `/api/token/` | Public | JWT obtain pair |
| POST | `/api/token/refresh/` | Public | Refresh JWT |

### User & Profile
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/me/` | Auth | Current user with profiles |
| POST | `/api/avatar/` | Auth | Upload profile picture |
| GET/PATCH | `/api/student/profile/` | Auth | Student profile |
| GET/PATCH | `/api/teacher/settings/` | Teacher | Teacher settings |
| GET | `/api/teachers/` | Public | List active teachers |
| GET | `/api/teachers/<id>/` | Public | Teacher detail |

### Scheduling
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET/POST/DELETE | `/api/availability/` | Teacher | Manage availability slots |
| POST | `/api/book-lesson/` | Student | Book a lesson (reserves credit) |
| GET | `/api/my-lessons/` | Auth | Student's lessons |
| GET | `/api/teacher-lessons/` | Teacher | Teacher's lessons |
| GET | `/api/classroom/enter/<id>/` | Auth | Get LiveKit token for classroom |
| POST | `/api/update-lesson-status/<id>/` | Teacher | Update lesson status |

### Homework
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET/POST | `/api/homework/templates/` | Teacher | List/create templates |
| GET/PUT/DELETE | `/api/homework/templates/<id>/` | Teacher | Template detail |
| POST | `/api/homework/assign/` | Teacher | Assign homework to lesson |
| GET | `/api/homework/student/assignments/` | Student | Student's assignments |
| POST | `/api/homework/student/submit/<id>/` | Student | Submit answers |
| GET | `/api/homework/leaderboard/` | Auth | Homework leaderboard |

### Curriculum
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| CRUD | `/api/curriculum/courses/` | Auth | Course management |
| CRUD | `/api/curriculum/units/` | Auth | Unit management |
| CRUD | `/api/curriculum/lessons/` | Auth | Lesson management |
| CRUD | `/api/curriculum/activities/` | Auth | Activity management |
| CRUD | `/api/curriculum/pdfs\|audio\|videos/` | Auth | Media asset management |

### Payments
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/payments/packages/` | Auth | List credit packages |
| POST | `/api/payments/purchase/` | Auth | Purchase credits |
| POST | `/api/payments/initiate/` | Auth | Initiate payment (Payme/Click/Stripe) |
| POST | `/api/payments/webhook/stripe/` | Public | Stripe webhook |
| GET | `/api/payments/history/` | Auth | Payment history |

### Marketing
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| CRUD | `/api/marketing/banners/` | Marketing | Banner management |
| CRUD | `/api/marketing/announcements/` | Marketing | Announcement management |
| CRUD | `/api/marketing/email-campaigns/` | Marketing | Email campaigns |
| CRUD | `/api/marketing/sms-campaigns/` | Marketing | SMS campaigns |
| CRUD | `/api/marketing/push-campaigns/` | Marketing | Push campaigns |
| CRUD | `/api/marketing/discount-codes/` | Marketing | Discount codes |
| POST | `/api/marketing/discount-codes/validate/` | Auth | Validate promo code |
| POST | `/api/marketing/push-tokens/` | Auth | Register push token |
| GET | `/api/marketing/kpi/` | Marketing | Marketing KPIs |

### Gamification
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/gamification/coin-balance/` | Student | Coin balance + history |
| GET | `/api/gamification/rewards/` | Student | Available rewards |
| GET/POST | `/api/gamification/my-rewards/` | Student | Claimed rewards / claim new |

### Progress
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/progress/submit/` | Teacher | Submit lesson progress scores |
| GET | `/api/progress/history/` | Student | Progress history |
| GET | `/api/progress/dashboard-stats/` | Student | Dashboard statistics |

---

## 10. Database Models Summary

### Total Models: ~35+

| App | Models |
|-----|--------|
| **accounts** | User, UserIdentity, PhoneOTP, TeacherProfile, Subject, TeacherSubject, StudentProfile, AdminNote, CreditTransaction, EarningsEvent, TeacherPayout, ActivityEvent |
| **scheduling** | Availability, Lesson, LessonWrapUp, LessonRescheduleHistory, LessonRating, LessonTemplate, Activity |
| **lessons** | LessonContent |
| **homework** | Homework, HomeworkActivity, HomeworkAssignment, StudentActivityResponse |
| **curriculum** | Course, Unit, Lesson, LessonActivity, PdfAsset, AudioAsset, VideoAsset, Enrollment |
| **payments** | CreditPackage, Payment, Package, StudentPackage |
| **banners** | BannerCampaign |
| **marketing** | Banner, Announcement, EmailCampaign, SmsCampaign, DiscountCode, DiscountCodeUsage, PushCampaign, PushToken, MarketingMetricsSnapshot |
| **gamification** | CoinTransaction, Reward, StudentReward |
| **progress** | LessonProgress |

### Key Relationships

```
User (phone_number as USERNAME_FIELD)
  ├── TeacherProfile (1:1) → TeacherSubject → Subject
  │   ├── Availability (1:N)
  │   ├── EarningsEvent (1:N)
  │   └── TeacherPayout (1:N)
  ├── StudentProfile (1:1)
  │   ├── CreditTransaction (1:N) → Payment, Lesson
  │   ├── CoinTransaction (1:N)
  │   ├── StudentReward (1:N) → Reward
  │   ├── AdminNote (1:N)
  │   └── HomeworkAssignment (1:N)
  ├── UserIdentity (1:N) — social logins
  └── ActivityEvent — audit log

Lesson (scheduling)
  ├── teacher → User
  ├── student → User
  ├── LessonWrapUp (1:1)
  ├── LessonContent (1:1)
  ├── LessonProgress (1:1)
  ├── LessonRating (1:1)
  ├── LessonRescheduleHistory (1:N)
  └── HomeworkAssignment (1:N) → Homework → HomeworkActivity
                                          → StudentActivityResponse

Course (curriculum)
  └── Unit (1:N)
      └── Lesson (1:N)
          └── LessonActivity (1:N)
              └── PdfAsset / AudioAsset / VideoAsset

CreditPackage → Payment → CreditTransaction
DiscountCode → DiscountCodeUsage
```

### Credit Flow

```
1. Student purchases credits:
   CreditPackage → Payment (pending) → Webhook confirms
   → Payment (succeeded) → StudentProfile.lesson_credits += N
   → CreditTransaction (delta: +N, reason: purchase)

2. Student books lesson:
   → StudentProfile.credits_reserved += 1
   → Lesson.credits_reserved = True

3. Lesson completes:
   → StudentProfile.lesson_credits -= 1
   → StudentProfile.credits_reserved -= 1
   → CreditTransaction (delta: -1, reason: lesson)
   → EarningsEvent (lesson_credit, amount_uzs)
   → Lesson.credits_consumed = True

4. Lesson cancelled:
   → StudentProfile.credits_reserved -= 1
   → Lesson.credits_reserved = False
   (no credit charge)
```
