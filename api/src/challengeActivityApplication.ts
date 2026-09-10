/**
 * Phase C2B Challenge activity application seam — the ONE transactional
 * logging path for clean V2 Challenges.
 *
 * Authenticated Member -> current Group authority -> participation
 * eligibility -> governing Challenge configuration -> Member Activity Event
 * -> exactly one Challenge Activity Record -> server scoring -> Challenge
 * Engine -> Derived Truth, committed atomically.
 *
 * Authoritative semantics applied (Stage F + C2A foundation):
 * - A: owning episode = the episode whose [joined_at, exited_at) contains
 *   occurred_at (never "whichever episode is active now").
 * - B: challenge status must be 'active' (establishment is not yet loggable;
 *   ended accepts no ordinary logging).
 * - C: occurred_day must fall inside the governing version's period.
 * - D: governing version = CURRENT config at acceptance. Stage F defines no
 *   per-event-time config rule and versions carry no validity intervals, so
 *   deriving [created_at, next) validity would invent temporal semantics.
 *   The record pins (challenge, version, activity_config) so the exact
 *   accepted terms stay reproducible. A backdated log straddling a
 *   mid-challenge config change is therefore scored under current terms;
 *   fixtures never depend on the straddle (founder-confirmable edge).
 * - E/F: canonical key (+variant rule below) and exact unit match.
 * - G: scoring is server-owned at acceptance via computeActivityScore.
 * - H: engine input is built ONLY from the accepted record + governing
 *   config + current derived state (no raw-Evidence-to-engine path).
 * - I: client_key idempotency (C1 UNIQUE) + UNIQUE(event_id): retries return
 *   the same application; concurrent duplicates stay single-effect.
 *
 * Group Membership at logging time: enforced under LIVE authority (fail
 * closed). Stage F checks eligibility at join; the transitional C2A seam
 * requires current membership for joining/establishment, and V1 behavioral
 * evidence gates logging on live group/member state (deactivated groups
 * refuse logs). The conservative C2B reading applies the same live gate at
 * logging: the PG shadow never authorizes.
 *
 * Streak late logging: Stage F allows no ordinary grace period, but the
 * approved engine measures gaps/resets honestly from occurred days, and the
 * synthetic proof must advance across days — so past occurred_at values are
 * accepted within episode + period. Open-day editing (L.16) and governed
 * correction (ACT-03/ACT-04) stay deferred; the recompute seam covers them.
 *
 * No Firebase. No routes. Pure domain + `Db`.
 */

import type { Db } from './db.js';
import {
  appendActivityEvent,
  type ActivityEventRow,
  type KnowledgePin as EventKnowledgePin,
} from './activityEvents.js';
import {
  getGoverningVersion,
  type ActivityConfigRow,
  type GoverningVersion,
} from './challengeConfigs.js';
import { getChallenge, normalizeChallengeRow, type ChallengeRow } from './challenges.js';
import {
  isParticipationActiveAt,
  listParticipations,
  normalizeParticipationRow,
  type ParticipationRow,
} from './challengeParticipations.js';
import type { GroupMembershipAuthority } from './groupMembershipAuthority.js';
import { computeActivityScore } from './engine/scoringConfig.js';
import {
  applyAcceptedRecord,
  DERIVED_SCORING_VERSION,
  lockChallengeDerived,
  lockParticipationDerived,
  normalizeChallengeDerived,
  normalizeParticipationDerived,
  persistChallengeDerived,
  persistParticipationDerived,
  type ChallengeDerivedRow,
  type ParticipationDerivedRow,
} from './derivedTruth.js';

export class ApplicationError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'ApplicationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function fail(statusCode: number, code: string, message: string): never {
  throw new ApplicationError(statusCode, code, message);
}

export interface ChallengeActivityResolvers {
  resolveKnowledgePin: (canonicalKey: string) => Promise<EventKnowledgePin | null>;
  resolveGroupMembershipAuthority: GroupMembershipAuthority['resolveGroupMembershipAuthority'];
}

