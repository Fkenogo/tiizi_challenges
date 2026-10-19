import { AuthError, type RequestMember } from './auth.js';
import type { Db } from './db.js';
import { DISPLAY_NAME_MAX_LENGTH, InvalidDisplayNameError } from './memberBootstrap.js';
import { findMemberByAuth } from './members.js';

export interface MemberProfileIdentity {
  memberId: string;
  displayName: string | null;
}

export class UnauthenticatedProfileMutationError extends AuthError {
  constructor() {
    super(401, 'missing_token', 'Authentication is required');
  }
}

export class InvalidProfileMutationError extends Error {
  readonly statusCode = 400;
  readonly code = 'invalid_profile_mutation';

  constructor() {
    super('Only a valid displayName value may be changed');
  }
}

export function parseProfileDisplayName(input: unknown): string {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new InvalidProfileMutationError();
  }
  const body = input as Record<string, unknown>;
  if (Object.keys(body).length !== 1 || !Object.hasOwn(body, 'displayName')) {
    throw new InvalidProfileMutationError();
  }
  if (typeof body.displayName !== 'string') throw new InvalidDisplayNameError();
  const name = body.displayName.trim().normalize('NFC');
  if (name.length === 0 || [...name].length > DISPLAY_NAME_MAX_LENGTH || /\p{Cc}/u.test(name)) {
    throw new InvalidDisplayNameError();
  }
  return name;
}

/** Resolve a verified authentication identity through the sole canonical member map. */
export async function getMemberProfileIdentity(
  db: Db,
  verifiedIdentity: { provider: string; subject: string },
): Promise<MemberProfileIdentity> {
  const member = await findMemberByAuth(db, verifiedIdentity.provider, verifiedIdentity.subject);
  if (!member) throw new AuthError(401, 'unknown_member', 'Authenticated member is not registered');
  const result = await db.query<{ display_name: string | null }>(
    'SELECT display_name FROM members WHERE member_id = $1', [member.memberId],
  );
  const row = result.rows[0];
  if (!row) throw new AuthError(401, 'unknown_member', 'Authenticated member is not registered');
  return { memberId: member.memberId, displayName: row.display_name };
}

/**
 * Internal authenticated mutation capability. The only identity accepted is
 * the canonical member context produced by the authentication boundary.
 */
export async function updateOwnDisplayName(
  db: Db,
  authenticatedMember: RequestMember | null,
  input: unknown,
): Promise<MemberProfileIdentity> {
  if (!authenticatedMember?.memberId) throw new UnauthenticatedProfileMutationError();
  const displayName = parseProfileDisplayName(input);
  return db.transaction(async (tx) => {
    const locked = await tx.query<{ display_name: string | null }>(
      'SELECT display_name FROM members WHERE member_id = $1 FOR UPDATE',
      [authenticatedMember.memberId],
    );
    const current = locked.rows[0];
    if (!current) throw new AuthError(401, 'unknown_member', 'Authenticated member is not registered');
    if (current.display_name === displayName) {
      return { memberId: authenticatedMember.memberId, displayName: current.display_name };
    }
    await tx.query(
      `INSERT INTO member_display_name_history
        (member_id, actor_member_id, old_display_name, new_display_name, source)
       VALUES ($1, $1, $2, $3, 'profile_self_edit')`,
      [authenticatedMember.memberId, current.display_name, displayName],
    );
    const updated = await tx.query<{ display_name: string | null }>(
      `UPDATE members SET display_name = $2, updated_at = clock_timestamp()
       WHERE member_id = $1 RETURNING display_name`,
      [authenticatedMember.memberId, displayName],
    );
    return { memberId: authenticatedMember.memberId, displayName: updated.rows[0].display_name };
  });
}
