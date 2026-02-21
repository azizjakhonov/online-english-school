# Frontend Timezone Implementation Guide

## Principle

The backend database stores all timestamps in **UTC**.
API responses return ISO 8601 strings with a UTC offset, for example:

```
"2024-03-15T09:30:00Z"
"2024-03-15T09:30:00+00:00"
```

The frontend is responsible for converting these UTC strings into the **user's
local timezone** before displaying them. Never display raw UTC times to users.

---

## The User's Timezone

After login, call `GET /api/me/`. The response now includes:

```json
{
  "id": 42,
  "full_name": "Alisher Umarov",
  "timezone": "Asia/Tashkent",
  ...
}
```

Store this value globally (React context, Zustand store, Redux — wherever you
keep user state). Use it as the display timezone for every timestamp in the UI.

If the field is missing or blank, fall back to `"Asia/Tashkent"`.

---

## Standard Helper Functions

Create `src/lib/formatTime.ts` (or add to an existing utils file):

```typescript
const DEFAULT_TZ = 'Asia/Tashkent';

/**
 * Format an ISO timestamp in the given IANA timezone.
 *
 * @param iso  - ISO 8601 string from the API, e.g. "2024-03-15T09:30:00Z"
 * @param tz   - IANA timezone name, e.g. "Asia/Tashkent" or "Europe/London"
 * @returns    Formatted string like "15/03/2024, 14:30"
 */
export function formatInUserTZ(iso: string, tz: string = DEFAULT_TZ): string {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: tz,
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format only the date part (no time).
 */
export function formatDateInUserTZ(iso: string, tz: string = DEFAULT_TZ): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    timeZone: tz,
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
  });
}

/**
 * Format only the time part (HH:mm).
 */
export function formatTimeInUserTZ(iso: string, tz: string = DEFAULT_TZ): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: tz,
    hour:   '2-digit',
    minute: '2-digit',
  });
}

/**
 * Convenience fallback — always uses Asia/Tashkent.
 * Use only when the user's stored timezone is unavailable.
 */
export function formatTashkent(iso: string): string {
  return formatInUserTZ(iso, DEFAULT_TZ);
}
```

---

## Where to Apply

Apply `formatInUserTZ(iso, user.timezone)` everywhere a timestamp from the
API is rendered to the user:

| Screen / Component | Field(s) to format |
|--------------------|-------------------|
| **Lesson schedule** (dashboard upcoming list) | `start_time`, `end_time` |
| **Lesson history** (StudentProfilePage) | `start_time` |
| **Payment history** (billing tab) | `created_at` |
| **Activity feed** (admin-facing or student-facing) | `created_at` |
| **Booking flow** (teacher availability slot picker) | Slot `start_time`, `end_time` |
| **Classroom countdown** | `start_time` |

### Example — Lesson card

```tsx
import { formatInUserTZ } from '../../lib/formatTime';
import { useAuth } from '../auth/AuthContext';

function LessonCard({ lesson }) {
  const { user } = useAuth();
  const tz = user?.timezone ?? 'Asia/Tashkent';

  return (
    <div>
      <p>{lesson.teacher_name}</p>
      <p>{formatInUserTZ(lesson.start_time, tz)}</p>
    </div>
  );
}
```

### Example — Payment row

```tsx
<span>{formatDateInUserTZ(tx.created_at, user?.timezone)}</span>
```

---

## Storing the Timezone Globally

Add `timezone` to your `AuthContext` user type so it is available everywhere:

```typescript
// In AuthContext or your user type definition
interface AuthUser {
  id: number;
  full_name: string;
  timezone: string;        // ← add this
  // ... other fields
}
```

The value comes directly from `GET /api/me/` on login and on `refreshUser()`.
No extra API call is needed.

---

## Updating the User's Timezone

If you build a timezone preference UI (settings page), call:

```
PATCH /api/me/
{ "timezone": "Europe/London" }
```

The backend validates the value and silently ignores unknown timezone names.
After a successful PATCH, call `refreshUser()` so the new value propagates to
your global context and all future `formatInUserTZ()` calls use the new tz.

---

## Critical Don'ts

| ❌ Do NOT | ✅ Do instead |
|-----------|--------------|
| Hardcode `+5` hours manually | Use `toLocaleString(..., { timeZone: tz })` |
| Display raw UTC strings (`"2024-03-15T09:30:00Z"`) | Always convert before rendering |
| Use `new Date().toLocaleDateString()` without `timeZone` option | Always pass `timeZone` explicitly |
| Use a library that depends on `moment-timezone` with embedded data | Prefer native `Intl` API (zero bundle cost) |
| Assume the server clock and user clock are in the same timezone | They are not — server is UTC, user may be anywhere |

---

## Why Not Hardcode UTC+5?

Tashkent does **not** observe DST (Daylight Saving Time), so UTC+5 is currently
stable. But:
- Other timezones your users may be in do observe DST
- Future policy changes are possible
- Using IANA names (`"Asia/Tashkent"`) through `Intl` is free, correct,
  and future-proof

Always use the IANA name. Never do manual offset arithmetic.

---

## Quick Reference

```typescript
import { formatInUserTZ, formatDateInUserTZ, formatTimeInUserTZ } from '@/lib/formatTime';

// Full date + time
formatInUserTZ('2024-03-15T09:30:00Z', 'Asia/Tashkent')
// → "15/03/2024, 14:30"

// Date only
formatDateInUserTZ('2024-03-15T09:30:00Z', 'Asia/Tashkent')
// → "15/03/2024"

// Time only
formatTimeInUserTZ('2024-03-15T09:30:00Z', 'Asia/Tashkent')
// → "14:30"
```
