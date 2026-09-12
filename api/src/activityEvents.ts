/**
 * Phase C1 Member Activity Event ledger — domain seam for reported Evidence.
 *
 * Clean V2 state: this ledger records NEW V2 activity reports. It carries no
 * Firestore migration mechanics (no legacy_* columns) and no
 * Challenge-derived fields (no challenge_id, no points/scoring).
 *
 * Domain separation (Stage F logical model):
 * - Member Activity Event (THIS module/table) = Evidence: what the member
 *   reported. Independent domain identity (event_id UUID PK).
 * - Challenge-Specific Activity Record (C2, not implemented here) =
 *   application of exactly one event within one Challenge/Participation:
 *   event FK + challenge + participation + exact challenge activity/config
 *   version + acceptance/calculation state + scoring result/points +
 *   contribution to Derived Truth.
 * - Derived Truth (C2) = calculated challenge outcome, recomputable.
 * Conceptual flow: Member Activity Event -> Challenge-Specific Activity
 * Record -> Challenge Engine -> Derived Truth.
 *
 * Challenge-specific logging invariant (V2 write path, C2): a user logging
 * action occurs in the context of ONE specific Challenge and transactionally
 * creates (A) the Member Activity Event and (B) exactly one
 * Challenge-Specific Activity Record for that Challenge. No automatic
 * cross-challenge reuse; re-reporting into another Challenge is a separate
 * intentional action. Tiizi is not a general personal activity diary.
 * This schema is already compatible: `event_id` is a stable UUID PRIMARY
 * KEY, so the C2 record table references it with NO change here.
 *
 * C2 application contract (NOT implemented in C1 — documented so C1 cannot
 * grow a bypass): the ONLY shape permitted to feed the Challenge Engine is
 * the Challenge-Specific Activity Record:
 *   ChallengeApplicationInput {
 *     event_id, challenge_id, participation_id,
 *     challenge_activity_config_version, accepted state,
 *     event measurement (value/unit/day, Knowledge pin snapshot)
 *   }
 * C1 deliberately provides NO production path from a raw Member Activity
 * Event to a ChallengeContext/engine result: replaying arbitrary Evidence
 * against an arbitrary Challenge would let a log in Challenge A count in
 * Challenge B without the member intentionally logging it there. The
 * vendored `engine/` sources remain (drift-guarded) as the C2 foundation;
 * replay/calculation arrives with challenge_activity_records in C2.
 *
 * Knowledge authority: the server resolves the canonical key (+variant)
 * against canonical Knowledge at write time and stores a complete,
 * trustworthy pin. Client input supplies ONLY the canonical key (+variant);
 * it never determines the authoritative version, so there is no
 * client-authored pin or provenance enum on the Evidence.
 *
 * `occurred_day` is the authoritative local calendar day the engines reason
 * about; `occurred_tz` records the originating timezone when known.
 *
 * Invariants (also enforced by migration 003 triggers):
 * - committed event content is never overwritten or deleted;
 * - corrections are NEW rows with supersedes_event_id + correction_kind;
 * - client_key is unique: duplicate retries converge (idempotent).
 *
 * This module imports nothing Firebase-related and nothing network-related:
 * pure domain + the `Db` seam.
 */

import type { Db } from './db.js';

export type ActivityKind = 'fitness' | 'wellness';

export type CorrectionKind = 'correction' | 'reversal';

export interface ActivityEventRow {
  event_id: string;
  member_id: string;
  activity_kind: ActivityKind;
  canonical_key: string;
  activity_variant: string | null;
  knowledge_id: string;
  knowledge_version: number;
  occurred_at: string;
  occurred_day: string;
  occurred_tz: string | null;
  recorded_at: string;
  value: number;
  unit: string;
  client_key: string;
  supersedes_event_id: string | null;
  correction_kind: CorrectionKind | null;
  status: 'committed' | 'superseded';
  metadata: Record<string, unknown>;
}

/**
 * New V2 activity report (Evidence input). Note what is absent by design:
 * - no `challenge_id` (association is the C2 application record);
 * - no `points`/scoring (Challenge application, computed at apply time);
 * - no `knowledge_id`/`knowledge_version` (server-resolved, never
 *   client-authored);
 * - no legacy_* fields (V1 history does not migrate);
 * - no Firestore document references of any kind.
 */
export interface NewActivityEvent {
  member_id: string;
  activity_kind: ActivityKind;
  canonical_key: string;
  activity_variant?: string | null;
  occurred_at: Date;
  /** Authoritative local day; must agree with occurred_at (+occurred_tz). */
  occurred_day?: string;
  /** Originating IANA timezone, e.g. 'Africa/Lagos'. */
  occurred_tz?: string | null;
  value: number;
  unit: string;
  client_key: string;
  metadata?: Record<string, unknown>;
  /** Explicit event_id; defaults to a server-generated UUID when omitted. */
  event_id?: string;
}

