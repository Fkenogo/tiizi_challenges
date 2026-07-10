const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Returns the inclusive number of days spanned by [startDate, endDate].
 * Aug 1 → Aug 1 = 1. Aug 1 → Aug 7 = 7.
 * Returns null for invalid or missing inputs.
 */
export function calculateInclusiveDurationDays(startDate: string, endDate: string): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
  return Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}
