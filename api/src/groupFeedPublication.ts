import type { Db } from './db.js';

export const GROUP_FEED_CONTRACT_VERSION = 1 as const;
// GF-01 v1.1: exactly four automatic Group Feed families. Challenge
// finalization remains authoritative Challenge/domain truth but no longer
// publishes a Group Feed event.
export const GROUP_FEED_EVENT_TYPES = [
  'challenge_established',
  'challenge_started',
  'together_goal_achieved',
  'challenge_ended',
] as const;

export type GroupFeedEventType = (typeof GROUP_FEED_EVENT_TYPES)[number];
export type GroupFeedSuppressionReason =
  | 'source_invalidated'
  | 'source_corrected'
  | 'visibility_invalidated'
  | 'duplicate_projection'
  | 'invalid_projection'
  | 'system_safety';

const SUPPRESSION_REASONS: readonly GroupFeedSuppressionReason[] = [
  'source_invalidated', 'source_corrected', 'visibility_invalidated',
  'duplicate_projection', 'invalid_projection', 'system_safety',
];

export type ChallengePublicationInput = {
  eventType: GroupFeedEventType;
  challengeId: string;
  /** Together events bind to the immutable config version governing the crossing. */
  sourceTransitionVersion: number;
};

export interface GroupFeedPublication {
  outboxId: string;
  groupId: string;
  sourceType: 'challenge';
  sourceId: string;
  eventType: GroupFeedEventType;
  sourceTransitionVersion: number;
  contractVersion: typeof GROUP_FEED_CONTRACT_VERSION;
  sourceTransitionAt: string;
  idempotencyKey: string;
}

interface ChallengePublicationSource {
  challenge_id: string;
  group_id: string;
  challenge_type: string;
  status: string;
  current_config_version: number;
  created_at: string | Date;
  activated_at: string | Date | null;
  ended_at: string | Date | null;
  finalized_at: string | Date | null;
}

interface OutboxRow extends Record<string, unknown> {
  outbox_id: string;
  group_id: string;
  source_type: 'challenge';
  source_id: string;
  event_type: GroupFeedEventType;
  source_transition_version: number;
  contract_version: number;
  source_transition_at: string | Date;
  idempotency_key: string;
  status: 'pending' | 'processing' | 'projected' | 'blocked' | 'expired';
  attempt_count: number;
  claimed_until: string | Date | null;
}

export class GroupFeedPublicationError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'GroupFeedPublicationError';
  }
}

function iso(value: string | Date): string {
  return new Date(value).toISOString();
}

function sameInstant(left: string | Date, right: string | Date): boolean {
  return new Date(left).getTime() === new Date(right).getTime();
}

function isEventType(value: string): value is GroupFeedEventType {
  return (GROUP_FEED_EVENT_TYPES as readonly string[]).includes(value);
}

async function challengeSource(tx: Db, challengeId: string): Promise<ChallengePublicationSource> {
  const result = await tx.query<ChallengePublicationSource>(
    `SELECT challenge_id, group_id, challenge_type, status, current_config_version,
            created_at, activated_at, ended_at, finalized_at
     FROM challenges WHERE challenge_id = $1 FOR SHARE`,
    [challengeId],
  );
  const source = result.rows[0];
  if (!source) throw new GroupFeedPublicationError('source_missing', 'Feed source Challenge is missing');
  return source;
}

async function transitionTimestamp(
  tx: Db,
  source: ChallengePublicationSource,
  eventType: GroupFeedEventType,
): Promise<string | null> {
  switch (eventType) {
    case 'challenge_established':
      return iso(source.created_at);
    case 'challenge_started':
      return source.activated_at == null ? null : iso(source.activated_at);
    case 'challenge_ended':
      return source.status !== 'ended' || source.ended_at == null ? null : iso(source.ended_at);
    case 'together_goal_achieved': {
      if (source.challenge_type !== 'collective') return null;
      const derived = await tx.query<{
        collective_goal_reached: boolean;
        goal_completed_at: string | Date | null;
      }>(
        `SELECT collective_goal_reached, goal_completed_at
         FROM challenge_derived_state WHERE challenge_id = $1`,
        [source.challenge_id],
      );
      const row = derived.rows[0];
      if (!row?.collective_goal_reached || row.goal_completed_at == null) return null;
      return iso(row.goal_completed_at);
    }
  }
}

