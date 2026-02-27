# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Online English language learning platform with 1v1 live virtual classrooms. Multi-role system (Student/Teacher/Admin) with lesson scheduling, interactive homework, real-time video/audio, and curriculum management.

## Repository Structure

```
OnlineSchool/
├── backend/    # Django REST API + Django Channels (ASGI/WebSocket)
└── frontend/   # React + TypeScript SPA (Vite)
```

## Commands

### Backend (`/backend`)
```bash
# Setup
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Database
python manage.py migrate
python manage.py createsuperuser

# Run (ASGI required for WebSocket support)
daphne -b 0.0.0.0 -p 8000 backend.asgi:application

# Alternative dev server (no WebSocket)
python manage.py runserver
```

### Frontend (`/frontend`)
```bash
npm install
npm run dev      # Dev server at http://localhost:5173
npm run build    # TypeScript check + Vite production build
npm run lint     # ESLint
npm run preview  # Preview production build
```

## Architecture

### Backend (Django)

Seven Django apps with clear responsibilities:
- **accounts** — Custom User model (phone_number as login), OTP auth via ESKIZ SMS, role-based (STUDENT/TEACHER/ADMIN), TeacherProfile/StudentProfile
- **scheduling** — Teacher availability (weekly recurring), Lesson bookings with UUID `room_sid`, status flow (PENDING→CONFIRMED→COMPLETED/CANCELLED), Agora token generation
- **lessons** — LessonContent (teacher notes, whiteboard state), WebSocket `LessonConsumer` for real-time classroom events
- **homework** — Homework/HomeworkActivity with JSON-based flexible activities (quiz, gap_fill, matching), auto-grading of StudentActivityResponse
- **curriculum** — Course → Unit → Lesson → LessonActivity hierarchy, supports PDF slide uploads
- **progress** — Student learning analytics, lesson completion, quiz scores
- **backend** — Project settings, ASGI routing, custom `TokenAuthMiddleware` for WebSocket JWT auth

Key backend patterns:
- JWT auth (6h access, 7d refresh) via `djangorestframework-simplejwt`
- WebSocket auth: JWT passed as query param, validated in `middleware.py`
- Channels uses `InMemoryChannelLayer` (can be upgraded to Redis for production)
- Admin uses `django-unfold` theme at `/admin/`
- API docs at `/api/docs/` (drf-spectacular/Swagger)

### Frontend (React + TypeScript)

Feature-based folder structure under `src/features/`:
- **auth** — `AuthContext` (global JWT state), OTP-based login flow
- **classroom** — Live lesson UI: `VideoRoom` (Agora RTC), `Whiteboard` (Konva canvas), `Quiz`/`GapFill`/`MatchingGame` interactive activities
- **dashboard** — Role-conditional dashboards; teacher calendar/schedule/earnings/students, student schedule/homework/achievements/goals/leaderboard
- **teachers** — Teacher discovery, profile pages, `LessonBuilder` for lesson content creation
- **students** — Student profile management
- **admin** — Admin content management: curriculum CRUD, homework management, PDF/media upload

Shared:
- `src/components/` — Shared UI (`Layout.tsx`)
- `src/lib/` — API utilities and helpers

Key frontend patterns:
- `App.tsx` is the root router — all routes defined here
- API base URL from `VITE_API_BASE_URL` env var (default `http://localhost:8000`)
- WebSocket base URL from `VITE_WS_BASE_URL` env var (default `ws://localhost:8000`)
- Agora RTC SDK used for video/audio in classroom (not WebSocket)
- Konva canvas used for collaborative whiteboard

## Environment Variables

**Backend** (`backend/.env`):
```
DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT
DEBUG
```

**Frontend** (`frontend/.env`):
```
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000
```

## API URL Structure

