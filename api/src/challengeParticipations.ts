/**
 * Phase C2A Challenge Participation seam — explicit, attributable episodes.
 *
 * Stage F rules encoded here:
 * - Participation requires affirmative joining; group membership never
 *   auto-enrolls. Joining checks Group Membership (of the challenge's group)
 *   at join time.
 * - Participation is an EPISODE: one row per (challenge, member, join)
 *   running joined_at -> exited_at. No authoritative rule bars re-entry
 *   after exit, so a later episode is structurally possible; simultaneous
 *   active episodes are impossible (partial unique index). No rejoin
 *   UI/product behavior and no reinstatement policy are invented here.
 * - Exits are distinguishable: voluntary `withdrawn` vs authorized `removed`
 *   (actor recorded). Both end the episode and block further logging under
 *   it (enforced by C2B acceptance); prior records stay in history.
 * - Completion is a Derived Truth outcome (C2B), never a participation
 *   state: no `completed`/`abandoned` status here.
 * - No Derived Truth counters on participation (no points, streaks,
 *   cumulative values): attribution + lifecycle only.
 *
 * C2B eligibility questions this foundation answers per episode: was this
 * member participating (episode exists)? Was it eligible at event time
 * (active interval [joined_at, exited_at) via isParticipationActiveAt)?
 * Which configuration applied (resolved per event time from versions)?
 *
 * No routes. No Firebase. Pure domain + `Db`.
 */

import type { Db } from './db.js';
import {
  requireCurrentGroupMember,
  type GroupMembershipAuthority,
} from './groupMembershipAuthority.js';

export type ParticipationStatus = 'active' | 'withdrawn' | 'removed';

