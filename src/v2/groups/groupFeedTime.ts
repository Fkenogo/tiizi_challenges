export function formatGroupFeedTime(occurredAt: string, now = new Date()): { text: string; full: string } {
  const date = new Date(occurredAt);
  const full = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(date);
  const age = Math.max(0, now.getTime() - date.getTime());
  if (age < 24 * 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.round(age / 60_000));
    if (minutes < 60) return { text: `${minutes} min ago`, full };
    const hours = Math.min(23, Math.max(1, Math.round(minutes / 60)));
    return { text: `${hours} hr ago`, full };
  }
  if (age < 48 * 60 * 60 * 1000) {
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (date.getFullYear() === yesterday.getFullYear() && date.getMonth() === yesterday.getMonth() && date.getDate() === yesterday.getDate()) {
      return { text: 'Yesterday', full };
    }
  }
  return { text: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date), full };
}
