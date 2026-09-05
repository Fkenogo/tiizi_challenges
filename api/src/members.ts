import type { Db } from './db.js';

export interface MemberRow {
  memberId: string;
}

export async function findMemberByAuth(
  db: Db,
  provider: string,
  subject: string,
): Promise<MemberRow | null> {
  const result = await db.query<{ member_id: string }>(
    `SELECT member_id FROM members
     WHERE auth_provider = $1 AND auth_subject = $2`,
    [provider, subject],
  );
  const row = result.rows[0];
  return row ? { memberId: String(row.member_id) } : null;
}

export async function createMember(
  db: Db,
  provider: string,
  subject: string,
): Promise<MemberRow> {
  const result = await db.query<{ member_id: string }>(
    `INSERT INTO members (auth_provider, auth_subject)
     VALUES ($1, $2)
     RETURNING member_id`,
    [provider, subject],
  );
  return { memberId: String(result.rows[0].member_id) };
}
