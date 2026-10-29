/**
 * TIIZI-FER-P1C-001 — how a member is labelled in an authorized shared
 * context. The server sends `displayName` only where the viewer is entitled to
 * it (and null otherwise); anything missing or blank falls back to the neutral
 * label for that context. The viewer's own row stays "You".
 */
export function memberLabel(displayName: string | null | undefined, fallback: string): string {
  const name = typeof displayName === 'string' ? displayName.trim() : '';
  return name.length > 0 ? name : fallback;
}
