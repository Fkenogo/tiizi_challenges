/**
 * TIIZI-FER-P5T-1-001 — governed Challenge Template authority.
 *
 * A Template is reusable configuration only: a Composer draft authored in
 * `TEMPLATE_AUTHORING` mode (no dates, no timezone, no hosting Group, no
 * payment/Support/scoring/recognition fields) plus catalogue metadata.
 * Published versions are immutable snapshots (also enforced by database
 * triggers in migration 030). A Template never becomes a Challenge: a member
 * establishes one through the existing governed `POST /api/challenges`, which
 * may carry a verified reference recorded as internal provenance.
 *
 * Publish-time validation reuses the PF-04 Composer preview and the single
 * PF-03 validator (plus the establishment-grade readiness/tuple gate) with a
 * synthetic anchor window; there is no second validation engine here.
 *
 * Provider-neutral: pure domain + `Db`. No Firebase imports.
 */

import { createHash } from 'node:crypto';
import type { Db } from './db.js';
import {
  describeComposerActivityOptions,
  normalizeComposerDraft,
  previewChallengeComposer,
  type ChallengeComposerDraft,
} from './challengeComposer.js';
import {
  assertActivityMeasurementCompatible,
  createDbKnowledgeEligibilityResolverByIdentity,
} from './knowledgeEligibility.js';
import { GROUP_FOCUS_AREAS } from './groupVocabulary.js';

export class TemplateError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

const COVER_IDS = ['challenge-1', 'challenge-2', 'challenge-3', 'challenge-4', 'challenge-5', 'challenge-6', 'challenge-7', 'challenge-8'];
const FOCUS_LABELS: string[] = GROUP_FOCUS_AREAS.map((area) => area.label);
const CONTENT_KEYS = new Set(['summary', 'focusTags', 'sortOrder', 'coverId', 'durationDays', 'durationPresetDays', 'composer']);
/** Instance-specific / excluded Composer fields: never part of a Template. */
const COMPOSER_FORBIDDEN = ['startDate', 'endDate', 'timezone', 'temporalConditions', 'instructions'];
const MAX_DURATION_DAYS = 3660;
const ANCHOR_START = '2030-01-01';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isTemplateUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export interface TemplateContent {
  summary: string | null;
  focusTags: string[];
  sortOrder: number;
  coverId: string | null;
  durationDays: number | null;
  durationPresetDays: number[] | null;
  composer: ChallengeComposerDraft;
}

function bad(message: string): never {
  throw new TemplateError(400, 'invalid_template_request', message);
}

/**
 * Strict content normalization. Unknown top-level fields (hosting Group,
 * payment destination, Support Tiizi, scoring, recognition, …) reject; the
 * Composer draft goes through the existing strict normalizer, after instance
 * fields are refused. Incomplete content is accepted (save-draft); the
 * publish gate decides completeness and validity.
 */
export function normalizeTemplateContent(raw: unknown): TemplateContent {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) bad('Template body must be an object');
  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!CONTENT_KEYS.has(key)) bad(`field '${key}' is not part of a Template`);
  }
  let summary: string | null = null;
  if (record.summary !== undefined && record.summary !== null) {
    if (typeof record.summary !== 'string' || record.summary.trim().length === 0 || record.summary.length > 280) {
      bad('summary must be 1..280 characters when present');
    }
    summary = record.summary.trim();
  }
  let focusTags: string[] = [];
  if (record.focusTags !== undefined) {
    if (!Array.isArray(record.focusTags) || record.focusTags.length > 5
      || record.focusTags.some((tag) => typeof tag !== 'string' || !FOCUS_LABELS.includes(tag))
      || new Set(record.focusTags).size !== record.focusTags.length) {
      bad('focusTags must be up to 5 distinct Group Interest labels from the governed vocabulary');
    }
    focusTags = record.focusTags as string[];
  }
  let sortOrder = 0;
  if (record.sortOrder !== undefined) {
    if (!Number.isInteger(record.sortOrder) || (record.sortOrder as number) < -1000 || (record.sortOrder as number) > 1000) {
      bad('sortOrder must be an integer between -1000 and 1000');
    }
    sortOrder = record.sortOrder as number;
  }
  let coverId: string | null = null;
  if (record.coverId !== undefined && record.coverId !== null) {
    if (typeof record.coverId !== 'string' || !COVER_IDS.includes(record.coverId)) {
      bad('coverId must reference the governed Challenge cover catalogue');
    }
    coverId = record.coverId;
  }
  let durationDays: number | null = null;
  if (record.durationDays !== undefined && record.durationDays !== null) {
    if (!Number.isInteger(record.durationDays) || (record.durationDays as number) < 1 || (record.durationDays as number) > MAX_DURATION_DAYS) {
      bad(`durationDays must be an integer between 1 and ${MAX_DURATION_DAYS}`);
    }
    durationDays = record.durationDays as number;
  }
  let durationPresetDays: number[] | null = null;
  if (record.durationPresetDays !== undefined && record.durationPresetDays !== null) {
    const presets = record.durationPresetDays;
    if (!Array.isArray(presets) || presets.length > 8
      || presets.some((value) => !Number.isInteger(value) || value < 1 || value > MAX_DURATION_DAYS)
      || new Set(presets).size !== presets.length) {
      bad('durationPresetDays must be up to 8 distinct integers >= 1');
    }
    durationPresetDays = presets as number[];
  }
  const rawComposer = record.composer === undefined ? { activities: [] } : record.composer;
  if (typeof rawComposer !== 'object' || rawComposer === null || Array.isArray(rawComposer)) bad('composer must be an object');
  const composerRecord = rawComposer as Record<string, unknown>;
  for (const field of COMPOSER_FORBIDDEN) {
    if (composerRecord[field] !== undefined) {
      bad(`composer field '${field}' is instance-specific and never stored in a Template`);
    }
  }
  if (composerRecord.mode !== undefined && composerRecord.mode !== 'TEMPLATE_AUTHORING') {
    bad("composer mode must be 'TEMPLATE_AUTHORING'");
  }
  let composer: ChallengeComposerDraft;
  try {
    composer = normalizeComposerDraft({ ...composerRecord, mode: 'TEMPLATE_AUTHORING' });
  } catch (error) {
    throw new TemplateError(400, 'invalid_template_request', (error as Error).message);
  }
  return { summary, focusTags, sortOrder, coverId, durationDays, durationPresetDays, composer };
}

