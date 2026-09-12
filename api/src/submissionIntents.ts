/**
 * Phase C2B (EBC-02) Submission Intent ledger — durable trace of the
 * automatic ordinary activity-acceptance chain.
 *
 * EBC-02 closes the P0 Activity Evidence / Truth-chain gap by making the
 * existing automatic acceptance path explicitly traceable WITHOUT changing
 * the approved self-accountability model:
 *
 *   Submission Intent
 *     -> Evidence Eligibility (server-owned determination)
 *     -> Acceptance Decision (automatic_system authority)
 *     -> Accepted Activity Event (member_activity_events)
 *     -> Challenge Application (challenge_activity_records)
 *     -> Calculation / Derived Truth
 *
 * One user action in one Challenge produces ONE attributable, deterministic
 * Submission Intent row here, persisted for BOTH accepted and
 * domain-ineligible submissions. Transport/schema failures never reach this
 * table (the API/domain boundary rejects them before intent persistence).
 *
 * Accepted != verified: the acceptance authority is the stable automatic
 * system (`automatic_system`), NOT a human reviewer and NOT factual
 * certification. ACT-03 Verification and ACT-04 Correction stay deferred.
 *
 * The base Evidence row (member_activity_events) stays independent domain
 * evidence: no challenge_id, no scoring, no acceptance authority live on it.
 * The Challenge relationship and the decision trace belong here and in the
 * Challenge application record.
 *
 * No Firebase. No routes. Pure domain + `Db`.
 */

import type { Db } from './db.js';

/** Stable non-human automatic acceptance authority identity. */
export const ACCEPTANCE_AUTHORITY = 'automatic_system' as const;

/**
 * Bounded machine-readable eligibility reason codes, one per actual governed
 * check the engine performs. No codes for conditions the engine does not
 * check (e.g. no CONFIG_NOT_CURRENT: the engine always governs by the
 * config CURRENT at acceptance, per the founder rule).
 */
export const ELIGIBILITY_REASON = {
  GROUP_MEMBERSHIP_REQUIRED: 'GROUP_MEMBERSHIP_REQUIRED',
  CHALLENGE_NOT_ACTIVE: 'CHALLENGE_NOT_ACTIVE',
  PARTICIPATION_NOT_ELIGIBLE: 'PARTICIPATION_NOT_ELIGIBLE',
  OCCURRENCE_OUT_OF_WINDOW: 'OCCURRENCE_OUT_OF_WINDOW',
  ACTIVITY_NOT_CONFIGURED: 'ACTIVITY_NOT_CONFIGURED',
  MEASUREMENT_NOT_COMPATIBLE: 'MEASUREMENT_NOT_COMPATIBLE',
  KNOWLEDGE_MISMATCH: 'KNOWLEDGE_MISMATCH',
} as const;

export type EligibilityReason =
  (typeof ELIGIBILITY_REASON)[keyof typeof ELIGIBILITY_REASON];

export type EligibilityStatus = 'eligible' | 'ineligible';
export type AcceptanceStatus = 'accepted' | 'rejected';

export interface SubmissionIntentRow {
  submission_id: string;
  member_id: string;
  challenge_id: string;
  participation_id: string | null;
  client_key: string;
  activity_kind: 'fitness' | 'wellness';
  canonical_key: string;
  activity_variant: string | null;
  value: number;
  unit: string;
  occurred_at: string;
  occurred_day: string;
  occurred_tz: string | null;
  submitted_at: string;
  eligibility_status: EligibilityStatus;
  eligibility_reason: EligibilityReason | null;
  acceptance_status: AcceptanceStatus;
  acceptance_authority: string;
  decided_at: string | null;
  event_id: string | null;
  record_id: string | null;
}

/** The submitted activity data shared by accepted and rejected intents. */
export interface SubmissionIntentPayload {
  member_id: string;
  challenge_id: string;
  client_key: string;
  activity_kind: 'fitness' | 'wellness';
  canonical_key: string;
  activity_variant: string | null;
  value: number;
  unit: string;
  occurred_at: Date;
  occurred_day: string;
  occurred_tz: string | null;
}