function canonicalIdempotencyKey(
  sourceId: string,
  eventType: GroupFeedEventType,
  transitionVersion: number,
): string {
  return `gf${GROUP_FEED_CONTRACT_VERSION}:challenge:${sourceId}:${eventType}:v${transitionVersion}`;
}

/**
 * Record only a successful, already-persisted Challenge transition. Callers
 * pass the transaction that owns the source write; the Group and timestamp
 * are re-derived from PostgreSQL and arbitrary event families are rejected.
 */
export async function recordChallengePublication(
  tx: Db,
  input: ChallengePublicationInput,
): Promise<GroupFeedPublication> {
  if (!isEventType(input.eventType)) {
    throw new GroupFeedPublicationError('event_type_not_allowed', 'GF-01 event type is not allow-listed');
  }
  if (!Number.isInteger(input.sourceTransitionVersion) || input.sourceTransitionVersion < 1) {
    throw new GroupFeedPublicationError('transition_version_invalid', 'source transition version is invalid');
  }
  if (input.eventType !== 'together_goal_achieved' && input.sourceTransitionVersion !== 1) {
    throw new GroupFeedPublicationError('transition_version_invalid', 'Challenge lifecycle transition version must be 1');
  }

  const source = await challengeSource(tx, input.challengeId);
  const sourceTransitionAt = await transitionTimestamp(tx, source, input.eventType);
  if (sourceTransitionAt == null) {
    throw new GroupFeedPublicationError('source_transition_not_eligible', 'Feed source transition is not eligible');
  }
  if (input.eventType === 'together_goal_achieved'
      && input.sourceTransitionVersion !== Number(source.current_config_version)) {
    throw new GroupFeedPublicationError('transition_version_invalid', 'Together goal version must match canonical Challenge version');
  }

  const idempotencyKey = canonicalIdempotencyKey(
    source.challenge_id,
    input.eventType,
    input.sourceTransitionVersion,
  );
  const inserted = await tx.query<{ outbox_id: string }>(
    `INSERT INTO group_feed_outbox
       (group_id, source_type, source_id, event_type, source_transition_version,
        contract_version, source_transition_at, idempotency_key)
     VALUES ($1, 'challenge', $2, $3, $4, $5, $6, $7)
     ON CONFLICT (source_type, source_id, event_type, source_transition_version) DO NOTHING
     RETURNING outbox_id`,
    [
      source.group_id, source.challenge_id, input.eventType, input.sourceTransitionVersion,
      GROUP_FEED_CONTRACT_VERSION, sourceTransitionAt, idempotencyKey,
    ],
  );
  let outboxId = inserted.rows[0]?.outbox_id;
  if (!outboxId) {
    const prior = await tx.query<{
      outbox_id: string;
      group_id: string;
      source_transition_at: string | Date;
      idempotency_key: string;
    }>(
      `SELECT outbox_id, group_id, source_transition_at, idempotency_key
       FROM group_feed_outbox
       WHERE source_type = 'challenge' AND source_id = $1 AND event_type = $2
         AND source_transition_version = $3`,
      [source.challenge_id, input.eventType, input.sourceTransitionVersion],
    );
    const existing = prior.rows[0];
    if (!existing
        || existing.group_id !== source.group_id
        || !sameInstant(existing.source_transition_at, sourceTransitionAt)
        || existing.idempotency_key !== idempotencyKey) {
      throw new GroupFeedPublicationError('idempotency_conflict', 'Existing publication identity does not match authoritative source');
    }
    outboxId = existing.outbox_id;
  }
  return {
    outboxId,
    groupId: source.group_id,
    sourceType: 'challenge',
    sourceId: source.challenge_id,
    eventType: input.eventType,
    sourceTransitionVersion: input.sourceTransitionVersion,
    contractVersion: GROUP_FEED_CONTRACT_VERSION,
    sourceTransitionAt,
    idempotencyKey,
  };
}