| Prefix | App |
|--------|-----|
| `/api/` | accounts (auth, OTP, user profile) |
| `/api/scheduling/` | availability, lesson booking |
| `/api/classroom/` | lesson content, WebSocket |
| `/api/homework/` | assignments, grading |
| `/api/curriculum/` | courses, units, content |
| `/api/progress/` | student analytics |
| `/api/docs/` | Swagger UI |
| `/admin/` | Django admin |

---

## Classroom UI Design System

All classroom components (`Classroom.tsx`, `Whiteboard.tsx`, `VideoRoom.tsx`, `Quiz.tsx`, `GapFill.tsx`, `MatchingGame.tsx`) share one consistent design system. Never deviate from these tokens:

### Layout Tokens
- Page background: `bg-gray-50`
- Card: `bg-white rounded-2xl border border-gray-200 shadow-sm`
- Card header separator: `border-b border-gray-100`
- Inner padding: `px-5 pt-5 pb-4` (mobile) → `md:px-6` (desktop)

### Color Palette
| Role | Background | Text |
|------|-----------|------|
| Primary action | `bg-blue-600 hover:bg-blue-700` | `text-white` |
| Teacher badge | `bg-violet-100` | `text-violet-700` |
| Student badge | `bg-teal-100` | `text-teal-700` |
| Correct/success | `bg-emerald-100` | `text-emerald-700` |
| Incorrect/error | `bg-red-100` | `text-red-600` |
| Danger action | transparent | `text-rose-500 hover:bg-rose-50` |
| Toolbar active | `bg-blue-600` | `text-white shadow-sm` |
| Toolbar inactive | transparent | `text-gray-500 hover:bg-gray-100 hover:text-gray-700` |

### Button Patterns
```tsx
// Primary
className="py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl
           transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed
           focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"

// Icon toolbar button (active)
className="w-8 h-8 rounded-lg flex items-center justify-center
           bg-blue-600 text-white shadow-sm transition-all"

// Icon toolbar button (inactive)
className="w-8 h-8 rounded-lg flex items-center justify-center
           text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all"
```

### Floating Toolbar Pattern (Whiteboard)
```tsx
// Pill container
className="absolute top-3 left-1/2 -translate-x-1/2 z-50
           bg-white border border-gray-200 shadow-md rounded-2xl p-1.5
           flex items-center gap-0.5"

// Group divider
<div className="w-px h-5 bg-gray-200 mx-0.5" />
```

### React + TypeScript Conventions
- **No `import React from 'react'`** — React 19 JSX transform; default React import causes TS6133
- **`React.memo` / `memo`** on every exported component and meaningful sub-component
- **`useCallback`** on all event handlers passed as props or used in effects
- **No side-effects inside `setShapes` updater** — use a `ref` mirroring state instead

---

## WebSocket / Classroom Sync Protocol

### Message Flow
```
Client → sendZoneAction(action, data)
  → ws.send({ type: 'ZONE_ACTION', activity_type, action, ...data })

Backend → zone_state.update(payload)   # dict merge into zone_state
        → broadcast ZONE_STATE_UPDATE to group

Client ← gameState = incoming payload  # received in Classroom.tsx useEffect
       → passed as prop to active activity component
```

### Critical: zone_state is a dict merge
`zone_state.update(payload)` merges — it does **not** replace. This means:
- Sending `{ shape: singleShape }` on every event → only latest shape stored (previous shapes lost).
- **Fix**: Always send the **full shapes array**: `onAction('draw_event', { shapes: [...allNormalized] })`.
- After clear: `zone_state` becomes `{ activity_type, action: 'clear_board' }` — no `shapes` key — correct empty state for late joiners.

### Late Joiner Sync
Backend replays full `zone_state` as `ZONE_STATE_UPDATE` on connect. Activity components receive this as `gameState` prop on mount → no special late-joiner code needed in frontend.

---

## Whiteboard Sync Implementation

**File**: `frontend/src/features/classroom/Whiteboard.tsx`

