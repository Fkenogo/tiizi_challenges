/** Deterministic dry-run-first importer for the governed S6 Activity candidate. */
import {
  createKnowledgeItem,
  assessPublicationReadiness,
  listCodedKnowledgeForAdmin,
  normalizeMeasurementContract,
  reviseKnowledgeItem,
  setLoadReportingBases,
  setMeasurementCompatibility,
  validateKnowledgeContent,
  type ApiKnowledgeItem,
  type CreateKnowledgeInput,
  type KnowledgeContentInput,
  type KnowledgeKind,
  type KcsClass,
  type KcsContentSnapshot,
} from './knowledge.js';
import { listActivityComponents, normalizeComponentSpecs as normalizeKnowledgeComponents, normalizeLoadReportingBases as normalizeKnowledgeLoadReportingBases, setActivityComponents } from './activityComponents.js';
import type { Db } from './db.js';
import { deriveS6KcsClasses, type KcsApplicabilityInput } from './s6KcsApplicability.js';

export interface S6ContentRecord extends KcsApplicabilityInput {
  candidateId: string;
  name: string;
  measurementContract: KcsApplicabilityInput['measurementContract'] & {
    loadReportingBases: string[];
    components: unknown[];
  };
  editorialNotes?: unknown[];
  sourceNotes?: unknown[];
}

export interface S6Candidate { schemaVersion: string; records: S6ContentRecord[] }
export interface S6Inventory { activities: Array<Pick<S6ContentRecord, 'activityCode' | 'candidateId' | 'name' | 'domain' | 'category' | 'classification' | 'family'>> }

export interface S6ImportEntry {
  activityCode: string;
  action: 'create' | 'update' | 'noop' | 'conflict';
  knowledgeId?: string;
  knowledgeVersion?: number;
  lifecycle?: string;
  deltas: string[];
  conflicts: string[];
  warnings: string[];
  kcsContentClasses?: string[];
  /** Exact Knowledge input resolved by planning and consumed by apply. */
  resolvedState?: CreateKnowledgeInput;
}
export interface S6ImportReport {
  mode: 'dry-run' | 'apply';
  expected: number;
  received: number;
  created: number;
  updated: number;
  unchanged: number;
  conflicts: number;
  applied: number;
  readyForIngestion: boolean;
  applicableKcsClassCounts: Record<string, number>;
  warnings: string[];
  entries: S6ImportEntry[];
  errors: string[];
}

const EXPECTED = 118;
const CODE_RE = /^(FIT|WEL)-[A-Z]{3}-\d{3}$/;
const KCS_CONTENT_KEYS = [
  'description', 'measurementGuidance', 'unitSemantics', 'setup', 'execution',
  'formCues', 'commonMistakes', 'techniqueReference', 'protocolSteps',
  'sessionFraming', 'completionMeaning', 'semanticDefinition', 'equipment',
  'environment', 'safetyNotes', 'adaptation', 'avoidanceCondition',
] as const;

