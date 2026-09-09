/**
 * Phase C1 Activity Event ledger — domain seam.
 *
 * PostgreSQL append-only shadow of Firestore workouts / wellnessLogs.
 * Firestore remains the live writer/authority for NEW events in C1;
 * this ledger is replay-validation only. No dual writes.
 *
 * Invariants (also enforced by migration 003 triggers):
 * - committed event content is never overwritten or deleted;
 * - corrections are NEW rows with supersedes_event_id + correction_kind;
 * - client_key is unique: duplicate retries converge (idempotent);
 * - knowledge_version stays pinned to the import snapshot.
 *
 * This module imports nothing Firebase-related and nothing network-related:
 * pure domain + the `Db` seam.
 */

import { createHash } from 'node:crypto';
import type { Db } from './db.js';

export type ActivityEventType = 'workout' | 'wellness';

export type WellnessLogType = 'fasting' | 'hydration' | 'sleep' | 'meditation';

export type CorrectionKind = 'correction' | 'reversal';

export type VersionSource = 'import_snapshot' | 'log_pinned';

export interface ActivityEventRow {
  event_id: string;
  event_type: ActivityEventType;
  member_id: string;
  legacy_challenge_id: string | null;
  legacy_group_id: string | null;
  canonical_key: string;
  knowledge_id: string | null;
  knowledge_version: number | null;
  version_source: VersionSource | null;
  occurred_at: string;
  occurred_day: string;
  recorded_at: string;
  value: number;
  unit: string;
  points: number;
  client_key: string;
  legacy_collection: 'workouts' | 'wellnessLogs';
  legacy_id: string;
  log_type: WellnessLogType | null;
  supersedes_event_id: string | null;
  correction_kind: CorrectionKind | null;
  status: 'committed' | 'superseded';
  metadata: Record<string, unknown>;
}

export interface NewActivityEvent {
  event_type: ActivityEventType;
  member_id: string;
  legacy_challenge_id?: string | null;
  legacy_group_id?: string | null;
  canonical_key: string;
  knowledge_id?: string | null;
  knowledge_version?: number | null;
  version_source?: VersionSource | null;
  occurred_at: Date;
  occurred_day: string;
  value: number;
  unit: string;
  points: number;
  client_key: string;
  legacy_collection: 'workouts' | 'wellnessLogs';
  legacy_id: string;
  log_type?: WellnessLogType | null;
  metadata?: Record<string, unknown>;
  /** Explicit event_id; defaults to deterministicId(client_key) when omitted. */
  event_id?: string;
}

export interface NewCorrectionEvent extends Omit<NewActivityEvent, 'legacy_collection' | 'legacy_id'> {
  legacy_collection: 'workouts' | 'wellnessLogs';
  legacy_id: string;
  supersedes_event_id: string;
  correction_kind: CorrectionKind;
}

