# Accounts Data Models

This document outlines the core data models for the OnlineSchool platform's account management system.

## 1. User Model
The central authentication model. It extends Django's `AbstractUser` but uses `phone_number` as the primary identifier.

| Field | Type | Description |
| :--- | :--- | :--- |
| `phone_number` | CharField | Primary identifier (unique). |
| `full_name` | CharField | User's full name. |
| `role` | CharField | Roles: `STUDENT`, `TEACHER`, `ADMIN`, `NEW`. |
| `profile_picture` | ImageField | Uploads to `media/profile_pics/`. |
| `timezone` | CharField | IANA name (e.g., `Asia/Tashkent`). |
| `email` | EmailField | Optional email address. |

---

## 2. Teacher Profile
Extended profile data specifically for teachers. Linked 1-to-1 with a User.

| Field | Type | Description |
| :--- | :--- | :--- |
| `user` | OneToOne | Reference to the User model. |
| `bio` | TextField | About the teacher. |
| `headline` | CharField | Short professional catchphrase. |
| `languages` | CharField | Languages spoken/taught. |
| `hourly_rate` | Decimal | Display rate for students. |
| `rate_per_lesson_uzs` | Decimal | Actual pay per 1-hour lesson (set by admin). |
| `rating` | Decimal | Average student rating (0.00 to 5.00). |
| `lessons_taught` | Integer | Total count of completed classes. |
| `is_accepting_students`| Boolean | Availability toggle for the public list. |
| `payout_day` | Integer | Monthly salary payout day (default: 25th). |

---

## 3. Student Profile
Extended profile data for students, including credit management and CRM fields.

| Field | Type | Description |
| :--- | :--- | :--- |
| `user` | OneToOne | Reference to the User model. |
| `level` | CharField | English proficiency (e.g., `Beginner`). |
| `lesson_credits` | Integer | Total credits owned by the student. |
| `credits_reserved` | Integer | Credits locked for upcoming/active lessons. |
| `available_credits` | Property | `lesson_credits` - `credits_reserved`. |
| `goals` | TextField | Learning objectives. |
| `crm_status` | CharField | Lifecycle: `lead`, `trial`, `paying`, `inactive`, `churned`. |
| `tags` | CharField | Comma-separated labels for administration. |

---

## 4. Supporting Models

### PhoneOTP
Stores temporary 5-digit codes for phone-based authentication.

### CreditTransaction
An immutable ledger of every credit change (Purchases, Lesson consumption, Refunds).

### EarningsEvent
An immutable ledger for teacher pay (Lesson credits, Payouts, Manual adjustments).

### ActivityEvent
Audit log for business-critical events (Registrations, Payments, Status changes).