interface OutboxRowNormalized extends OutboxRow {
  source_transition_at: string | Date;
}

async function loadOutbox(tx: Db, outboxId: string): Promise<OutboxRowNormalized> {
  const result = await tx.query<OutboxRowNormalized>(
    'SELECT * FROM group_feed_outbox WHERE outbox_id = $1 FOR UPDATE',
    [outboxId],
  );
  const row = result.rows[0];
  if (!row) throw new GroupFeedPublicationError('outbox_missing', 'Feed outbox row is missing');
  return row;
}

type SourceTransitionCheck =
  | { kind: 'current'; source: ChallengePublicationSource }
  | { kind: 'source_missing' }
  | { kind: 'group_scope_mismatch' }
  | { kind: 'not_eligible'; source: ChallengePublicationSource }
  | { kind: 'identity_invalid' };

async function inspectSourceTransition(tx: Db, row: OutboxRowNormalized): Promise<SourceTransitionCheck> {
  if (row.source_type !== 'challenge' || !isEventType(row.event_type)
      || !Number.isInteger(Number(row.source_transition_version))
      || Number(row.source_transition_version) < 1
      || row.contract_version !== GROUP_FEED_CONTRACT_VERSION) {
    return { kind: 'identity_invalid' };
  }
  const result = await tx.query<ChallengePublicationSource>(
    `SELECT challenge_id, group_id, challenge_type, status, current_config_version,
            created_at, activated_at, ended_at, finalized_at
     FROM challenges WHERE challenge_id = $1 FOR SHARE`,
    [row.source_id],
  );
  const source = result.rows[0];
  if (!source) return { kind: 'source_missing' };
  // Establish the authoritative Group binding before evaluating event eligibility.
  if (source.group_id !== row.group_id) return { kind: 'group_scope_mismatch' };
  if (row.event_type !== 'together_goal_achieved' && Number(row.source_transition_version) !== 1) {
    return { kind: 'identity_invalid' };
  }
  if (row.event_type === 'together_goal_achieved'
      && Number(row.source_transition_version) !== Number(source.current_config_version)) {
    return { kind: 'not_eligible', source };
  }
  const timestamp = await transitionTimestamp(tx, source, row.event_type);
  if (timestamp == null || !sameInstant(timestamp, row.source_transition_at)) {
    return { kind: 'not_eligible', source };
  }
  return { kind: 'current', source };
}

async function appendSystemAction(
  tx: Db,
  row: OutboxRowNormalized,
  actionType: 'suppressed' | 'restored' | 'purged',
  reasonCode: GroupFeedSuppressionReason | 'retention_90_days',
  actedAt: Date,
): Promise<void> {
  await tx.query(
    `INSERT INTO group_feed_projection_actions
       (feed_event_id, group_id, action_type, reason_code, actor_kind, acted_at)
     VALUES ($1, $2, $3, $4, 'system', $5)`,
    [row.outbox_id, row.group_id, actionType, reasonCode, actedAt.toISOString()],
  );
}

