import type { Db } from './db.js';
import {
  deterministicKnowledgeId,
  normalizeLifecycle,
  normalizeVersion,
  type KnowledgeKind,
  type KnowledgeLifecycle,
} from './knowledge.js';

/**
 * Phase B read-only Firestore → PostgreSQL Knowledge importer.
 *
 * - dry-run reads Firestore and reports planned writes without touching PG;
 * - explicit apply writes transactionally and is idempotent (deterministic
 *   legacy Firestore ID → Tiizi UUID mapping + upserts);
 * - Firestore is READ ONLY here (get() calls only, never writes);
 * - missing lifecycle status normalizes to published; missing/invalid
 *   knowledgeVersion normalizes to 1 (same rules as the product read
 *   boundary in src/utils/knowledgeLifecycle.ts);
 * - records without a usable name are reported as malformed and skipped —
 *   never silently dropped, never fabricated;
 * - PostgreSQL wins ties: an existing item is only overwritten when the
 *   Firestore version is strictly newer, so API-side revisions are never
 *   regressed by a re-import;
 * - member role sync (Firestore users → members.role) reuses the existing
 *   Tiizi role vocabulary so API admin authorization reflects the same
 *   admins/moderators the Firestore rules already trust.
 */

export type KnowledgeSourceCollection = 'catalogExercises' | 'wellnessActivities';

export interface SourceKnowledgeItem {
  firestoreId: string;
  collection: KnowledgeSourceCollection;
  data: Record<string, unknown>;
}

export interface SourceUserRole {
  uid: string;
  role: string;
}

export interface KnowledgeSource {
  listKnowledge(): Promise<SourceKnowledgeItem[]>;
  listUserRoles(): Promise<SourceUserRole[]>;
}

export interface MalformedKnowledgeRecord {
  legacyId: string;
  collection: KnowledgeSourceCollection;
  reason: string;
}

export interface KnowledgeImportReport {
  dryRun: boolean;
  fitnessSeen: number;
  /** Absolute total after apply (mirrors shadow importer recount semantics). */
  fitnessWritten: number;
  wellnessSeen: number;
  /** Absolute total after apply (mirrors shadow importer recount semantics). */
  wellnessWritten: number;
  malformed: MalformedKnowledgeRecord[];
  rolesSeen: number;
  /** Member rows whose role was set by this run. */
  rolesWritten: number;
}

export interface NormalizedKnowledge {
  kind: KnowledgeKind;
  legacyId: string;
  legacyCollection: KnowledgeSourceCollection;
  knowledgeId: string;
  lifecycle: KnowledgeLifecycle;
  version: number;
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

const MEMBER_ROLES = new Set([
  'member',
  'support',
  'moderator',
  'content_manager',
  'admin',
  'super_admin',
]);

const LIFECYCLE_ORDER: KnowledgeLifecycle[] = ['draft', 'published', 'retired'];

/**
 * Forward-only lifecycle target for import synchronization, independent of
 * content version. Returns the Firestore lifecycle when it is a strict
 * forward move from the PostgreSQL lifecycle, else null (same state or a
 * regression such as retired → published, which must never be applied).
 */
export function forwardLifecycleTarget(
  current: KnowledgeLifecycle,
  incoming: KnowledgeLifecycle,
): KnowledgeLifecycle | null {
  if (current === incoming) return null;
  if (LIFECYCLE_ORDER.indexOf(incoming) > LIFECYCLE_ORDER.indexOf(current)) return incoming;
  return null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim());
}

function finiteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? (n as number) : null;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function pickDetails(
  data: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  const details: Record<string, unknown> = {};
  for (const key of keys) {
    if (data[key] !== undefined) details[key] = data[key];
  }
  return details;
}

const FITNESS_DETAIL_KEYS = [
  'musclesTargeted',
  'equipment',
  'trainingGoals',
  'setup',
  'execution',
  'breathing',
  'formCues',
  'commonMistakes',
  'progressions',
  'advancedVariations',
  'safetyNotes',
  'recommendedVolume',
  'movementType',
  'holdBased',
];

const WELLNESS_DETAIL_KEYS = [
  'shortName',
  'activityType',
  'suggestedFrequency',
  'protocolSteps',
  'fastingProtocol',
  'hydrationProtocol',
  'sleepProtocol',
  'benefits',
  'benefitsTimeline',
  'guidelines',
  'warnings',
  'contraindications',
  'bodyResponse',
  'bonusConditions',
  'popular',
  'medicalSupervisionRequired',
  'prerequisite',
];

/**
 * Normalizes one Firestore Knowledge document. Returns null with a reason
 * when the record is malformed (no usable name) — the caller reports it.
 * Import stores legacy scalar values verbatim (no vocabulary filtering), so
 * re-imports never lose data; the API vocabulary gates only NEW writes.
 */
