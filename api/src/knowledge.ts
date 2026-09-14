import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { isCanonicalMetric, metricForUnit } from './measurementVocabulary.js';
import {
  normalizeComponentSpecs,
  normalizeLoadReportingBases,
  snapshotVersionComponents,
  type ActivityComponentSpec,
} from './activityComponents.js';
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
 *
 * PF-01 canonical V2 Activity Product Contract: UUID identity is joined by
 * a governed immutable Tiizi Activity Code (`activity_code`, format
 * AAA-AAA-000, e.g. FIT-STR-001). Display names are localizable content and
 * never identity. New V2 product contracts resolve by UUID/code; legacy
 * exact-name resolution is quarantined for historical compatibility
 * (knowledgePins.resolveKnowledgePinByName,
 * knowledgeEligibility name resolver) and must not be used by PF-01
 * contracts. Publication readiness (KCS content satisfied) and Challenge
 * eligibility (published + ready + governed Metric/Unit contract) are
 * evaluated server-side and exposed separately on every item.
 *
 * PKG-2A note: this module is Tiizi Core Engine capability (Canonical
 * Activity / Knowledge authority + KCS publication contract). It does not by
 * itself authorize PKG-1 sequencing or any participant experience.
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

/**
 * PF-01 governed Tiizi Activity Code format.
 *
 * Format: AAA-AAA-000 — three uppercase ASCII letters, dash, three
 * uppercase ASCII letters, dash, three digits (e.g. FIT-STR-001 Push-Up,
 * WEL-MND-003 Breathing Practice). Properties (Founder PF-01 §1):
 * - immutable after creation (database trigger + application gate);
 * - unique (database UNIQUE constraint);
 * - language-independent (never localized; translations attach to the UUID);
 * - human-readable enough for product/editorial references.
 *
 * The middle segment is a stable mnemonic captured at creation time from
 * the approved 118-Activity baseline families (STR, MND, ...). It is NOT a
 * live classification pointer: recategorising an Activity never changes its
 * code, so the format encodes no mutable classification assumption. New
 * codes are allocated from the governed baseline families; PF-01 allocates
 * exactly two (FIT-STR-001, WEL-MND-003) and invents no catalogue.
 */
export const ACTIVITY_CODE_FORMAT = 'AAA-AAA-000';

const ACTIVITY_CODE_RE = /^[A-Z]{3}-[A-Z]{3}-[0-9]{3}$/;

/** True when the value is a well-formed governed Activity Code. */
export function isActivityCode(value: unknown): value is string {
  return typeof value === 'string' && ACTIVITY_CODE_RE.test(value);
}

/**
 * Parses an Activity Code from creation input. Omission (undefined/null/'')
 * yields null (quarantined legacy row — permitted so V1 history is never
 * rewritten). Anything else must match the governed format exactly: no case
 * folding, no slug/name coercion — malformed codes reject fail-closed.
 */