export interface NewCorrectionEvent extends NewActivityEvent {
  supersedes_event_id: string;
  correction_kind: CorrectionKind;
}

/** Canonical Knowledge pin, server-resolved (never client-authored). */
export interface KnowledgePin {
  knowledge_id: string;
  current_version: number;
}

export interface ActivityEventResolvers {
  /**
   * Server-side resolution of a canonical key (+variant context) to the
   * authoritative Knowledge pin. Backed by knowledge_items today; the C2
   * write path additionally consults the exact challenge activity/config
   * version. Returns null when the key is not canonical Knowledge.
   */
  resolveKnowledgePin: (canonicalKey: string) => Promise<KnowledgePin | null>;
}

const EVENT_COLUMNS = [
  'event_id', 'member_id',
  'activity_kind', 'canonical_key', 'activity_variant',
  'knowledge_id', 'knowledge_version',
  'occurred_at', 'occurred_day', 'occurred_tz',
  'value', 'unit',
  'client_key',
  'supersedes_event_id', 'correction_kind', 'metadata',
].join(', ');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(message: string): never {
  throw new Error(`activity-events: ${message}`);
}

/** Calendar day (YYYY-MM-DD) of `at` in `tz` (or UTC when tz is null). */
export function dayInTimezone(at: Date, tz: string | null): string {
  if (!tz) return at.toISOString().slice(0, 10);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(at);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parts)) fail(`unresolvable timezone day for '${tz}'`);
    return parts;
  } catch {
    fail(`invalid occurred_tz '${tz}' (must be an IANA timezone)`);
  }
}

export function validateNewEvent(event: NewActivityEvent): void {
  if (event.activity_kind !== 'fitness' && event.activity_kind !== 'wellness') {
    fail('invalid activity_kind (must be fitness|wellness)');
  }
  if (!event.member_id) fail('member_id is required (Firebase UID is not the event identity)');
  if (!event.canonical_key || event.canonical_key.length > 200) {
    fail('canonical_key is required (1..200 chars)');
  }
  if (event.activity_variant != null
    && (event.activity_variant.length === 0 || event.activity_variant.length > 120)) {
    fail('activity_variant must be 1..120 chars when present');
  }
  // Scoring lives in Challenge application (C2): Evidence carries no points.
  if ((event as unknown as Record<string, unknown>).points !== undefined) {
    fail('points do not belong on a Member Activity Event (scoring is Challenge application)');
  }
  // Challenge association lives in the C2 application record, not the Evidence.
  if ((event as unknown as Record<string, unknown>).challenge_id !== undefined) {
    fail('challenge_id does not belong on a Member Activity Event (association is Challenge application)');
  }
  // Knowledge authority is server-side: callers send key (+variant), never a pin.
  if ((event as unknown as Record<string, unknown>).knowledge_id !== undefined
    || (event as unknown as Record<string, unknown>).knowledge_version !== undefined) {
    fail('knowledge pins are server-resolved (callers send canonical_key, never knowledge_id/version)');
  }
  if (!(event.occurred_at instanceof Date) || Number.isNaN(event.occurred_at.getTime())) {
    fail('occurred_at must be a valid Date');
  }
  if (event.occurred_day !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(event.occurred_day)) {
    fail('occurred_day must be YYYY-MM-DD');
  }
  const expectedDay = dayInTimezone(event.occurred_at, event.occurred_tz ?? null);
  if (event.occurred_day !== undefined && event.occurred_day !== expectedDay) {
    fail(`occurred_day ${event.occurred_day} disagrees with occurred_at in ${event.occurred_tz ?? 'UTC'} (expected ${expectedDay})`);
  }
  if (!Number.isFinite(event.value) || event.value < 0) fail('value must be a finite number >= 0');
  if (!event.unit || event.unit.length > 40) fail('unit is required (1..40 chars)');
  if (!event.client_key || event.client_key.length > 300) {
    fail('client_key is required for idempotency (1..300 chars)');
  }
  if (event.event_id !== undefined && !UUID_RE.test(event.event_id)) {
    fail('event_id must be a UUID when supplied');
  }
}

/**
 * Append Evidence. Idempotent on client_key: a duplicate retry returns the
 * existing row with inserted=false instead of creating a second event.
 * The Knowledge pin is always server-resolved; unknown activities are
 * rejected, never invented.
 *
 * EBC-03 authoritative day: the Challenge application seam derives the
 * Challenge-local day server-side from occurred_at + the governing
 * Challenge timezone and passes it as `options.authoritativeDay`. That day
 * overrides the client derivation and skips the client-tz agreement check
 * (a client-supplied occurred_day that disagrees with the governing day is
 * rejected by the caller, never trusted). occurred_tz still records the
 * originating client timezone as provenance only.
 */