export function normalizeKnowledgeRecord(
  item: SourceKnowledgeItem,
): { normalized?: NormalizedKnowledge; malformed?: string } {
  const data = item.data ?? {};
  const name = stringValue(data.name);
  if (!name) return { malformed: 'missing name' };
  const kind: KnowledgeKind = item.collection === 'catalogExercises' ? 'fitness' : 'wellness';

  const base = {
    kind,
    legacyId: item.firestoreId,
    legacyCollection: item.collection,
    knowledgeId: deterministicKnowledgeId(item.collection, item.firestoreId),
    lifecycle: normalizeLifecycle(data.lifecycleStatus),
    version: normalizeVersion(data.knowledgeVersion),
    name: name.slice(0, 200),
    tags: stringArray(data.tags),
  };

  if (kind === 'fitness') {
    const metric = objectValue(data.metric);
    const details = pickDetails(data, FITNESS_DETAIL_KEYS);
    const metricType = stringValue(metric?.type);
    if (metricType) details.metricType = metricType;
    return {
      normalized: {
        ...base,
        category: stringValue(data.tier_1).slice(0, 100),
        subcategory: stringValue(data.tier_2).slice(0, 100),
        difficulty: stringValue(data.difficulty).slice(0, 50),
        icon: '',
        description: stringValue(data.description).slice(0, 2000),
        metricUnit: stringValue(metric?.unit ?? metric?.type).slice(0, 50),
        targetValue: null,
        targetType: '',
        frequency: '',
        points: 0,
        imageUrl: stringValue(data.imageUrl).slice(0, 500),
        details,
      },
    };
  }

  const targetValue = finiteNumber(data.defaultTargetValue);
  const points = finiteNumber(data.defaultPoints);
  return {
    normalized: {
      ...base,
      category: stringValue(data.category).slice(0, 100),
      subcategory: '',
      difficulty: stringValue(data.difficulty).slice(0, 50),
      icon: stringValue(data.icon).slice(0, 100),
      description: stringValue(data.description).slice(0, 2000),
      metricUnit: stringValue(data.defaultMetricUnit).slice(0, 50),
      targetValue: targetValue !== null && targetValue >= 0 ? targetValue : null,
      targetType: stringValue(data.targetType).slice(0, 50),
      frequency: '',
      points: points !== null && points >= 0 ? Math.floor(points) : 0,
      imageUrl: stringValue(data.coverImage).slice(0, 500),
      details: pickDetails(data, WELLNESS_DETAIL_KEYS),
    },
  };
}

const ITEM_CONTENT_COLUMNS = `name, category, subcategory, difficulty, icon,
  description, metric_unit, target_value, target_type, frequency,
  points, image_url, tags, details`;

function contentValues(n: NormalizedKnowledge): unknown[] {
  return [
    n.name,
    n.category,
    n.subcategory,
    n.difficulty,
    n.icon,
    n.description,
    n.metricUnit,
    n.targetValue,
    n.targetType,
    n.frequency,
    n.points,
    n.imageUrl,
    n.tags,
    JSON.stringify(n.details),
  ];
}