### Coordinate Normalization
All shapes are stored and transmitted in **fractional coordinates** (0.0–1.0 relative to canvas size). `normalizeShape` divides by `(width, height)`; `denormalizeShape` multiplies back. This makes the stored state resolution-independent.

### Key Refs (stale closure prevention)
```typescript
const shapesRef = useRef<ShapeType[]>([]);         // mirrors shapes state
const currentShapeIdRef = useRef<string | null>(null); // mirrors currentShapeId state
const lastNormalizedShapesStr = useRef<string>(''); // echo prevention
const lastSyncRef = useRef<number>(0);              // throttle timestamp
```

`shapesRef.current` is updated **eagerly** (before `setShapes`) in event handlers so subsequent handlers in the same event cycle always read fresh data.

### gameState Sync Effect
```typescript
useEffect(() => {
  if (currentShapeIdRef.current) return;          // don't interrupt active stroke
  if (!gameState) return;
  if (gameState.action === 'clear_board') {
    shapesRef.current = []; setShapes([]); return;
  }
  if (Array.isArray(gameState.shapes)) {
    const remoteStr = JSON.stringify(gameState.shapes);
    if (remoteStr === lastNormalizedShapesStr.current) return; // skip echo
    lastNormalizedShapesStr.current = remoteStr;
    const next = gameState.shapes.map(denormalizeShape);
    shapesRef.current = next; setShapes(next);
  }
}, [gameState, denormalizeShape]);
```

### Throttling
- `handleMouseMove`: throttled to **30fps** (33ms gate via `lastSyncRef`)
- `handleMouseUp`: **always syncs** (no throttle) — ensures stroke completion is never missed

---

## VideoRoom Component

**File**: `frontend/src/features/classroom/VideoRoom.tsx`

### Module-Level Client Singleton
```typescript
let client: IAgoraRTCClient | null = null;
// Created once in initAgora effect: client = AgoraRTC.createClient(...)
// Never recreated across re-renders
```

### Key Types
```typescript
type NetQuality = 0 | 1 | 2 | 3 | 4 | 5 | 6;   // 0=unknown, 1=excellent, 6=bad
type ErrorKind = 'permission' | 'notfound' | 'unknown';
type PlayableVideoTrack = ICameraVideoTrack | IRemoteVideoTrack;
```

### VideoTile ref pattern
`useCallback([videoTrack])` as the `ref` callback — fires when the DOM node mounts/changes, plays the track into the node. Never use `useRef` + `useEffect` for Agora track playback; the callback ref guarantees correct timing.

### Props NOT destructured
`onToggleMic` and `onToggleCamera` exist on `VideoRoomProps` for API compatibility (parent passes them) but VideoRoom does not call them internally — do not destructure them to avoid TS6133.

---

## Activity Components

All activities receive: `content: any` (JSON payload from backend) + `isTeacher: boolean`.

### Quiz (`Quiz.tsx`)
- **State**: `selectedIndex: number | null`, `submitted: boolean`
- **Teacher**: always sees correct answer highlighted; cannot submit
- **Student**: selects option → submits → sees result banner; cannot reselect after submit
- **No WebSocket sync** — purely local state machine

### GapFill (`GapFill.tsx`)
- Fill-in-the-blank; `content.text` with `___` placeholders, `content.answers` array
- Student fills blanks → submits → each blank graded individually

### MatchingGame (`MatchingGame.tsx`)
- Column A items dragged/clicked to match Column B items
- `content.pairs`: array of `{ left, right }` objects

### Whiteboard (`Whiteboard.tsx`)
- Full bidirectional real-time sync via WebSocket (see Whiteboard Sync section above)
- Tools: select, pencil, eraser, rect, circle
- Teacher and student both draw; all strokes synced to all participants

---

## Performance Decisions

