/**
 * Returns the local-device calendar date as a YYYY-MM-DD string.
 *
 * Uses local year/month/day so that dates recorded across workout logs and
 * wellness logs are consistent regardless of the user's UTC offset.
 * Do NOT use Date.toISOString() for calendar dates — it returns UTC midnight
 * which produces the wrong date for users in UTC- timezones after midnight.
 */
export function toLocalIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
