# Database Documentation

This document provides an overview of the database configuration, environment variables, and the Entity-Relationship (ER) diagram for the Online School backend.

## Database Configuration

The project uses **PostgreSQL** as the primary database.

### Core Variables (`backend/settings.py`)

| Variable | Description | Default / Source |
| :--- | :--- | :--- |
| `ENGINE` | Database engine | `django.db.backends.postgresql` |
| `NAME` | Database name | `os.getenv("DB_NAME", "allright_db")` |
| `USER` | Database user | `os.getenv("DB_USER", "allright_user")` |
| `PASSWORD` | Database password | `os.getenv("DB_PASSWORD", "******")` |
| `HOST` | Database host | `os.getenv("DB_HOST", "localhost")` |
| `PORT` | Database port | `os.getenv("DB_PORT", "5432")` |

### Environment Variables (`.env`)

Actual values from the `.env` file used in the current environment:

- **DB_NAME**: `allright_db`
- **DB_USER**: `allright_user`
- **DB_HOST**: `localhost`
- **DB_PORT**: `5432`

---

## Entity-Relationship (ER) Diagram

The following Mermaid diagram illustrates the core models and their relationships.

```mermaid
erDiagram
    USER ||--o| TEACHER_PROFILE : "has one"
    USER ||--o| STUDENT_PROFILE : "has one"
    USER ||--o{ USER_IDENTITY : "has many"
    USER ||--o| TELEGRAM_ACCOUNT : "has one"
    
    STUDENT_PROFILE ||--o{ ADMIN_NOTE : "receives"
    STUDENT_PROFILE ||--o{ CREDIT_TRANSACTION : "involved in"
    STUDENT_PROFILE ||--o{ ACTIVITY_EVENT : "subject of"
    
    TEACHER_PROFILE ||--o{ ACTIVITY_EVENT : "subject of"
    
    LESSON ||--|| STUDENT_PROFILE : "booked by"
    LESSON ||--|| TEACHER_PROFILE : "taught by"
    LESSON ||--o| AVAILABILITY : "uses slot"
    LESSON ||--o| LESSON_WRAP_UP : "has"
    LESSON ||--o| LESSON_RATING : "rated by student"
    LESSON ||--o| LESSON_CONTENT : "has details"
    LESSON ||--o| LESSON_PROGRESS : "tracks feedback"
    LESSON ||--o| HOMEWORK_ASSIGNMENT : "assigns"
    
    AVAILABILITY ||--|| USER : "belongs to (Teacher)"
    
    COURSE ||--o{ UNIT : "contains"
    UNIT ||--o{ CURRICULUM_LESSON : "contains"
    CURRICULUM_LESSON ||--o{ LESSON_ACTIVITY : "consists of"
    
    HOMEWORK ||--o{ HOMEWORK_ACTIVITY : "defines"
    HOMEWORK_ASSIGNMENT ||--|| HOMEWORK : "is instance of"
    HOMEWORK_ASSIGNMENT ||--o{ STUDENT_ACTIVITY_RESPONSE : "has"
    STUDENT_ACTIVITY_RESPONSE ||--|| HOMEWORK_ACTIVITY : "answers"
    
    PAYMENT ||--|| STUDENT_PROFILE : "made by"
    CREDIT_TRANSACTION ||--o| PAYMENT : "linked to"
    CREDIT_TRANSACTION ||--o| LESSON : "linked to"
    
    EARNINGS_EVENT ||--|| USER : "earned by (Teacher)"
    EARNINGS_EVENT ||--o| LESSON : "linked to"

    %% Legend / Simplified Names
    class USER "accounts.User"
    class TEACHER_PROFILE "accounts.TeacherProfile"
    class STUDENT_PROFILE "accounts.StudentProfile"
    class USER_IDENTITY "accounts.UserIdentity"
    class TELEGRAM_ACCOUNT "auth_telegram.TelegramAccount"
    class ADMIN_NOTE "accounts.AdminNote"
    class CREDIT_TRANSACTION "accounts.CreditTransaction"
    class EARNINGS_EVENT "accounts.EarningsEvent"
    class ACTIVITY_EVENT "accounts.ActivityEvent"
    class LESSON "scheduling.Lesson"
    class AVAILABILITY "scheduling.Availability"
    class LESSON_WRAP_UP "scheduling.LessonWrapUp"
    class LESSON_RATING "scheduling.LessonRating"
    class LESSON_CONTENT "lessons.LessonContent"
    class LESSON_PROGRESS "progress.LessonProgress"
    class HOMEWORK "homework.Homework"
    class HOMEWORK_ACTIVITY "homework.HomeworkActivity"
    class HOMEWORK_ASSIGNMENT "homework.HomeworkAssignment"
    class STUDENT_ACTIVITY_RESPONSE "homework.StudentActivityResponse"
    class COURSE "curriculum.Course"
    class UNIT "curriculum.Unit"
    class CURRICULUM_LESSON "curriculum.Lesson"
    class LESSON_ACTIVITY "curriculum.LessonActivity"
    class PAYMENT "payments.Payment"
```

---

## Model Summaries per App

### Accounts (`accounts`)
- **User**: Custom user model using `phone_number` as the unique identifier. Roles: `STUDENT`, `TEACHER`, `ADMIN`, `NEW`.
- **TeacherProfile**: Extended profile for teachers (bio, rating, earnings config, etc.).
- **StudentProfile**: Extended profile for students (credits, level, CRM status).
- **CreditTransaction**: Ledger for all credit balance changes.
- **EarningsEvent**: Ledger for teacher income/payouts.
- **ActivityEvent**: Centralized audit log for business events.

### Scheduling (`scheduling`)
- **Availability**: Stores the weekly recurring schedule for teachers.
- **Lesson**: The core booking record between a student and a teacher.
- **LessonWrapUp**: Post-lesson notes and homework assignments by the teacher.
- **LessonRating**: Student feedback on completed lessons.

### Curriculum (`curriculum`)
- **Course / Unit / Lesson**: Multi-level hierarchy for educational content.
- **LessonActivity**: Individual interactive components (Quiz, Matching, etc.) within a curriculum lesson.
- **PdfAsset / AudioAsset / VideoAsset**: Managed media files for lessons.

### Homework (`homework`)
- **Homework / HomeworkActivity**: Templates for assignments.
- **HomeworkAssignment**: A specific assignment linked to a scheduled lesson.
- **StudentActivityResponse**: Recorded answers from students for specific activities.

### Payments (`payments`)
- **Payment**: Records of credit purchases via various providers (Click, Payme, Stripe, etc.).

### Other Apps
- **Progress**: `LessonProgress` for detailed pedagogical feedback.
- **Banners**: `BannerCampaign` for managing marketing banners in the app.
- **Auth Telegram**: `TelegramAccount` for linking Telegram identities.

---
*Generated by Antigravity AI on 2026-02-28*