export async function runKnowledgeImport(
  db: Db,
  source: KnowledgeSource,
  options: { dryRun: boolean },
): Promise<KnowledgeImportReport> {
  const [items, userRoles] = await Promise.all([
    source.listKnowledge(),
    source.listUserRoles(),
  ]);

  const normalized: NormalizedKnowledge[] = [];
  const malformed: MalformedKnowledgeRecord[] = [];
  let fitnessSeen = 0;
  let wellnessSeen = 0;
  for (const item of items) {
    if (item.collection === 'catalogExercises') fitnessSeen += 1;
    else wellnessSeen += 1;
    const result = normalizeKnowledgeRecord(item);
    if (result.normalized) normalized.push(result.normalized);
    else {
      malformed.push({
        legacyId: item.firestoreId,
        collection: item.collection,
        reason: result.malformed ?? 'malformed record',
      });
    }
  }

  const validRoles = userRoles.filter((entry) => entry.uid.trim().length > 0);

  const report: KnowledgeImportReport = {
    dryRun: options.dryRun,
    fitnessSeen,
    fitnessWritten: 0,
    wellnessSeen,
    wellnessWritten: 0,
    malformed,
    rolesSeen: validRoles.length,
    rolesWritten: 0,
  };

  if (options.dryRun) return report;

  await db.transaction(async (tx) => {
    for (const n of normalized) {
      const existing = await tx.query<{
        knowledge_id: string;
        current_version: number;
        lifecycle: string;
      }>(
        `SELECT knowledge_id, current_version, lifecycle FROM knowledge_items
         WHERE legacy_firestore_id = $1`,
        [n.legacyId],
      );
      const row = existing.rows[0];
      if (!row) {
        // Legacy Firestore carries predate the KCS gate: they enter as
        // grandfathered published records (PKG-2A compat rule), never as
        // gate-subject drafts.
        await tx.query(
          `INSERT INTO knowledge_items
             (knowledge_id, kind, legacy_firestore_id, legacy_collection,
              lifecycle, current_version, grandfathered, ${ITEM_CONTENT_COLUMNS})
           VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8, $9, $10, $11, $12, $13,
                   $14, $15, $16, $17, $18, $19, $20)`,
          [n.knowledgeId, n.kind, n.legacyId, n.legacyCollection, n.lifecycle, n.version,
            ...contentValues(n)],
        );
        await tx.query(
          `INSERT INTO knowledge_item_versions
             (item_id, version, ${ITEM_CONTENT_COLUMNS})
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [n.knowledgeId, n.version, ...contentValues(n)],
        );
        continue;
      }
      // PostgreSQL wins content ties: only a strictly newer Firestore version
      // moves current content forward. Equal versions keep API-side content
      // (the version row already exists from the API write path).
      // Lifecycle sync is INDEPENDENT of version: a safe forward lifecycle
      // move (draft → published → retired) is applied even when versions are
      // equal, without touching current_version, content, or history.
      const currentLifecycle = normalizeLifecycle(row.lifecycle);
      const lifecycleMove = forwardLifecycleTarget(currentLifecycle, n.lifecycle);
      if (n.version > Number(row.current_version)) {
        await tx.query(
          `UPDATE knowledge_items SET
             lifecycle = $2, current_version = $3, name = $4, category = $5,
             subcategory = $6, difficulty = $7, icon = $8, description = $9,
             metric_unit = $10, target_value = $11, target_type = $12,
             frequency = $13, points = $14, image_url = $15, tags = $16,
             details = $17, updated_at = now()
           WHERE knowledge_id = $1`,
          [row.knowledge_id, lifecycleMove ?? currentLifecycle, n.version, ...contentValues(n)],
        );
        await tx.query(
          `INSERT INTO knowledge_item_versions
             (item_id, version, ${ITEM_CONTENT_COLUMNS})
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           ON CONFLICT (item_id, version) DO NOTHING`,
          [row.knowledge_id, n.version, ...contentValues(n)],
        );
      } else if (lifecycleMove) {
        await tx.query(
          `UPDATE knowledge_items SET lifecycle = $2, updated_at = now()
           WHERE knowledge_id = $1`,
          [row.knowledge_id, lifecycleMove],
        );
      } else {
        await tx.query(
          `INSERT INTO knowledge_item_versions
             (item_id, version, ${ITEM_CONTENT_COLUMNS})
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           ON CONFLICT (item_id, version) DO NOTHING`,
          [row.knowledge_id, n.version, ...contentValues(n)],
        );
      }
    }

    let rolesWritten = 0;
    for (const entry of validRoles) {
      const role = MEMBER_ROLES.has(entry.role) ? entry.role : 'member';
      await tx.query(
        `INSERT INTO members (auth_provider, auth_subject, role)
         VALUES ('firebase', $1, $2)
         ON CONFLICT (auth_provider, auth_subject) DO UPDATE SET
           role = EXCLUDED.role,
           updated_at = now()`,
        [entry.uid, role],
      );
      rolesWritten += 1;
    }
    report.rolesWritten = rolesWritten;
  });

  const fitnessCounts = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM knowledge_items
     WHERE kind = 'fitness' AND legacy_firestore_id IS NOT NULL`,
  );
  report.fitnessWritten = Number(fitnessCounts.rows[0].count);
  const wellnessCounts = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM knowledge_items
     WHERE kind = 'wellness' AND legacy_firestore_id IS NOT NULL`,
  );
  report.wellnessWritten = Number(wellnessCounts.rows[0].count);
  return report;
}

/** Production Firestore reader. Read-only: get() calls only, never writes. */
export function createAdminKnowledgeSource(): KnowledgeSource {
  return {
    async listKnowledge(): Promise<SourceKnowledgeItem[]> {
      const { getFirestore } = await import('firebase-admin/firestore');
      const fs = getFirestore();
      const [fitness, wellness] = await Promise.all([
        fs.collection('catalogExercises').get(),
        fs.collection('wellnessActivities').get(),
      ]);
      return [
        ...fitness.docs.map((d) => ({
          firestoreId: d.id,
          collection: 'catalogExercises' as const,
          data: d.data() as Record<string, unknown>,
        })),
        ...wellness.docs.map((d) => ({
          firestoreId: d.id,
          collection: 'wellnessActivities' as const,
          data: d.data() as Record<string, unknown>,
        })),
      ];
    },
    async listUserRoles(): Promise<SourceUserRole[]> {
      const { getFirestore } = await import('firebase-admin/firestore');
      const snap = await getFirestore().collection('users').get();
      return snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        const uid = typeof data.uid === 'string' && data.uid.trim() ? data.uid : d.id;
        return {
          uid,
          role: typeof data.role === 'string' ? data.role : 'member',
        };
      });
    },
  };
}