1. **`React.memo`** on all classroom sub-components — `Whiteboard`, `VideoRoom`, `Quiz`, `OptionButton`, `VideoTile`, etc. prevent re-renders when Classroom.tsx re-renders on WebSocket messages.
2. **`useCallback` deps must be minimal** — event handlers that reference refs (not state) have stable identity across renders.
3. **Whiteboard throttle** — 30fps (33ms) for in-stroke sync; final sync on mouseUp always fires. Reduces WS messages from ~600/s to ~30/s during drawing.
4. **`shapesRef` pattern** — avoids re-creating `handleMouseMove` closure on every shape change; handler always reads `shapesRef.current` instead of closed-over `shapes` state.
5. **No shared component library** — UI primitives are inlined per file (avoids build-time abstraction overhead and keeps each file self-contained).

---

## Known Pre-Existing TypeScript Warnings

These TS6133 errors exist in the codebase and are **not regressions** — do not fix them unless explicitly asked:
- `src/features/admin/*.tsx` — unused `React` default import
- `src/features/dashboard/*.tsx` — unused `React` default import
- `src/features/classroom/Classroom.tsx:216` — `isChatOpen` declared but unused
- `src/features/classroom/Whiteboard.tsx:40` — `isTeacher` declared but unused
- `src/features/classroom/GapFill.tsx:1` — unused `React` default import

---

## TODOs / Future Work

- **InMemoryChannelLayer → Redis**: Backend uses in-memory channel layer; multi-process deployments require Redis. See `backend/settings.py` `CHANNEL_LAYERS`.
- **Whiteboard persistence**: `zone_state` is in-memory per channel group; restarting the server wipes whiteboard state. Consider persisting to `LessonContent.whiteboard_state` on each draw event.
- **GapFill + MatchingGame UI redesign**: Both still use old UI patterns; should be updated to match the Classroom.tsx design system (same as Whiteboard, VideoRoom, Quiz were updated).
- **Remove unused React imports**: ~10 files have `import React from 'react'` that triggers TS6133 in strict mode. Can be cleaned up with a single ESLint fix pass.
- **VideoRoom controls integration**: `onToggleMic`/`onToggleCamera` are passed from Classroom.tsx and wired to the toolbar buttons there — VideoRoom renders its own local track states but does not re-expose controls internally.

---

## Project Start Protocol

Read in this order at the start of every session:
1. `PROJECT_KNOWLEDGE.md`
2. `NAVIGATION_MAP.md`
3. `MASTER_STATE.md`

If those files exist, never ask high-level architecture questions — answers are already there.

Assumptions that are always true unless a file explicitly contradicts them:
- Backend auth: DRF Token auth.
- Frontend: thin client — no business logic lives there.
- Database: PostgreSQL, database name `rideuz_db`.
- `AUTH_USER_MODEL` must never be changed.

---

## Code Modification Rules

- Never change database models without first checking existing migrations.
- Never change the ride state machine without updating **all** `@action` methods that depend on it.
- Never modify role-immutability logic unless explicitly instructed.
- Never expose OTP values in production-facing logic or logs.
- All ride mutations must go through named `@action` methods only — no ad-hoc state writes.

---

## Testing Protocol

After any backend change, verify all four flows before declaring success:
1. Auth flow
2. Role flow
3. Ride state transitions
4. Complaint permissions

Do not assume a change is correct without running through these checks.

---

## Architecture Guarantees

- All business logic lives in Django. Flutter must not contain business rules.
- Every HTTP call from Flutter goes through `auth_service.dart`.
- All ride state transitions are enforced in `rides/views.py` — nowhere else.

---

## Future Features Placeholder

These are **not yet implemented** — do not scaffold, stub, or assume any of these exist:
- `RideProvider` (no provider model yet)
- Pricing model
- WebSocket / real-time transport
- Push notifications
- Payment integration

---

## Safe Editing Policy

- Never mass-refactor without an explicit instruction to do so.
- Prefer minimal, targeted edits — change only what is necessary.
- If the scope of a change is unclear, analyze and confirm before modifying.
