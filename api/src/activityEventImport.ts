/**
 * Phase C1 Firestore -> PostgreSQL event importer (shadow only).
 *
 * Reads `workouts` and `wellnessLogs` (plain-data snapshots — this module
 * never imports Firebase; the CLI wires firebase-admin) and maps each record
 * 1:1 to an `activity_events` row:
 * - member identity resolves through the PostgreSQL members table
 *   (auth_provider/auth_subject); Firebase UIDs never become event IDs;
 * - challenge/group ids are carried as transitional legacy references —
 *   they are NOT PostgreSQL authority claims;
 * - canonical knowledge pins resolve via knowledge_items; unresolvable keys
 *   keep a NULL pin and are reported (never invented);
 * - event_id / client_key are deterministic (`firestore:<collection>:<doc>`),
 *   so --apply is idempotent and --dry-run predicts it exactly;
 * - zero Firestore writes; malformed records are reported, never silently
 *   dropped; historical missing fields are normalized only to safe,
 *   explicitly-reported defaults.
 */

import {
  appendActivityEvent,
  legacyClientKey,
  type ActivityEventType,
  type NewActivityEvent,
  type WellnessLogType,
} from './activityEvents.js';
import type { Db } from './db.js';

/** Plain-data Firestore document (Timestamp, Date, ISO string, or millis). */
export interface LegacyDocSnapshot {
  id: string;
  data: Record<string, unknown>;
}

export interface MemberResolver {
  (authProvider: string, uid: string): Promise<string | null>;
}

export interface KnowledgePin {
  knowledge_id: string;
  current_version: number;
}

export interface KnowledgeResolver {
  (canonicalKey: string): Promise<KnowledgePin | null>;
}

export interface MalformedEntry {
  collection: 'workouts' | 'wellnessLogs';
  legacy_id: string;
  reason: string;
}

export interface UnresolvedKnowledgeEntry {
  collection: 'workouts' | 'wellnessLogs';
  legacy_id: string;
  canonical_key: string;
}

export interface ImportCollectionReport {
  scanned: number;
  imported: number;
  skipped_existing: number;
  malformed: MalformedEntry[];
}

export interface ActivityEventImportReport {
  dryRun: boolean;
  workouts: ImportCollectionReport;
  wellnessLogs: ImportCollectionReport;
  unresolvedKnowledgeTotal: number;
  unresolvedKnowledgeSample: UnresolvedKnowledgeEntry[];
  normalizedDays: number;
}

