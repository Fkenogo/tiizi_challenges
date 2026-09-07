import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { authenticatedMember } from './auth.js';
import type { Db } from './db.js';

/**
 * Phase B canonical Knowledge authority (fitness + wellness).
 *
 * PostgreSQL/API is authoritative for canonical Knowledge: all mutations go
 * through the admin routes below, reads for challenge creation/runtime come
 * from these tables, and Firestore Knowledge data is retained read-only.
 *
 * Product semantics preserved from the Firestore implementation
 * (src/utils/knowledgeLifecycle.ts, adminExerciseService,
 * adminWellnessActivityService, challengeCreationBackend):
 *
 * - lifecycle: draft → published → retired (forward-only; retirement replaces
 *   destructive deletion — there is deliberately no DELETE route);
 * - legacy records without lifecycle status count as published;
 * - create starts at knowledgeVersion 1 (client-supplied versions ignored);
 * - content revisions increment knowledgeVersion exactly once, atomically;
 * - lifecycle-only transitions never touch knowledgeVersion;
 * - historical version rows are append-only (database trigger rejects
 *   UPDATE/DELETE) so challenge snapshots stay interpretable forever;
 * - supplied canonical IDs must resolve; draft/retired/missing IDs are
 *   rejected for new challenge creation (enforced in functions/src);
 * - custom/manual activities (no canonical ID) are unaffected.
 *
 * Identity: `id` is always the internal Tiizi UUID. Transitional legacy
 * Firestore document ids appear ONLY as `legacyId` in the compat lookup —
 * never as a domain `id`.
 */

export type KnowledgeKind = 'fitness' | 'wellness';
export type KnowledgeLifecycle = 'draft' | 'published' | 'retired';

export const KNOWLEDGE_KINDS: KnowledgeKind[] = ['fitness', 'wellness'];
export const KNOWLEDGE_LIFECYCLES: KnowledgeLifecycle[] = ['draft', 'published', 'retired'];

/** Version assigned on create and to legacy records that predate tracking. */
export const KNOWLEDGE_VERSION_INITIAL = 1;

/**
 * Admin roles allowed to mutate canonical Knowledge. Reuses the existing
 * Tiizi role vocabulary — canModerateChallenges ∪ canManageExercises
 * (firestore.rules + src/services/adminAccessService.ts). No new roles.
 */