export async function appendActivityEvent(
  db: Db,
  event: NewActivityEvent,
  resolvers: ActivityEventResolvers,
  options: { authoritativeDay?: string } = {},
): Promise<{ row: ActivityEventRow; inserted: boolean }> {
  validateNewEvent(event);
  const pin = await resolvers.resolveKnowledgePin(event.canonical_key);
  if (!pin) fail(`unknown activity '${event.canonical_key}' (no canonical Knowledge; pins are never invented)`);
  let occurredDay = event.occurred_day ?? dayInTimezone(event.occurred_at, event.occurred_tz ?? null);
  if (options.authoritativeDay !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(options.authoritativeDay)) {
      fail('authoritativeDay must be YYYY-MM-DD');
    }
    occurredDay = options.authoritativeDay;
  }
  const params = [
    event.event_id ?? null, event.member_id,
    event.activity_kind, event.canonical_key, event.activity_variant ?? null,
    pin.knowledge_id, pin.current_version,
    event.occurred_at.toISOString(), occurredDay, event.occurred_tz ?? null,
    event.value, event.unit,
    event.client_key,
    null, null,
    JSON.stringify(event.metadata ?? {}),
  ];
  const result = await db.query<ActivityEventRow & { metadata: unknown }>(
    `INSERT INTO member_activity_events (${EVENT_COLUMNS})
     VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     ON CONFLICT (client_key) DO NOTHING
     RETURNING *`,
    params,
  );
  if (result.rows.length > 0) {
    return { row: normalizeRow(result.rows[0]), inserted: true };
  }
  const existing = await db.query<ActivityEventRow & { metadata: unknown }>(
    `SELECT * FROM member_activity_events WHERE client_key = $1`,
    [event.client_key],
  );
  if (existing.rows.length === 0) fail('idempotency conflict on client_key without a stored row');
  return { row: normalizeRow(existing.rows[0]), inserted: false };
}

/**
 * Append a correction/reversal. The DB trigger flips the superseded target to
 * `superseded`; the original row content is never touched.
 */
export async function appendCorrectionEvent(
  db: Db,
  event: NewCorrectionEvent,
  resolvers: ActivityEventResolvers,
): Promise<ActivityEventRow> {
  validateNewEvent(event);
  if (!event.supersedes_event_id) fail('corrections require supersedes_event_id');
  const pin = await resolvers.resolveKnowledgePin(event.canonical_key);
  if (!pin) fail(`unknown activity '${event.canonical_key}' (no canonical Knowledge; pins are never invented)`);
  const occurredDay = event.occurred_day ?? dayInTimezone(event.occurred_at, event.occurred_tz ?? null);
  const params = [
    event.event_id ?? null, event.member_id,
    event.activity_kind, event.canonical_key, event.activity_variant ?? null,
    pin.knowledge_id, pin.current_version,
    event.occurred_at.toISOString(), occurredDay, event.occurred_tz ?? null,
    event.value, event.unit,
    event.client_key,
    event.supersedes_event_id, event.correction_kind,
    JSON.stringify(event.metadata ?? {}),
  ];
  const result = await db.query<ActivityEventRow & { metadata: unknown }>(
    `INSERT INTO member_activity_events (${EVENT_COLUMNS})
     VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING *`,
    params,
  );
  if (result.rows.length === 0) fail('correction insert returned no row');
  return normalizeRow(result.rows[0]);
}

export function normalizeRow(
  row: Omit<ActivityEventRow, 'occurred_at' | 'occurred_day' | 'recorded_at' | 'metadata'> & {
    occurred_at: string | Date;
    occurred_day: string | Date;
    recorded_at: string | Date;
    metadata: unknown;
  },
): ActivityEventRow {
  const metadata = typeof row.metadata === 'string'
    ? (JSON.parse(row.metadata) as Record<string, unknown>)
    : ((row.metadata ?? {}) as Record<string, unknown>);
  const occurredDay = row.occurred_day instanceof Date
    ? row.occurred_day.toISOString().slice(0, 10)
    : String(row.occurred_day).slice(0, 10);
  return {
    ...row,
    event_id: String(row.event_id),
    member_id: String(row.member_id),
    knowledge_id: String(row.knowledge_id),
    occurred_at: new Date(row.occurred_at).toISOString(),
    occurred_day: occurredDay,
    recorded_at: new Date(row.recorded_at).toISOString(),
    value: Number(row.value),
    metadata,
  };
}

/** Effective ledger rows: committed only, deterministic order. */
export async function listEffectiveEvents(
  db: Db,
  filter?: { member_id?: string },
): Promise<ActivityEventRow[]> {
  const clauses: string[] = [`status = 'committed'`];
  const params: unknown[] = [];
  if (filter?.member_id) {
    params.push(filter.member_id);
    clauses.push(`member_id = $${params.length}`);
  }
  const result = await db.query<ActivityEventRow & { metadata: unknown }>(
    `SELECT * FROM v_member_activity_events_effective WHERE ${clauses.join(' AND ')}
     ORDER BY occurred_at ASC, recorded_at ASC, event_id ASC`,
    params,
  );
  return result.rows.map(normalizeRow);
}
