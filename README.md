# Allright — Online English School Platform

**Student ID:** 00014354  
**Author:** Azizjon Jakhonov  
**Module:** BISP (Bachelor of Information Systems Project)

A full-stack 1-on-1 online English tutoring platform connecting students with teachers through real-time video classrooms, interactive activities, scheduling, homework, gamification, and integrated payments.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Repository Structure](#repository-structure)
5. [Prerequisites](#prerequisites)
6. [Setup & Installation](#setup--installation)
7. [Running the Project](#running-the-project)
8. [Key Features](#key-features)
9. [API Documentation](#api-documentation)
10. [Environment Variables](#environment-variables)
11. [Deployment](#deployment)

---

## Project Overview

Allright is a web and mobile platform for 1-on-1 English language tutoring. Students can browse teachers, book lessons, join real-time video classrooms with interactive activities (quizzes, matching games, gap-fill exercises, whiteboard, PDF/video/audio content), complete homework, and track their progress. Teachers manage their availability, conduct lessons, and earn payouts. Administrators oversee the entire platform through a comprehensive admin dashboard with analytics, CRM, and marketing campaign management.

---

## Architecture

```
┌─────────────┐   ┌──────────────┐   ┌──────────────┐
│   Landing    │   │   Frontend   │   │  Mobile App  │
│  (HTML/CSS)  │   │ (React+Vite) │   │ (React Native│
│              │   │  Port 5173   │   │  + Expo)     │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                   │
       └──────────────────┼───────────────────┘
                          │  REST API + WebSocket
                          ▼
              ┌───────────────────────┐
              │    Django Backend     │
              │  (DRF + Channels)     │
              │    Port 8000          │
              └───────┬───────┬───────┘
                      │       │
               ┌──────┘       └──────┐
               ▼                     ▼
        ┌─────────────┐      ┌─────────────┐
        │ PostgreSQL   │      │    Redis     │
        │  Database    │      │  (Channels)  │
        └─────────────┘      └─────────────┘
                                     │
                              ┌──────┘
                              ▼
                       ┌─────────────┐
                       │   LiveKit   │
                       │  (WebRTC)   │
                       └─────────────┘
```

---

## Tech Stack

### Backend (`/backend`)
| Technology | Purpose |
|---|---|
| **Django 5.1** | Web framework |
| **Django REST Framework** | REST API |
| **Django Channels + Daphne** | WebSocket support (real-time classroom) |
| **PostgreSQL** | Primary database |
| **Redis** | Channel layer for WebSockets |
| **LiveKit** | WebRTC video conferencing |
| **SimpleJWT** | JWT authentication |
| **django-unfold** | Modern admin UI |
| **drf-spectacular** | OpenAPI/Swagger docs |
| **Stripe / PayTech** | Payment processing |
| **DevSMS** | OTP delivery via SMS |

### Frontend (`/frontend`)
| Technology | Purpose |
|---|---|
| **React 19** | UI framework |
| **TypeScript** | Type safety |
| **Vite** | Build tool & dev server |
| **TailwindCSS** | Styling |
| **React Router 7** | Client-side routing |
| **React Query** | Server state management |
| **Axios** | HTTP client |
| **LiveKit Client** | WebRTC video |
| **Konva / React-Konva** | Interactive whiteboard |
| **Recharts** | Analytics charts |
| **Lucide React** | Icons |

### Mobile App (`/mobileapp`)
| Technology | Purpose |
|---|---|
| **React Native 0.81** | Cross-platform mobile |
| **Expo SDK 54** | Development toolchain |
| **React Navigation** | Screen navigation |
| **LiveKit React Native** | WebRTC video |
| **expo-secure-store** | Secure token storage (native) |
| **localStorage** | Token storage (web fallback) |
| **Lucide React Native** | Icons |

### Landing Page (`/landing`)
| Technology | Purpose |
|---|---|
| **HTML5 / CSS3 / JavaScript** | Static marketing page |

---

## Repository Structure

```
OnlineSchool/
├── backend/                    # Django REST API + WebSocket server
│   ├── accounts/               # Users, auth (phone+OTP), profiles, admin notes
│   ├── scheduling/             # Lessons, availability, rescheduling
│   ├── lessons/                # Lesson content management
│   ├── homework/               # Homework assignments & student responses
│   ├── curriculum/             # Courses, units, assets (PDF, audio, video)
│   ├── progress/               # Lesson progress tracking
│   ├── payments/               # Packages, credits, Stripe/PayTech integration
│   ├── marketing/              # Campaigns (email, SMS, push), banners, discounts
│   ├── gamification/           # Coins, rewards, student achievements
│   ├── banners/                # Banner campaign management
│   ├── templates/              # Django admin templates
│   ├── requirements.txt        # Python dependencies
│   └── .env.example            # Environment variable template
├── frontend/                   # React SPA (student + teacher + admin views)
│   └── src/
│       ├── features/
│       │   ├── auth/           # Login, OTP verification
│       │   ├── classroom/      # Real-time lesson (video, whiteboard, activities)
│       │   ├── dashboard/      # Student & teacher dashboards
│       │   ├── admin/          # Admin analytics & management
│       │   ├── students/       # Student-specific views
│       │   └── teachers/       # Teacher-specific views
│       ├── components/         # Reusable UI components
│       ├── lib/                # API client, auth context, utilities
│       └── views/              # Page-level view components
├── mobileapp/                  # React Native + Expo mobile app
│   └── src/
│       ├── features/
│       │   ├── auth/           # Login, OTP, role selection
│       │   ├── classroom/      # Mobile classroom with activities
│       │   ├── dashboard/      # Student dashboard, homework player
│       │   └── teachers/       # Teacher views
│       ├── api/                # Axios client with JWT interceptor
│       ├── lib/                # Cross-platform storage wrapper
│       ├── navigation/         # React Navigation setup
│       └── theme/              # Colors, spacing, shadows
├── landing/                    # Static HTML landing page
│   ├── index.html
│   ├── styles.css
│   └── script.js
└── README.md                   # This file
```

---

## Prerequisites

- **Python 3.12+**
- **Node.js 18+** and **npm**
- **PostgreSQL 14+**
- **Redis** (for Django Channels WebSocket layer)
- **Expo Go** app on your phone (for mobile testing)

---

## Setup & Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd OnlineSchool
```

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your database credentials, Redis URL, etc.

# Run database migrations
python manage.py migrate

# (Optional) Load seed data
python manage.py loaddata seed.json

# Create a superuser for admin access
python manage.py createsuperuser
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

### 4. Mobile App Setup

```bash
cd mobileapp
npm install

# Create .env file with your local IP for API access
# Replace <YOUR_LOCAL_IP> with your machine's LAN IP (e.g., 192.168.1.100)
echo "EXPO_PUBLIC_API_URL=http://<YOUR_LOCAL_IP>:8000" > .env
```

---

## Running the Project

### Start Backend (Django)

```bash
cd backend
python manage.py runserver 0.0.0.0:8000
```

The backend runs at `http://localhost:8000`.  
Admin panel: `http://localhost:5173/admin/` (proxied through Vite).

### Start Frontend (React + Vite)

```bash
cd frontend
npm run dev
```

The frontend runs at `http://localhost:5173`.

### Start Mobile App (Expo)

```bash
cd mobileapp

# For physical device (scan QR with Expo Go):
npx expo start --go --host lan --port 8082

# For web browser preview:
npx expo start --web --port 8082
```

### Authentication (Development Mode)

The platform uses **phone number + OTP** authentication. In development mode (`DEBUG=True`), the OTP is **printed to the Django terminal** instead of sending an SMS:

```
========================================
📱 OTP for +998901234567: 123456
========================================
```

Enter the phone number with country code `+998` followed by 9 digits.

---

## Key Features

### For Students
- **Browse & Book Teachers** — View teacher profiles, availability, and book 1-on-1 lessons
- **Real-Time Video Classroom** — WebRTC-powered video calls with interactive activities
- **Interactive Activities** — Quizzes, matching games, gap-fill exercises, whiteboard, PDF viewer, video/audio player
- **Homework** — Complete assigned homework with various activity types
- **Progress Tracking** — View lesson history and learning progress
- **Gamification** — Earn coins and redeem rewards
- **Credit System** — Purchase lesson credits via packages

### For Teachers
- **Availability Management** — Set weekly availability slots
- **Lesson Delivery** — Conduct lessons with full classroom activity controls
- **Homework Assignment** — Create and assign homework to students
- **Earnings & Payouts** — Track earnings and request payouts
- **Lesson Wrap-Up** — Post-lesson summary with vocabulary, grammar notes, and homework links

### For Administrators
- **Unfold Admin Dashboard** — Modern, responsive admin interface
- **Analytics & CRM** — Business metrics, student lifecycle tracking
- **Marketing Campaigns** — Email, SMS, and push notification campaigns
- **Discount Codes** — Create and manage promotional discounts
- **Banner Management** — Carousel, announcement, modal, and inline banners
- **User Management** — Manage students, teachers, and their profiles

### Technical Highlights
- **JWT Authentication** with token refresh
- **WebSocket Real-Time Sync** for classroom activities
- **LiveKit WebRTC** for video conferencing
- **Cross-Platform Mobile** with web fallback (Expo)
- **OpenAPI Documentation** via drf-spectacular
- **Timezone-Aware** with per-user timezone support

---

## API Documentation

When the backend is running, interactive API documentation is available at:

- **Swagger UI:** `http://localhost:8000/api/schema/swagger-ui/`
- **ReDoc:** `http://localhost:8000/api/schema/redoc/`
- **OpenAPI Schema:** `http://localhost:8000/api/schema/`

---

## Environment Variables

### Backend (`.env`)

| Variable | Description | Default |
|---|---|---|
| `SECRET_KEY` | Django secret key | Insecure dev default |
| `DEBUG` | Debug mode | `True` |
| `ALLOWED_HOSTS` | Comma-separated hosts | `localhost,127.0.0.1` |
| `DB_NAME` | PostgreSQL database name | `myproject` |
| `DB_USER` | PostgreSQL username | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | — |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `REDIS_URL` | Redis connection URL | `redis://127.0.0.1:6379` |
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins | `http://localhost:5173,...` |
| `DEVSMS_TOKEN` | DevSMS API token | — |
| `LIVEKIT_API_KEY` | LiveKit API key | — |
| `LIVEKIT_API_SECRET` | LiveKit API secret | — |
| `LIVEKIT_URL` | LiveKit server URL | — |

### Mobile App (`.env`)

| Variable | Description | Default |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | Backend API URL | `https://api.allright.uz` |

---

## Deployment

### Production Checklist

1. Set `DEBUG=False` in backend `.env`
2. Set a strong, unique `SECRET_KEY`
3. Configure `ALLOWED_HOSTS` with your domain
4. Configure `CORS_ALLOWED_ORIGINS` with your frontend domain
5. Set `SESSION_COOKIE_SECURE=True` and `CSRF_COOKIE_SECURE=True` (automatic when `DEBUG=False`)
6. Run `python manage.py collectstatic`
7. Use a production ASGI server (Daphne is included)
8. Set up PostgreSQL and Redis on production servers
9. Configure LiveKit server for WebRTC
10. Configure DevSMS or another SMS provider for OTP delivery
11. Build the frontend: `cd frontend && npm run build`

### Production Stack

- **Web Server:** Nginx (reverse proxy)
- **ASGI Server:** Daphne (included via `daphne` package)
- **Database:** PostgreSQL
- **Cache/Channel Layer:** Redis
- **Video:** LiveKit Cloud or self-hosted
- **Domain:** `allright.uz` / `api.allright.uz`

---

