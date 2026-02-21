/**
 * datetime.ts — Central date/time formatting utilities.
 *
 * ALL displayed timestamps in the app must go through these functions.
 * Never call toLocaleString / toLocaleDateString / toLocaleTimeString directly
 * in components.
 *
 * Timezone: Asia/Tashkent (UTC+5) by default.
 * Target format: "20 Feb 2026, 17:45"  (DD Mon YYYY, HH:mm, 24-hour)
 */

export const DEFAULT_TZ = "Asia/Tashkent";

/** Returns the user's preferred IANA timezone, falling back to DEFAULT_TZ. */
export function getUserTz(user?: { timezone?: string | null }): string {
  return user?.timezone?.trim() || DEFAULT_TZ;
}

/** Parse an ISO string safely — returns null if the string is invalid. */
function safeDate(iso: string): Date | null {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Full date + time.
 * Output: "20 Feb 2026, 17:45"
 */
export function formatDateTime(iso: string, tz?: string): string {
  const d = safeDate(iso);
  if (!d) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz || DEFAULT_TZ,
  }).format(d);
}

/**
 * Date only.
 * Output: "20 Feb 2026"
 */
export function formatDate(iso: string, tz?: string): string {
  const d = safeDate(iso);
  if (!d) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: tz || DEFAULT_TZ,
  }).format(d);
}

/**
 * Time only (24-hour).
 * Output: "17:45"
 */
export function formatTime(iso: string, tz?: string): string {
  const d = safeDate(iso);
  if (!d) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz || DEFAULT_TZ,
  }).format(d);
}

/**
 * Short month abbreviation.
 * Output: "Feb"
 */
export function formatMonthShort(iso: string, tz?: string): string {
  const d = safeDate(iso);
  if (!d) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    timeZone: tz || DEFAULT_TZ,
  }).format(d);
}

/**
 * Day of month as a number string.
 * Output: "20"
 */
export function formatDayNum(iso: string, tz?: string): string {
  const d = safeDate(iso);
  if (!d) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    timeZone: tz || DEFAULT_TZ,
  }).format(d);
}

/**
 * Short weekday abbreviation.
 * Output: "Mon"
 */
export function formatWeekdayShort(iso: string, tz?: string): string {
  const d = safeDate(iso);
  if (!d) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    timeZone: tz || DEFAULT_TZ,
  }).format(d);
}

/**
 * Month (long) + numeric day — used for calendar section headers.
 * Output: "20 February"
 */
export function formatMonthDay(iso: string, tz?: string): string {
  const d = safeDate(iso);
  if (!d) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    day: "numeric",
    timeZone: tz || DEFAULT_TZ,
  }).format(d);
}