export interface TemplateIssue {
  code: string;
  message: string;
  field?: string;
  activityIndex?: number;
}

/** Effective Composer values derived exactly as the Wizard derives them. */
export function effectiveComposer(content: TemplateContent): ChallengeComposerDraft {
  const composer = { ...content.composer };
  if (composer.challengeType === 'streak' && content.durationDays !== null) {
    composer.requiredConsecutiveDays = content.durationDays;
  }
  if (composer.challengeType === 'collective' && composer.goalValue === undefined && composer.activities.length > 0) {
    const primary = composer.activities[0];
    if (typeof primary.targetValue === 'number' && typeof primary.unit === 'string') {
      composer.goalValue = primary.targetValue;
      composer.goalUnit = primary.unit;
    }
  }
  return composer;
}

/** Activity kind is Knowledge truth: derive it when the author did not supply it. */
async function withDerivedKinds(db: Db, composer: ChallengeComposerDraft): Promise<ChallengeComposerDraft> {
  const activities = [];
  for (const entry of composer.activities) {
    if (entry.kind !== undefined) { activities.push(entry); continue; }
    try {
      const options = await describeComposerActivityOptions(db, entry.activity);
      activities.push({ ...entry, kind: options.kind });
    } catch {
      activities.push(entry); // unresolved identity: PF-04 reports it
    }
  }
  return { ...composer, activities };
}

function addDays(day: string, days: number): string {
  const [year, month, date] = day.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, date + days));
  return next.toISOString().slice(0, 10);
}

export interface TemplateValidation {
  ok: boolean;
  issues: TemplateIssue[];
}

/**
 * Publish gate: structural completeness, then the existing PF-04 preview
 * (stale-Activity detection + PF-03 semantic validation) over a synthetic
 * anchor window of `durationDays`, then the same establishment-grade
 * readiness and (Activity, Metric, Unit) tuple gate that establishment uses.
 */