export const KNOWLEDGE_ADMIN_ROLES = new Set([
  'super_admin',
  'admin',
  'moderator',
  'content_manager',
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Upper bound per list request so the seam cannot be used to dump the table. */
const MAX_LIST_ROWS = 500;

/** Upper bound per compat request (mirrors groupIdentity seam). */
const MAX_IDS_PER_REQUEST = 200;

/**
 * Fixed namespace for deterministic legacy Firestore ID → Tiizi UUID mapping
 * (RFC 4122 UUIDv5). Generated once, never changed: changing it would remap
 * every imported record. The importer mints this UUID on first sight of a
 * legacy entity, so repeated resolution is inherently stable.
 */
export const KNOWLEDGE_UUID_NAMESPACE = 'b3e1a2c4-8f5d-4a1e-9c3b-2d4f6a8b0c1e';

export class KnowledgeError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

/** Missing lifecycle status (legacy records) counts as published. */
export function normalizeLifecycle(value: unknown): KnowledgeLifecycle {
  if (value === 'draft' || value === 'published' || value === 'retired') return value;
  return 'published';
}

/** Missing/invalid versions (legacy records) normalize to 1. */
export function normalizeVersion(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || (n as number) < 1) return KNOWLEDGE_VERSION_INITIAL;
  return Math.floor(n as number);
}

/** RFC 4122 UUIDv5: sha1(namespace || name), version + variant bits set. */
export function deterministicKnowledgeId(collection: string, legacyId: string): string {
  const namespaceHex = KNOWLEDGE_UUID_NAMESPACE.replace(/-/g, '');
  const namespaceBytes = Buffer.from(namespaceHex, 'hex');
  const hash = createHash('sha1')
    .update(namespaceBytes)
    .update(`${collection}/${legacyId}`, 'utf8')
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return (
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-` +
    `${hex.slice(16, 20)}-${hex.slice(20, 32)}`
  );
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export interface ApiKnowledgeItem {
  id: string;
  kind: KnowledgeKind;
  lifecycle: KnowledgeLifecycle;
  knowledgeVersion: number;
  name: string;
  category: string;
  subcategory: string;
  difficulty: string;
  icon: string;
  description: string;
  metricUnit: string;
  targetValue: number | null;
  targetType: string;
  frequency: string;
  points: number;
  imageUrl: string;
  tags: string[];
  details: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeContentInput {
  name?: unknown;
  category?: unknown;
  subcategory?: unknown;
  difficulty?: unknown;
  icon?: unknown;
  description?: unknown;
  metricUnit?: unknown;
  targetValue?: unknown;
  targetType?: unknown;
  frequency?: unknown;
  points?: unknown;
  imageUrl?: unknown;
  tags?: unknown;
  details?: unknown;
}

export interface CreateKnowledgeInput extends KnowledgeContentInput {
  kind?: unknown;
  lifecycle?: unknown;
}

export interface KnowledgeIdentityMapping {
  /**
   * Transitional Firestore document id. Lookup key only — never a domain id.
   * Present solely so strangler-migration callers can translate the legacy
   * identity they already hold into the authoritative Tiizi UUID.
   */
  legacyId: string;
  /** Authoritative Tiizi knowledge UUID (`knowledge_items.knowledge_id`). */
  id: string;
  kind: KnowledgeKind;
}

/**
 * Stable per-kind vocabularies, mirroring the existing product validation
 * (adminExerciseService tier/difficulty sets; WellnessCategory /
 * WellnessDifficulty types). The API rejects anything outside these sets so
 * the migration cannot weaken creation-time guarantees.
 */
const FITNESS_CATEGORIES = new Set(['Core', 'Upper Body', 'Lower Body', 'Full Body']);
const FITNESS_SUBCATEGORIES = new Set(['Strength', 'Cardio', 'Balance', 'Mobility', 'Power']);
const FITNESS_DIFFICULTIES = new Set(['Beginner', 'Intermediate', 'Advanced']);
const WELLNESS_CATEGORIES = new Set([
  'fasting',
  'hydration',
  'sleep',
  'mindfulness',
  'nutrition',
  'habits',
  'stress',
  'social',
  'movement',
  'health-monitoring',
]);
const WELLNESS_DIFFICULTIES = new Set(['beginner', 'intermediate', 'advanced', 'expert']);

function asTrimmed(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.trim()) out.push(entry.trim().slice(0, 200));
  }
  return out;
}

function asDetails(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export interface ValidatedKnowledgeContent {
  name: string;
  category: string;
  subcategory: string;
  difficulty: string;
  icon: string;
  description: string;
  metricUnit: string;
  targetValue: number | null;
  targetType: string;
  frequency: string;
  points: number;
  imageUrl: string;
  tags: string[];
  details: Record<string, unknown>;
}

/**
 * Full-content validation shared by create and content revision. Revisions
 * require the same complete, valid content as creation — partial merges would
 * let callers blank out canonical fields by omission.
 */
export function validateKnowledgeContent(
  kind: KnowledgeKind,
  input: KnowledgeContentInput,
): ValidatedKnowledgeContent {
  const name = asTrimmed(input.name, 200);
  if (!name) throw new KnowledgeError(400, 'invalid_knowledge', 'name is required');
  const category = asTrimmed(input.category, 100);
  const subcategory = asTrimmed(input.subcategory, 100);
  const difficulty = asTrimmed(input.difficulty, 50);
  const metricUnit = asTrimmed(input.metricUnit, 50);
  if (!metricUnit) throw new KnowledgeError(400, 'invalid_knowledge', 'metricUnit is required');

  if (kind === 'fitness') {
    if (!FITNESS_CATEGORIES.has(category)) {
      throw new KnowledgeError(400, 'invalid_knowledge', `Invalid fitness category: ${category}`);
    }
    if (subcategory && !FITNESS_SUBCATEGORIES.has(subcategory)) {
      throw new KnowledgeError(400, 'invalid_knowledge', `Invalid fitness subcategory: ${subcategory}`);
    }
    if (!FITNESS_DIFFICULTIES.has(difficulty)) {
      throw new KnowledgeError(400, 'invalid_knowledge', `Invalid fitness difficulty: ${difficulty}`);
    }
  } else {
    if (!WELLNESS_CATEGORIES.has(category)) {
      throw new KnowledgeError(400, 'invalid_knowledge', `Invalid wellness category: ${category}`);
    }
    if (!WELLNESS_DIFFICULTIES.has(difficulty)) {
      throw new KnowledgeError(400, 'invalid_knowledge', `Invalid wellness difficulty: ${difficulty}`);
    }
  }

  let targetValue: number | null = null;
  if (input.targetValue !== undefined && input.targetValue !== null) {
    const n = typeof input.targetValue === 'number'
      ? input.targetValue
      : Number(input.targetValue);
    if (!Number.isFinite(n) || n < 0 || n > 1000000000) {
      throw new KnowledgeError(400, 'invalid_knowledge', 'targetValue must be a finite number >= 0');
    }
    targetValue = n;
  }

  let points = 0;
  if (input.points !== undefined && input.points !== null) {
    const n = typeof input.points === 'number' ? input.points : Number(input.points);
    if (!Number.isFinite(n) || n < 0) {
      throw new KnowledgeError(400, 'invalid_knowledge', 'points must be a number >= 0');
    }
    points = Math.floor(n);
  }

  return {
    name,
    category,
    subcategory,
    difficulty,
    icon: asTrimmed(input.icon, 100),
    description: asTrimmed(input.description, 2000),
    metricUnit,
    targetValue,
    targetType: asTrimmed(input.targetType, 50),
    frequency: asTrimmed(input.frequency, 50),
    points,
    imageUrl: asTrimmed(input.imageUrl, 500),
    tags: asStringArray(input.tags),
    details: asDetails(input.details),
  };
}

interface KnowledgeRow {
  knowledge_id: string;
  kind: string;
  lifecycle: string;
  current_version: number;
  name: string;
  category: string;
  subcategory: string;
  difficulty: string;
  icon: string;
  description: string;
  metric_unit: string;
  target_value: number | string | null;
  target_type: string;
  frequency: string;
  points: number | string;
  image_url: string;
  tags: string[] | string | null;
  details: Record<string, unknown> | string | null;
  created_at: string;
  updated_at: string;
}

function parseTags(value: KnowledgeRow['tags']): string[] {
  if (Array.isArray(value)) return value.map((t) => String(t));
  return [];
}

function parseDetails(value: KnowledgeRow['details']): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string' && value) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Fall through to empty details.
    }
  }
  return {};
}

export function mapKnowledgeRow(row: KnowledgeRow): ApiKnowledgeItem {
  return {
    id: String(row.knowledge_id),
    kind: row.kind as KnowledgeKind,
    lifecycle: row.lifecycle as KnowledgeLifecycle,
    knowledgeVersion: Number(row.current_version),
    name: row.name,
    category: row.category ?? '',
    subcategory: row.subcategory ?? '',
    difficulty: row.difficulty ?? '',
    icon: row.icon ?? '',
    description: row.description ?? '',
    metricUnit: row.metric_unit ?? '',
    targetValue: row.target_value === null || row.target_value === undefined
      ? null
      : Number(row.target_value),
    targetType: row.target_type ?? '',
    frequency: row.frequency ?? '',
    points: Number(row.points ?? 0),
    imageUrl: row.image_url ?? '',
    tags: parseTags(row.tags),
    details: parseDetails(row.details),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

const ITEM_COLUMNS = `knowledge_id, kind, lifecycle, current_version, name, category,
  subcategory, difficulty, icon, description, metric_unit, target_value,
  target_type, frequency, points, image_url, tags, details, created_at, updated_at`;

function contentParams(content: ValidatedKnowledgeContent): unknown[] {
  return [
    content.name,
    content.category,
    content.subcategory,
    content.difficulty,
    content.icon,
    content.description,
    content.metricUnit,
    content.targetValue,
    content.targetType,
    content.frequency,
    content.points,
    content.imageUrl,
    content.tags,
    JSON.stringify(content.details),
  ];
}

/** Throws 403 unless the member holds a knowledge-administration role. */
export async function requireKnowledgeAdmin(db: Db, memberId: string): Promise<void> {
  const result = await db.query<{ role: string }>(
    'SELECT role FROM members WHERE member_id = $1',
    [memberId],
  );
  const role = result.rows[0]?.role;
  if (!role || !KNOWLEDGE_ADMIN_ROLES.has(String(role))) {
    throw new KnowledgeError(403, 'forbidden', 'Knowledge administration role is required');
  }
}

/**
 * Create a canonical Knowledge item. Starts at version 1 with an initial
 * immutable version row; any client-supplied version is ignored. `kind` is
 * immutable after creation. Lifecycle defaults to published (legacy
 * backwards compatibility); callers may explicitly create drafts.
 */
export async function createKnowledgeItem(
  db: Db,
  input: CreateKnowledgeInput,
): Promise<ApiKnowledgeItem> {
  const kind = input.kind as KnowledgeKind;
  if (kind !== 'fitness' && kind !== 'wellness') {
    throw new KnowledgeError(400, 'invalid_knowledge', 'kind must be fitness or wellness');
  }
  const content = validateKnowledgeContent(kind, input);
  const lifecycle = input.lifecycle === undefined || input.lifecycle === null
    ? 'published'
    : String(input.lifecycle);
  if (lifecycle !== 'draft' && lifecycle !== 'published') {
    throw new KnowledgeError(
      400,
      'invalid_knowledge',
      'New items start as draft or published; retired is reached only via retire',
    );
  }
  return db.transaction(async (tx) => {
    const inserted = await tx.query<KnowledgeRow>(
      `INSERT INTO knowledge_items
         (kind, lifecycle, current_version, name, category, subcategory, difficulty,
          icon, description, metric_unit, target_value, target_type, frequency,
          points, image_url, tags, details)
       VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING ${ITEM_COLUMNS}`,
      [kind, lifecycle, ...contentParams(content)],
    );
    const row = inserted.rows[0];
    await tx.query(
      `INSERT INTO knowledge_item_versions
         (item_id, version, name, category, subcategory, difficulty, icon,
          description, metric_unit, target_value, target_type, frequency,
          points, image_url, tags, details)
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [row.knowledge_id, ...contentParams(content)],
    );
    return mapKnowledgeRow(row);
  });
}