/** Legitimate client Evidence inputs only. No ids-as-authority, no points. */
export interface NewChallengeActivityInput {
  activity_kind: 'fitness' | 'wellness';
  canonical_key: string;
  activity_variant?: string | null;
  value: number;
  unit: string;
  occurred_at: Date;
  occurred_day?: string;
  occurred_tz?: string | null;
  client_key: string;
}

export interface ActivityRecordRow {
  record_id: string;
  event_id: string;
  participation_id: string;
  challenge_id: string;
  activity_config_id: string;
  config_version: number;
  accepted_at: string;
  value: number;
  unit: string;
  occurred_day: string;
  points_awarded: number;
  scoring_target_value: number;
  scoring_method: string;
  scoring_version: string;
  engine_version: string;
  completion_triggered: boolean;
  created_at: string;
}

export interface ApplyChallengeActivityResult {
  event: ActivityEventRow;
  record: ActivityRecordRow;
  participation: ParticipationDerivedRow;
  challenge: ChallengeDerivedRow;
  completionTriggered: boolean;
  duplicate: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Upper bound on future-dated Evidence (client clock skew tolerance). */
const FUTURE_SKEW_MS = 5 * 60 * 1000;

function normalizeRecord(row: Record<string, unknown>): ActivityRecordRow {
  const day = row.occurred_day instanceof Date
    ? (row.occurred_day as Date).toISOString().slice(0, 10)
    : String(row.occurred_day).slice(0, 10);
  return {
    record_id: String(row.record_id),
    event_id: String(row.event_id),
    participation_id: String(row.participation_id),
    challenge_id: String(row.challenge_id),
    activity_config_id: String(row.activity_config_id),
    config_version: Number(row.config_version),
    accepted_at: new Date(row.accepted_at as string).toISOString(),
    value: Number(row.value),
    unit: String(row.unit),
    occurred_day: day,
    points_awarded: Number(row.points_awarded),
    scoring_target_value: Number(row.scoring_target_value),
    scoring_method: String(row.scoring_method),
    scoring_version: String(row.scoring_version),
    engine_version: String(row.engine_version),
    completion_triggered: Boolean(row.completion_triggered),
    created_at: new Date(row.created_at as string).toISOString(),
  };
}

function validateInput(input: NewChallengeActivityInput): void {
  if (input.activity_kind !== 'fitness' && input.activity_kind !== 'wellness') {
    fail(422, 'invalid_activity_kind', 'activity_kind must be fitness|wellness');
  }
  if (!input.canonical_key || input.canonical_key.length > 200) {
    fail(422, 'invalid_activity', 'canonical_key is required (1..200 chars)');
  }
  if (input.activity_variant != null
    && (input.activity_variant.length === 0 || input.activity_variant.length > 120)) {
    fail(422, 'invalid_variant', 'activity_variant must be 1..120 chars when present');
  }
  if (!Number.isFinite(input.value) || input.value < 0) {
    fail(422, 'invalid_value', 'value must be a finite number >= 0');
  }
  if (!input.unit || input.unit.length > 40) {
    fail(422, 'invalid_unit', 'unit is required (1..40 chars)');
  }
  if (!(input.occurred_at instanceof Date) || Number.isNaN(input.occurred_at.getTime())) {
    fail(422, 'invalid_occurred_at', 'occurred_at must be a valid timestamp');
  }
  if (input.occurred_at.getTime() > Date.now() + FUTURE_SKEW_MS) {
    fail(422, 'future_occurred_at', 'occurred_at must not be in the future');
  }
  if (!input.client_key || input.client_key.length > 300) {
    fail(422, 'invalid_client_key', 'client_key is required for idempotency (1..300 chars)');
  }
  const forbidden = input as unknown as Record<string, unknown>;
  if (forbidden.points !== undefined
    || forbidden.points_awarded !== undefined
    || forbidden.participation_id !== undefined
    || forbidden.config_version !== undefined
    || forbidden.member_id !== undefined) {
    fail(400, 'server_derived_field', 'points, participation, config version and member are server-derived');
  }
}

/**
 * Variant matching within one governing version. An activity config with a
 * NULL variant accepts any event variant of the canonical activity (C2A
 * schema intent); a configured variant requires an exact match. An exact
 * variant match wins over the generic config.
 */
export function matchActivityConfig(
  activities: ActivityConfigRow[],
  canonicalKey: string,
  eventVariant: string | null,
): ActivityConfigRow | null {
  const candidates = activities.filter((a) => a.canonical_key === canonicalKey);
  if (candidates.length === 0) return null;
  const exact = candidates.find((a) => (a.activity_variant ?? null) === (eventVariant ?? null));
  if (exact) return exact;
  return candidates.find((a) => a.activity_variant == null) ?? null;
}

function owningEpisode(episodes: ParticipationRow[], occurredAt: Date): ParticipationRow | null {
  const owned = episodes.filter((episode) => isParticipationActiveAt(episode, occurredAt));
  if (owned.length === 0) return null;
  if (owned.length > 1) {
    fail(500, 'ambiguous_episode', 'Evidence time falls in multiple participation episodes');
  }
  return owned[0];
}

/**
 * Explicit V2 log-time gate (transitional architecture): the participation
 * episode proves Challenge participation at occurred_at; the CURRENT
 * Group-Membership authority proves the Member remains eligible to submit a
 * NEW log now. Stale PG shadow state never authorizes, and already-accepted
 * historical Evidence/applications stay historical if Group membership later
 * changes. No automatic participation termination on Group exit.
 */
async function requireLiveGroupMember(
  resolvers: ChallengeActivityResolvers,
  groupId: string,
  memberId: string,
): Promise<void> {
  let status;
  try {
    status = await resolvers.resolveGroupMembershipAuthority(groupId, memberId);
  } catch (error) {
    fail(503, 'group_authority_unavailable',
      `challenge activity logging refused: membership authority unreachable (${(error as Error).message})`);
  }
  if (!status || status.eligible !== true) {
    fail(403, 'no_current_group_membership',
      'challenge activity logging refused: no current Group Membership under live Group authority');
  }
}

export async function applyChallengeActivity(
  db: Db,
  memberId: string,
  challengeId: string,
  input: NewChallengeActivityInput,
  resolvers: ChallengeActivityResolvers,
): Promise<ApplyChallengeActivityResult> {
  if (!UUID_RE.test(memberId)) fail(401, 'unknown_member', 'authenticated member is required');
  if (!UUID_RE.test(challengeId)) fail(404, 'unknown_challenge', 'challenge_id must be a Tiizi challenge UUID');
  validateInput(input);
  const eventVariant = input.activity_variant ?? null;

  // Network-bound checks first (outside the transaction): live Group
  // authority and server-side Knowledge resolution. Both fail closed.
  const challenge = await getChallenge(db, challengeId).catch(() => {
    fail(404, 'unknown_challenge', `unknown challenge ${challengeId}`);
  });
  if (challenge.status !== 'active') {
    fail(422, 'challenge_not_active',
      challenge.status === 'ended'
        ? 'challenge has ended: no ordinary logging is accepted'
        : 'challenge is not active yet: logging opens when the challenge is active');
  }
  await requireLiveGroupMember(resolvers, challenge.group_id, memberId);
  const pin = await resolvers.resolveKnowledgePin(input.canonical_key);
  if (!pin) {
    fail(422, 'unknown_activity',
      `unknown activity '${input.canonical_key}' (no canonical Knowledge; pins are never invented)`);
  }

  return db.transaction(async (tx) => {
    // Founder product rule (acceptance side): an ordinary log is governed by
    // the immutable configuration CURRENT WHEN TIIZI ACCEPTS THE LOG.
    // occurred_at records when the activity occurred; it never retroactively
    // selects an older configuration. The accepted record permanently pins
    // that (version, activity_config_id); retrospective re-application under
    // different terms belongs to the governed correction mechanism, not here.
    //
    // Single-version concurrency (CORR-2): the Challenge governing pointer
    // (challenges row) is locked FOR UPDATE first, then ONE exact version is
    // resolved and its immutable snapshot + activity rows are read for THAT
    // version only. A concurrent versioned config change (which UPDATEs the
    // same row when bumping current_config_version) serializes against this
    // lock, so an acceptance can never mix vN+1 mirrors with vN activity
    // rows: it either sees the bump entirely or precedes it entirely.
    const lockedRow = await tx.query(
      `SELECT * FROM challenges WHERE challenge_id = $1 FOR UPDATE`,
      [challengeId],
    );
    if (lockedRow.rows.length === 0) {
      fail(404, 'unknown_challenge', `unknown challenge ${challengeId}`);
    }
    const freshChallenge = normalizeChallengeRow(lockedRow.rows[0] as never);
    if (freshChallenge.status !== 'active') {
      fail(422, 'challenge_not_active', 'challenge is not active for logging');
    }
    const governing: GoverningVersion = await getGoverningVersion(
      tx, challengeId, freshChallenge.current_config_version,
    ).catch((error) => {
      fail(500, 'governing_config_unavailable',
        `governing configuration v${freshChallenge.current_config_version} is unreadable: ${(error as Error).message}`);
    });
    const pinned = governing as GoverningVersion;
    if (pinned.snapshot.challenge_type !== freshChallenge.challenge_type) {
      fail(500, 'governing_config_mismatch',
        'pinned snapshot type disagrees with Challenge identity');
    }
    const activities = pinned.activities;
    const config = matchActivityConfig(activities, input.canonical_key, eventVariant);
    if (!config) {
      const keyKnown = activities.some((a) => a.canonical_key === input.canonical_key);
      fail(422, keyKnown ? 'wrong_variant' : 'wrong_activity',
        keyKnown
          ? `variant '${eventVariant ?? '(none)'}' is not configured for '${input.canonical_key}' in this challenge`
          : `activity '${input.canonical_key}' is not configured in this challenge`);
    }
    const matched = config as ActivityConfigRow;
    if (input.unit !== matched.unit) {
      fail(422, 'wrong_unit',
        `unit '${input.unit}' does not match the configured unit '${matched.unit}' for '${input.canonical_key}'`);
    }
    // Knowledge boundary: canonical IDENTITY must match the pinned Challenge
    // activity config; the Knowledge VERSION is deliberately not required to
    // equal the config's pinned knowledge_version. Canonical Knowledge may be
    // revised (v1 -> v2, same identity) after the Challenge version was cut —
    // requiring version equality would make immutable Challenge snapshots
    // unusable after an unrelated Knowledge revision. The authoritative
    // application identity stays the pinned Challenge config (its terms score
    // the log); the Challenge pin is never rewritten to the newer version.
    if (pin.knowledge_id !== matched.knowledge_id) {
      fail(422, 'knowledge_mismatch',
        `activity '${input.canonical_key}' does not resolve to this challenge's configured Knowledge`);
    }
    const episodes = await listParticipations(tx, challengeId, memberId);
    const episode = owningEpisode(episodes, input.occurred_at);
    if (!episode) {
      fail(422, 'no_participation_episode',
        'no participation episode owns the Evidence time (before join, in a gap, or after exit)');
    }
    const owned = episode as ParticipationRow;

    // Evidence: C1 idempotent append. A duplicate client_key returns the
    // existing event; the existing application is then returned (or a
    // cross-challenge key reuse is rejected) — never a second application.
    //
    // The Knowledge pin is the value resolved BEFORE the transaction, NOT a
    // live resolver call: the C1 append resolves through whatever resolver
    // it is given, and a DB-backed resolver would issue a new query on the
    // same connection mid-transaction (self-deadlock on single-connection
    // drivers; an undisciplined hold on pooled ones). Resolution outside,
    // pure value inside — the event pin is identical to the checked pin.
    const { row: event, inserted } = await appendActivityEvent(tx, {
      member_id: memberId,
      activity_kind: input.activity_kind,
      canonical_key: input.canonical_key,
      activity_variant: eventVariant,
      occurred_at: input.occurred_at,
      occurred_day: input.occurred_day,
      occurred_tz: input.occurred_tz ?? null,
      value: input.value,
      unit: input.unit,
      client_key: input.client_key,
    }, { resolveKnowledgePin: async () => pin }).catch((error) => {
      if (error instanceof ApplicationError) throw error;
      fail(422, 'evidence_rejected', `member activity evidence rejected: ${(error as Error).message}`);
    });
    const evidence = event as ActivityEventRow;

    if (evidence.member_id !== memberId) {
      fail(409, 'idempotency_key_conflict', 'client_key is already bound to another member');
    }
    // Idempotent retry: the application already exists — return it verbatim.
    // A retry never re-validates stored Evidence against current config, so
    // concurrent and sequential duplicates converge on one effect.
    if (!inserted) {
      const existingRecord = await tx.query(
        `SELECT * FROM challenge_activity_records WHERE event_id = $1`,
        [evidence.event_id],
      );
      if (existingRecord.rows.length === 0) {
        fail(500, 'application_missing',
          'idempotency conflict on client_key without a stored Challenge application');
      }
      const record = normalizeRecord(existingRecord.rows[0] as Record<string, unknown>);
      if (record.challenge_id !== challengeId) {
        fail(409, 'idempotency_key_conflict',
          'client_key is already bound to a Challenge application in another challenge');
      }
      const partRow = await tx.query(
        `SELECT * FROM challenge_participation_derived WHERE participation_id = $1`,
        [record.participation_id],
      );
      const challRow = await tx.query(
        `SELECT * FROM challenge_derived_state WHERE challenge_id = $1`,
        [challengeId],
      );
      return {
        event: evidence,
        record,
        participation: normalizeParticipationDerived(partRow.rows[0] as Record<string, unknown>),
        challenge: normalizeChallengeDerived(challRow.rows[0] as Record<string, unknown>),
        completionTriggered: record.completion_triggered,
        duplicate: true,
      };
    }

    // Period eligibility comes from the PINNED snapshot's period, never the
    // mutable mirrors: a later extension cannot retroactively admit (or bar)
    // this Evidence, and the current mirrors cannot reinterpret it either.
    if (evidence.occurred_day < pinned.snapshot.start_date
      || evidence.occurred_day > pinned.snapshot.end_date) {
      fail(422, 'outside_challenge_window',
        `occurred day ${evidence.occurred_day} is outside the governing challenge period ${pinned.snapshot.start_date}..${pinned.snapshot.end_date}`);
    }

    // Server-owned scoring against the governing activity config. The client
    // supplies measurement facts; points are derived here and persisted with
    // full attribution. computeActivityScore consumes the C2B shape directly
    // (value + target + type), so no adapter or second algorithm is needed.
    const scoring = computeActivityScore({
      value: input.value,
      targetValue: matched.target_value,
      challengeType: pinned.snapshot.challenge_type,
    });

    const acceptedAt = new Date();
    const partBefore = await lockParticipationDerived(
      tx, owned.participation_id, challengeId, memberId,
    );
    const challengeBefore = await lockChallengeDerived(
      tx, challengeId, pinned.snapshot.challenge_type,
    );
    const update = applyAcceptedRecord({
      challenge_id: challengeId,
      snapshot: pinned.snapshot,
      memberId,
      activities,
      prevPart: partBefore,
      prevChallenge: challengeBefore,
      record: {
        record_id: 'pending',
        activity_config_id: matched.activity_config_id,
        value: input.value,
        unit: input.unit,
        occurred_day: evidence.occurred_day,
        points_awarded: scoring.pointsEarned,
        accepted_at: acceptedAt.toISOString(),
      },
    });

    const insertedRecord = await tx.query(
      `INSERT INTO challenge_activity_records
         (event_id, participation_id, challenge_id, activity_config_id,
          config_version, accepted_at, value, unit, occurred_day,
          points_awarded, scoring_target_value, scoring_method,
          scoring_version, engine_version, completion_triggered)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        evidence.event_id, owned.participation_id, challengeId, matched.activity_config_id,
        pinned.version, acceptedAt.toISOString(), input.value, input.unit, evidence.occurred_day,
        scoring.pointsEarned, matched.target_value, scoring.scoringMethod,
        DERIVED_SCORING_VERSION, 'v2', update.completionTriggered,
      ],
    );
    const record = normalizeRecord(insertedRecord.rows[0] as Record<string, unknown>);

    await persistParticipationDerived(tx, owned.participation_id, update.part);

    // Collective goal crossing ends the challenge (Stage F J.5 completion
    // boundary: ordinary new logging closes) and completes every episode
    // active at the crossing instant — the shared achievement belongs to
    // the group, matching the V1 cascade (all active memberships complete).
    if (pinned.snapshot.challenge_type === 'collective' && update.completionTriggered) {
      const ended = await tx.query(
        `UPDATE challenges SET status = 'ended', ended_at = now(), updated_at = now()
         WHERE challenge_id = $1 AND status = 'active' RETURNING *`,
        [challengeId],
      );
      if (ended.rows.length === 0) {
        fail(409, 'challenge_closed_during_acceptance',
          'challenge closed while the activity was being accepted');
      }
      // All episodes of the challenge, not just the trigger member's: the
      // shared achievement completes every episode active at the crossing.
      const allEpisodes = (
        await tx.query(`SELECT * FROM challenge_participations WHERE challenge_id = $1`, [challengeId])
      ).rows.map((row) => normalizeParticipationRow(row as never));
      for (const sibling of allEpisodes) {
        if (!isParticipationActiveAt(sibling, acceptedAt)) continue;
        await tx.query(
          `INSERT INTO challenge_participation_derived
             (participation_id, challenge_id, member_id, scoring_version)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (participation_id) DO NOTHING`,
          [sibling.participation_id, challengeId, String(sibling.member_id), DERIVED_SCORING_VERSION],
        );
        if (sibling.participation_id === owned.participation_id) continue;
        await tx.query(
          `UPDATE challenge_participation_derived
           SET completion_status = 'completed', completed_at = $2, updated_at = now()
           WHERE participation_id = $1 AND completion_status = 'in_progress'`,
          [sibling.participation_id, acceptedAt.toISOString()],
        );
      }
    }

    const completions = await tx.query(
      `SELECT COUNT(*) AS count FROM challenge_participation_derived
       WHERE challenge_id = $1 AND completion_status = 'completed'`,
      [challengeId],
    );
    await persistChallengeDerived(tx, challengeId, {
      ...update.challenge,
      completionsCount: Number((completions.rows[0] as { count: string }).count),
    });

    const partRow = await tx.query(
      `SELECT * FROM challenge_participation_derived WHERE participation_id = $1`,
      [owned.participation_id],
    );
    const challRow = await tx.query(
      `SELECT * FROM challenge_derived_state WHERE challenge_id = $1`,
      [challengeId],
    );
    return {
      event: evidence,
      record,
      participation: normalizeParticipationDerived(partRow.rows[0] as Record<string, unknown>),
      challenge: normalizeChallengeDerived(challRow.rows[0] as Record<string, unknown>),
      completionTriggered: update.completionTriggered,
      duplicate: false,
    };
  });
}