export async function validateTemplateContent(db: Db, content: TemplateContent): Promise<TemplateValidation> {
  const issues: TemplateIssue[] = [];
  const composer = effectiveComposer(content);
  if (!composer.title || composer.title.trim().length === 0) issues.push({ code: 'MISSING_FIELD', field: 'title', message: 'title is required to publish' });
  if (!content.summary) issues.push({ code: 'MISSING_FIELD', field: 'summary', message: 'a short member-facing summary is required to publish' });
  if (!composer.challengeType) issues.push({ code: 'MISSING_FIELD', field: 'challengeType', message: 'challengeType is required to publish' });
  if (content.durationDays === null) issues.push({ code: 'MISSING_FIELD', field: 'durationDays', message: 'durationDays (>= 1) is required to publish' });
  if (composer.challengeType === 'streak' && content.composer.requiredConsecutiveDays !== undefined
    && content.durationDays !== null && content.composer.requiredConsecutiveDays !== content.durationDays) {
    issues.push({ code: 'DURATION_MISMATCH', field: 'requiredConsecutiveDays', message: 'Streak requiredConsecutiveDays is derived from durationDays' });
  }
  if (issues.length > 0) return { ok: false, issues };

  const anchored: ChallengeComposerDraft = {
    ...(await withDerivedKinds(db, composer)),
    startDate: ANCHOR_START,
    endDate: addDays(ANCHOR_START, (content.durationDays as number) - 1),
    timezone: 'UTC',
  };
  const preview = await previewChallengeComposer(db, anchored);
  if (!preview.ok) {
    return { ok: false, issues: preview.issues.map((issue) => ({ ...issue })) as TemplateIssue[] };
  }
  for (const [index, activity] of preview.definition.activities.entries()) {
    const identity = composer.activities[index].activity;
    const eligibility = await createDbKnowledgeEligibilityResolverByIdentity(db, activity.kind)(identity);
    if (!eligibility) {
      issues.push({
        code: 'ACTIVITY_NOT_ELIGIBLE',
        activityIndex: index,
        field: 'activities[].activity',
        message: `Activity '${identity}' is not published and Challenge-ready (retired or content-thin Activities cannot back a Template)`,
      });
      continue;
    }
    try {
      assertActivityMeasurementCompatible(eligibility, {
        canonical_key: identity,
        metric: composer.activities[index].metric,
        unit: composer.activities[index].unit as string,
      }, index);
    } catch (error) {
      issues.push({ code: 'INCOMPATIBLE_MEASUREMENT', activityIndex: index, message: (error as Error).message });
    }
  }
  return { ok: issues.length === 0, issues };
}

interface VersionRow {
  template_id: string;
  version: number;
  state: 'draft' | 'published';
  title: string | null;
  description: string | null;
  summary: string | null;
  challenge_type: string | null;
  duration_days: number | null;
  duration_preset_days: number[] | null;
  cover_id: string | null;
  focus_tags: string[];
  sort_order: number;
  composer_config: ChallengeComposerDraft;
  authored_by_member_id: string;
  authored_at: string | Date;
  last_edited_by_member_id: string;
  last_edited_at: string | Date;
  published_by_member_id: string | null;
  published_at: string | Date | null;
}

function contentFromRow(row: VersionRow): TemplateContent {
  return {
    summary: row.summary,
    focusTags: row.focus_tags ?? [],
    sortOrder: Number(row.sort_order),
    coverId: row.cover_id,
    durationDays: row.duration_days === null ? null : Number(row.duration_days),
    durationPresetDays: row.duration_preset_days === null ? null : row.duration_preset_days.map(Number),
    composer: normalizeComposerDraft(row.composer_config),
  };
}

function contentHash(row: VersionRow): string {
  return createHash('sha256').update(JSON.stringify([
    row.title, row.description, row.summary, row.challenge_type, row.duration_days, row.duration_preset_days,
    row.cover_id, row.focus_tags, row.sort_order, row.composer_config,
  ]), 'utf8').digest('hex');
}

const VERSION_COLUMNS = `template_id, version, state, title, description, summary, challenge_type, duration_days,
  duration_preset_days, cover_id, focus_tags, sort_order, composer_config, authored_by_member_id, authored_at,
  last_edited_by_member_id, last_edited_at, published_by_member_id, published_at`;

function contentParams(content: TemplateContent): unknown[] {
  return [
    content.composer.title ?? null,
    content.composer.description ?? null,
    content.summary,
    content.composer.challengeType ?? null,
    content.durationDays,
    content.durationPresetDays,
    content.coverId,
    content.focusTags,
    content.sortOrder,
    JSON.stringify(content.composer),
  ];
}

function notFound(): never {
  throw new TemplateError(404, 'template_not_found', 'Template not found');
}