export function parseActivityCode(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new KnowledgeError(400, 'invalid_knowledge', 'activityCode must be a string');
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!ACTIVITY_CODE_RE.test(trimmed)) {
    throw new KnowledgeError(
      400,
      'invalid_knowledge',
      `Invalid activityCode '${trimmed}': governed format is ${ACTIVITY_CODE_FORMAT} (e.g. FIT-STR-001)`,
    );
  }
  return trimmed;
}

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
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
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
  /**
   * PF-01 dual identity: UUID `id` is the authoritative internal PK/FK;
   * `activityCode` is the stable product/API/editorial identifier. NULL
   * marks quarantined pre-PF-01 rows (never rewritten by migration).
   */
  activityCode: string | null;
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
  contentClasses: KcsClass[];
  defaultLocale: string;
  grandfathered: boolean;
  /**
   * EBC-01 governed measurement contract: permitted primary/secondary
   * Metrics and compatible Units for this canonical Activity. Empty by
   * default (nothing permitted): legacy/grandfathered records gain no
   * contract implicitly. Declared through governed Knowledge
   * administration; consumed by Challenge establishment validation and by
   * future creation UI querying valid options.
   */
  primaryMetrics: string[];
  secondaryMetrics: string[];
  compatibleUnits: string[];
  /**
   * PF-02-CORR-001: governed Load Reporting Bases this Activity supports
   * for its Weight configurations (empty when no load semantics declared).
   * Server-owned, versioned with the product contract.
   */
  loadReportingBases: string[];
  measurementGuidance: string;
  unitSemantics: string;
  setup: string;
  execution: string;
  techniqueReference: string;
  formCues: string[];
  commonMistakes: string[];
  equipment: string;
  environment: string;
  adaptation: string;
  protocolSteps: unknown[];
  sessionFraming: string;
  completionMeaning: string;
  avoidanceCondition: string;
  semanticDefinition: string;
  safetyNotes: string[];
  /**
   * PF-01 product contract (server-owned, derived — never client-set):
   * - publicationReady: current content satisfies the KCS minima for its
   *   applicable classes (assessPublicationReadiness is empty). A pure
   *   content property, independent of lifecycle.
   * - challengeEligible: published AND publication-ready AND carrying a
   *   valid governed Metric/Unit contract. Invalid configuration fails
   *   closed (eligible is false with machine-readable issues).
   * The two states are deliberately distinct: a published item without a
   * governed measurement contract is catalogue-visible but NOT eligible.
   */
  publicationReady: boolean;
  publicationIssues: KcsReadinessIssue[];
  challengeEligible: boolean;
  challengeEligibilityIssues: ChallengeEligibilityIssue[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeContentInput {
  name?: unknown;
  /** PF-01: revisions must never change the code; a differing code rejects. */
  activityCode?: unknown;
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
  contentClasses?: unknown;
  defaultLocale?: unknown;
  measurementGuidance?: unknown;
  unitSemantics?: unknown;
  setup?: unknown;
  execution?: unknown;
  techniqueReference?: unknown;
  formCues?: unknown;
  commonMistakes?: unknown;
  equipment?: unknown;
  environment?: unknown;
  adaptation?: unknown;
  protocolSteps?: unknown;
  sessionFraming?: unknown;
  completionMeaning?: unknown;
  avoidanceCondition?: unknown;
  semanticDefinition?: unknown;
  safetyNotes?: unknown;
}

export interface CreateKnowledgeInput extends KnowledgeContentInput {
  kind?: unknown;
  lifecycle?: unknown;
  /**
   * PF-02: optional governed Component specs for the new Activity.
   * Absent/undefined means an ordinary non-component Activity (the PF-01
   * path, unchanged). Provided specs are validated exactly like
   * setActivityComponents and snapshotted into version 1.
   */
  components?: unknown;
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
 * PF-01 V2 governed taxonomy (Founder-approved 118-Activity working
 * baseline, EKG-01 §5). Six Fitness + six Wellness categories. This is the
 * ONLY taxonomy the new V2 product path accepts — do not redesign it here.
 */
export const V2_FITNESS_CATEGORIES = [
  'Strength',
  'Cardio & Conditioning',
  'Mobility & Flexibility',
  'Balance & Stability',
  'Power, Speed & Agility',
  'Sports & Recreation',
] as const;

export const V2_WELLNESS_CATEGORIES = [
  'Sleep & Rest',
  'Mind & Emotional Wellbeing',
  'Nutrition & Hydration',
  'Daily Living',
  'Personal Growth',
  'Social Wellbeing',
] as const;

const V2_FITNESS_CATEGORY_SET = new Set<string>(V2_FITNESS_CATEGORIES);
const V2_WELLNESS_CATEGORY_SET = new Set<string>(V2_WELLNESS_CATEGORIES);

/**
 * Legacy pre-V2 category vocabularies — QUARANTINED for historical
 * compatibility. Rows created without an Activity Code (pre-PF-01 data,
 * legacy import path, existing tests) keep validating against these sets so
 * history is never rewritten. The governed V2 path (creation WITH an
 * Activity Code, and every revision of a coded item) rejects every value
 * below that is not also a V2 category.
 */
const LEGACY_FITNESS_CATEGORIES = new Set(['Core', 'Upper Body', 'Lower Body', 'Full Body']);
const LEGACY_FITNESS_SUBCATEGORIES = new Set(['Strength', 'Cardio', 'Balance', 'Mobility', 'Power']);
const LEGACY_FITNESS_DIFFICULTIES = new Set(['Beginner', 'Intermediate', 'Advanced']);
const LEGACY_WELLNESS_CATEGORIES = new Set([
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
const LEGACY_WELLNESS_DIFFICULTIES = new Set(['beginner', 'intermediate', 'advanced', 'expert']);

const FITNESS_CATEGORIES = LEGACY_FITNESS_CATEGORIES;
const FITNESS_SUBCATEGORIES = LEGACY_FITNESS_SUBCATEGORIES;
const FITNESS_DIFFICULTIES = LEGACY_FITNESS_DIFFICULTIES;
const WELLNESS_CATEGORIES = LEGACY_WELLNESS_CATEGORIES;
const WELLNESS_DIFFICULTIES = LEGACY_WELLNESS_DIFFICULTIES;

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

/**
 * PKG-2A — KCS content classes (Stage F Knowledge Content Specification).
 * Classes compose; the publication minimum is the UNION of all applicable
 * class requirements. U applies to every Activity. S is automatic for
 * fitness kinds (physical by default, KCS §3.7).
 */
export type KcsClass = 'U' | 'Q' | 'T' | 'P' | 'C' | 'M' | 'S';

export const KCS_CLASSES: KcsClass[] = ['U', 'Q', 'T', 'P', 'C', 'M', 'S'];
const KCS_CLASS_SET = new Set<string>(KCS_CLASSES);

/**
 * PKG-2A-CORR fail-closed class parsing. Omission (undefined/null) yields no
 * declared classes; duplicates normalize deterministically. Anything else
 * malformed — unknown letters, non-string entries, non-array values —
 * rejects with 400 invalid_knowledge so client input can never silently
 * weaken the effective KCS gate. Database rows already satisfy the CHECK
 * constraint, so row mapping through this function is safe.
 */
export function parseContentClasses(value: unknown): KcsClass[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new KnowledgeError(400, 'invalid_knowledge', 'contentClasses must be an array');
  }
  const out: KcsClass[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !KCS_CLASS_SET.has(entry)) {
      throw new KnowledgeError(
        400,
        'invalid_knowledge',
        `Unknown content class: ${String(entry)} (valid: U Q T P C M S)`,
      );
    }
    if (!out.includes(entry as KcsClass)) out.push(entry as KcsClass);
  }
  return out;
}

/** Declared classes plus automatic memberships. U always applies. */
export function effectiveContentClasses(kind: KnowledgeKind, declared: KcsClass[]): Set<KcsClass> {
  const effective = new Set<KcsClass>(['U', ...declared]);
  if (kind === 'fitness') effective.add('S');
  return effective;
}

export interface KcsReadinessIssue {
  field: string;
  class: KcsClass;
  reason: string;
}

export interface KcsContentSnapshot {
  name: string;
  description: string;
  category: string;
  metricUnit: string;
  measurementGuidance: string;
  unitSemantics: string;
  setup: string;
  execution: string;
  techniqueReference: string;
  formCues: string[];
  commonMistakes: string[];
  equipment: string;
  environment: string;
  adaptation: string;
  protocolSteps: unknown;
  sessionFraming: string;
  completionMeaning: string;
  avoidanceCondition: string;
  semanticDefinition: string;
  safetyNotes: string[];
}

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function nonEmptyList(value: string[]): boolean {
  return value.some((entry) => entry.trim().length > 0);
}

function validProtocolSteps(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every((entry) => {
    if (typeof entry === 'string') return entry.trim().length > 0 && entry.length <= 500;
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const text = (entry as Record<string, unknown>).text;
      const title = (entry as Record<string, unknown>).title;
      return typeof text === 'string' && text.trim().length > 0 && text.length <= 1000 &&
        (title === undefined || (typeof title === 'string' && title.length <= 200));
    }
    return false;
  });
}

export function asProtocolSteps(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value;
}

/**
 * Server-owned KCS publication readiness assessment (KRC §6.2, T2 FR-V2-213).
 * Pure function over kind + effective classes + content snapshot. Returns
 * every unmet minimum; empty means publishable. Never invents clinical
 * content — absence is reported, not filled.
 */
export function assessPublicationReadiness(
  kind: KnowledgeKind,
  declared: KcsClass[],
  content: KcsContentSnapshot,
): KcsReadinessIssue[] {
  const issues: KcsReadinessIssue[] = [];
  const effective = effectiveContentClasses(kind, declared);
  const require = (ok: boolean, field: string, cls: KcsClass, reason: string) => {
    if (!ok) issues.push({ field, class: cls, reason });
  };

  // U — Universal.
  require(nonEmpty(content.name), 'name', 'U', 'display title is required');
  require(nonEmpty(content.description), 'description', 'U', 'authoritative description is required');
  require(nonEmpty(content.category), 'category', 'U', 'governed category reference is required');
  require(nonEmpty(content.metricUnit), 'metricUnit', 'U', 'compatible unit is required');
  require(
    nonEmpty(content.measurementGuidance),
    'measurementGuidance',
    'U',
    'measurement/reporting guidance is required',
  );

  // Q — Quantitative.
  if (effective.has('Q')) {
    require(
      nonEmpty(content.unitSemantics),
      'unitSemantics',
      'Q',
      'governed unit semantics are required for measured activities',
    );
  }

  // T — Technique-dependent fitness.
  if (effective.has('T')) {
    require(nonEmpty(content.setup), 'setup', 'T', 'setup guidance is required');
    require(nonEmpty(content.execution), 'execution', 'T', 'execution guidance is required');
    require(
      nonEmptyList(content.formCues) || nonEmptyList(content.commonMistakes) ||
        nonEmpty(content.techniqueReference),
      'formCues',
      'T',
      'form cues, common mistakes, or a governed technique reference is required',
    );
    require(
      nonEmpty(content.adaptation),
      'adaptation',
      'T',
      'adaptation/difficulty pointer is required',
    );
  }

  // P — Protocol/practice wellness.
  if (effective.has('P')) {
    require(
      validProtocolSteps(content.protocolSteps),
      'protocolSteps',
      'P',
      'non-empty protocol steps are required',
    );
  }

  // C — Completion/self-attested.
  if (effective.has('C')) {
    require(
      nonEmpty(content.completionMeaning),
      'completionMeaning',
      'C',
      'completion meaning (what counts as Done) is required',
    );
  }

  // M — Meaning-sensitive.
  if (effective.has('M')) {
    require(
      nonEmpty(content.semanticDefinition),
      'semanticDefinition',
      'M',
      'governed semantic definition is required before publishing with the dependent meaning',
    );
  }

  // S — Safety-sensitive.
  if (effective.has('S')) {
    require(
      nonEmptyList(content.safetyNotes),
      'safetyNotes',
      'S',
      'supported caution/safety content is required',
    );
  }

  return issues;
}

/**
 * Bounded locale subset (documented contract, PKG-2A-CORR §6 option B — not
 * full BCP 47): two-letter lowercase language (`en`, `fr`) with an optional
 * two-letter uppercase region (`fr-FR`, `sw-KE`). Longer BCP 47 tags
 * (script/extended variants) are rejected until a governed need exists.
 * Not coupled to any fixed language set.
 */
const LOCALE_RE = /^[a-z]{2}(-[A-Z]{2})?$/;

export function validateLocale(value: unknown): string {
  if (typeof value !== 'string' || !LOCALE_RE.test(value)) {
    throw new KnowledgeError(400, 'invalid_knowledge', `Invalid locale identifier: ${String(value)}`);
  }
  return value;
}

/** Source locale for canonical member-facing text stored in base columns. */
export const DEFAULT_SOURCE_LOCALE = 'en';

/** Member-facing scalar text fields supporting locale overrides. */
export const LOCALIZABLE_TEXT_FIELDS = new Set([
  'name',
  'description',
  'measurementGuidance',
  'unitSemantics',
  'setup',
  'execution',
  'techniqueReference',
  'equipment',
  'environment',
  'adaptation',
  'sessionFraming',
  'completionMeaning',
  'avoidanceCondition',
  'semanticDefinition',
]);

/** Member-facing string-list fields supporting locale overrides (JSON array values). */
export const LOCALIZABLE_ARRAY_FIELDS = new Set([
  'formCues',
  'commonMistakes',
  'safetyNotes',
]);

export function isLocalizableField(field: string): boolean {
  return LOCALIZABLE_TEXT_FIELDS.has(field) || LOCALIZABLE_ARRAY_FIELDS.has(field);
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
  contentClasses: KcsClass[];
  defaultLocale: string;
  measurementGuidance: string;
  unitSemantics: string;
  setup: string;
  execution: string;
  techniqueReference: string;
  formCues: string[];
  commonMistakes: string[];
  equipment: string;
  environment: string;
  adaptation: string;
  protocolSteps: unknown[];
  sessionFraming: string;
  completionMeaning: string;
  avoidanceCondition: string;
  semanticDefinition: string;
  safetyNotes: string[];
}

/**
 * Full-content validation shared by create and content revision. Revisions
 * require the same complete, valid content as creation — partial merges would
 * let callers blank out canonical fields by omission.
 *
 * PF-01 dual path: `v2Governed` selects the governed V2 product contract.
 * - true (creation WITH an Activity Code, or revision of a coded item):
 *   category MUST be one of the approved V2 six+six; legacy V1 categories
 *   reject fail-closed. Subcategory is free editorial refinement text (the
 *   baseline sub-families are not a second governed taxonomy in PF-01).
 * - false (quarantined legacy path): the pre-V2 vocabularies keep applying
 *   so V1 history and the legacy import path are never rewritten.
 */
export function validateKnowledgeContent(
  kind: KnowledgeKind,
  input: KnowledgeContentInput,
  v2Governed = false,
): ValidatedKnowledgeContent {
  const name = asTrimmed(input.name, 200);
  if (!name) throw new KnowledgeError(400, 'invalid_knowledge', 'name is required');
  const category = asTrimmed(input.category, 100);
  const subcategory = asTrimmed(input.subcategory, 100);
  const difficulty = asTrimmed(input.difficulty, 50);
  const metricUnit = asTrimmed(input.metricUnit, 50);
  if (!metricUnit) throw new KnowledgeError(400, 'invalid_knowledge', 'metricUnit is required');

  if (v2Governed) {
    if (kind === 'fitness') {
      if (!V2_FITNESS_CATEGORY_SET.has(category)) {
        throw new KnowledgeError(
          400,
          'invalid_knowledge',
          `Invalid fitness category: ${category} (V2 governed categories: ${V2_FITNESS_CATEGORIES.join(' | ')})`,
        );
      }
      if (!FITNESS_DIFFICULTIES.has(difficulty)) {
        throw new KnowledgeError(400, 'invalid_knowledge', `Invalid fitness difficulty: ${difficulty}`);
      }
    } else {
      if (!V2_WELLNESS_CATEGORY_SET.has(category)) {
        throw new KnowledgeError(
          400,
          'invalid_knowledge',
          `Invalid wellness category: ${category} (V2 governed categories: ${V2_WELLNESS_CATEGORIES.join(' | ')})`,
        );
      }
      if (!WELLNESS_DIFFICULTIES.has(difficulty)) {
        throw new KnowledgeError(400, 'invalid_knowledge', `Invalid wellness difficulty: ${difficulty}`);
      }
    }
  } else if (kind === 'fitness') {
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

  if (input.protocolSteps !== undefined && !Array.isArray(input.protocolSteps)) {
    throw new KnowledgeError(400, 'invalid_knowledge', 'protocolSteps must be an array');
  }
  const protocolSteps = asProtocolSteps(input.protocolSteps);
  if (input.protocolSteps !== undefined && protocolSteps.length > 0 && !validProtocolSteps(protocolSteps)) {
    throw new KnowledgeError(
      400,
      'invalid_knowledge',
      'protocolSteps entries must be non-empty strings or {title?, text} objects',
    );
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
    contentClasses: parseContentClasses(input.contentClasses),
    defaultLocale: input.defaultLocale === undefined || input.defaultLocale === null
      ? DEFAULT_SOURCE_LOCALE
      : validateLocale(input.defaultLocale),
    measurementGuidance: asTrimmed(input.measurementGuidance, 2000),
    unitSemantics: asTrimmed(input.unitSemantics, 2000),
    setup: asTrimmed(input.setup, 2000),
    execution: asTrimmed(input.execution, 2000),
    techniqueReference: asTrimmed(input.techniqueReference, 500),
    formCues: asStringArray(input.formCues),
    commonMistakes: asStringArray(input.commonMistakes),
    equipment: asTrimmed(input.equipment, 1000),
    environment: asTrimmed(input.environment, 1000),
    adaptation: asTrimmed(input.adaptation, 2000),
    protocolSteps,
    sessionFraming: asTrimmed(input.sessionFraming, 2000),
    completionMeaning: asTrimmed(input.completionMeaning, 2000),
    avoidanceCondition: asTrimmed(input.avoidanceCondition, 2000),
    semanticDefinition: asTrimmed(input.semanticDefinition, 2000),
    safetyNotes: asStringArray(input.safetyNotes),
  };
}

interface KnowledgeRow {
  knowledge_id: string;
  activity_code: string | null;
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
  content_classes: string[] | string | null;
  default_locale: string | null;
  grandfathered: boolean | null;
  primary_metrics: string[] | string | null;
  secondary_metrics: string[] | string | null;
  compatible_units: string[] | string | null;
  load_reporting_bases: string[] | string | null;
  measurement_guidance: string | null;
  unit_semantics: string | null;
  setup: string | null;
  execution: string | null;
  technique_reference: string | null;
  form_cues: string[] | string | null;
  common_mistakes: string[] | string | null;
  equipment: string | null;
  environment: string | null;
  adaptation: string | null;
  protocol_steps: unknown[] | string | null;
  session_framing: string | null;
  completion_meaning: string | null;
  avoidance_condition: string | null;
  semantic_definition: string | null;
  safety_notes: string[] | string | null;
  created_at: string;
  updated_at: string;
}

function parseStringList(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value.map((t) => String(t));
  return [];
}

function parseProtocolSteps(value: unknown[] | string | null | undefined): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall through to empty steps.
    }
  }
  return [];
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
  const kind = row.kind as KnowledgeKind;
  const declared = parseContentClasses(row.content_classes);
  const snapshot: KcsContentSnapshot = {
    name: row.name,
    description: row.description ?? '',
    category: row.category ?? '',
    metricUnit: row.metric_unit ?? '',
    measurementGuidance: row.measurement_guidance ?? '',
    unitSemantics: row.unit_semantics ?? '',
    setup: row.setup ?? '',
    execution: row.execution ?? '',
    techniqueReference: row.technique_reference ?? '',
    formCues: parseStringList(row.form_cues),
    commonMistakes: parseStringList(row.common_mistakes),
    equipment: row.equipment ?? '',
    environment: row.environment ?? '',
    adaptation: row.adaptation ?? '',
    protocolSteps: parseProtocolSteps(row.protocol_steps),
    sessionFraming: row.session_framing ?? '',
    completionMeaning: row.completion_meaning ?? '',
    avoidanceCondition: row.avoidance_condition ?? '',
    semanticDefinition: row.semantic_definition ?? '',
    safetyNotes: parseStringList(row.safety_notes),
  };
  const publicationIssues = assessPublicationReadiness(kind, declared, snapshot);
  const challengeEligibilityIssues = assessChallengeEligibility({
    lifecycle: row.lifecycle,
    kind,
    declared,
    snapshot,
    primaryMetrics: parseStringList(row.primary_metrics),
    secondaryMetrics: parseStringList(row.secondary_metrics),
    compatibleUnits: parseStringList(row.compatible_units),
  });
  return {
    id: String(row.knowledge_id),
    activityCode: row.activity_code ?? null,
    kind,
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
    contentClasses: parseContentClasses(row.content_classes),
    defaultLocale: typeof row.default_locale === 'string' && row.default_locale
      ? row.default_locale
      : DEFAULT_SOURCE_LOCALE,
    grandfathered: row.grandfathered === true,
    primaryMetrics: parseStringList(row.primary_metrics),
    secondaryMetrics: parseStringList(row.secondary_metrics),
    compatibleUnits: parseStringList(row.compatible_units),
    loadReportingBases: parseStringList(row.load_reporting_bases),
    measurementGuidance: row.measurement_guidance ?? '',
    unitSemantics: row.unit_semantics ?? '',
    setup: row.setup ?? '',
    execution: row.execution ?? '',
    techniqueReference: row.technique_reference ?? '',
    formCues: parseStringList(row.form_cues),
    commonMistakes: parseStringList(row.common_mistakes),
    equipment: row.equipment ?? '',
    environment: row.environment ?? '',
    adaptation: row.adaptation ?? '',
    protocolSteps: parseProtocolSteps(row.protocol_steps),
    sessionFraming: row.session_framing ?? '',
    completionMeaning: row.completion_meaning ?? '',
    avoidanceCondition: row.avoidance_condition ?? '',
    semanticDefinition: row.semantic_definition ?? '',
    safetyNotes: parseStringList(row.safety_notes),
    publicationReady: publicationIssues.length === 0,
    publicationIssues,
    challengeEligible: challengeEligibilityIssues.length === 0,
    challengeEligibilityIssues,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

const ITEM_COLUMNS = `knowledge_id, activity_code, kind, lifecycle, current_version, name, category,
  subcategory, difficulty, icon, description, metric_unit, target_value,
  target_type, frequency, points, image_url, tags, details, content_classes,
  default_locale, grandfathered, primary_metrics, secondary_metrics,
  compatible_units, measurement_guidance, unit_semantics, setup,
  execution, technique_reference, form_cues, common_mistakes, equipment,
  environment, adaptation, protocol_steps, session_framing, completion_meaning,
  avoidance_condition, semantic_definition, safety_notes, load_reporting_bases, created_at, updated_at`;

/**
 * Content columns mirrored into knowledge_item_versions. content_classes is
 * included (PKG-2A-CORR §7) so a historical version shows the class set that
 * governed it; locale/default-locale/grandfathered remain current-state item
 * attributes. Historical intelligibility of member-facing text is additionally
 * carried by challenge snapshots.
 */
const VERSION_CONTENT_COLUMNS = `name, category, subcategory, difficulty, icon,
  description, metric_unit, target_value, target_type, frequency, points,
  image_url, tags, details, measurement_guidance, unit_semantics, setup,
  execution, technique_reference, form_cues, common_mistakes, equipment,
  environment, adaptation, protocol_steps, session_framing, completion_meaning,
  avoidance_condition, semantic_definition, safety_notes, content_classes,
  primary_metrics, secondary_metrics, compatible_units, load_reporting_bases`;

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

/** PKG-2A content columns appended after the legacy content params. */
function kcsContentParams(content: ValidatedKnowledgeContent): unknown[] {
  return [
    content.contentClasses,
    content.defaultLocale,
    false,
    content.measurementGuidance,
    content.unitSemantics,
    content.setup,
    content.execution,
    content.techniqueReference,
    content.formCues,
    content.commonMistakes,
    content.equipment,
    content.environment,
    content.adaptation,
    JSON.stringify(content.protocolSteps),
    content.sessionFraming,
    content.completionMeaning,
    content.avoidanceCondition,
    content.semanticDefinition,
    content.safetyNotes,
  ];
}

const KCS_ITEM_COLUMNS = `content_classes, default_locale, grandfathered,
  measurement_guidance, unit_semantics, setup, execution, technique_reference,
  form_cues, common_mistakes, equipment, environment, adaptation,
  protocol_steps, session_framing, completion_meaning, avoidance_condition,
  semantic_definition, safety_notes`;

/** Snapshot of a validated content object for readiness assessment. */
export function snapshotForReadiness(content: ValidatedKnowledgeContent): KcsContentSnapshot {
  return {
    name: content.name,
    description: content.description,
    category: content.category,
    metricUnit: content.metricUnit,
    measurementGuidance: content.measurementGuidance,
    unitSemantics: content.unitSemantics,
    setup: content.setup,
    execution: content.execution,
    techniqueReference: content.techniqueReference,
    formCues: content.formCues,
    commonMistakes: content.commonMistakes,
    equipment: content.equipment,
    environment: content.environment,
    adaptation: content.adaptation,
    protocolSteps: content.protocolSteps,
    sessionFraming: content.sessionFraming,
    completionMeaning: content.completionMeaning,
    avoidanceCondition: content.avoidanceCondition,
    semanticDefinition: content.semanticDefinition,
    safetyNotes: content.safetyNotes,
  };
}

/** Snapshot of a mapped API item for readiness assessment. */
export function snapshotItemForReadiness(item: ApiKnowledgeItem): KcsContentSnapshot {
  return {
    name: item.name,
    description: item.description,
    category: item.category,
    metricUnit: item.metricUnit,
    measurementGuidance: item.measurementGuidance,
    unitSemantics: item.unitSemantics,
    setup: item.setup,
    execution: item.execution,
    techniqueReference: item.techniqueReference,
    formCues: item.formCues,
    commonMistakes: item.commonMistakes,
    equipment: item.equipment,
    environment: item.environment,
    adaptation: item.adaptation,
    protocolSteps: item.protocolSteps,
    sessionFraming: item.sessionFraming,
    completionMeaning: item.completionMeaning,
    avoidanceCondition: item.avoidanceCondition,
    semanticDefinition: item.semanticDefinition,
    safetyNotes: item.safetyNotes,
  };
}

/**
 * EBC-01 CORR-001 current-version establishment readiness (derived,
 * server-owned; no persisted marker, no second lifecycle).
 *
 * NEW V2 Challenge establishment requires the CURRENT version to satisfy
 * the CURRENT KCS publication/readiness rules — `grandfathered` is
 * historical provenance (pre-KCS publication), never permanent
 * ineligibility, and is NOT consulted here. Consequences:
 * - an untouched pre-KCS grandfathered item (content-thin) fails;
 * - any content-thin published item fails, grandfathered or not;
 * - a grandfathered item revised under the gate (every content revision
 *   enforces requirePublicationReady) passes while keeping
 *   `grandfathered = TRUE`.
 */
export function isCurrentVersionEstablishmentReady(
  lifecycle: string,
  kind: KnowledgeKind,
  declared: KcsClass[],
  snapshot: KcsContentSnapshot,
): boolean {
  if (lifecycle !== 'published') return false;
  return assessPublicationReadiness(kind, declared, snapshot).length === 0;
}

/**
 * PF-01 Challenge eligibility issue (machine-readable, fail-closed).
 * Codes: not_published | kcs_not_ready | no_primary_metric |
 * no_compatible_unit | incoherent_contract.
 */
export interface ChallengeEligibilityIssue {
  code: string;
  reason: string;
}

export interface ChallengeEligibilityAssessmentInput {
  lifecycle: string;
  kind: KnowledgeKind;
  declared: KcsClass[];
  snapshot: KcsContentSnapshot;
  primaryMetrics: string[];
  secondaryMetrics: string[];
  compatibleUnits: string[];
}

/**
 * PF-01 server-owned Challenge eligibility evaluation, kept explicitly
 * distinct from publication readiness (TASK 6):
 *
 * PUBLISHED = approved canonical Knowledge in the Runtime Catalogue
 * (lifecycle only).
 * PUBLICATION-READY = current content satisfies the KCS minima for its
 * applicable classes (content property, lifecycle-independent).
 * CHALLENGE-ELIGIBLE = published AND publication-ready AND carrying a
 * valid governed Metric/Unit contract (at least one primary Metric, at
 * least one compatible Unit, every Unit coherent with a declared Metric).
 *
 * Returns every blocking issue; empty means eligible. Never throws for
 * content reasons (invalid configuration fails closed via `eligible`).
 */
export function assessChallengeEligibility(
  input: ChallengeEligibilityAssessmentInput,
): ChallengeEligibilityIssue[] {
  const issues: ChallengeEligibilityIssue[] = [];
  if (input.lifecycle !== 'published') {
    issues.push({
      code: 'not_published',
      reason: `lifecycle is '${input.lifecycle}', must be 'published'`,
    });
  }
  for (const kcs of assessPublicationReadiness(input.kind, input.declared, input.snapshot)) {
    issues.push({ code: 'kcs_not_ready', reason: `${kcs.field}: ${kcs.reason}` });
  }
  const declared = new Set([...input.primaryMetrics, ...input.secondaryMetrics]);
  if (input.primaryMetrics.length === 0) {
    issues.push({
      code: 'no_primary_metric',
      reason: 'a governed primary Metric is required before Challenge use',
    });
  }
  if (input.compatibleUnits.length === 0) {
    issues.push({
      code: 'no_compatible_unit',
      reason: 'at least one governed compatible Unit is required before Challenge use',
    });
  }
  for (const unit of input.compatibleUnits) {
    const unitMetric = metricForUnit(unit);
    if (!unitMetric || !declared.has(unitMetric)) {
      issues.push({
        code: 'incoherent_contract',
        reason: `unit '${unit}' expresses Metric '${unitMetric ?? 'ungoverned'}', which is not among the declared Metrics`,
      });
    }
  }
  return issues;
}

/**
 * Enforces the KCS publication gate (KRC §6.2, T2 FR-V2-213). Throws 422
 * `kcs_not_ready` with structured missing-field details unless every
 * applicable class minimum is satisfied. Grandfathered items (published
 * under pre-KCS rules) are exempt: published state is never auto-demoted.
 */
/**
 * EBC-01 governed measurement-contract administration.
 *
 * Sets the canonical (Activity → permitted Metrics → compatible Units)
 * contract for one Knowledge item. Knowledge-administration role required
 * (enforced at the route). Validation is fail-closed and deterministic:
 * - Metrics must be canonical; a Metric cannot be both primary and
 *   secondary (roles are distinct by §6 of the working baseline);
 * - Units must belong to the governed vocabulary;
 * - every compatible Unit's governed Metric must be among the declared
 *   Metrics (coherence: a Unit that could never validate against any
 *   declared Metric is rejected rather than stored);
 * - values normalize deterministically (dedupe + sort).
 *
 * Current-state governance (like content classes): setting the contract
 * never changes lifecycle or grandfathered state; revisions capture the contract current at revision
 * time. Grandfathered items may carry a contract; establishment requires
 * current-version KCS readiness (CORR-001), never non-grandfathered
 * provenance — readability vs establishment, §8.
 *
 * PF-02-CORR-001 contract version integrity: setting the contract is a
 * semantic product-contract mutation, so it atomically advances
 * current_version and mints a complete contract snapshot (see
 * advanceProductContractVersion). The live contract can never diverge
 * from the snapshot identified by current_version.
 */
export async function setMeasurementCompatibility(
  db: Db,
  id: string,
  contract: {
    primaryMetrics?: unknown;
    secondaryMetrics?: unknown;
    compatibleUnits?: unknown;
  },
): Promise<ApiKnowledgeItem> {
  if (!isUuid(id)) throw new KnowledgeError(404, 'knowledge_not_found', 'Unknown knowledge item');
  const primary = normalizeMetricList(contract.primaryMetrics, 'primaryMetrics');
  const secondary = normalizeMetricList(contract.secondaryMetrics, 'secondaryMetrics');
  const overlap = primary.filter((metric) => secondary.includes(metric));
  if (overlap.length > 0) {
    throw new KnowledgeError(
      400,
      'invalid_knowledge',
      `Metrics cannot be both primary and secondary: ${overlap.join(', ')}`,
    );
  }
  const units = normalizeUnitList(contract.compatibleUnits);
  const declared = new Set([...primary, ...secondary]);
  for (const unit of units) {
    const unitMetric = metricForUnit(unit);
    if (!unitMetric || !declared.has(unitMetric)) {
      throw new KnowledgeError(
        400,
        'invalid_knowledge',
        `Unit '${unit}' expresses Metric '${unitMetric ?? 'ungoverned'}'`
          + ` which is not among the declared Metrics (${[...declared].sort().join(', ') || 'none'})`,
      );
    }
  }
  const updated = await db.transaction(async (tx) =>
    advanceProductContractVersion(tx, id, {
      primaryMetrics: primary,
      secondaryMetrics: secondary,
      compatibleUnits: units,
    }),
  );
  return updated;
}

/**
 * PF-02-CORR-001 governed Load Reporting Basis administration: declares
 * which of the five authorized Load Reporting Bases an Activity supports
 * for its Weight configurations. Values normalize deterministically
 * (dedupe + sort); unknown bases reject with 400 unknown_load_basis.
 * Like the measurement contract, this is a semantic product-contract
 * mutation: it atomically advances current_version with a complete
 * snapshot. Non-empty bases require Weight among the declared Metrics
 * (400 load_basis_without_weight) — Weight eligibility stays constrained
 * until governed bases are declared, and bases are never auto-assigned.
 * Unknown items reject with 404 knowledge_not_found.
 */
export async function setLoadReportingBases(
  db: Db,
  id: string,
  bases: unknown,
): Promise<ApiKnowledgeItem> {
  if (!isUuid(id)) throw new KnowledgeError(404, 'knowledge_not_found', 'Unknown knowledge item');
  const normalized = normalizeLoadReportingBases(bases);
  return db.transaction(async (tx) =>
    advanceProductContractVersion(tx, id, { loadReportingBases: normalized }),
  );
}

function normalizeMetricList(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new KnowledgeError(400, 'invalid_knowledge', `${field} must be an array`);
  }
  const out: string[] = [];
  for (const entry of value) {
    if (!isCanonicalMetric(entry)) {
      throw new KnowledgeError(
        400,
        'invalid_knowledge',
        `${field} must list canonical Metrics (completion|repetitions|duration|distance|weight|quantity)`,
      );
    }
    if (!out.includes(entry)) out.push(entry);
  }
  return out.sort();
}