export interface AcceptedSubmissionIntentInput extends SubmissionIntentPayload {
  participation_id: string;
  event_id: string;
  record_id: string;
  decided_at: string;
}

export interface RejectedSubmissionIntentInput extends SubmissionIntentPayload {
  participation_id: string | null;
  eligibility_reason: EligibilityReason;
}

const INTENT_COLUMNS = [
  'member_id', 'challenge_id', 'participation_id', 'client_key',
  'activity_kind', 'canonical_key', 'activity_variant', 'value', 'unit',
  'occurred_at', 'occurred_day', 'occurred_tz',
  'eligibility_status', 'eligibility_reason', 'acceptance_status',
  'acceptance_authority', 'decided_at', 'event_id', 'record_id',
].join(', ');

export function normalizeSubmissionIntentRow(
  row: Record<string, unknown>,
): SubmissionIntentRow {
  const day = row.occurred_day instanceof Date
    ? (row.occurred_day as Date).toISOString().slice(0, 10)
    : String(row.occurred_day).slice(0, 10);
  return {
    submission_id: String(row.submission_id),
    member_id: String(row.member_id),
    challenge_id: String(row.challenge_id),
    participation_id: row.participation_id == null ? null : String(row.participation_id),
    client_key: String(row.client_key),
    activity_kind: row.activity_kind as 'fitness' | 'wellness',
    canonical_key: String(row.canonical_key),
    activity_variant: row.activity_variant == null ? null : String(row.activity_variant),
    value: Number(row.value),
    unit: String(row.unit),
    occurred_at: new Date(row.occurred_at as string).toISOString(),
    occurred_day: day,
    occurred_tz: row.occurred_tz == null ? null : String(row.occurred_tz),
    submitted_at: new Date(row.submitted_at as string).toISOString(),
    eligibility_status: row.eligibility_status as EligibilityStatus,
    eligibility_reason: (row.eligibility_reason as EligibilityReason | null) ?? null,
    acceptance_status: row.acceptance_status as AcceptanceStatus,
    acceptance_authority: String(row.acceptance_authority),
    decided_at: row.decided_at == null ? null : new Date(row.decided_at as string).toISOString(),
    event_id: row.event_id == null ? null : String(row.event_id),
    record_id: row.record_id == null ? null : String(row.record_id),
  };
}

/**
 * Persist an ACCEPTED Submission Intent inside the acceptance transaction.
 * Atomic with the Evidence event, the Challenge application, and the Derived
 * Truth writes: if any authoritative step fails, everything rolls back and no
 * falsely accepted intent survives.
 */
export async function recordAcceptedSubmissionIntent(
  tx: Db,
  input: AcceptedSubmissionIntentInput,
): Promise<SubmissionIntentRow> {
  const result = await tx.query(
    `INSERT INTO activity_submission_intents (${INTENT_COLUMNS})
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
             'eligible', NULL, 'accepted', '${ACCEPTANCE_AUTHORITY}', $13, $14, $15)
     RETURNING *`,
    [
      input.member_id, input.challenge_id, input.participation_id, input.client_key,
      input.activity_kind, input.canonical_key, input.activity_variant,
      input.value, input.unit,
      input.occurred_at.toISOString(), input.occurred_day, input.occurred_tz,
      input.decided_at, input.event_id, input.record_id,
    ],
  );
  if (result.rows.length === 0) throw new Error('submission-intents: accepted intent insert returned no row');
  return normalizeSubmissionIntentRow(result.rows[0] as Record<string, unknown>);
}

/**
 * Persist a REJECTED Submission Intent for a domain-valid submission that
 * failed eligibility. Runs OUTSIDE the acceptance transaction (which rolled
 * back) so the rejection is durable. Idempotent on client_key: a retry of the
 * same rejected intent converges on the first persisted decision and never
 * mints a second unrelated submission.
 */