/** UUID namespace for deterministic legacy mapping (DNS namespace, fixed). */
export const LEGACY_EVENT_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/** Deterministic UUIDv5 for a legacy record: stable across re-imports. */
export function deterministicEventId(clientKey: string): string {
  const hash = createHash('sha1')
    .update(LEGACY_EVENT_NAMESPACE.replace(/-/g, ''))
    .update(clientKey, 'utf8')
    .digest();
  // Set version (5) and variant (RFC 4122) bits.
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Deterministic client idempotency key for a legacy Firestore record. */
export function legacyClientKey(collection: 'workouts' | 'wellnessLogs', docId: string): string {
  return `firestore:${collection}:${docId}`;
}

const EVENT_COLUMNS = [
  'event_id', 'event_type', 'member_id', 'legacy_challenge_id', 'legacy_group_id',
  'canonical_key', 'knowledge_id', 'knowledge_version', 'version_source',
  'occurred_at', 'occurred_day', 'value', 'unit', 'points',
  'client_key', 'legacy_collection', 'legacy_id', 'log_type',
  'supersedes_event_id', 'correction_kind', 'metadata',
].join(', ');

function fail(message: string): never {
  throw new Error(`activity-events: ${message}`);
}

export function validateNewEvent(event: NewActivityEvent): void {
  if (event.event_type !== 'workout' && event.event_type !== 'wellness') fail(`invalid event_type`);
  if (!event.member_id) fail('member_id is required (Firebase UID is not the event identity)');
  if (!event.canonical_key || event.canonical_key.length > 200) fail('canonical_key is required (1..200 chars)');
  const hasPin = event.knowledge_id != null || event.knowledge_version != null || event.version_source != null;
  if (hasPin && !(event.knowledge_id && event.knowledge_version && event.knowledge_version >= 1 && event.version_source)) {
    fail('partial knowledge pin: knowledge_id, knowledge_version, and version_source must travel together');
  }
  if (!(event.occurred_at instanceof Date) || Number.isNaN(event.occurred_at.getTime())) fail('occurred_at must be a valid Date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.occurred_day)) fail('occurred_day must be YYYY-MM-DD');
  if (!Number.isFinite(event.value) || event.value < 0) fail('value must be a finite number >= 0');
  if (!event.unit || event.unit.length > 40) fail('unit is required (1..40 chars)');
  if (!Number.isInteger(event.points) || event.points < 0) fail('points must be an integer >= 0');
  if (!event.client_key) fail('client_key is required for idempotency');
  if (!event.legacy_id) fail('legacy_id is required');
  if (event.event_type === 'workout' && event.log_type != null) fail('workout events carry no log_type');
  if (event.event_type === 'wellness' && event.log_type == null) fail('wellness events require log_type');
}

/**
 * Append an event. Idempotent on client_key: a duplicate retry returns the
 * existing row with inserted=false instead of creating a second business event.
 */
export async function appendActivityEvent(
  db: Db,
  event: NewActivityEvent,
): Promise<{ row: ActivityEventRow; inserted: boolean }> {
  validateNewEvent(event);
  const eventId = event.event_id ?? deterministicEventId(event.client_key);
  const params = [
    eventId, event.event_type, event.member_id,
    event.legacy_challenge_id ?? null, event.legacy_group_id ?? null,
    event.canonical_key,
    event.knowledge_id ?? null, event.knowledge_version ?? null, event.version_source ?? null,
    event.occurred_at.toISOString(), event.occurred_day,
    event.value, event.unit, event.points,
    event.client_key, event.legacy_collection, event.legacy_id,
    event.log_type ?? null,
    null, null,
    JSON.stringify(event.metadata ?? {}),
  ];
  const placeholders = params.map((_, i) => `$${i + 1}`).join(', ');
  const result = await db.query<ActivityEventRow & { metadata: unknown }>(
    `INSERT INTO activity_events (${EVENT_COLUMNS})
     VALUES (${placeholders})
     ON CONFLICT (client_key) DO NOTHING
     RETURNING *`,
    params,
  );
  if (result.rows.length > 0) {
    return { row: normalizeRow(result.rows[0]), inserted: true };
  }
  const existing = await db.query<ActivityEventRow & { metadata: unknown }>(
    `SELECT * FROM activity_events WHERE client_key = $1`,
    [event.client_key],
  );
  if (existing.rows.length === 0) fail(`idempotency conflict on client_key without a stored row`);
  return { row: normalizeRow(existing.rows[0]), inserted: false };
}

/**
 * Append a correction/reversal. The DB trigger flips the superseded target to
 * `superseded`; the original row content is never touched.
 */
export async function appendCorrectionEvent(
  db: Db,
  event: NewCorrectionEvent,
): Promise<ActivityEventRow> {
  validateNewEvent(event);
  if (!event.supersedes_event_id) fail('corrections require supersedes_event_id');
  const eventId = event.event_id ?? deterministicEventId(event.client_key);
  const params = [
    eventId, event.event_type, event.member_id,
    event.legacy_challenge_id ?? null, event.legacy_group_id ?? null,
    event.canonical_key,
    event.knowledge_id ?? null, event.knowledge_version ?? null, event.version_source ?? null,
    event.occurred_at.toISOString(), event.occurred_day,
    event.value, event.unit, event.points,
    event.client_key, event.legacy_collection, event.legacy_id,
    event.log_type ?? null,
    event.supersedes_event_id, event.correction_kind,
    JSON.stringify(event.metadata ?? {}),
  ];
  const placeholders = params.map((_, i) => `$${i + 1}`).join(', ');
  const result = await db.query<ActivityEventRow & { metadata: unknown }>(
    `INSERT INTO activity_events (${EVENT_COLUMNS})
     VALUES (${placeholders})
     RETURNING *`,
    params,
  );
  if (result.rows.length === 0) fail('correction insert returned no row');
  return normalizeRow(result.rows[0]);
}

export function normalizeRow(
  row: Omit<ActivityEventRow, 'occurred_at' | 'occurred_day' | 'metadata'> & {
    occurred_at: string | Date;
    occurred_day: string | Date;
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
    knowledge_id: row.knowledge_id == null ? null : String(row.knowledge_id),
    occurred_at: new Date(row.occurred_at).toISOString(),
    occurred_day: occurredDay,
    recorded_at: new Date(row.recorded_at).toISOString(),
    value: Number(row.value),
    points: Number(row.points),
    metadata,
  };
}

/** Effective ledger rows for replay: committed only, deterministic order. */
export async function listEffectiveEvents(
  db: Db,
  filter?: { member_id?: string; legacy_challenge_id?: string },
): Promise<ActivityEventRow[]> {
  const clauses: string[] = [`status = 'committed'`];
  const params: unknown[] = [];
  if (filter?.member_id) {
    params.push(filter.member_id);
    clauses.push(`member_id = $${params.length}`);
  }
  if (filter?.legacy_challenge_id) {
    params.push(filter.legacy_challenge_id);
    clauses.push(`legacy_challenge_id = $${params.length}`);
  }
  const result = await db.query<ActivityEventRow & { metadata: unknown }>(
    `SELECT * FROM v_activity_events_effective WHERE ${clauses.join(' AND ')}
     ORDER BY occurred_at ASC, recorded_at ASC, event_id ASC`,
    params,
  );
  return result.rows.map(normalizeRow);
}