/** Firestore Timestamp-shape or any common timestamp encoding. */
export function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object') {
    const maybe = value as { toDate?: unknown; seconds?: unknown };
    if (typeof maybe.toDate === 'function') {
      const d = (maybe.toDate as () => unknown)();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    }
    if (typeof maybe.seconds === 'number') {
      const d = new Date(maybe.seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

function isDayString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : (value as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function toInt(value: unknown): number | null {
  const n = toFiniteNumber(value);
  return n == null ? null : Math.floor(n);
}

function nonEmptyString(value: unknown, max = 200): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

const WELLNESS_LOG_TYPES: WellnessLogType[] = ['fasting', 'hydration', 'sleep', 'meditation'];

export interface MappedEvent {
  event?: NewActivityEvent;
  malformed?: string;
  unresolvedKnowledge?: boolean;
  dayNormalized?: boolean;
}

function baseOccurred(
  occurredRaw: unknown,
  fallbackRaw: unknown,
  dayRaw: unknown,
): { occurredAt: Date | null; day: string | null; dayNormalized: boolean } {
  const occurredAt = toDate(occurredRaw) ?? toDate(fallbackRaw);
  if (!occurredAt) return { occurredAt: null, day: null, dayNormalized: false };
  if (isDayString(dayRaw)) return { occurredAt, day: dayRaw, dayNormalized: false };
  return { occurredAt, day: occurredAt.toISOString().slice(0, 10), dayNormalized: true };
}

export function mapLegacyWorkout(
  doc: LegacyDocSnapshot,
  resolved: { memberId: string | null; pin: KnowledgePin | null },
): MappedEvent {
  const data = doc.data;
  if (!resolved.memberId) return { malformed: 'unknown_member' };
  const exerciseId = nonEmptyString(data.exerciseId);
  if (!exerciseId) return { malformed: 'missing_exerciseId' };
  const value = toFiniteNumber(data.value);
  if (value == null || value < 0) return { malformed: 'invalid_value' };
  const unit = nonEmptyString(data.unit, 40);
  if (!unit) return { malformed: 'missing_unit' };
  const points = toInt(data.points);
  if (points == null || points < 0) {
    // Pre-scoring legacy records (no scoringVersion, no points) predate the v2
    // engines the live path itself rejects; they need a Founder backfill
    // policy, not an invented value. Corrupt v2 records stay missing_points.
    return { malformed: data.scoringVersion == null ? 'legacy_prescoring' : 'missing_points' };
  }
  const challengeId = nonEmptyString(data.challengeId);
  if (!challengeId) return { malformed: 'missing_challengeId' };
  const { occurredAt, day, dayNormalized } = baseOccurred(data.completedAt, data.loggedAt, data.date);
  if (!occurredAt || !day) return { malformed: 'missing_timestamp' };
  const clientKey = legacyClientKey('workouts', doc.id);
  const event: NewActivityEvent = {
    event_type: 'workout',
    member_id: resolved.memberId,
    legacy_challenge_id: challengeId,
    legacy_group_id: nonEmptyString(data.groupId) ?? null,
    canonical_key: exerciseId,
    knowledge_id: resolved.pin?.knowledge_id ?? null,
    knowledge_version: resolved.pin?.current_version ?? null,
    version_source: resolved.pin ? 'import_snapshot' : null,
    occurred_at: occurredAt,
    occurred_day: day,
    value,
    unit,
    points,
    client_key: clientKey,
    legacy_collection: 'workouts',
    legacy_id: doc.id,
    log_type: null,
    metadata: {
      ...(typeof data.notes === 'string' && data.notes ? { notes: data.notes } : {}),
      ...(typeof data.verified === 'boolean' ? { verified: data.verified } : {}),
      ...(typeof data.scoringVersion === 'string' ? { scoringVersion: data.scoringVersion } : {}),
    },
  };
  return { event, unresolvedKnowledge: !resolved.pin, dayNormalized: dayNormalized };
}

export function mapLegacyWellnessLog(
  doc: LegacyDocSnapshot,
  resolved: { memberId: string | null; pin: KnowledgePin | null },
): MappedEvent {
  const data = doc.data;
  if (!resolved.memberId) return { malformed: 'unknown_member' };
  const activityId = nonEmptyString(data.activityId);
  if (!activityId) return { malformed: 'missing_activityId' };
  const logType = data.logType;
  if (typeof logType !== 'string' || !(WELLNESS_LOG_TYPES as string[]).includes(logType)) {
    return { malformed: 'invalid_logType' };
  }
  const value = toFiniteNumber(data.value);
  if (value == null || value < 0) return { malformed: 'invalid_value' };
  const unit = nonEmptyString(data.unit, 40);
  if (!unit) return { malformed: 'missing_unit' };
  const points = toInt(data.points);
  if (points == null || points < 0) {
    return { malformed: data.scoringVersion == null ? 'legacy_prescoring' : 'missing_points' };
  }
  const challengeId = nonEmptyString(data.challengeId);
  if (!challengeId) return { malformed: 'missing_challengeId' };
  const { occurredAt, day, dayNormalized } = baseOccurred(data.loggedAt, data.date, data.date);
  if (!occurredAt || !day) return { malformed: 'missing_timestamp' };
  const clientKey = legacyClientKey('wellnessLogs', doc.id);
  const metadata: Record<string, unknown> = {
    ...(typeof data.notes === 'string' && data.notes ? { notes: data.notes } : {}),
    ...(typeof data.scoringVersion === 'string' ? { scoringVersion: data.scoringVersion } : {}),
  };
  const sourceMeta = data.metadata;
  if (sourceMeta && typeof sourceMeta === 'object') {
    for (const [key, metaValue] of Object.entries(sourceMeta as Record<string, unknown>)) {
      if (metaValue !== undefined && metaValue !== null) metadata[`wellness_${key}`] = metaValue;
    }
  }
  const event: NewActivityEvent = {
    event_type: 'wellness',
    member_id: resolved.memberId,
    legacy_challenge_id: challengeId,
    legacy_group_id: nonEmptyString(data.groupId) ?? null,
    canonical_key: activityId,
    knowledge_id: resolved.pin?.knowledge_id ?? null,
    knowledge_version: resolved.pin?.current_version ?? null,
    version_source: resolved.pin ? 'import_snapshot' : null,
    occurred_at: occurredAt,
    occurred_day: day,
    value,
    unit,
    points,
    client_key: clientKey,
    legacy_collection: 'wellnessLogs',
    legacy_id: doc.id,
    log_type: logType as WellnessLogType,
    metadata,
  };
  return { event, unresolvedKnowledge: !resolved.pin, dayNormalized: dayNormalized };
}

export interface ImportSource {
  workouts: LegacyDocSnapshot[];
  wellnessLogs: LegacyDocSnapshot[];
}

export interface ImportResolvers {
  resolveMemberId: MemberResolver;
  resolveKnowledgePin: KnowledgeResolver;
}

const APPLY_BATCH_SIZE = 200;
const UNRESOLVED_SAMPLE_LIMIT = 50;

async function importCollection(
  db: Db,
  docs: LegacyDocSnapshot[],
  collection: 'workouts' | 'wellnessLogs',
  eventType: ActivityEventType,
  resolvers: ImportResolvers,
  dryRun: boolean,
  report: ImportCollectionReport,
  unresolved: UnresolvedKnowledgeEntry[],
  counters: { normalizedDays: number; unresolvedKnowledge: number },
): Promise<void> {
  const pending: NewActivityEvent[] = [];
  for (const doc of docs) {
    report.scanned += 1;
    const data = doc.data;
    const uid = typeof data.userId === 'string' ? data.userId : '';
    const memberId = uid ? await resolvers.resolveMemberId('firebase', uid) : null;
    const keyRaw = eventType === 'workout' ? data.exerciseId : data.activityId;
    const canonicalKey = typeof keyRaw === 'string' ? keyRaw.trim() : '';
    const pin = memberId && canonicalKey ? await resolvers.resolveKnowledgePin(canonicalKey) : null;
    const mapped = eventType === 'workout'
      ? mapLegacyWorkout(doc, { memberId, pin })
      : mapLegacyWellnessLog(doc, { memberId, pin });
    if (!mapped.event || mapped.malformed) {
      report.malformed.push({ collection, legacy_id: doc.id, reason: mapped.malformed ?? 'unknown' });
      continue;
    }
    if (mapped.unresolvedKnowledge) {
      counters.unresolvedKnowledge += 1;
      if (unresolved.length < UNRESOLVED_SAMPLE_LIMIT) {
        unresolved.push({ collection, legacy_id: doc.id, canonical_key: canonicalKey });
      }
    }
    if (mapped.dayNormalized) counters.normalizedDays += 1;
    if (dryRun) {
      report.imported += 1;
      continue;
    }
    pending.push(mapped.event);
    if (pending.length >= APPLY_BATCH_SIZE) {
      await flushBatch(db, pending, report);
    }
  }
  if (!dryRun && pending.length > 0) {
    await flushBatch(db, pending, report);
  }
}

async function flushBatch(db: Db, pending: NewActivityEvent[], report: ImportCollectionReport): Promise<void> {
  const batch = pending.splice(0, pending.length);
  await db.transaction(async (tx) => {
    for (const event of batch) {
      const { inserted } = await appendActivityEvent(tx, event);
      if (inserted) report.imported += 1;
      else report.skipped_existing += 1;
    }
  });
}

export async function runActivityEventImport(
  db: Db,
  source: ImportSource,
  resolvers: ImportResolvers,
  options?: { dryRun?: boolean },
): Promise<ActivityEventImportReport> {
  const dryRun = options?.dryRun ?? true;
  const report: ActivityEventImportReport = {
    dryRun,
    workouts: { scanned: 0, imported: 0, skipped_existing: 0, malformed: [] },
    wellnessLogs: { scanned: 0, imported: 0, skipped_existing: 0, malformed: [] },
    unresolvedKnowledgeTotal: 0,
    unresolvedKnowledgeSample: [],
    normalizedDays: 0,
  };
  const counters = { normalizedDays: 0, unresolvedKnowledge: 0 };
  const unresolved: UnresolvedKnowledgeEntry[] = [];
  await importCollection(db, source.workouts, 'workouts', 'workout', resolvers, dryRun, report.workouts, unresolved, counters);
  await importCollection(db, source.wellnessLogs, 'wellnessLogs', 'wellness', resolvers, dryRun, report.wellnessLogs, unresolved, counters);
  report.unresolvedKnowledgeSample = unresolved;
  report.unresolvedKnowledgeTotal = counters.unresolvedKnowledge;
  report.normalizedDays = counters.normalizedDays;
  return report;
}
