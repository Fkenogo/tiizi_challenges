/** Provider-neutral Group lifecycle predicate shared across authority adapters. */
export function isGroupDocActive(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;
  const status = String(data.status ?? 'active').toLowerCase();
  return status === 'active' && String(data.moderationStatus ?? 'active').toLowerCase() !== 'deactivated';
}