async function recordAudit(
  tx: Db,
  templateId: string,
  version: number | null,
  action: string,
  actor: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await tx.query(
    `INSERT INTO challenge_template_audit_events (template_id, version, action, actor_member_id, detail)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [templateId, version, action, actor, JSON.stringify(detail)],
  );
}

async function lockTemplate(tx: Db, templateId: string): Promise<{ lifecycle: string; latest_published_version: number | null }> {
  const found = await tx.query<{ lifecycle: string; latest_published_version: number | null }>(
    `SELECT lifecycle, latest_published_version FROM challenge_templates WHERE template_id = $1 FOR UPDATE`,
    [templateId],
  );
  if (found.rows.length === 0) notFound();
  if (found.rows[0].lifecycle === 'retired') {
    throw new TemplateError(409, 'template_retired', 'A retired Template cannot change');
  }
  return found.rows[0];
}

export async function createTemplateDraft(
  db: Db,
  actor: string,
  content: TemplateContent,
): Promise<{ templateId: string; version: number }> {
  return db.transaction(async (tx) => {
    const created = await tx.query<{ template_id: string }>(
      `INSERT INTO challenge_templates (created_by_member_id) VALUES ($1) RETURNING template_id`,
      [actor],
    );
    const templateId = String(created.rows[0].template_id);
    await tx.query(
      `INSERT INTO challenge_template_versions
         (template_id, version, title, description, summary, challenge_type, duration_days, duration_preset_days,
          cover_id, focus_tags, sort_order, composer_config, authored_by_member_id, last_edited_by_member_id)
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $12)`,
      [templateId, ...contentParams(content), actor],
    );
    await recordAudit(tx, templateId, 1, 'create_draft', actor);
    return { templateId, version: 1 };
  });
}

async function lockVersion(tx: Db, templateId: string, version: number): Promise<VersionRow> {
  const found = await tx.query<VersionRow>(
    `SELECT ${VERSION_COLUMNS} FROM challenge_template_versions WHERE template_id = $1 AND version = $2 FOR NO KEY UPDATE`,
    [templateId, version],
  );
  if (found.rows.length === 0) notFound();
  return found.rows[0];
}

export async function updateTemplateDraft(
  db: Db,
  actor: string,
  templateId: string,
  version: number,
  content: TemplateContent,
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockTemplate(tx, templateId);
    const row = await lockVersion(tx, templateId, version);
    if (row.state !== 'draft') {
      throw new TemplateError(409, 'template_version_immutable', 'A published version is immutable; create a revision');
    }
    await tx.query(
      `UPDATE challenge_template_versions
       SET title = $3, description = $4, summary = $5, challenge_type = $6, duration_days = $7,
           duration_preset_days = $8, cover_id = $9, focus_tags = $10, sort_order = $11,
           composer_config = $12::jsonb, last_edited_by_member_id = $13, last_edited_at = clock_timestamp()
       WHERE template_id = $1 AND version = $2`,
      [templateId, version, ...contentParams(content), actor],
    );
    await recordAudit(tx, templateId, version, 'edit_draft', actor);
  });
}

export async function validateTemplateVersion(
  db: Db,
  templateId: string,
  version: number,
): Promise<TemplateValidation> {
  const row = await readVersionRow(db, templateId, version);
  if (!row) notFound();
  return validateTemplateContent(db, contentFromRow(row));
}

async function readVersionRow(db: Db, templateId: string, version: number): Promise<VersionRow | null> {
  const found = await db.query<VersionRow>(
    `SELECT ${VERSION_COLUMNS} FROM challenge_template_versions WHERE template_id = $1 AND version = $2`,
    [templateId, version],
  );
  return found.rows[0] ?? null;
}

/**
 * Publish a draft version. Validation runs BEFORE the transaction (Knowledge
 * reads never happen inside it); the transaction then re-reads the locked
 * draft and refuses to publish if it changed since it was validated, so the
 * published snapshot is exactly the validated content.
 */
export async function publishTemplateVersion(
  db: Db,
  actor: string,
  templateId: string,
  version: number,
): Promise<{ templateId: string; version: number }> {
  const before = await readVersionRow(db, templateId, version);
  if (!before) notFound();
  if (before.state !== 'draft') {
    throw new TemplateError(409, 'template_version_immutable', 'Version is already published');
  }
  const validation = await validateTemplateContent(db, contentFromRow(before));
  if (!validation.ok) {
    throw new TemplateError(422, 'invalid_template', 'Template does not validate for publication', { issues: validation.issues });
  }
  const validatedHash = contentHash(before);
  return db.transaction(async (tx) => {
    await lockTemplate(tx, templateId);
    const row = await lockVersion(tx, templateId, version);
    if (row.state !== 'draft') {
      throw new TemplateError(409, 'template_version_immutable', 'Version is already published');
    }
    if (contentHash(row) !== validatedHash) {
      throw new TemplateError(409, 'template_changed', 'Template draft changed during publication; validate and publish again');
    }
    await tx.query(
      `UPDATE challenge_template_versions
       SET state = 'published', published_by_member_id = $3, published_at = clock_timestamp()
       WHERE template_id = $1 AND version = $2`,
      [templateId, version, actor],
    );
    await tx.query(
      `UPDATE challenge_templates
       SET lifecycle = 'published', latest_published_version = $2, latest_published_at = clock_timestamp()
       WHERE template_id = $1`,
      [templateId, version],
    );
    await recordAudit(tx, templateId, version, 'publish', actor, {
      authoredBy: row.authored_by_member_id,
      lastEditedBy: row.last_edited_by_member_id,
      publishedBy: actor,
    });
    return { templateId, version };
  });
}

/** Revision = a NEW draft seeded from the latest published version; never an edit of it. */
export async function reviseTemplate(
  db: Db,
  actor: string,
  templateId: string,
): Promise<{ templateId: string; version: number }> {
  return db.transaction(async (tx) => {
    const template = await lockTemplate(tx, templateId);
    if (template.latest_published_version === null) {
      throw new TemplateError(409, 'template_not_published', 'Only a published Template can be revised');
    }
    const open = await tx.query(
      `SELECT 1 FROM challenge_template_versions WHERE template_id = $1 AND state = 'draft'`,
      [templateId],
    );
    if (open.rows.length > 0) {
      throw new TemplateError(409, 'template_draft_open', 'This Template already has an open draft');
    }
    const source = await readVersionRow(tx, templateId, template.latest_published_version);
    if (!source) notFound();
    const next = await tx.query<{ next: number }>(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next FROM challenge_template_versions WHERE template_id = $1`,
      [templateId],
    );
    const version = Number(next.rows[0].next);
    await tx.query(
      `INSERT INTO challenge_template_versions
         (template_id, version, title, description, summary, challenge_type, duration_days, duration_preset_days,
          cover_id, focus_tags, sort_order, composer_config, authored_by_member_id, last_edited_by_member_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $13)`,
      [templateId, version, ...contentParams(contentFromRow(source)), actor],
    );
    await recordAudit(tx, templateId, version, 'revise', actor, { basedOnVersion: template.latest_published_version });
    return { templateId, version };
  });
}

