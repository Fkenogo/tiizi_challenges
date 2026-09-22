/**
 * S3d — final-result date formatting (presentation only).
 *
 * Formats a server instant in the Challenge's governing timezone so a
 * "goal reached on …" or "results saved on …" line matches the days the
 * Challenge actually ran. Pure formatting: no truth is derived here, and a
 * missing/invalid value renders as an empty string so callers can omit it.
 */
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** ISO instant → "19 Sep 2026" in the governing timezone ('' when absent). */
export function formatResultDay(iso: string | null | undefined, timezone: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).formatToParts(date);
    const day = parts.find((p) => p.type === 'day')?.value;
    const monthIndex = MONTHS.indexOf(parts.find((p) => p.type === 'month')?.value ?? '');
    const year = parts.find((p) => p.type === 'year')?.value;
    if (day && year && monthIndex >= 0) return `${Number(day)} ${MONTHS[monthIndex]} ${year}`;
  } catch {
    // Unknown timezone: fall through to a UTC day label.
  }
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
