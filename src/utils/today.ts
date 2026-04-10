/**
 * Single source of truth for "today" across the entire app.
 *
 * Uses device local time to determine the day boundary.
 * Both check-ins (local_date string) and signals (created_at timestamp)
 * use this same boundary.
 */

/** Returns today as "YYYY-MM-DD" in local timezone. Used for daily_checkins.local_date. */
export function todayDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, '0');
  const d = `${now.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Returns local midnight as ISO string. Used for signals created_at >= filter. */
export function todayMidnightISO(now = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