export interface ParticipationRow {
  participation_id: string;
  challenge_id: string;
  member_id: string;
  status: ParticipationStatus;
  joined_at: string;
  joined_config_version: number;
  exited_at: string | null;
  exit_reason: 'withdrawn' | 'removed' | null;
  exited_by_member_id: string | null;
  created_at: string;
  updated_at: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(message: string): never {
  throw new Error(`challenge-participations: ${message}`);
}

export function normalizeParticipationRow(row: {
  participation_id: unknown;
  challenge_id: unknown;
  member_id: unknown;
  status: ParticipationStatus;
  joined_at: string | Date;
  joined_config_version: unknown;
  exited_at: string | Date | null;
  exit_reason: 'withdrawn' | 'removed' | null;
  exited_by_member_id: unknown;
  created_at: string | Date;
  updated_at: string | Date;
}): ParticipationRow {
  return {
    participation_id: String(row.participation_id),
    challenge_id: String(row.challenge_id),
    member_id: String(row.member_id),
    status: row.status,
    joined_at: new Date(row.joined_at).toISOString(),
    joined_config_version: Number(row.joined_config_version),
    exited_at: row.exited_at == null ? null : new Date(row.exited_at).toISOString(),
    exit_reason: row.exit_reason,
    exited_by_member_id: row.exited_by_member_id == null ? null : String(row.exited_by_member_id),
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

/**
 * Affirmative join: opens a new participation episode. Requires: challenge
 * exists and is not ended; member holds CURRENT Group Membership in the
 * challenge's group under live membership authority (the PG
 * group_memberships shadow is reference data only and never authorizes
 * joining — a stale active-looking shadow row grants nothing); no currently
 * ACTIVE episode for the pair (closed episodes never block a later episode).
 */
export async function joinChallenge(
  db: Db,
  challengeId: string,
  memberId: string,
  membershipAuthority: GroupMembershipAuthority,
): Promise<ParticipationRow> {
  if (!UUID_RE.test(challengeId)) fail('challenge_id must be a Tiizi challenge UUID');
  if (!UUID_RE.test(memberId)) fail('member_id must be a member UUID');
  const challenge = await db.query<{
    challenge_id: string;
    group_id: string;
    status: string;
    current_config_version: number;
  }>(
    `SELECT challenge_id, group_id, status, current_config_version
     FROM challenges WHERE challenge_id = $1`,
    [challengeId],
  );
  if (challenge.rows.length === 0) fail(`unknown challenge ${challengeId}`);
  const { group_id: groupId, status, current_config_version: configVersion } = challenge.rows[0];
  if (status === 'ended') fail('cannot join an ended challenge (run-again creates a new challenge)');
  await requireCurrentGroupMember(membershipAuthority, String(groupId), memberId, 'challenge joining');
  try {
    const inserted = await db.query(
      `INSERT INTO challenge_participations (challenge_id, member_id, joined_config_version)
       VALUES ($1, $2, $3) RETURNING *`,
      [challengeId, memberId, Number(configVersion)],
    );
    return normalizeParticipationRow(inserted.rows[0] as never);
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('challenge_participations_one_active_idx')) {
      fail('an active participation episode already exists for this challenge and member');
    }
    fail(`join rejected: ${message}`);
  }
}

/** Voluntary withdrawal: ends active participation, preserves history. */
export async function withdrawParticipation(
  db: Db,
  participationId: string,
): Promise<ParticipationRow> {
  const current = await readParticipation(db, participationId);
  if (current.status !== 'active') fail(`only active participations can withdraw (status=${current.status})`);
  const result = await db.query(
    `UPDATE challenge_participations
     SET status = 'withdrawn', exited_at = now(), exit_reason = 'withdrawn', updated_at = now()
     WHERE participation_id = $1 RETURNING *`,
    [participationId],
  );
  return normalizeParticipationRow(result.rows[0] as never);
}

/** Authorized removal: ends active participation, records the actor. */
export async function removeParticipation(
  db: Db,
  participationId: string,
  removedByMemberId: string,
): Promise<ParticipationRow> {
  if (!UUID_RE.test(removedByMemberId)) fail('removed_by must be a member UUID');
  const current = await readParticipation(db, participationId);
  if (current.status !== 'active') fail(`only active participations can be removed (status=${current.status})`);
  try {
    const result = await db.query(
      `UPDATE challenge_participations
       SET status = 'removed', exited_at = now(), exit_reason = 'removed',
           exited_by_member_id = $2, updated_at = now()
       WHERE participation_id = $1 RETURNING *`,
      [participationId, removedByMemberId],
    );
    return normalizeParticipationRow(result.rows[0] as never);
  } catch (error) {
    fail(`removal rejected: ${(error as Error).message}`);
  }
}

async function readParticipation(db: Db, participationId: string): Promise<ParticipationRow> {
  const result = await db.query(
    `SELECT * FROM challenge_participations WHERE participation_id = $1`,
    [participationId],
  );
  if (result.rows.length === 0) fail(`unknown participation ${participationId}`);
  return normalizeParticipationRow(result.rows[0] as never);
}

/** All episodes for the pair, oldest first (history is never rewritten). */
export async function listParticipations(
  db: Db,
  challengeId: string,
  memberId: string,
): Promise<ParticipationRow[]> {
  const result = await db.query(
    `SELECT * FROM challenge_participations
     WHERE challenge_id = $1 AND member_id = $2
     ORDER BY joined_at ASC, participation_id ASC`,
    [challengeId, memberId],
  );
  return (result.rows as never[]).map(normalizeParticipationRow);
}

/** The currently active episode, if any. */
export async function getActiveParticipation(
  db: Db,
  challengeId: string,
  memberId: string,
): Promise<ParticipationRow | null> {
  const result = await db.query(
    `SELECT * FROM challenge_participations
     WHERE challenge_id = $1 AND member_id = $2 AND status = 'active'`,
    [challengeId, memberId],
  );
  if (result.rows.length === 0) return null;
  return normalizeParticipationRow(result.rows[0] as never);
}

/**
 * Pure C2B helper: was this episode eligible at event time?
 * Eligibility is the episode interval [joined_at, exited_at): an exited
 * episode was eligible before its exit and ineligible from the exit instant
 * on; an active episode is eligible from its join onward. Current status is
 * intentionally NOT consulted — the DB CHECK guarantees active rows carry
 * no exit columns and exited rows carry both, so the interval alone is
 * authoritative and withdrawn history stays evaluable.
 */
export function isParticipationActiveAt(row: ParticipationRow, at: Date): boolean {
  const time = at.getTime();
  if (Number.isNaN(time)) return false;
  if (time < Date.parse(row.joined_at)) return false;
  if (row.exited_at != null && time >= Date.parse(row.exited_at)) return false;
  return true;
}