export function validateS6Candidate(candidate: unknown, inventory: unknown): {
  candidate: S6Candidate | null; errors: string[]; applicableKcsClassCounts: Record<string, number>;
} {
  const errors: string[] = [];
  const root = object(candidate);
  const inv = object(inventory);
  const records = Array.isArray(root?.records) ? root.records : [];
  const expected = Array.isArray(inv?.activities) ? inv.activities : [];
  const classCounts: Record<string, number> = { U: EXPECTED, Q: 0, T: 0, P: 0, C: 0, M: 0, S: 0 };
  if (!root || !inv) return { candidate: null, errors: ['Candidate and canonical inventory must be JSON objects'], applicableKcsClassCounts: classCounts };
  for (const key of Object.keys(root)) if (!['schemaVersion', 'records'].includes(key)) errors.push(`Candidate contains unexpected top-level field '${key}'`);
  if (root.schemaVersion !== '1.0.0') errors.push(`Unsupported content candidate schemaVersion '${String(root.schemaVersion)}'`);
  if (inv.inventoryVersion !== '1.0.0' || inv.inventoryFormatVersion !== '1.0.0') errors.push('Unexpected canonical identity manifest version');
  if (records.length !== EXPECTED) errors.push(`Expected ${EXPECTED} candidate records; received ${records.length}`);
  if (expected.length !== EXPECTED) errors.push(`Canonical inventory must contain ${EXPECTED} identities; received ${expected.length}`);
  const byExpected = new Map<string, Record<string, unknown>>();
  const expectedIds = new Set<string>();
  for (const raw of expected) {
    const item = object(raw);
    const code = typeof item?.activityCode === 'string' ? item.activityCode : '';
    const candidateId = typeof item?.candidateId === 'string' ? item.candidateId : '';
    if (!CODE_RE.test(code) || byExpected.has(code) || !candidateId || expectedIds.has(candidateId)) errors.push(`Invalid or duplicate canonical inventory identity '${code}'`);
    else { byExpected.set(code, item!); expectedIds.add(candidateId); }
  }
  const byCode = new Map<string, S6ContentRecord>();
  const fitnessCodes = new Set<string>();
  const wellnessCodes = new Set<string>();
  for (const [index, raw] of records.entries()) {
    const item = object(raw);
    const code = typeof item?.activityCode === 'string' ? item.activityCode : '';
    if (!item || !CODE_RE.test(code)) { errors.push(`records[${index}] has invalid Activity Code`); continue; }
    if (byCode.has(code)) { errors.push(`Duplicate Activity Code ${code}`); continue; }
    if (!byExpected.has(code)) { errors.push(`Unexpected Activity Code ${code}`); continue; }
    const source = byExpected.get(code)!;
    for (const key of ['candidateId', 'name', 'domain', 'category', 'classification', 'family'] as const) {
      if ((item[key] ?? null) !== (source[key] ?? null)) errors.push(`${code} identity drift: ${key}`);
    }
    if (item.candidateId !== code) errors.push(`${code} candidateId must equal its canonical Activity Code`);
    const content = object(item.content);
    const contract = object(item.measurementContract);
    if (!content || !contract) { errors.push(`${code} requires content and measurementContract objects`); continue; }
    for (const noteField of ['editorialNotes', 'sourceNotes']) {
      const notes = item[noteField];
      if (notes !== undefined && (!Array.isArray(notes) || notes.some((note) => typeof note !== 'string'))) errors.push(`${code} ${noteField} must be an array of strings`);
    }
    if (item.domain === 'Fitness') fitnessCodes.add(code);
    else if (item.domain === 'Wellness') wellnessCodes.add(code);
    const allowedRecordFields = new Set(['activityCode', 'candidateId', 'name', 'domain', 'category', 'classification', 'family', 'content', 'measurementContract', 'editorialNotes', 'sourceNotes']);
    for (const key of Object.keys(item)) if (!allowedRecordFields.has(key)) errors.push(`${code} contains consultant/system field '${key}'`);
    const allowedContentFields = new Set<string>(KCS_CONTENT_KEYS);
    for (const key of Object.keys(content)) if (!allowedContentFields.has(key)) errors.push(`${code} contains unmapped content field '${key}'`);
    const allowedContractFields = new Set(['primaryMetrics', 'secondaryMetrics', 'compatibleUnits', 'loadReportingBases', 'components']);
    for (const key of Object.keys(contract)) if (!allowedContractFields.has(key)) errors.push(`${code} contains unsupported contract field '${key}'`);
    for (const key of KCS_CONTENT_KEYS) {
      const value = content[key];
      if (value !== undefined && typeof value !== 'string' && !Array.isArray(value)) errors.push(`${code} content.${key} has invalid structure`);
      if (Array.isArray(value) && value.some((entry) => typeof entry !== 'string' && key !== 'protocolSteps')) errors.push(`${code} content.${key} must contain strings`);
    }
    try {
      const metrics = normalizeMeasurementContract(contract);
      if (!sameArray(stringArray(contract.primaryMetrics), metrics.primaryMetrics)
        || !sameArray(stringArray(contract.secondaryMetrics), metrics.secondaryMetrics)
        || !sameArray(stringArray(contract.compatibleUnits), metrics.compatibleUnits)) {
        errors.push(`${code} measurement arrays contain duplicates that Knowledge normalization would remove`);
      }
      if (!metrics.primaryMetrics.length) errors.push(`${code} requires at least one primary metric`);
      if (!metrics.compatibleUnits.length) errors.push(`${code} requires at least one compatible unit`);
      const bases = normalizeKnowledgeLoadReportingBases(contract.loadReportingBases);
      if (!sameArray(stringArray(contract.loadReportingBases), bases)) errors.push(`${code} loadReportingBases contains duplicates that Knowledge normalization would remove`);
      if (bases.length && ![...metrics.primaryMetrics, ...metrics.secondaryMetrics].includes('weight')) errors.push(`${code} load bases require Weight`);
      const components = normalizeKnowledgeComponents(contract.components);
      const activity: S6ContentRecord = { ...item, content, measurementContract: { ...contract, ...metrics, loadReportingBases: bases, components } } as unknown as S6ContentRecord;
      const classes = deriveS6KcsClasses(activity);
      for (const kcs of classes) classCounts[kcs] = (classCounts[kcs] ?? 0) + 1;
      const validatedContent = validateKnowledgeContent(activity.domain === 'Fitness' ? 'fitness' : 'wellness', toCreateInput(activity), true);
      for (const key of [
        'name', 'category', 'subcategory', 'description', 'measurementGuidance', 'unitSemantics',
        'setup', 'execution', 'formCues', 'commonMistakes', 'techniqueReference', 'equipment',
        'environment', 'adaptation', 'protocolSteps', 'completionMeaning', 'avoidanceCondition',
        'semanticDefinition', 'safetyNotes', 'contentClasses',
      ] as const) {
        const supplied = key === 'contentClasses' ? declaredClasses(activity)
          : key === 'name' ? activity.name
          : key === 'category' ? activity.category
          : key === 'subcategory' ? activity.classification ?? activity.family ?? ''
          : activity.content[key];
        const normalized = validatedContent[key];
        if (!equal(normalized, supplied ?? (Array.isArray(normalized) ? [] : ''))) {
          errors.push(`${code} ${key} would be changed by Knowledge normalization; shorten/normalize it before ingestion`);
        }
      }
      byCode.set(code, activity);
    } catch (error) {
      errors.push(`${code}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  for (const code of byExpected.keys()) if (!byCode.has(code)) errors.push(`Missing canonical Activity ${code}`);
  if (fitnessCodes.size !== 84) errors.push(`Expected 84 Fitness Activities; received ${fitnessCodes.size}`);
  if (wellnessCodes.size !== 34) errors.push(`Expected 34 Wellness Activities; received ${wellnessCodes.size}`);
  if (errors.length) return { candidate: null, errors, applicableKcsClassCounts: classCounts };
  return { candidate: { schemaVersion: String(root.schemaVersion ?? ''), records: [...byCode.values()].sort((a, b) => a.activityCode.localeCompare(b.activityCode)) }, errors, applicableKcsClassCounts: classCounts };
}

export async function planS6CatalogueImport(
  db: Db,
  candidateInput: unknown,
  inventoryInput: unknown,
): Promise<S6ImportReport> {
  const checked = validateS6Candidate(candidateInput, inventoryInput);
  const report = emptyReport('dry-run', checked.errors, checked.applicableKcsClassCounts, Array.isArray(object(candidateInput)?.records) ? object(candidateInput)!.records.length : 0);
  if (!checked.candidate) return report;
  const stored = await listCodedKnowledgeForAdmin(db);
  const byCode = new Map<string, ApiKnowledgeItem>();
  for (const item of stored) {
    if (!item.activityCode) continue;
    if (byCode.has(item.activityCode)) report.errors.push(`Database contains duplicate Activity Code ${item.activityCode}`);
    byCode.set(item.activityCode, item);
  }
  const expectedCodes = new Set(checked.candidate.records.map((record) => record.activityCode));
  for (const code of byCode.keys()) if (!expectedCodes.has(code)) report.errors.push(`Database contains coded Activity outside the S6 identity manifest: ${code}`);
  for (const record of checked.candidate.records) {
    if ((record.editorialNotes?.length ?? 0) > 0) report.warnings.push(`${record.activityCode}: editorialNotes are retained in source candidate but not persisted to Knowledge`);
    if ((record.sourceNotes?.length ?? 0) > 0) report.warnings.push(`${record.activityCode}: sourceNotes are retained in source candidate but not persisted to Knowledge`);
    const existing = byCode.get(record.activityCode);
    const components = existing ? await listActivityComponents(db, existing.id) : [];
    const entry = existing ? planExisting(existing, record, components) : planCreate(record);
    for (const warning of entry.warnings) report.warnings.push(`${record.activityCode}: ${warning}`);
    report.entries.push(entry);
    if (entry.action === 'create') report.created++;
    else if (entry.action === 'update') report.updated++;
    else if (entry.action === 'noop') report.unchanged++;
    else report.conflicts++;
  }
  const missingResolvedStates = report.entries.filter(
    (entry) => (entry.action === 'create' || entry.action === 'update') && entry.resolvedState === undefined,
  );
  for (const entry of missingResolvedStates) report.errors.push(`${entry.activityCode}: actionable reconciliation has no resolved mutation state`);
  report.conflicts += report.errors.length;
  report.readyForIngestion = report.errors.length === 0 && report.conflicts === 0 && report.entries.length === EXPECTED;
  return report;
}

export async function importS6Catalogue(
  db: Db,
  candidate: unknown,
  inventory: unknown,
  mode: 'dry-run' | 'apply' = 'dry-run',
): Promise<S6ImportReport> {
  const initial = await planS6CatalogueImport(db, candidate, inventory);
  initial.mode = mode;
  if (mode === 'dry-run' || !initial.readyForIngestion) return initial;
  let applied = 0;
  for (const entry of initial.entries) {
    if (entry.action === 'noop') continue;
    if (entry.action === 'conflict') return { ...initial, applied, readyForIngestion: false };
    if (!entry.resolvedState) {
      initial.errors.push(`${entry.activityCode}: reconciliation plan has no resolved mutation payload`);
      initial.readyForIngestion = false;
      initial.applied = applied;
      return initial;
    }
    try {
      await db.transaction(async (tx) => {
        if (entry.action === 'create') {
          await createKnowledgeItem(tx, entry.resolvedState!);
          return;
        }
        const locked = await tx.query<{ knowledge_id: string; current_version: number; lifecycle: string }>(
          'SELECT knowledge_id, current_version, lifecycle FROM knowledge_items WHERE activity_code = $1 FOR UPDATE',
          [entry.activityCode],
        );
        if (!locked.rows[0] || locked.rows[0].knowledge_id !== entry.knowledgeId
          || Number(locked.rows[0].current_version) !== entry.knowledgeVersion
          || locked.rows[0].lifecycle !== entry.lifecycle) {
          throw new Error(`Activity ${entry.activityCode} changed after dry-run planning`);
        }
        const before = await listCodedKnowledgeForAdmin(tx);
        const current = before.find((item) => item.activityCode === entry.activityCode);
        if (!current || current.id !== entry.knowledgeId) throw new Error(`Activity ${entry.activityCode} changed after dry-run planning`);
        await applyExistingDelta(tx, current, entry);
      });
      applied++;
    } catch (error) {
      initial.errors.push(`${entry.activityCode}: ${error instanceof Error ? error.message : String(error)}`);
      initial.readyForIngestion = false;
      initial.applied = applied;
      return initial;
    }
  }
  initial.applied = applied;
  return initial;
}

function planCreate(record: S6ContentRecord): S6ImportEntry {
  return {
    activityCode: record.activityCode,
    action: 'create',
    deltas: ['initial-content-and-product-contract'],
    conflicts: [],
    warnings: [],
    kcsContentClasses: declaredClasses(record),
    resolvedState: toCreateInput(record),
  };
}

function planExisting(item: ApiKnowledgeItem, record: S6ContentRecord, existingComponents: unknown[]): S6ImportEntry {
  const entry: S6ImportEntry = { activityCode: record.activityCode, action: 'noop', knowledgeId: item.id, knowledgeVersion: item.knowledgeVersion, lifecycle: item.lifecycle, deltas: [], conflicts: [], warnings: [], kcsContentClasses: declaredClasses(record) };
  const identity = { name: record.name, kind: record.domain.toLowerCase(), category: record.category, subcategory: record.classification ?? record.family ?? '' };
  if (item.name !== identity.name) entry.conflicts.push(`name conflict: stored '${item.name}', candidate '${identity.name}'`);
  if (item.kind !== identity.kind) entry.conflicts.push(`domain conflict: stored '${item.kind}', candidate '${identity.kind}'`);
  if (item.category !== identity.category) entry.conflicts.push(`category conflict: stored '${item.category}', candidate '${identity.category}'`);
  if (item.subcategory !== identity.subcategory) entry.conflicts.push(`classification/family conflict: stored '${item.subcategory}', candidate '${identity.subcategory}'`);
  const content = desiredContent(record);
  if (isExemplar(record.activityCode)) {
    for (const key of KCS_CONTENT_KEYS) {
      const desired = content[key as keyof KnowledgeContentInput];
      const current = item[key as keyof ApiKnowledgeItem];
      if (hasContent(current) && (!hasContent(desired) || !equal(current, desired))) {
        entry.warnings.push(`approved exemplar content retained for ${key}`);
        (content as Record<string, unknown>)[key] = current;
      }
    }
    if (!sameArray(item.primaryMetrics, record.measurementContract.primaryMetrics)
      || !sameArray(item.secondaryMetrics, record.measurementContract.secondaryMetrics)
      || !sameArray(item.compatibleUnits, record.measurementContract.compatibleUnits)
      || !sameArray(item.loadReportingBases, record.measurementContract.loadReportingBases)) {
      entry.conflicts.push('approved exemplar measurement contract differs; candidate contract not applied');
    }
    if (!equal(normalizeKnowledgeComponents(existingComponents), normalizeKnowledgeComponents(record.measurementContract.components))) {
      entry.conflicts.push('approved exemplar component contract differs; candidate components not applied');
    }
  }
  if (entry.conflicts.length > 0) {
    entry.action = 'conflict';
    return entry;
  }
  const preserved = { ...content, activityCode: record.activityCode, difficulty: item.difficulty, metricUnit: item.metricUnit };
  const resolvedState = {
    ...toCreateInput(record),
    ...preserved,
    kind: item.kind,
    lifecycle: undefined,
  } as CreateKnowledgeInput;
  const beforeContent = contentProjection(item);
  const afterContent = contentProjection(preserved);
  const changedContentFields = [...new Set([...Object.keys(beforeContent), ...Object.keys(afterContent)])]
    .filter((key) => key === 'contentClasses'
      ? !sameArray(beforeContent[key] as string[], afterContent[key] as string[])
      : !equal(beforeContent[key], afterContent[key]));
  if (changedContentFields.length) entry.deltas.push(...changedContentFields.map((key) => `content:${key}`));
  if (!sameArray(item.contentClasses, declaredClasses(record))) entry.deltas.push('content:contentClasses');
  if (item.lifecycle === 'published' && entry.deltas.some((delta) => delta.startsWith('content:'))) {
    const issues = assessPublicationReadiness(
      item.kind,
      declaredClasses(record) as KcsClass[],
      readinessSnapshot(preserved, record.measurementContract.compatibleUnits),
    );
    if (issues.length) entry.conflicts.push(`published content revision would fail KCS: ${issues.map((issue) => `${issue.field} (${issue.class})`).join(', ')}`);
  }
  if (!sameArray(item.primaryMetrics, record.measurementContract.primaryMetrics)
    || !sameArray(item.secondaryMetrics, record.measurementContract.secondaryMetrics)
    || !sameArray(item.compatibleUnits, record.measurementContract.compatibleUnits)) entry.deltas.push('measurement-contract');
  if (!sameArray(item.loadReportingBases, record.measurementContract.loadReportingBases)) entry.deltas.push('load-reporting-bases');
  if (!equal(normalizeKnowledgeComponents(existingComponents), normalizeKnowledgeComponents(record.measurementContract.components))) entry.deltas.push('components');
  entry.action = entry.conflicts.length ? 'conflict' : entry.deltas.length ? 'update' : 'noop';
  entry.resolvedState = resolvedState;
  return entry;
}

function desiredContent(record: S6ContentRecord): Record<string, unknown> {
  const c = record.content;
  return {
    kind: record.domain.toLowerCase(), activityCode: record.activityCode, name: record.name,
    category: record.category, subcategory: record.classification ?? record.family ?? '',
    description: c.description ?? '', contentClasses: declaredClasses(record),
    measurementGuidance: c.measurementGuidance ?? '', unitSemantics: c.unitSemantics ?? '',
    setup: c.setup ?? '', execution: c.execution ?? '', formCues: c.formCues ?? [],
    commonMistakes: c.commonMistakes ?? [], techniqueReference: c.techniqueReference ?? '',
    protocolSteps: c.protocolSteps ?? [], sessionFraming: c.sessionFraming ?? '',
    completionMeaning: c.completionMeaning ?? '', semanticDefinition: c.semanticDefinition ?? '',
    equipment: c.equipment ?? '', environment: c.environment ?? '', safetyNotes: c.safetyNotes ?? [],
    adaptation: c.adaptation ?? '', avoidanceCondition: c.avoidanceCondition ?? '',
  };
}

function toCreateInput(record: S6ContentRecord): CreateKnowledgeInput {
  return {
    ...(desiredContent(record) as KnowledgeContentInput), kind: record.domain.toLowerCase() as KnowledgeKind,
    lifecycle: 'draft',
    primaryMetrics: record.measurementContract.primaryMetrics,
    secondaryMetrics: record.measurementContract.secondaryMetrics,
    compatibleUnits: record.measurementContract.compatibleUnits,
    loadReportingBases: record.measurementContract.loadReportingBases,
    components: record.measurementContract.components,
  };
}

async function applyExistingDelta(db: Db, item: ApiKnowledgeItem, entry: S6ImportEntry): Promise<void> {
  const resolved = entry.resolvedState;
  if (!resolved) throw new Error(`${entry.activityCode}: missing resolved plan state`);
  const contract = {
    primaryMetrics: stringArray(resolved.primaryMetrics),
    secondaryMetrics: stringArray(resolved.secondaryMetrics),
    compatibleUnits: stringArray(resolved.compatibleUnits),
    loadReportingBases: stringArray(resolved.loadReportingBases),
    components: Array.isArray(resolved.components) ? resolved.components : [],
  };
  const deltas = entry.deltas;
  if (deltas.some((delta) => delta.startsWith('content:'))) {
    await reviseKnowledgeItem(db, item.id, resolved);
  }
  if (deltas.includes('measurement-contract')) await setMeasurementCompatibility(db, item.id, contract);
  if (deltas.includes('load-reporting-bases')) await setLoadReportingBases(db, item.id, contract.loadReportingBases);
  const currentComponents = await listActivityComponents(db, item.id);
  if (!equal(normalizeKnowledgeComponents(currentComponents), normalizeKnowledgeComponents(contract.components))) {
    await setActivityComponents(db, item.id, contract.components);
  }
}

function declaredClasses(record: S6ContentRecord): string[] {
  // U is explicit in existing persisted content; Fitness safety is automatic
  // in effectiveContentClasses and is not redundantly declared.
  return ['U', ...deriveS6KcsClasses(record).filter((value) => !(record.domain === 'Fitness' && value === 'S'))].sort();
}
function contentProjection(value: Record<string, unknown> | ApiKnowledgeItem): Record<string, unknown> {
  const record = value as Record<string, unknown>;
  return Object.fromEntries(['name', 'category', 'subcategory', ...KCS_CONTENT_KEYS, 'contentClasses'].map((key) => [key, record[key] ?? (key.endsWith('Cues') || key.endsWith('Mistakes') || key.endsWith('Notes') || key === 'protocolSteps' || key === 'contentClasses' ? [] : '')]));
}
function isExemplar(code: string): boolean { return code === 'FIT-STR-001' || code === 'WEL-MND-003'; }
function hasContent(value: unknown): boolean { return typeof value === 'string' ? value.trim().length > 0 : Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null; }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []; }
function sameArray(left: string[], right: string[]): boolean { return equal([...left].sort(), [...right].sort()); }
function readinessSnapshot(content: Record<string, unknown>, compatibleUnits: string[]): KcsContentSnapshot {
  return {
    name: String(content.name ?? ''), description: String(content.description ?? ''), category: String(content.category ?? ''),
    metricUnit: String(content.metricUnit ?? ''), compatibleUnits, measurementGuidance: String(content.measurementGuidance ?? ''),
    unitSemantics: String(content.unitSemantics ?? ''), setup: String(content.setup ?? ''), execution: String(content.execution ?? ''),
    techniqueReference: String(content.techniqueReference ?? ''), formCues: stringArray(content.formCues),
    commonMistakes: stringArray(content.commonMistakes), equipment: String(content.equipment ?? ''), environment: String(content.environment ?? ''),
    adaptation: String(content.adaptation ?? ''), protocolSteps: content.protocolSteps ?? [], sessionFraming: String(content.sessionFraming ?? ''),
    completionMeaning: String(content.completionMeaning ?? ''), avoidanceCondition: String(content.avoidanceCondition ?? ''),
    semanticDefinition: String(content.semanticDefinition ?? ''), safetyNotes: stringArray(content.safetyNotes),
  };
}
function equal(left: unknown, right: unknown): boolean { return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right)); }
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return value;
}
function object(value: unknown): Record<string, any> | null { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null; }
function emptyReport(mode: 'dry-run' | 'apply', errors: string[], applicableKcsClassCounts: Record<string, number>, received: number): S6ImportReport {
  return { mode, expected: EXPECTED, received, created: 0, updated: 0, unchanged: 0, conflicts: 0, applied: 0, readyForIngestion: false, applicableKcsClassCounts, warnings: [], entries: [], errors: [...errors] };
}