async function projectOne(
  db: Db,
  claimed: OutboxRowNormalized,
  now: Date,
): Promise<'projected' | 'suppressed' | 'blocked' | 'lost-lease'> {
  return db.transaction(async (tx) => {
    const row = await loadOutbox(tx, claimed.outbox_id);
    if (row.status !== 'processing' || row.claimed_until == null
        || new Date(row.claimed_until).getTime() < now.getTime()) return 'lost-lease';
    const sourceCheck = await inspectSourceTransition(tx, row);
    if (sourceCheck.kind === 'group_scope_mismatch'
        || sourceCheck.kind === 'source_missing'
        || sourceCheck.kind === 'identity_invalid') {
      const errorCode = sourceCheck.kind === 'group_scope_mismatch'
        ? 'group_scope_mismatch'
        : sourceCheck.kind === 'source_missing' ? 'source_missing' : 'source_identity_invalid';
      await tx.query(
        `UPDATE group_feed_outbox SET status = 'blocked', claimed_until = NULL,
           last_error_code = $2, last_error_at = $3
         WHERE outbox_id = $1 AND status = 'processing'`,
        [row.outbox_id, errorCode, now.toISOString()],
      );
      return 'blocked';
    }
    if (sourceCheck.kind === 'not_eligible') {
      await tx.query(
        `INSERT INTO group_feed_projection
           (feed_event_id, group_id, source_type, source_id, event_type,
            source_transition_version, contract_version, source_transition_at,
            projected_at, suppressed_at, suppression_reason_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, 'source_invalidated')
         ON CONFLICT (feed_event_id) DO NOTHING`,
        [row.outbox_id, row.group_id, row.source_type, row.source_id, row.event_type,
          row.source_transition_version, row.contract_version, row.source_transition_at, now.toISOString()],
      );
      await appendSystemAction(tx, row, 'suppressed', 'source_invalidated', now);
      await tx.query(
        `UPDATE group_feed_outbox SET status = 'projected', claimed_until = NULL,
           processed_at = $2, last_error_code = NULL, last_error_at = NULL
         WHERE outbox_id = $1`,
        [row.outbox_id, now.toISOString()],
      );
      return 'suppressed';
    }

    await tx.query(
      `INSERT INTO group_feed_projection
         (feed_event_id, group_id, source_type, source_id, event_type,
          source_transition_version, contract_version, source_transition_at, projected_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (feed_event_id) DO NOTHING`,
      [row.outbox_id, row.group_id, row.source_type, row.source_id, row.event_type,
        row.source_transition_version, row.contract_version, row.source_transition_at, now.toISOString()],
    );
    const projection = await tx.query<{
      group_id: string; source_type: string; source_id: string; event_type: string;
      source_transition_version: number; contract_version: number; source_transition_at: string | Date;
    }>(
      `SELECT group_id, source_type, source_id, event_type,
              source_transition_version, contract_version, source_transition_at
       FROM group_feed_projection WHERE feed_event_id = $1`,
      [row.outbox_id],
    );
    const current = projection.rows[0];
    if (!current || current.group_id !== row.group_id || current.source_type !== row.source_type
        || current.source_id !== row.source_id || current.event_type !== row.event_type
        || Number(current.source_transition_version) !== Number(row.source_transition_version)
        || Number(current.contract_version) !== Number(row.contract_version)
        || !sameInstant(current.source_transition_at, row.source_transition_at)) {
      throw new GroupFeedPublicationError('projection_identity_conflict', 'Feed projection identity conflicts with outbox source');
    }
    await tx.query(
      `UPDATE group_feed_outbox SET status = 'projected', claimed_until = NULL,
         processed_at = $2, last_error_code = NULL, last_error_at = NULL
       WHERE outbox_id = $1`,
      [row.outbox_id, now.toISOString()],
    );
    return 'projected';
  });
}

export interface FeedOutboxBatchSummary {
  claimed: number;
  projected: number;
  suppressed: number;
  retried: number;
  blocked: number;
  lostLease: number;
  blockedIds: string[];
}

const DEFAULT_BATCH_LIMIT = 50;
const MAX_BATCH_LIMIT = 100;
const DEFAULT_MAX_ATTEMPTS = 8;
const CLAIM_LEASE_MS = 60_000;