export async function retireTemplate(
  db: Db,
  actor: string,
  templateId: string,
  reason: string | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockTemplate(tx, templateId);
    await tx.query(
      `UPDATE challenge_templates
       SET lifecycle = 'retired', retired_by_member_id = $2, retired_at = clock_timestamp(), retired_reason = $3
       WHERE template_id = $1`,
      [templateId, actor, reason],
    );
    await recordAudit(tx, templateId, null, 'retire', actor, reason ? { reason } : {});
  });
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export const TEMPLATE_PAGE_DEFAULT = 20;
export const TEMPLATE_PAGE_MAX = 100;

export function pageLimit(raw: unknown): number {
  const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? Math.max(1, Math.min(TEMPLATE_PAGE_MAX, parsed)) : TEMPLATE_PAGE_DEFAULT;
}

function encodeCursor(parts: unknown[]): string {
  return Buffer.from(JSON.stringify(parts), 'utf8').toString('base64url');
}

type CursorPart = 'int' | 'uuid' | 'timestamp' | 'digits';
const CURSOR_CHECKS: Record<CursorPart, (value: unknown) => boolean> = {
  int: (value) => Number.isInteger(value) && Math.abs(value as number) < 2_000_000_000,
  uuid: (value) => isTemplateUuid(value),
  timestamp: (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}[ T][0-9:.]+(Z|[+-]\d{2}(:?\d{2})?)?$/.test(value),
  digits: (value) => typeof value === 'string' && /^\d{1,18}$/.test(value),
};

function decodeCursor(raw: unknown, shape: CursorPart[]): unknown[] | null {
  if (raw === undefined || raw === '') return null;
  try {
    const parts = JSON.parse(Buffer.from(String(raw), 'base64url').toString('utf8'));
    if (Array.isArray(parts) && parts.length === shape.length
      && parts.every((part, index) => CURSOR_CHECKS[shape[index]](part))) return parts;
  } catch { /* fallthrough */ }
  throw new TemplateError(400, 'invalid_cursor', 'cursor is not valid');
}

export interface CatalogueFilters {
  q?: string;
  type?: string;
  activity?: string;
  tag?: string;
}

