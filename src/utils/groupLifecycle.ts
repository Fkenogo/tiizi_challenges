/** Returns true when the group is operational (status active or missing — legacy default). */
export function isGroupActive(group: { status?: string } | null | undefined): boolean {
  if (!group) return false;
  const s = String(group.status ?? 'active').toLowerCase();
  return s === 'active';
}