export async function processGroupFeedOutboxBatch(
  db: Db,
  options: { limit?: number; now?: Date; maxAttempts?: number } = {},
): Promise<FeedOutboxBatchSummary> {
  const limit = options.limit ?? DEFAULT_BATCH_LIMIT;
  const now = options.now ?? new Date();
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_BATCH_LIMIT) {
    throw new GroupFeedPublicationError('batch_limit_invalid', `batch limit must be 1..${MAX_BATCH_LIMIT}`);
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
    throw new GroupFeedPublicationError('attempt_limit_invalid', 'maximum attempts must be 1..20');
  }
  const claimed = await db.transaction(async (tx) => {
    const leaseExpired = await tx.query<{ outbox_id: string }>(
      `UPDATE group_feed_outbox SET status = 'blocked', claimed_until = NULL,
         last_error_code = 'lease_exhausted', last_error_at = $1
       WHERE status = 'processing' AND claimed_until <= $1 AND attempt_count >= $2
       RETURNING outbox_id`,
      [now.toISOString(), maxAttempts],
    );
    const result = await tx.query<OutboxRowNormalized>(
      `WITH due AS (
         SELECT outbox_id FROM group_feed_outbox
         WHERE attempt_count < $2 AND next_attempt_at <= $3
           AND (status = 'pending' OR (status = 'processing' AND claimed_until <= $3))
         ORDER BY next_attempt_at, created_at, outbox_id
         FOR UPDATE SKIP LOCKED LIMIT $1
       )
       UPDATE group_feed_outbox AS o
       SET status = 'processing', attempt_count = o.attempt_count + 1,
           claimed_until = $4
       FROM due WHERE o.outbox_id = due.outbox_id
       RETURNING o.*`,
      [limit, maxAttempts, now.toISOString(), new Date(now.getTime() + CLAIM_LEASE_MS).toISOString()],
    );
    return { rows: result.rows, leaseBlocked: leaseExpired.rows.map((row) => row.outbox_id) };
  });
  const summary: FeedOutboxBatchSummary = {
    claimed: claimed.rows.length,
    projected: 0,
    suppressed: 0,
    retried: 0,
    blocked: claimed.leaseBlocked.length,
    lostLease: 0,
    blockedIds: [...claimed.leaseBlocked],
  };
  for (const row of claimed.rows) {
    try {
      const result = await projectOne(db, row, now);
      if (result === 'projected') summary.projected += 1;
      else if (result === 'suppressed') summary.suppressed += 1;
      else if (result === 'blocked') {
        summary.blocked += 1;
        summary.blockedIds.push(row.outbox_id);
      }
      else summary.lostLease += 1;
    } catch (error) {
      const code = error instanceof GroupFeedPublicationError ? error.code : 'projection_failure';
      const blocked = Number(row.attempt_count) >= maxAttempts;
      const delaySeconds = Math.min(3600, 2 ** Math.min(Number(row.attempt_count) - 1, 12));
      await db.query(
        `UPDATE group_feed_outbox
         SET status = $2, claimed_until = NULL,
             next_attempt_at = $3, last_error_code = $4, last_error_at = $5
         WHERE outbox_id = $1 AND status = 'processing'`,
        [row.outbox_id, blocked ? 'blocked' : 'pending',
          new Date(now.getTime() + delaySeconds * 1000).toISOString(), code.slice(0, 64), now.toISOString()],
      );
      if (blocked) {
        summary.blocked += 1;
        summary.blockedIds.push(row.outbox_id);
      } else summary.retried += 1;
    }
  }
  return summary;
}

/** Re-open only blocked rows, explicitly through the trusted operational CLI. */
export async function retryBlockedGroupFeedOutbox(
  db: Db,
  options: { limit?: number; now?: Date } = {},
): Promise<number> {
  const limit = options.limit ?? DEFAULT_BATCH_LIMIT;
  const now = options.now ?? new Date();
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_BATCH_LIMIT) {
    throw new GroupFeedPublicationError('batch_limit_invalid', `batch limit must be 1..${MAX_BATCH_LIMIT}`);
  }
  return db.transaction(async (tx) => {
    const result = await tx.query<{ outbox_id: string }>(
      `WITH blocked AS (
         SELECT outbox_id FROM group_feed_outbox WHERE status = 'blocked'
         ORDER BY created_at, outbox_id FOR UPDATE SKIP LOCKED LIMIT $1
       )
       UPDATE group_feed_outbox AS o
       SET status = 'pending', attempt_count = 0, claimed_until = NULL,
           next_attempt_at = $2, last_error_code = NULL, last_error_at = NULL
       FROM blocked WHERE o.outbox_id = blocked.outbox_id
       RETURNING o.outbox_id`,
      [limit, now.toISOString()],
    );
    return result.rows.length;
  });
}