function likePattern(q: string): string {
  return `%${q.trim().slice(0, 120).replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

async function activityIdentities(db: Db, activity: string): Promise<string[]> {
  const identities = new Set<string>([activity]);
  try {
    const options = await describeComposerActivityOptions(db, activity);
    identities.add(options.knowledgeId);
    if (options.activityCode) identities.add(options.activityCode);
  } catch { /* unknown identity simply matches only its literal form */ }
  return [...identities];
}

async function filterClauses(db: Db, filters: CatalogueFilters, params: unknown[]): Promise<string[]> {
  const clauses: string[] = [];
  if (filters.q && filters.q.trim()) {
    params.push(likePattern(filters.q));
    const n = params.length;
    clauses.push(`(v.title ILIKE $${n} ESCAPE '\\' OR v.description ILIKE $${n} ESCAPE '\\' OR v.summary ILIKE $${n} ESCAPE '\\')`);
  }
  if (filters.type) {
    if (!['collective', 'competitive', 'streak'].includes(filters.type)) {
      throw new TemplateError(400, 'invalid_filter', 'type must be collective|competitive|streak');
    }
    params.push(filters.type);
    clauses.push(`v.challenge_type = $${params.length}`);
  }
  if (filters.tag) {
    params.push([filters.tag]);
    clauses.push(`v.focus_tags @> $${params.length}::text[]`);
  }
  if (filters.activity) {
    const parts: string[] = [];
    for (const identity of await activityIdentities(db, filters.activity)) {
      params.push(JSON.stringify([{ activity: identity }]));
      parts.push(`v.composer_config->'activities' @> $${params.length}::jsonb`);
    }
    clauses.push(`(${parts.join(' OR ')})`);
  }
  return clauses;
}

export interface MemberTemplate {
  templateId: string;
  version: number;
  title: string;
  summary: string;
  description: string | null;
  challengeType: string;
  durationDays: number;
  durationPresetDays: number[];
  coverId: string | null;
  focusTags: string[];
  composer: ChallengeComposerDraft;
  publishedAt: string | Date | null;
  adoptable: boolean;
  unavailableReason: string | null;
}

interface CatalogueRow extends VersionRow {
  cursor_published_at: string;
  catalogue_published_at: string | Date;
}

async function toMemberTemplate(db: Db, row: VersionRow): Promise<MemberTemplate> {
  const content = contentFromRow(row);
  const validation = await validateTemplateContent(db, content);
  const composer = await withDerivedKinds(db, effectiveComposer(content));
  return {
    templateId: String(row.template_id),
    version: Number(row.version),
    title: row.title as string,
    summary: row.summary as string,
    description: row.description,
    challengeType: row.challenge_type as string,
    durationDays: Number(row.duration_days),
    durationPresetDays: content.durationPresetDays ?? [],
    coverId: row.cover_id,
    focusTags: row.focus_tags ?? [],
    composer,
    publishedAt: row.published_at,
    adoptable: validation.ok,
    unavailableReason: validation.ok ? null : (validation.issues[0]?.code ?? 'NOT_ADOPTABLE'),
  };
}

/**
 * Member catalogue: only the latest published version of each non-retired
 * Template whose Activities are still current and Challenge-ready. Keyset
 * pagination; no total cap on the catalogue.
 */
export async function listMemberTemplates(
  db: Db,
  filters: CatalogueFilters,
  limit: number,
  cursorRaw: unknown,
): Promise<{ templates: MemberTemplate[]; nextCursor: string | null }> {
  const cursor = decodeCursor(cursorRaw, ['int', 'timestamp', 'uuid']);
  const templates: MemberTemplate[] = [];
  let position = cursor;
  // Bounded work per request: scan at most SCAN_CAP rows, then hand back a
  // cursor so a catalogue full of stale Templates cannot pin the server.
  const scanCap = Math.max(100, limit * 5);
  let scanned = 0;
  for (;;) {
    const params: unknown[] = [];
    const clauses = await filterClauses(db, filters, params);
    if (position) {
      params.push(position[0], position[1], position[2]);
      const n = params.length;
      clauses.push(`(v.sort_order > $${n - 2}::int OR (v.sort_order = $${n - 2}::int AND (t.latest_published_at < $${n - 1}::timestamptz OR (t.latest_published_at = $${n - 1}::timestamptz AND t.template_id > $${n}::uuid))))`);
    }
    params.push(limit);
    const batch = await db.query<CatalogueRow>(
      `SELECT ${VERSION_COLUMNS.split(',').map((column) => `v.${column.trim()}`).join(', ')},
              t.latest_published_at::text AS cursor_published_at
       FROM challenge_templates t
       JOIN challenge_template_versions v
         ON v.template_id = t.template_id AND v.version = t.latest_published_version AND v.state = 'published'
       WHERE t.lifecycle = 'published'${clauses.length ? ` AND ${clauses.join(' AND ')}` : ''}
       ORDER BY v.sort_order ASC, t.latest_published_at DESC, t.template_id ASC
       LIMIT $${params.length}`,
      params,
    );
    for (const row of batch.rows) {
      position = [Number(row.sort_order), row.cursor_published_at, String(row.template_id)];
      scanned += 1;
      const shaped = await toMemberTemplate(db, row);
      if (shaped.adoptable) templates.push(shaped);
      if (templates.length >= limit || scanned >= scanCap) {
        return { templates, nextCursor: encodeCursor(position) };
      }
    }
    if (batch.rows.length < limit) return { templates, nextCursor: null };
  }
}

/** One published version of a non-retired Template (latest when version is omitted). */
export async function getMemberTemplate(
  db: Db,
  templateId: string,
  version?: number,
): Promise<MemberTemplate> {
  const found = await db.query<VersionRow>(
    `SELECT ${VERSION_COLUMNS.split(',').map((column) => `v.${column.trim()}`).join(', ')}
     FROM challenge_templates t
     JOIN challenge_template_versions v
       ON v.template_id = t.template_id
      AND v.version = COALESCE($2::int, t.latest_published_version)
      AND v.state = 'published'
     WHERE t.template_id = $1 AND t.lifecycle = 'published'`,
    [templateId, version ?? null],
  );
  if (found.rows.length === 0) notFound();
  return toMemberTemplate(db, found.rows[0]);
}

export interface TemplateReference {
  templateId: string;
  version: number;
}

/** Resolve an establishment reference: null when unknown or not a published version. */
export async function resolvePublishedTemplateReference(
  db: Db,
  ref: TemplateReference,
): Promise<{ retired: boolean } | null> {
  const found = await db.query<{ lifecycle: string }>(
    `SELECT t.lifecycle
     FROM challenge_template_versions v
     JOIN challenge_templates t ON t.template_id = v.template_id
     WHERE v.template_id = $1 AND v.version = $2 AND v.state = 'published'`,
    [ref.templateId, ref.version],
  );
  if (found.rows.length === 0) return null;
  return { retired: found.rows[0].lifecycle === 'retired' };
}

/* Operator reads --------------------------------------------------- */

export interface OperatorTemplateSummary {
  templateId: string;
  lifecycle: string;
  createdByMemberId: string;
  createdAt: string | Date;
  latestPublishedVersion: number | null;
  latestVersion: number;
  openDraftVersion: number | null;
  title: string | null;
  summary: string | null;
  challengeType: string | null;
  durationDays: number | null;
  focusTags: string[];
}

export async function listOperatorTemplates(
  db: Db,
  filters: CatalogueFilters & { lifecycle?: string },
  limit: number,
  cursorRaw: unknown,
): Promise<{ templates: OperatorTemplateSummary[]; nextCursor: string | null }> {
  const params: unknown[] = [];
  const clauses = await filterClauses(db, filters, params);
  if (filters.lifecycle) {
    if (!['draft', 'published', 'retired'].includes(filters.lifecycle)) {
      throw new TemplateError(400, 'invalid_filter', 'lifecycle must be draft|published|retired');
    }
    params.push(filters.lifecycle);
    clauses.push(`t.lifecycle = $${params.length}`);
  }
  const cursor = decodeCursor(cursorRaw, ['timestamp', 'uuid']);
  if (cursor) {
    params.push(cursor[0], cursor[1]);
    const n = params.length;
    clauses.push(`(t.created_at < $${n - 1}::timestamptz OR (t.created_at = $${n - 1}::timestamptz AND t.template_id > $${n}::uuid))`);
  }
  params.push(limit + 1);
  const result = await db.query<Record<string, unknown>>(
    `SELECT t.template_id, t.lifecycle, t.created_by_member_id, t.created_at, t.created_at::text AS cursor_created_at,
            t.latest_published_version, v.version AS latest_version, v.title, v.summary, v.challenge_type,
            v.duration_days, v.focus_tags,
            (SELECT d.version FROM challenge_template_versions d WHERE d.template_id = t.template_id AND d.state = 'draft') AS open_draft_version
     FROM challenge_templates t
     JOIN LATERAL (SELECT * FROM challenge_template_versions x WHERE x.template_id = t.template_id ORDER BY x.version DESC LIMIT 1) v ON TRUE
     ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
     ORDER BY t.created_at DESC, t.template_id ASC
     LIMIT $${params.length}`,
    params,
  );
  const rows = result.rows.slice(0, limit);
  const last = rows[rows.length - 1];
  return {
    templates: rows.map((row) => ({
      templateId: String(row.template_id),
      lifecycle: String(row.lifecycle),
      createdByMemberId: String(row.created_by_member_id),
      createdAt: row.created_at as string | Date,
      latestPublishedVersion: row.latest_published_version === null ? null : Number(row.latest_published_version),
      latestVersion: Number(row.latest_version),
      openDraftVersion: row.open_draft_version === null ? null : Number(row.open_draft_version),
      title: row.title as string | null,
      summary: row.summary as string | null,
      challengeType: row.challenge_type as string | null,
      durationDays: row.duration_days === null ? null : Number(row.duration_days),
      focusTags: (row.focus_tags as string[]) ?? [],
    })),
    nextCursor: result.rows.length > limit && last ? encodeCursor([last.cursor_created_at, String(last.template_id)]) : null,
  };
}

export async function getOperatorTemplate(db: Db, templateId: string) {
  const template = await db.query<Record<string, unknown>>(
    `SELECT template_id, lifecycle, created_by_member_id, created_at, latest_published_version, latest_published_at,
            retired_by_member_id, retired_at, retired_reason
     FROM challenge_templates WHERE template_id = $1`,
    [templateId],
  );
  if (template.rows.length === 0) notFound();
  const versions = await db.query<VersionRow>(
    `SELECT ${VERSION_COLUMNS} FROM challenge_template_versions WHERE template_id = $1 ORDER BY version ASC`,
    [templateId],
  );
  const row = template.rows[0];
  return {
    templateId: String(row.template_id),
    lifecycle: String(row.lifecycle),
    createdByMemberId: String(row.created_by_member_id),
    createdAt: row.created_at,
    latestPublishedVersion: row.latest_published_version === null ? null : Number(row.latest_published_version),
    latestPublishedAt: row.latest_published_at,
    retiredByMemberId: row.retired_by_member_id === null ? null : String(row.retired_by_member_id),
    retiredAt: row.retired_at,
    retiredReason: row.retired_reason,
    versions: versions.rows.map((version) => ({
      version: Number(version.version),
      state: version.state,
      content: contentFromRow(version),
      authoredByMemberId: String(version.authored_by_member_id),
      authoredAt: version.authored_at,
      lastEditedByMemberId: String(version.last_edited_by_member_id),
      lastEditedAt: version.last_edited_at,
      publishedByMemberId: version.published_by_member_id === null ? null : String(version.published_by_member_id),
      publishedAt: version.published_at,
    })),
  };
}

export async function listTemplateAudit(db: Db, templateId: string, limit: number, cursorRaw: unknown) {
  const exists = await db.query('SELECT 1 FROM challenge_templates WHERE template_id = $1', [templateId]);
  if (exists.rows.length === 0) notFound();
  const cursor = decodeCursor(cursorRaw, ['digits']);
  const result = await db.query<Record<string, unknown>>(
    `SELECT event_id::text AS event_id, version, action, actor_member_id, occurred_at, detail
     FROM challenge_template_audit_events
     WHERE template_id = $1 ${cursor ? 'AND event_id > $3::bigint' : ''}
     ORDER BY event_id ASC LIMIT $2`,
    cursor ? [templateId, limit + 1, cursor[0]] : [templateId, limit + 1],
  );
  const rows = result.rows.slice(0, limit);
  return {
    events: rows.map((row) => ({
      eventId: String(row.event_id),
      version: row.version === null ? null : Number(row.version),
      action: String(row.action),
      actorMemberId: String(row.actor_member_id),
      occurredAt: row.occurred_at,
      detail: row.detail,
    })),
    nextCursor: result.rows.length > limit ? encodeCursor([String(rows[rows.length - 1].event_id)]) : null,
  };
}

/**
 * FD-TPL-04 adoption counts: Challenges that exist with this provenance —
 * i.e. successfully established (provenance is written in the establishing
 * transaction, so failed/abandoned attempts and idempotent replays leave no
 * extra rows). Derived from `challenges`; no analytics store.
 */
export async function listTemplateAdoption(
  db: Db,
  templateId: string | null,
  limit: number,
  cursorRaw: unknown,
) {
  const cursor = decodeCursor(cursorRaw, ['uuid', 'int']);
  const params: unknown[] = [];
  const clauses = [`v.state = 'published'`];
  if (templateId) { params.push(templateId); clauses.push(`v.template_id = $${params.length}`); }
  if (cursor) {
    params.push(cursor[0], cursor[1]);
    const n = params.length;
    clauses.push(`(v.template_id > $${n - 1}::uuid OR (v.template_id = $${n - 1}::uuid AND v.version > $${n}::int))`);
  }
  params.push(limit + 1);
  const result = await db.query<Record<string, unknown>>(
    `SELECT v.template_id, v.version, t.lifecycle, v.title, COUNT(c.challenge_id)::int AS adoptions
     FROM challenge_template_versions v
     JOIN challenge_templates t ON t.template_id = v.template_id
     LEFT JOIN challenges c ON c.source_template_id = v.template_id AND c.source_template_version = v.version
     WHERE ${clauses.join(' AND ')}
     GROUP BY v.template_id, v.version, t.lifecycle, v.title
     ORDER BY v.template_id ASC, v.version ASC
     LIMIT $${params.length}`,
    params,
  );
  const rows = result.rows.slice(0, limit);
  const last = rows[rows.length - 1];
  return {
    adoption: rows.map((row) => ({
      templateId: String(row.template_id),
      version: Number(row.version),
      lifecycle: String(row.lifecycle),
      title: row.title as string | null,
      adoptions: Number(row.adoptions),
    })),
    nextCursor: result.rows.length > limit && last ? encodeCursor([String(last.template_id), Number(last.version)]) : null,
  };
}
