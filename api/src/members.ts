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

export interface BootstrappedMember extends MemberRow {
  /** True only for the request that created the mapping. */
  created: boolean;
}

/**
 * MC-1 explicit member bootstrap seam. Resolves (provider, subject) to the
 * canonical member, creating exactly one ordinary `member` row on first use.
 *
 * Race safety comes from the `members_auth_identity_unique` constraint, not a
 * check-then-insert: concurrent first requests all issue the same single
 * INSERT ... ON CONFLICT DO NOTHING. One inserts; the others wait on the
 * unique index, conflict, and then read the committed row.
 *
 * An existing mapping is returned untouched (role and any other column are
 * never updated). Only `role = 'member'` is ever written here.
 */
export async function bootstrapMember(
  db: Db,
  provider: string,
  subject: string,
): Promise<BootstrappedMember> {
  const inserted = await db.query<{ member_id: string }>(
    `INSERT INTO members (auth_provider, auth_subject, role)
     VALUES ($1, $2, 'member')
     ON CONFLICT ON CONSTRAINT members_auth_identity_unique DO NOTHING
     RETURNING member_id`,
    [provider, subject],
  );
  if (inserted.rows[0]) return { memberId: String(inserted.rows[0].member_id), created: true };

  const existing = await findMemberByAuth(db, provider, subject);
  if (!existing) {
    // A conflict with no readable row means the mapping is inconsistent.
    // Fail closed rather than provisioning around it.
    throw new MemberBootstrapError();
  }
  return { memberId: existing.memberId, created: false };
}

export class MemberBootstrapError extends Error {
  readonly statusCode = 409;
  readonly code = 'member_mapping_inconsistent';

  constructor() {
    super('Member identity mapping could not be resolved');
  }
}