export async function suppressGroupFeedProjection(
  db: Db,
  feedEventId: string,
  reason: GroupFeedSuppressionReason,
  now: Date = new Date(),
): Promise<boolean> {
  if (!(SUPPRESSION_REASONS as readonly string[]).includes(reason)) {
    throw new GroupFeedPublicationError('suppression_reason_invalid', 'system suppression reason is required');
  }
  return db.transaction(async (tx) => {
    const outbox = await tx.query<OutboxRowNormalized>(
      `SELECT o.* FROM group_feed_outbox o
       JOIN group_feed_projection p ON p.feed_event_id = o.outbox_id AND p.group_id = o.group_id
       WHERE o.outbox_id = $1 FOR UPDATE OF o`,
      [feedEventId],
    );
    const row = outbox.rows[0];
    if (!row) return false;
    const changed = await tx.query(
      `UPDATE group_feed_projection SET suppressed_at = $2, suppression_reason_code = $3
       WHERE feed_event_id = $1 AND suppressed_at IS NULL RETURNING feed_event_id`,
      [feedEventId, now.toISOString(), reason],
    );
    if (!changed.rows.length) return false;
    await appendSystemAction(tx, row, 'suppressed', reason, now);
    return true;
  });
}

export async function restoreGroupFeedProjectionAfterSourceRevalidation(
  db: Db,
  feedEventId: string,
  now: Date = new Date(),
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const outbox = await tx.query<OutboxRowNormalized>(
      `SELECT o.* FROM group_feed_outbox o
       JOIN group_feed_projection p ON p.feed_event_id = o.outbox_id AND p.group_id = o.group_id
       WHERE o.outbox_id = $1 FOR UPDATE OF o`,
      [feedEventId],
    );
    const row = outbox.rows[0];
    if (!row) return false;
    const sourceCheck = await inspectSourceTransition(tx, row);
    if (sourceCheck.kind !== 'current') return false;
    const prior = await tx.query<{ suppression_reason_code: GroupFeedSuppressionReason | null }>(
      'SELECT suppression_reason_code FROM group_feed_projection WHERE feed_event_id = $1 AND suppressed_at IS NOT NULL',
      [feedEventId],
    );
    const reason = prior.rows[0]?.suppression_reason_code;
    if (!reason) return false;
    await tx.query(
      `UPDATE group_feed_projection SET suppressed_at = NULL, suppression_reason_code = NULL
       WHERE feed_event_id = $1`,
      [feedEventId],
    );
    await appendSystemAction(tx, row, 'restored', reason, now);
    return true;
  });
}

/** Expire active projections while retaining the minimal publication identity. */
export async function expireGroupFeedProjections(
  db: Db,
  options: { limit?: number; now?: Date } = {},
): Promise<number> {
  const limit = options.limit ?? DEFAULT_BATCH_LIMIT;
  const now = options.now ?? new Date();
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_BATCH_LIMIT) {
    throw new GroupFeedPublicationError('batch_limit_invalid', `batch limit must be 1..${MAX_BATCH_LIMIT}`);
  }
  const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  return db.transaction(async (tx) => {
    const due = await tx.query<OutboxRowNormalized>(
      `SELECT o.* FROM group_feed_outbox o
       JOIN group_feed_projection p ON p.feed_event_id = o.outbox_id AND p.group_id = o.group_id
       WHERE p.source_transition_at < $1
       ORDER BY p.source_transition_at, p.feed_event_id
       FOR UPDATE OF o SKIP LOCKED LIMIT $2`,
      [cutoff.toISOString(), limit],
    );
    for (const row of due.rows) {
      await appendSystemAction(tx, row, 'purged', 'retention_90_days', now);
      await tx.query('DELETE FROM group_feed_projection WHERE feed_event_id = $1', [row.outbox_id]);
      // Retain only the minimal event/source/Group identity needed to prevent
      // republication; discard retry/error state after visible projection expiry.
      await tx.query(
        `UPDATE group_feed_outbox
         SET status = 'expired', expired_at = $2, attempt_count = 0,
             next_attempt_at = $2, claimed_until = NULL,
             last_error_code = NULL, last_error_at = NULL
         WHERE outbox_id = $1`,
        [row.outbox_id, now.toISOString()],
      );
    }
    return due.rows.length;
  });
}