/**
 * Content revision: atomically increments knowledgeVersion exactly once and
 * appends an immutable version row. The row lock (SELECT FOR UPDATE) makes
 * concurrent revisions serialize, so two simultaneous edits produce two
 * distinct versions — never a lost update.
 */
export async function reviseKnowledgeItem(
  db: Db,
  id: string,
  input: KnowledgeContentInput,
): Promise<ApiKnowledgeItem> {
  if (!isUuid(id)) throw new KnowledgeError(404, 'knowledge_not_found', 'Unknown knowledge item');
  return db.transaction(async (tx) => {
    const current = await tx.query<KnowledgeRow>(
      `SELECT ${ITEM_COLUMNS} FROM knowledge_items WHERE knowledge_id = $1 FOR UPDATE`,
      [id],
    );
    const row = current.rows[0];
    if (!row) throw new KnowledgeError(404, 'knowledge_not_found', 'Unknown knowledge item');
    const content = validateKnowledgeContent(row.kind as KnowledgeKind, input);
    const next = Number(row.current_version) + 1;
    const updated = await tx.query<KnowledgeRow>(
      `UPDATE knowledge_items SET
         name = $2, category = $3, subcategory = $4, difficulty = $5, icon = $6,
         description = $7, metric_unit = $8, target_value = $9, target_type = $10,
         frequency = $11, points = $12, image_url = $13, tags = $14, details = $15,
         current_version = $16, updated_at = now()
       WHERE knowledge_id = $1
       RETURNING ${ITEM_COLUMNS}`,
      [id, ...contentParams(content), next],
    );
    await tx.query(
      `INSERT INTO knowledge_item_versions
         (item_id, version, name, category, subcategory, difficulty, icon,
          description, metric_unit, target_value, target_type, frequency,
          points, image_url, tags, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [id, next, ...contentParams(content)],
    );
    return mapKnowledgeRow(updated.rows[0]);
  });
}

const LIFECYCLE_TRANSITIONS: Record<KnowledgeLifecycle, KnowledgeLifecycle[]> = {
  draft: ['published', 'retired'],
  published: ['retired'],
  retired: [],
};

/**
 * Lifecycle-only transition. Forward-only (draft → published → retired);
 * never creates a content version and never touches knowledgeVersion.
 * Idempotent when the item already holds the target lifecycle.
 */
export async function setKnowledgeLifecycle(
  db: Db,
  id: string,
  target: KnowledgeLifecycle,
): Promise<ApiKnowledgeItem> {
  if (!isUuid(id)) throw new KnowledgeError(404, 'knowledge_not_found', 'Unknown knowledge item');
  if (target !== 'draft' && target !== 'published' && target !== 'retired') {
    throw new KnowledgeError(400, 'invalid_knowledge', `Invalid lifecycle: ${String(target)}`);
  }
  const current = await db.query<KnowledgeRow>(
    `SELECT ${ITEM_COLUMNS} FROM knowledge_items WHERE knowledge_id = $1`,
    [id],
  );
  const row = current.rows[0];
  if (!row) throw new KnowledgeError(404, 'knowledge_not_found', 'Unknown knowledge item');
  const from = row.lifecycle as KnowledgeLifecycle;
  if (from === target) return mapKnowledgeRow(row);
  if (!LIFECYCLE_TRANSITIONS[from].includes(target)) {
    throw new KnowledgeError(
      409,
      'invalid_lifecycle_transition',
      `Cannot move knowledge from ${from} to ${target}`,
    );
  }
  const updated = await db.query<KnowledgeRow>(
    `UPDATE knowledge_items SET lifecycle = $2, updated_at = now()
     WHERE knowledge_id = $1
     RETURNING ${ITEM_COLUMNS}`,
    [id, target],
  );
  return mapKnowledgeRow(updated.rows[0]);
}

export interface KnowledgeListQuery {
  kind?: KnowledgeKind;
  search?: string;
  lifecycle?: KnowledgeLifecycle;
}

/**
 * Runtime listing: ONLY published records, ordered by name (mirrors the
 * Firestore selectPublishedCatalog contract). Draft/retired items are never
 * offered for new challenge creation through this seam.
 */
export async function listPublishedKnowledge(
  db: Db,
  query: KnowledgeListQuery,
): Promise<ApiKnowledgeItem[]> {
  const conditions = [`lifecycle = 'published'`];
  const params: unknown[] = [];
  if (query.kind === 'fitness' || query.kind === 'wellness') {
    params.push(query.kind);
    conditions.push(`kind = $${params.length}`);
  }
  const search = (query.search ?? '').trim().slice(0, 100);
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(name ILIKE $${params.length} OR description ILIKE $${params.length})`);
  }
  const result = await db.query<KnowledgeRow>(
    `SELECT ${ITEM_COLUMNS} FROM knowledge_items
     WHERE ${conditions.join(' AND ')}
     ORDER BY name ASC
     LIMIT ${MAX_LIST_ROWS}`,
    params,
  );
  return result.rows.map(mapKnowledgeRow);
}

/** Admin listing: all lifecycle states, filterable by kind/lifecycle. */
export async function listKnowledgeForAdmin(
  db: Db,
  query: KnowledgeListQuery,
): Promise<ApiKnowledgeItem[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (query.kind === 'fitness' || query.kind === 'wellness') {
    params.push(query.kind);
    conditions.push(`kind = $${params.length}`);
  }
  if (
    query.lifecycle === 'draft' ||
    query.lifecycle === 'published' ||
    query.lifecycle === 'retired'
  ) {
    params.push(query.lifecycle);
    conditions.push(`lifecycle = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.query<KnowledgeRow>(
    `SELECT ${ITEM_COLUMNS} FROM knowledge_items
     ${where}
     ORDER BY name ASC
     LIMIT ${MAX_LIST_ROWS}`,
    params,
  );
  return result.rows.map(mapKnowledgeRow);
}

/**
 * By-UUID fetch. Unfiltered by lifecycle — like the Firestore by-ID reads,
 * historical challenges referencing retired items must stay resolvable.
 */
export async function getKnowledgeById(db: Db, id: string): Promise<ApiKnowledgeItem | null> {
  if (!isUuid(id)) return null;
  const result = await db.query<KnowledgeRow>(
    `SELECT ${ITEM_COLUMNS} FROM knowledge_items WHERE knowledge_id = $1`,
    [id],
  );
  const row = result.rows[0];
  return row ? mapKnowledgeRow(row) : null;
}

/**
 * Historical version lookup (verification/debugging). Content is historical;
 * `lifecycle` always reflects the item's CURRENT state.
 */
export async function getKnowledgeVersion(
  db: Db,
  id: string,
  version: number,
): Promise<ApiKnowledgeItem | null> {
  if (!isUuid(id) || !Number.isInteger(version) || version < 1) return null;
  const item = await db.query<KnowledgeRow>(
    `SELECT ${ITEM_COLUMNS} FROM knowledge_items WHERE knowledge_id = $1`,
    [id],
  );
  const current = item.rows[0];
  if (!current) return null;
  const versionRow = await db.query<KnowledgeRow>(
    `SELECT name, category, subcategory, difficulty, icon, description,
            metric_unit, target_value, target_type, frequency, points,
            image_url, tags, details
     FROM knowledge_item_versions
     WHERE item_id = $1 AND version = $2`,
    [id, version],
  );
  const historic = versionRow.rows[0];
  if (!historic) return null;
  return {
    ...mapKnowledgeRow({ ...current, ...historic, current_version: version }),
    lifecycle: current.lifecycle as KnowledgeLifecycle,
  };
}

export interface KnowledgeIdentityQuery {
  legacyIds: string[];
  uuids: string[];
}

function cleanIds(values: unknown): string[] {
  const raw = Array.isArray(values) ? values : values === undefined ? [] : [values];
  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    if (seen.size >= MAX_IDS_PER_REQUEST) break;
  }
  return [...seen];
}

export function parseKnowledgeIdentityQuery(query: unknown): KnowledgeIdentityQuery {
  const params = (query ?? {}) as Record<string, unknown>;
  return {
    legacyIds: cleanIds(params.legacyId ?? params.legacyIds),
    uuids: cleanIds(params.id ?? params.ids).filter((id) => isUuid(id)),
  };
}

interface IdentityRow {
  knowledge_id: string;
  kind: string;
  legacy_firestore_id: string | null;
}

/**
 * Bidirectional transitional lookup between Tiizi knowledge UUIDs and legacy
 * Firestore document ids. Read-only: resolving never creates UUIDs — UUIDs
 * are minted only by the knowledge importer on first sight of a legacy
 * entity, so repeated resolution is inherently stable.
 */
export async function resolveKnowledgeIdentity(
  db: Db,
  query: KnowledgeIdentityQuery,
): Promise<KnowledgeIdentityMapping[]> {
  const mappings = new Map<string, KnowledgeIdentityMapping>();
  if (query.legacyIds.length > 0) {
    const rows = await db.query<IdentityRow>(
      `SELECT knowledge_id, kind, legacy_firestore_id FROM knowledge_items
       WHERE legacy_firestore_id = ANY($1)`,
      [query.legacyIds],
    );
    for (const row of rows.rows) {
      if (!row.legacy_firestore_id) continue;
      mappings.set(row.legacy_firestore_id, {
        legacyId: row.legacy_firestore_id,
        id: String(row.knowledge_id),
        kind: row.kind as KnowledgeKind,
      });
    }
  }
  if (query.uuids.length > 0) {
    const rows = await db.query<IdentityRow>(
      `SELECT knowledge_id, kind, legacy_firestore_id FROM knowledge_items
       WHERE knowledge_id = ANY($1::uuid[])`,
      [query.uuids],
    );
    for (const row of rows.rows) {
      if (!row.legacy_firestore_id) continue;
      mappings.set(row.legacy_firestore_id, {
        legacyId: row.legacy_firestore_id,
        id: String(row.knowledge_id),
        kind: row.kind as KnowledgeKind,
      });
    }
  }
  return [...mappings.values()].sort((a, b) => a.legacyId.localeCompare(b.legacyId));
}

const knowledgeItemSchema = {
  type: 'object',
  required: ['id', 'kind', 'lifecycle', 'knowledgeVersion', 'name'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    kind: { type: 'string', enum: ['fitness', 'wellness'] },
    lifecycle: { type: 'string', enum: ['draft', 'published', 'retired'] },
    knowledgeVersion: { type: 'integer', minimum: 1 },
    name: { type: 'string' },
    category: { type: 'string' },
    subcategory: { type: 'string' },
    difficulty: { type: 'string' },
    icon: { type: 'string' },
    description: { type: 'string' },
    metricUnit: { type: 'string' },
    targetValue: { type: ['number', 'null'] },
    targetType: { type: 'string' },
    frequency: { type: 'string' },
    points: { type: 'integer', minimum: 0 },
    imageUrl: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    details: { type: 'object' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
};

const identityResponseSchema = {
  type: 'object',
  required: ['mappings'],
  properties: {
    mappings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['legacyId', 'id', 'kind'],
        properties: {
          legacyId: { type: 'string' },
          id: { type: 'string', format: 'uuid' },
          kind: { type: 'string', enum: ['fitness', 'wellness'] },
        },
      },
    },
  },
};

export function registerKnowledgeRoutes(app: FastifyInstance, db: Db): void {
  app.get('/v1/knowledge', {
    schema: {
      response: {
        200: {
          type: 'object',
          required: ['items'],
          properties: { items: { type: 'array', items: knowledgeItemSchema } },
        },
      },
    },
  }, async (request) => {
    const params = (request.query ?? {}) as Record<string, unknown>;
    const kind = params.kind === 'fitness' || params.kind === 'wellness' ? params.kind : undefined;
    const search = typeof params.search === 'string' ? params.search : undefined;
    return { items: await listPublishedKnowledge(db, { kind, search }) };
  });

  const notFoundSchema = {
    type: 'object',
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        required: ['code', 'message'],
        properties: { code: { type: 'string' }, message: { type: 'string' } },
      },
    },
  };

  app.get('/v1/knowledge/:id', {
    schema: { response: { 200: knowledgeItemSchema, 404: notFoundSchema } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = await getKnowledgeById(db, id);
    if (!item) {
      return reply.status(404).send({
        error: { code: 'knowledge_not_found', message: 'Unknown knowledge item' },
      });
    }
    return item;
  });

  app.get('/v1/knowledge/:id/versions/:version', {
    schema: { response: { 200: knowledgeItemSchema, 404: notFoundSchema } },
  }, async (request, reply) => {
    const { id, version } = request.params as { id: string; version: string };
    const item = await getKnowledgeVersion(db, id, Number(version));
    if (!item) {
      return reply.status(404).send({
        error: { code: 'knowledge_not_found', message: 'Unknown knowledge item or version' },
      });
    }
    return item;
  });

  app.get('/v1/compat/knowledge-ids', {
    schema: { response: { 200: identityResponseSchema } },
  }, async (request) => {
    const query = parseKnowledgeIdentityQuery(request.query);
    return { mappings: await resolveKnowledgeIdentity(db, query) };
  });

  app.get('/v1/admin/knowledge', {
    schema: {
      response: {
        200: {
          type: 'object',
          required: ['items'],
          properties: { items: { type: 'array', items: knowledgeItemSchema } },
        },
      },
    },
  }, async (request) => {
    await requireKnowledgeAdmin(db, authenticatedMember(request).memberId);
    const params = (request.query ?? {}) as Record<string, unknown>;
    const kind = params.kind === 'fitness' || params.kind === 'wellness' ? params.kind : undefined;
    const lifecycle = params.lifecycle === 'draft' || params.lifecycle === 'published' ||
        params.lifecycle === 'retired'
      ? params.lifecycle
      : undefined;
    return { items: await listKnowledgeForAdmin(db, { kind, lifecycle }) };
  });

  app.post('/v1/admin/knowledge', {
    schema: { response: { 201: knowledgeItemSchema } },
  }, async (request, reply) => {
    await requireKnowledgeAdmin(db, authenticatedMember(request).memberId);
    const item = await createKnowledgeItem(db, (request.body ?? {}) as CreateKnowledgeInput);
    return reply.status(201).send(item);
  });

  app.patch('/v1/admin/knowledge/:id', {
    schema: { response: { 200: knowledgeItemSchema } },
  }, async (request) => {
    await requireKnowledgeAdmin(db, authenticatedMember(request).memberId);
    const { id } = request.params as { id: string };
    return reviseKnowledgeItem(db, id, (request.body ?? {}) as KnowledgeContentInput);
  });

  app.post('/v1/admin/knowledge/:id/publish', {
    schema: { response: { 200: knowledgeItemSchema } },
  }, async (request) => {
    await requireKnowledgeAdmin(db, authenticatedMember(request).memberId);
    const { id } = request.params as { id: string };
    return setKnowledgeLifecycle(db, id, 'published');
  });

  app.post('/v1/admin/knowledge/:id/retire', {
    schema: { response: { 200: knowledgeItemSchema } },
  }, async (request) => {
    await requireKnowledgeAdmin(db, authenticatedMember(request).memberId);
    const { id } = request.params as { id: string };
    return setKnowledgeLifecycle(db, id, 'retired');
  });
}
