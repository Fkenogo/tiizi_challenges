import type { Db } from './db.js';

/**
 * TIIZI-FER-P1C-001 — presentation projection of the canonical member display
 * name (members.display_name; FD-MC-03, FD-PILOT-01 §16.6 minimum MC-4).
 *
 * This is NOT an identity authority and NOT a directory: callers must pass only
 * member ids that the viewer is already authorized to see in the Group or
 * Challenge context being read, and must decide (before calling) that the
 * viewer is currently entitled to names there. Only `display_name` is read —
 * never email, auth subject, role or any previous name — and a missing or NULL
 * name maps to null so the UI falls back to a neutral label.
 */
export async function readDisplayNames(db: Db, memberIds: readonly string[]): Promise<Map<string, string | null>> {
  const names = new Map<string, string | null>();
  const ids = [...new Set(memberIds)];
  if (ids.length === 0) return names;
  const result = await db.query<{ member_id: string; display_name: string | null }>(
    `SELECT member_id, display_name FROM members WHERE member_id = ANY($1::uuid[])`,
    [ids],
  );
  for (const row of result.rows) {
    const name = typeof row.display_name === 'string' ? row.display_name.trim() : '';
    names.set(String(row.member_id), name.length > 0 ? name : null);
  }
  return names;
}