export async function recordRejectedSubmissionIntent(
  db: Db,
  input: RejectedSubmissionIntentInput,
): Promise<SubmissionIntentRow> {
  const inserted = await db.query(
    `INSERT INTO activity_submission_intents (${INTENT_COLUMNS})
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
             'ineligible', $13, 'rejected', '${ACCEPTANCE_AUTHORITY}', now(), NULL, NULL)
     ON CONFLICT (client_key) DO NOTHING
     RETURNING *`,
    [
      input.member_id, input.challenge_id, input.participation_id, input.client_key,
      input.activity_kind, input.canonical_key, input.activity_variant,
      input.value, input.unit,
      input.occurred_at.toISOString(), input.occurred_day, input.occurred_tz,
      input.eligibility_reason,
    ],
  );
  if (inserted.rows.length > 0) {
    return normalizeSubmissionIntentRow(inserted.rows[0] as Record<string, unknown>);
  }
  const existing = await db.query(
    `SELECT * FROM activity_submission_intents WHERE client_key = $1`,
    [input.client_key],
  );
  if (existing.rows.length === 0) {
    throw new Error('submission-intents: rejected intent conflict on client_key without a stored row');
  }
  return normalizeSubmissionIntentRow(existing.rows[0] as Record<string, unknown>);
}

/**
 * CORR-001: a client_key binds to the ORIGINAL logical submission payload, not
 * just to the member/challenge. Replay of a persisted intent is allowed ONLY
 * when the incoming submission matches the persisted intent's normalized
 * canonical values. Any bound-field difference is a key conflict, never a
 * replay — for BOTH accepted and rejected prior intents.
 *
 * Normalization (so serialization differences never false-conflict):
 * - activity_variant: null and absent compare consistently (both are null by
 *   the time the domain sees them);
 * - occurred_at: compared by canonical instant (getTime), not by transport
 *   string formatting;
 * - occurred_day: compared using the canonical stored/derived YYYY-MM-DD
 *   value (the caller passes the derived day, not the raw request field);
 * - value: compared as the normalized domain number;
 * - occurred_tz: null and absent compare consistently; a supplied tz is part
 *   of the bound request contract.
 */
export function isSameSubmissionPayload(
  prior: SubmissionIntentRow,
  incoming: SubmissionIntentPayload,
): boolean {
  if (prior.member_id !== incoming.member_id) return false;
  if (prior.challenge_id !== incoming.challenge_id) return false;
  if (prior.activity_kind !== incoming.activity_kind) return false;
  if (prior.canonical_key !== incoming.canonical_key) return false;
  if ((prior.activity_variant ?? null) !== (incoming.activity_variant ?? null)) return false;
  if (prior.value !== incoming.value) return false;
  if (prior.unit !== incoming.unit) return false;
  if (new Date(prior.occurred_at).getTime() !== incoming.occurred_at.getTime()) return false;
  if (prior.occurred_day !== String(incoming.occurred_day).slice(0, 10)) return false;
  if ((prior.occurred_tz ?? null) !== (incoming.occurred_tz ?? null)) return false;
  return true;
}

/** Look up the persisted decision for a request/client idempotency key. */
export async function findSubmissionIntentByClientKey(
  db: Db,
  clientKey: string,
): Promise<SubmissionIntentRow | null> {
  const result = await db.query(
    `SELECT * FROM activity_submission_intents WHERE client_key = $1`,
    [clientKey],
  );
  if (result.rows.length === 0) return null;
  return normalizeSubmissionIntentRow(result.rows[0] as Record<string, unknown>);
}

/** Look up the intent for an accepted Challenge application (legacy-safe). */
export async function findSubmissionIntentByRecordId(
  db: Db,
  recordId: string,
): Promise<SubmissionIntentRow | null> {
  const result = await db.query(
    `SELECT * FROM activity_submission_intents WHERE record_id = $1`,
    [recordId],
  );
  if (result.rows.length === 0) return null;
  return normalizeSubmissionIntentRow(result.rows[0] as Record<string, unknown>);
}