function normalizeUnitList(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new KnowledgeError(400, 'invalid_knowledge', 'compatibleUnits must be an array');
  }
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || metricForUnit(entry) === null) {
      throw new KnowledgeError(
        400,
        'invalid_knowledge',
        `compatibleUnits must list governed Units (got '${String(entry)}')`,
      );
    }
    if (!out.includes(entry)) out.push(entry);
  }
  return out.sort();
}

export function requirePublicationReady(
  kind: KnowledgeKind,
  declared: KcsClass[],
  content: KcsContentSnapshot,
  grandfathered: boolean,
): void {
  if (grandfathered) return;
  const issues = assessPublicationReadiness(kind, declared, content);
  if (issues.length > 0) {
    throw new KnowledgeError(
      422,
      'kcs_not_ready',
      `Knowledge does not satisfy KCS publication minimum: ${issues.map((i) => i.field).join(', ')}`,
      { missing: issues },
    );
  }
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
 * immutable after creation. Lifecycle defaults to draft (PKG-2A safe
 * default — new records must earn publication through the KCS gate).
 * Requesting published at creation runs the same gate before insert.
 * New items are never grandfathered.
 *
 * PF-01: an `activityCode` may be supplied once at creation. It must match
 * the governed format and be unique (conflicts reject with 409
 * knowledge_conflict); creation WITH a code follows the governed V2 product
 * contract (V2 taxonomy). Creation WITHOUT a code follows the quarantined
 * legacy path so V1 history keeps importing untouched.
 */
export async function createKnowledgeItem(
  db: Db,
  input: CreateKnowledgeInput,
): Promise<ApiKnowledgeItem> {
  const kind = input.kind as KnowledgeKind;
  if (kind !== 'fitness' && kind !== 'wellness') {
    throw new KnowledgeError(400, 'invalid_knowledge', 'kind must be fitness or wellness');
  }
  const activityCode = parseActivityCode(input.activityCode);
  const content = validateKnowledgeContent(kind, input, activityCode !== null);
  const lifecycle = input.lifecycle === undefined || input.lifecycle === null
    ? 'draft'
    : String(input.lifecycle);
  if (lifecycle !== 'draft' && lifecycle !== 'published') {
    throw new KnowledgeError(
      400,
      'invalid_knowledge',
      'New items start as draft or published; retired is reached only via retire',
    );
  }
  if (lifecycle === 'published') {
    requirePublicationReady(kind, content.contentClasses, snapshotForReadiness(content), false);
  }
  // PF-02: validate Component specs before any write so a bad Component
  // set rejects without creating the Activity.
  const components = normalizeComponentSpecs(input.components);
  return db.transaction(async (tx) => {
    let row: KnowledgeRow;
    try {
      const inserted = await tx.query<KnowledgeRow>(
        `INSERT INTO knowledge_items
           (kind, activity_code, lifecycle, current_version, name, category, subcategory, difficulty,
            icon, description, metric_unit, target_value, target_type, frequency,
            points, image_url, tags, details, ${KCS_ITEM_COLUMNS})
         VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                 $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
                 $31, $32, $33, $34, $35, $36)
         RETURNING ${ITEM_COLUMNS}`,
        [kind, activityCode, lifecycle, ...contentParams(content), ...kcsContentParams(content)],
      );
      row = inserted.rows[0];
    } catch (error) {
      throw mapActivityCodeConflict(error);
    }
    await tx.query(
      `INSERT INTO knowledge_item_versions
         (item_id, version, ${VERSION_CONTENT_COLUMNS})
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
               $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29,
               $30, $31, $32, $33, $34, $35, $36)`,
      [row.knowledge_id, ...contentParams(content), ...kcsVersionParams(content, EMPTY_CONTRACT, [])],
    );
    // PF-02: pin the creation-time Component set into version 1 (no-op for
    // non-component Activities).
    for (const [position, spec] of components.entries()) {
      await tx.query(
        `INSERT INTO activity_components (item_id, component_id, display_name, relationship, position)
         VALUES ($1, $2, $3, $4, $5)`,
        [row.knowledge_id, spec.componentId, spec.displayName, spec.relationship, position],
      );
    }
    await snapshotVersionComponents(tx, row.knowledge_id, 1);
    return mapKnowledgeRow(row);
  });
}

/**
 * Maps a duplicate Activity Code insert to 409 knowledge_conflict.
 * Drivers surface uniqueness violations differently (node-postgres `23505`,
 * PGlite message text), so both signals are accepted; anything else
 * rethrows untouched.
 */
function mapActivityCodeConflict(error: unknown): unknown {
  const code = (error as { code?: unknown }).code;
  const message = error instanceof Error ? error.message : String(error);
  if (code === '23505' || /duplicate key|UNIQUE constraint|unique constraint/i.test(message)) {
    return new KnowledgeError(
      409,
      'knowledge_conflict',
      'Activity Code is already in use (Activity Codes are unique)',
    );
  }
  return error;
}

/**
 * PKG-2A content columns for version rows (plus content_classes per §7 and
 * the EBC-01 measurement contract so a historical version shows the
 * contract that governed it). New items start with an empty contract;
 * revisions capture the contract current at revision time.
 */
export interface MeasurementContractValues {
  primaryMetrics: string[];
  secondaryMetrics: string[];
  compatibleUnits: string[];
}

const EMPTY_CONTRACT: MeasurementContractValues = {
  primaryMetrics: [],
  secondaryMetrics: [],
  compatibleUnits: [],
};

function kcsVersionParams(
  content: ValidatedKnowledgeContent,
  contract: MeasurementContractValues = EMPTY_CONTRACT,
  loadReportingBases: string[] = [],
): unknown[] {
  return [
    content.measurementGuidance,
    content.unitSemantics,
    content.setup,
    content.execution,
    content.techniqueReference,
    content.formCues,
    content.commonMistakes,
    content.equipment,
    content.environment,
    content.adaptation,
    JSON.stringify(content.protocolSteps),
    content.sessionFraming,
    content.completionMeaning,
    content.avoidanceCondition,
    content.semanticDefinition,
    content.safetyNotes,
    content.contentClasses,
    contract.primaryMetrics,
    contract.secondaryMetrics,
    contract.compatibleUnits,
    loadReportingBases,
  ];
}

/**
 * PF-02-CORR-001 product-contract revision helper: the smallest coherent
 * implementation of "semantic Activity-contract mutation => atomic version
 * advancement + complete contract snapshot".
 *
 * Runs inside the caller's transaction (which must hold the row lock):
 * applies the contract and/or Component and/or Load Reporting Basis
 * changes to the live item, advances current_version exactly once, mints
 * one immutable version row carrying the live content with the NEW
 * contract, and snapshots the Component set and locale texts into that
 * version. Either the whole advancement lands or nothing does — a version
 * number can never describe two different contracts, and the live
 * contract can never diverge from the snapshot identified by
 * current_version.
 *
 * Every public administration operation that mutates the canonical
 * product contract (setMeasurementCompatibility, setActivityComponents,
 * setLoadReportingBases) funnels through this helper, so no second
 * versioning system exists.
 */
export interface ProductContractChanges {
  primaryMetrics?: string[];
  secondaryMetrics?: string[];
  compatibleUnits?: string[];
  /** Undefined leaves the Component set untouched; an array replaces it. */
  components?: ActivityComponentSpec[];
  loadReportingBases?: string[];
}

const VERSION_CONTRACT_TAIL = new Set([
  'primary_metrics',
  'secondary_metrics',
  'compatible_units',
  'load_reporting_bases',
]);

export async function advanceProductContractVersion(
  tx: Db,
  itemId: string,
  changes: ProductContractChanges,
): Promise<ApiKnowledgeItem> {
  const current = await tx.query<KnowledgeRow>(
    `SELECT ${ITEM_COLUMNS} FROM knowledge_items WHERE knowledge_id = $1 FOR UPDATE`,
    [itemId],
  );
  const row = current.rows[0];
  if (!row) throw new KnowledgeError(404, 'knowledge_not_found', 'Unknown knowledge item');
  const primary = changes.primaryMetrics ?? parseStringList(row.primary_metrics);
  const secondary = changes.secondaryMetrics ?? parseStringList(row.secondary_metrics);
  const units = changes.compatibleUnits ?? parseStringList(row.compatible_units);
  const bases = changes.loadReportingBases ?? parseStringList(row.load_reporting_bases);
  // Coherence: declared Load Reporting Bases require Weight among the
  // resulting declared Metrics (mirrors the unit/contract coherence rule).
  if (bases.length > 0 && ![...primary, ...secondary].includes('weight')) {
    throw new KnowledgeError(
      400,
      'load_basis_without_weight',
      'Load Reporting Bases require Weight among the declared Metrics '
      + '(declare the Weight contract first, or clear the bases)',
    );
  }
  const next = Number(row.current_version) + 1;
  if (changes.components !== undefined) {
    await tx.query('DELETE FROM activity_components WHERE item_id = $1', [itemId]);
    for (const [position, spec] of changes.components.entries()) {
      await tx.query(
        `INSERT INTO activity_components (item_id, component_id, display_name, relationship, position)
         VALUES ($1, $2, $3, $4, $5)`,
        [itemId, spec.componentId, spec.displayName, spec.relationship, position],
      );
    }
  }
  const updated = await tx.query<KnowledgeRow>(
    `UPDATE knowledge_items
     SET primary_metrics = $2, secondary_metrics = $3, compatible_units = $4,
         load_reporting_bases = $5, current_version = $6, updated_at = now()
     WHERE knowledge_id = $1
     RETURNING ${ITEM_COLUMNS}`,
    [itemId, primary, secondary, units, bases, next],
  );
  // Mint the version from the live content columns with the NEW contract:
  // content travels untouched, so one statement cannot partially succeed.
  const contentOnly = VERSION_CONTENT_COLUMNS.split(',')
    .map((column) => column.trim())
    .filter((column) => !VERSION_CONTRACT_TAIL.has(column))
    .join(', ');
  await tx.query(
    `INSERT INTO knowledge_item_versions (item_id, version, ${VERSION_CONTENT_COLUMNS})
     SELECT $1, $2, ${contentOnly}, $3, $4, $5, $6
     FROM knowledge_items WHERE knowledge_id = $1`,
    [itemId, next, primary, secondary, units, bases],
  );
  await snapshotVersionComponents(tx, itemId, next);
  await snapshotVersionTexts(tx, itemId, next);
  return mapKnowledgeRow(updated.rows[0]);
}

/**
 * Content revision: atomically increments knowledgeVersion exactly once and
 * appends an immutable version row. The row lock (SELECT FOR UPDATE) makes
 * concurrent revisions serialize, so two simultaneous edits produce two
 * distinct versions — never a lost update.
 *
 * PF-01: the Activity Code is immutable — a revision carrying a code that
 * differs from the stored code (including adopting a code onto a codeless
 * legacy row) rejects with 400 immutable_activity_code before any write.
 * Display-name changes never affect identity. Coded items revalidate under
 * the governed V2 contract; legacy rows keep the quarantined path.
 * Locale overrides current at revision time are snapshotted into
 * knowledge_item_version_texts so the new version stays historically
 * resolvable after later edits.
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
    const storedCode = row.activity_code ?? null;
    const incomingCode = parseActivityCode(input.activityCode);
    if (incomingCode !== storedCode) {
      throw new KnowledgeError(
        400,
        'immutable_activity_code',
        'Activity Code is immutable: revisions cannot change, clear, or adopt a code',
      );
    }
    const content = validateKnowledgeContent(row.kind as KnowledgeKind, input, storedCode !== null);
    // PKG-2A-CORR: a revision that remains published must satisfy the current
    // KCS gate on the NEW content — including grandfathered items, whose
    // exemption covers only their pre-KCS publication, never future versions.
    // Failure rejects before any write; the published version is untouched.
    if ((row.lifecycle as KnowledgeLifecycle) === 'published') {
      requirePublicationReady(
        row.kind as KnowledgeKind,
        content.contentClasses,
        snapshotForReadiness(content),
        false,
      );
    }
    const next = Number(row.current_version) + 1;
    const updated = await tx.query<KnowledgeRow>(
      `UPDATE knowledge_items SET
         name = $2, category = $3, subcategory = $4, difficulty = $5, icon = $6,
         description = $7, metric_unit = $8, target_value = $9, target_type = $10,
         frequency = $11, points = $12, image_url = $13, tags = $14, details = $15,
         content_classes = $16, default_locale = $17,
         measurement_guidance = $18, unit_semantics = $19, setup = $20,
         execution = $21, technique_reference = $22, form_cues = $23,
         common_mistakes = $24, equipment = $25, environment = $26,
         adaptation = $27, protocol_steps = $28, session_framing = $29,
         completion_meaning = $30, avoidance_condition = $31,
         semantic_definition = $32, safety_notes = $33,
         current_version = $34, updated_at = now()
       WHERE knowledge_id = $1
       RETURNING ${ITEM_COLUMNS}`,
      [id, ...contentParams(content), content.contentClasses, content.defaultLocale,
        content.measurementGuidance, content.unitSemantics, content.setup,
        content.execution, content.techniqueReference, content.formCues,
        content.commonMistakes, content.equipment, content.environment,
        content.adaptation, JSON.stringify(content.protocolSteps),
        content.sessionFraming, content.completionMeaning, content.avoidanceCondition,
        content.semanticDefinition, content.safetyNotes, next],
    );
    const revised = mapKnowledgeRow(updated.rows[0]);
    await tx.query(
      `INSERT INTO knowledge_item_versions
         (item_id, version, ${VERSION_CONTENT_COLUMNS})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
               $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
               $31, $32, $33, $34, $35, $36, $37)`,
      [id, next, ...contentParams(content), ...kcsVersionParams(content, {
        primaryMetrics: revised.primaryMetrics,
        secondaryMetrics: revised.secondaryMetrics,
        compatibleUnits: revised.compatibleUnits,
      }, parseStringList(row.load_reporting_bases))],
    );
    await snapshotVersionTexts(tx, id, next);
    // PF-02: pin the Component set current at revision time into the new
    // version (no-op for non-component Activities). Component edits are
    // current-state administration; the revision is what pins them.
    await snapshotVersionComponents(tx, id, next);
    return revised;
  });
}

/**
 * Snapshots the locale overrides current at revision time into the new
 * version's historical texts. Creation needs no snapshot (texts can only be
 * set on an existing item, so version 1 starts with none).
 */
async function snapshotVersionTexts(db: Db, id: string, version: number): Promise<void> {
  await db.query(
    `INSERT INTO knowledge_item_version_texts (item_id, version, locale, field, value)
     SELECT $1, $2, locale, field, value FROM knowledge_item_texts WHERE item_id = $1`,
    [id, version],
  );
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
 * The draft → published move enforces the KCS publication gate (T2
 * FR-V2-213) for non-grandfathered items; published state is never
 * auto-demoted by this function.
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
  if (target === 'published') {
    const item = mapKnowledgeRow(row);
    requirePublicationReady(
      item.kind,
      item.contentClasses,
      snapshotItemForReadiness(item),
      item.grandfathered,
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

/**
 * PKG-2A locale-keyed member-facing text (T2 FR-V2-214). Canonical identity
 * is never duplicated per locale: overrides attach to the same knowledge_id.
 * Base columns always carry the default-locale (source) text.
 */
export interface KnowledgeTextEntry {
  locale: string;
  field: string;
  value: string;
}

function parseTextArrayValue(field: string, value: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new KnowledgeError(
      400,
      'invalid_knowledge',
      `Locale value for ${field} must be a JSON array of strings`,
    );
  }
  if (!Array.isArray(parsed) || parsed.some((e) => typeof e !== 'string')) {
    throw new KnowledgeError(
      400,
      'invalid_knowledge',
      `Locale value for ${field} must be a JSON array of strings`,
    );
  }
  return (parsed as string[]).map((e) => e.trim()).filter((e) => e.length > 0);
}

export async function setKnowledgeText(
  db: Db,
  id: string,
  localeInput: unknown,
  fieldInput: unknown,
  valueInput: unknown,
): Promise<KnowledgeTextEntry> {
  if (!isUuid(id)) throw new KnowledgeError(404, 'knowledge_not_found', 'Unknown knowledge item');
  const locale = validateLocale(localeInput);
  const field = typeof fieldInput === 'string' ? fieldInput : '';
  if (!isLocalizableField(field)) {
    throw new KnowledgeError(400, 'invalid_knowledge', `Field is not localizable: ${field}`);
  }
  if (typeof valueInput !== 'string' || !valueInput.trim()) {
    throw new KnowledgeError(400, 'invalid_knowledge', 'Locale value must be a non-empty string');
  }
  if (valueInput.length > 5000) {
    throw new KnowledgeError(400, 'invalid_knowledge', 'Locale value exceeds 5000 characters');
  }
  const exists = await db.query<{ knowledge_id: string }>(
    'SELECT knowledge_id FROM knowledge_items WHERE knowledge_id = $1',
    [id],
  );
  if (!exists.rows[0]) throw new KnowledgeError(404, 'knowledge_not_found', 'Unknown knowledge item');
  // Validate array-field payloads up front so malformed locale content is rejected, not stored.
  if (LOCALIZABLE_ARRAY_FIELDS.has(field)) parseTextArrayValue(field, valueInput);
  const stored = await db.query<{ locale: string; field: string; value: string }>(
    `INSERT INTO knowledge_item_texts (item_id, locale, field, value, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (item_id, locale, field)
     DO UPDATE SET value = EXCLUDED.value, updated_at = now()
     RETURNING locale, field, value`,
    [id, locale, field, valueInput],
  );
  return stored.rows[0];
}

export async function listKnowledgeTexts(db: Db, id: string): Promise<KnowledgeTextEntry[]> {
  if (!isUuid(id)) throw new KnowledgeError(404, 'knowledge_not_found', 'Unknown knowledge item');
  const result = await db.query<KnowledgeTextEntry>(
    'SELECT locale, field, value FROM knowledge_item_texts WHERE item_id = $1 ORDER BY locale, field',
    [id],
  );
  return result.rows;
}

export interface LocalizedKnowledgeItem extends ApiKnowledgeItem {
  resolvedLocale: string;
  localeFallback: boolean;
}

const LOCALE_FIELD_PROPS: Record<string, keyof ApiKnowledgeItem> = {
  name: 'name',
  description: 'description',
  measurementGuidance: 'measurementGuidance',
  unitSemantics: 'unitSemantics',
  setup: 'setup',
  execution: 'execution',
  techniqueReference: 'techniqueReference',
  equipment: 'equipment',
  environment: 'environment',
  adaptation: 'adaptation',
  sessionFraming: 'sessionFraming',
  completionMeaning: 'completionMeaning',
  avoidanceCondition: 'avoidanceCondition',
  semanticDefinition: 'semanticDefinition',
  formCues: 'formCues',
  commonMistakes: 'commonMistakes',
  safetyNotes: 'safetyNotes',
};

function applyLocaleOverrides(
  item: ApiKnowledgeItem,
  texts: KnowledgeTextEntry[],
): { item: ApiKnowledgeItem; applied: number } {
  let applied = 0;
  const merged = { ...item };
  for (const entry of texts) {
    const prop = LOCALE_FIELD_PROPS[entry.field];
    if (!prop) continue;
    if (LOCALIZABLE_ARRAY_FIELDS.has(entry.field)) {
      try {
        const parsed = parseTextArrayValue(entry.field, entry.value);
        if (parsed.length === 0) continue;
        (merged as Record<string, unknown>)[prop] = parsed;
        applied += 1;
      } catch {
        continue;
      }
    } else {
      if (!entry.value.trim()) continue;
      (merged as Record<string, unknown>)[prop] = entry.value;
      applied += 1;
    }
  }
  return { item: merged, applied };
}

/**
 * Deterministic locale resolution (FR-V2-214): requested locale overrides
 * apply per field; every field without an override falls back to the base
 * (default-locale) text. resolvedLocale is always the requested locale;
 * localeFallback is true whenever the request differs from the default
 * locale — including when no override exists (full fallback).
 */
export async function localizeKnowledgeItems(
  db: Db,
  items: ApiKnowledgeItem[],
  localeInput: unknown,
): Promise<LocalizedKnowledgeItem[]> {
  if (localeInput === undefined || localeInput === null || localeInput === '') {
    return items.map((item) => ({ ...item, resolvedLocale: item.defaultLocale, localeFallback: false }));
  }
  const locale = validateLocale(localeInput);
  const ids = items.map((item) => item.id);
  const textsResult = ids.length > 0
    ? await db.query<{ item_id: string; locale: string; field: string; value: string }>(
      `SELECT item_id, locale, field, value FROM knowledge_item_texts
       WHERE item_id = ANY($1::uuid[]) AND locale = $2`,
      [ids, locale],
    )
    : { rows: [] as Array<{ item_id: string; locale: string; field: string; value: string }> };
  const byItem = new Map<string, KnowledgeTextEntry[]>();
  for (const row of textsResult.rows) {
    const key = String(row.item_id);
    const list = byItem.get(key) ?? [];
    list.push({ locale: row.locale, field: row.field, value: row.value });
    byItem.set(key, list);
  }
  return items.map((item) => {
    const { item: merged } = applyLocaleOverrides(item, byItem.get(item.id) ?? []);
    return {
      ...merged,
      resolvedLocale: locale,
      localeFallback: locale !== item.defaultLocale,
    };
  });
}

export async function getLocalizedKnowledge(
  db: Db,
  id: string,
  localeInput: unknown,
): Promise<LocalizedKnowledgeItem | null> {
  const item = await getKnowledgeById(db, id);
  if (!item) return null;
  const [localized] = await localizeKnowledgeItems(db, [item], localeInput);
  return localized;
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
 * By-code fetch (PF-01 governed V2 resolution). Malformed codes and unknown
 * codes resolve to null — identity is never invented. Unfiltered by
 * lifecycle, like the by-UUID read, so retired items stay historically
 * resolvable.
 */
export async function getKnowledgeByCode(db: Db, code: unknown): Promise<ApiKnowledgeItem | null> {
  if (!isActivityCode(code)) return null;
  const result = await db.query<KnowledgeRow>(
    `SELECT ${ITEM_COLUMNS} FROM knowledge_items WHERE activity_code = $1`,
    [code],
  );
  const row = result.rows[0];
  return row ? mapKnowledgeRow(row) : null;
}

/**
 * Historical locale texts snapshotted at revision time (PF-01 version
 * association). Empty when the version predates its locale overrides.
 */
export async function listKnowledgeVersionTexts(
  db: Db,
  id: string,
  version: number,
): Promise<KnowledgeTextEntry[]> {
  if (!isUuid(id) || !Number.isInteger(version) || version < 1) return [];
  const result = await db.query<KnowledgeTextEntry>(
    `SELECT locale, field, value FROM knowledge_item_version_texts
     WHERE item_id = $1 AND version = $2 ORDER BY locale, field`,
    [id, version],
  );
  return result.rows;
}

/**
 * Localized historical version (PF-01): the version row's base content with
 * that version's snapshotted locale overrides applied. Later edits to live
 * texts can never rewrite what a pinned version meant.
 */
export async function getLocalizedKnowledgeVersion(
  db: Db,
  id: string,
  version: number,
  localeInput: unknown,
): Promise<LocalizedKnowledgeItem | null> {
  const historic = await getKnowledgeVersion(db, id, version);
  if (!historic) return null;
  if (localeInput === undefined || localeInput === null || localeInput === '') {
    return { ...historic, resolvedLocale: historic.defaultLocale, localeFallback: false };
  }
  const locale = validateLocale(localeInput);
  const textsResult = await db.query<{ locale: string; field: string; value: string }>(
    `SELECT locale, field, value FROM knowledge_item_version_texts
     WHERE item_id = $1 AND version = $2 AND locale = $3`,
    [id, version, locale],
  );
  const entries = textsResult.rows.map((entry) => ({
    locale: entry.locale,
    field: entry.field,
    value: entry.value,
  }));
  const { item: merged } = applyLocaleOverrides(historic, entries);
  return {
    ...merged,
    resolvedLocale: locale,
    localeFallback: locale !== historic.defaultLocale,
  };
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
    `SELECT ${VERSION_CONTENT_COLUMNS}
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
    activityCode: { type: ['string', 'null'] },
    kind: { type: 'string', enum: ['fitness', 'wellness'] },
    lifecycle: { type: 'string', enum: ['draft', 'published', 'retired'] },
    knowledgeVersion: { type: 'integer', minimum: 1 },
    publicationReady: { type: 'boolean' },
    publicationIssues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          class: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    challengeEligible: { type: 'boolean' },
    challengeEligibilityIssues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
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
    contentClasses: { type: 'array', items: { type: 'string' } },
    defaultLocale: { type: 'string' },
    grandfathered: { type: 'boolean' },
    primaryMetrics: { type: 'array', items: { type: 'string' } },
    secondaryMetrics: { type: 'array', items: { type: 'string' } },
    compatibleUnits: { type: 'array', items: { type: 'string' } },
    measurementGuidance: { type: 'string' },
    unitSemantics: { type: 'string' },
    setup: { type: 'string' },
    execution: { type: 'string' },
    techniqueReference: { type: 'string' },
    formCues: { type: 'array', items: { type: 'string' } },
    commonMistakes: { type: 'array', items: { type: 'string' } },
    equipment: { type: 'string' },
    environment: { type: 'string' },
    adaptation: { type: 'string' },
    protocolSteps: { type: 'array' },
    sessionFraming: { type: 'string' },
    completionMeaning: { type: 'string' },
    avoidanceCondition: { type: 'string' },
    semanticDefinition: { type: 'string' },
    safetyNotes: { type: 'array', items: { type: 'string' } },
    resolvedLocale: { type: 'string' },
    localeFallback: { type: 'boolean' },
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
    const items = await listPublishedKnowledge(db, { kind, search });
    return { items: await localizeKnowledgeItems(db, items, params.locale ?? undefined) };
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

  app.get('/v1/knowledge/code/:code', {
    schema: { response: { 200: knowledgeItemSchema, 404: notFoundSchema } },
  }, async (request, reply) => {
    const { code } = request.params as { code: string };
    const params = (request.query ?? {}) as Record<string, unknown>;
    const item = await getKnowledgeByCode(db, code);
    if (!item) {
      return reply.status(404).send({
        error: { code: 'knowledge_not_found', message: 'Unknown knowledge item' },
      });
    }
    const [localized] = await localizeKnowledgeItems(db, [item], params.locale ?? undefined);
    return localized;
  });

  app.get('/v1/knowledge/:id', {
    schema: { response: { 200: knowledgeItemSchema, 404: notFoundSchema } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const params = (request.query ?? {}) as Record<string, unknown>;
    const item = await getLocalizedKnowledge(db, id, params.locale ?? undefined);
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
    const params = (request.query ?? {}) as Record<string, unknown>;
    const item = await getLocalizedKnowledgeVersion(db, id, Number(version), params.locale ?? undefined);
    if (!item) {
      return reply.status(404).send({
        error: { code: 'knowledge_not_found', message: 'Unknown knowledge item or version' },
      });
    }
    return item;
  });

  app.get('/v1/knowledge/:id/versions/:version/texts', {
    schema: {
      response: {
        200: {
          type: 'object',
          required: ['texts'],
          properties: {
            texts: {
              type: 'array',
              items: {
                type: 'object',
                required: ['locale', 'field', 'value'],
                properties: {
                  locale: { type: 'string' },
                  field: { type: 'string' },
                  value: { type: 'string' },
                },
              },
            },
          },
        },
        404: notFoundSchema,
      },
    },
  }, async (request, reply) => {
    const { id, version } = request.params as { id: string; version: string };
    const texts = await listKnowledgeVersionTexts(db, id, Number(version));
    const historic = await getKnowledgeVersion(db, id, Number(version));
    if (!historic) {
      return reply.status(404).send({
        error: { code: 'knowledge_not_found', message: 'Unknown knowledge item or version' },
      });
    }
    return { texts };
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

  app.put('/v1/admin/knowledge/:id/compatibility', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          primaryMetrics: { type: 'array', items: { type: 'string' } },
          secondaryMetrics: { type: 'array', items: { type: 'string' } },
          compatibleUnits: { type: 'array', items: { type: 'string' } },
        },
      },
      response: { 200: knowledgeItemSchema },
    },
  }, async (request) => {
    await requireKnowledgeAdmin(db, authenticatedMember(request).memberId);
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      primaryMetrics?: unknown;
      secondaryMetrics?: unknown;
      compatibleUnits?: unknown;
    };
    return setMeasurementCompatibility(db, id, body);
  });

  app.get('/v1/admin/knowledge/:id/texts', {
    schema: {
      response: {
        200: {
          type: 'object',
          required: ['texts'],
          properties: {
            texts: {
              type: 'array',
              items: {
                type: 'object',
                required: ['locale', 'field', 'value'],
                properties: {
                  locale: { type: 'string' },
                  field: { type: 'string' },
                  value: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  }, async (request) => {
    await requireKnowledgeAdmin(db, authenticatedMember(request).memberId);
    const { id } = request.params as { id: string };
    return { texts: await listKnowledgeTexts(db, id) };
  });

  app.put('/v1/admin/knowledge/:id/texts', {
    schema: {
      response: {
        200: {
          type: 'object',
          required: ['locale', 'field', 'value'],
          properties: {
            locale: { type: 'string' },
            field: { type: 'string' },
            value: { type: 'string' },
          },
        },
      },
    },
  }, async (request) => {
    await requireKnowledgeAdmin(db, authenticatedMember(request).memberId);
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    return setKnowledgeText(db, id, body.locale, body.field, body.value);
  });
}
