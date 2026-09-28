import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getKnowledgeByCode, getKnowledgeVersion, createKnowledgeItem, setKnowledgeLifecycle, setMeasurementCompatibility, listKnowledgeForAdmin } from '../src/knowledge.js';
import { importS6Catalogue, planS6CatalogueImport, validateS6Candidate } from '../src/knowledgeCatalogueImport.js';
import { deriveS6KcsClasses } from '../src/s6KcsApplicability.js';
import { breathingPracticeExemplarInput, pushUpExemplarInput } from '../src/pf01Exemplars.js';
import { testDb } from './helpers.js';

const readJson = async (path: string) => JSON.parse(await readFile(resolve(process.cwd(), path), 'utf8')) as Record<string, any>;
const load = async () => Promise.all([
  readJson('../docs/programme/working/s6-content/tiizi-118-activity-reconciled-content.json'),
  readJson('../docs/programme/working/s6-content/activity-master-inventory.json'),
]);
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('S6 deterministic Knowledge catalogue importer', () => {
  it('accepts exactly the 118 canonical identities and derives applicable KCS classes', async () => {
    const [candidate, inventory] = await load();
    const checked = validateS6Candidate(candidate, inventory);
    expect(checked.errors).toEqual([]);
    expect(checked.candidate?.records).toHaveLength(118);
    expect(checked.applicableKcsClassCounts).toMatchObject({ U: 118, Q: 111, T: 84, P: 34, C: 43, M: 7, S: 118 });
    expect(checked.applicableKcsClassCounts.U).toBe(118);
  });

  it('rejects missing, unexpected, duplicate, identity-drifted and malformed contract data', async () => {
    const [candidate, inventory] = await load();
    const missing = copy(candidate); missing.records.pop();
    expect(validateS6Candidate(missing, inventory).errors.join('\n')).toContain('Expected 118');
    const unexpected = copy(candidate); unexpected.records[0].activityCode = 'FIT-STR-999';
    expect(validateS6Candidate(unexpected, inventory).errors.join('\n')).toContain('Unexpected Activity Code');
    const duplicate = copy(candidate); duplicate.records[1].activityCode = duplicate.records[0].activityCode;
    expect(validateS6Candidate(duplicate, inventory).errors.join('\n')).toContain('Duplicate Activity Code');
    const drift = copy(candidate); drift.records[0].name = 'Renamed by consultant';
    expect(validateS6Candidate(drift, inventory).errors.join('\n')).toContain('identity drift: name');
    const invalidMetric = copy(candidate); invalidMetric.records[0].measurementContract.primaryMetrics = ['score'];
    expect(validateS6Candidate(invalidMetric, inventory).errors.join('\n')).toContain('canonical Metrics');
    const duplicateMetric = copy(candidate); duplicateMetric.records[0].measurementContract.primaryMetrics = ['repetitions', 'repetitions'];
    expect(validateS6Candidate(duplicateMetric, inventory).errors.join('\n')).toContain('measurement arrays contain duplicates');
    const invalidPair = copy(candidate); invalidPair.records[0].measurementContract.compatibleUnits = ['hours'];
    expect(validateS6Candidate(invalidPair, inventory).errors.join('\n')).toContain("expresses Metric 'duration'");
    const invalidUnit = copy(candidate); invalidUnit.records[0].measurementContract.compatibleUnits = ['cups'];
    expect(validateS6Candidate(invalidUnit, inventory).errors.join('\n')).toContain('must list governed Units');
    const injectedAuthority = copy(candidate); injectedAuthority.records[0].uuid = '11111111-1111-4111-8111-111111111111';
    expect(validateS6Candidate(injectedAuthority, inventory).errors.join('\n')).toContain("consultant/system field 'uuid'");
    const invalidBasis = copy(candidate); invalidBasis.records[0].measurementContract.loadReportingBases = ['MADE_UP'];
    expect(validateS6Candidate(invalidBasis, inventory).errors.join('\n')).toContain('not an authorized Load Reporting Basis');
    const lossyContent = copy(candidate); lossyContent.records[0].content.description = 'x'.repeat(2100);
    expect(validateS6Candidate(lossyContent, inventory).errors.join('\n')).toContain('description would be changed by Knowledge normalization');
  });

  it('uses the canonical identity as key and creates all new Activities Draft with UUIDs owned by PostgreSQL', async () => {
    const [candidate, inventory] = await load();
    const before = await testDb().query<{ count: string }>('SELECT count(*)::text AS count FROM knowledge_items');
    expect(before.rows[0].count).toBe('0');
    const preview = await importS6Catalogue(testDb(), candidate, inventory);
    expect(preview.mode).toBe('dry-run');
    expect(preview.readyForIngestion).toBe(true);
    expect(preview.created).toBe(118);
    expect(preview.entries.filter((entry) => entry.action === 'create' || entry.action === 'update').every((entry) => entry.resolvedState !== undefined)).toBe(true);
    expect((await testDb().query<{ count: string }>('SELECT count(*)::text AS count FROM knowledge_items')).rows[0].count).toBe('0');
    const plannedCreate = preview.entries.find((entry) => entry.activityCode === 'FIT-STR-002')!;
    const plannedRecord = candidate.records.find((record: any) => record.activityCode === 'FIT-STR-002');
    expect(plannedCreate.resolvedState).toMatchObject({ kind: 'fitness', lifecycle: 'draft', activityCode: 'FIT-STR-002' });
    expect(plannedCreate.resolvedState!.primaryMetrics).toEqual(plannedRecord.measurementContract.primaryMetrics);
    expect([...(plannedCreate.resolvedState!.compatibleUnits as string[])].sort()).toEqual([...plannedRecord.measurementContract.compatibleUnits].sort());

    const applied = await importS6Catalogue(testDb(), candidate, inventory, 'apply');
    expect(applied.readyForIngestion).toBe(true);
    expect(applied.applied).toBe(118);
    const items = await listKnowledgeForAdmin(testDb(), {});
    expect(items).toHaveLength(118);
    expect(items.every((item) => item.lifecycle === 'draft' && !item.challengeEligible)).toBe(true);
    expect(items.every((item) => /^[0-9a-f-]{36}$/i.test(item.id))).toBe(true);
    expect((await getKnowledgeByCode(testDb(), 'WEL-NUT-009'))?.safetyNotes).toEqual(
      candidate.records.find((record: any) => record.activityCode === 'WEL-NUT-009').content.safetyNotes,
    );
    const created = (await getKnowledgeByCode(testDb(), 'FIT-STR-002'))!;
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);
    const contentFields = [
      'name', 'activityCode', 'category', 'subcategory', 'description', 'measurementGuidance', 'unitSemantics',
      'setup', 'execution', 'formCues', 'commonMistakes', 'techniqueReference', 'protocolSteps',
      'sessionFraming', 'completionMeaning', 'semanticDefinition', 'equipment', 'environment', 'safetyNotes',
      'adaptation', 'avoidanceCondition', 'contentClasses',
    ] as const;
    for (const field of contentFields) expect(created[field]).toEqual(plannedCreate.resolvedState![field]);
    expect(created.lifecycle).toBe(plannedCreate.resolvedState!.lifecycle);
    expect(created.primaryMetrics).toEqual(plannedCreate.resolvedState!.primaryMetrics);
    expect(created.secondaryMetrics).toEqual(plannedCreate.resolvedState!.secondaryMetrics);
    expect([...created.compatibleUnits].sort()).toEqual([...(plannedCreate.resolvedState!.compatibleUnits as string[])].sort());
    expect(created.loadReportingBases).toEqual(plannedCreate.resolvedState!.loadReportingBases);
    const rerun = await planS6CatalogueImport(testDb(), candidate, inventory);
    expect(rerun.readyForIngestion).toBe(true);
    expect(rerun.created).toBe(0);
    expect(rerun.updated).toBe(0);
    expect(rerun.unchanged).toBe(118);
    const versionsBeforeNoopApply = (await testDb().query<{ count: string }>('SELECT count(*)::text AS count FROM knowledge_item_versions')).rows[0].count;
    const noopApply = await importS6Catalogue(testDb(), candidate, inventory, 'apply');
    expect(noopApply.applied).toBe(0);
    expect(noopApply.unchanged).toBe(118);
    expect((await testDb().query<{ count: string }>('SELECT count(*)::text AS count FROM knowledge_item_versions')).rows[0].count).toBe(versionsBeforeNoopApply);
  });

  it('preserves an existing UUID and lifecycle, and adds only one version for a real content delta', async () => {
    const [candidate, inventory] = await load();
    const existing = await createKnowledgeItem(testDb(), pushUpExemplarInput());
    await setMeasurementCompatibility(testDb(), existing.id, { primaryMetrics: ['repetitions'], compatibleUnits: ['reps'] });
    await setKnowledgeLifecycle(testDb(), existing.id, 'published');
    const originalVersion = (await getKnowledgeByCode(testDb(), 'FIT-STR-001'))!.knowledgeVersion;
    const changed = copy(candidate);
    changed.records.find((x: any) => x.activityCode === 'FIT-STR-002').content.description += ' Updated editorial detail.';
    // Approved exemplar content is authoritative; consultant wording cannot replace it.
    const protectedPreview = await planS6CatalogueImport(testDb(), changed, inventory);
    expect(protectedPreview.entries.find((x) => x.activityCode === 'FIT-STR-001')?.action).toBe('noop');
    await importS6Catalogue(testDb(), candidate, inventory, 'apply');
    const originalDraft = (await getKnowledgeByCode(testDb(), 'FIT-STR-002'))!;
    const applied = await importS6Catalogue(testDb(), changed, inventory, 'apply');
    expect(applied.updated).toBe(1);
    const changedVersion = (await getKnowledgeByCode(testDb(), 'FIT-STR-002'))!.knowledgeVersion;
    expect(changedVersion).toBe(originalDraft.knowledgeVersion + 1);
    const noop = await planS6CatalogueImport(testDb(), changed, inventory);
    expect(noop.updated).toBe(0);
    expect(noop.unchanged).toBe(118);
    // An already populated subset is reconciled by code without replacing its UUID or lifecycle.
    const itemAfter = (await getKnowledgeByCode(testDb(), 'FIT-STR-001'))!;
    expect(itemAfter.id).toBe(existing.id);
    expect(itemAfter.lifecycle).toBe('published');
    expect(itemAfter.knowledgeVersion).toBe(originalVersion);
  });

  it('protects Push-Up and Breathing Practice exemplar identity, lifecycle and approved content', async () => {
    const [candidate, inventory] = await load();
    const push = await createKnowledgeItem(testDb(), pushUpExemplarInput());
    await setMeasurementCompatibility(testDb(), push.id, { primaryMetrics: ['repetitions'], compatibleUnits: ['reps'] });
    await setKnowledgeLifecycle(testDb(), push.id, 'published');
    const breath = await createKnowledgeItem(testDb(), breathingPracticeExemplarInput());
    await setMeasurementCompatibility(testDb(), breath.id, { primaryMetrics: ['completion', 'duration'], compatibleUnits: ['completion', 'minutes', 'seconds'] });
    await setKnowledgeLifecycle(testDb(), breath.id, 'published');
    const breathingVersionBeforeImport = (await getKnowledgeByCode(testDb(), 'WEL-MND-003'))!.knowledgeVersion;
    const approvedMeasurementGuidance = (await getKnowledgeByCode(testDb(), 'WEL-MND-003'))!.measurementGuidance;
    const report = await planS6CatalogueImport(testDb(), candidate, inventory);
    expect(report.entries.find((x) => x.activityCode === 'FIT-STR-001')?.action).toBe('noop');
    expect(report.entries.find((x) => x.activityCode === 'WEL-MND-003')?.action).toBe('update');
    expect(report.entries.find((x) => x.activityCode === 'WEL-MND-003')?.warnings).toContain('approved exemplar content retained for measurementGuidance');
    const breathingPlan = report.entries.find((x) => x.activityCode === 'WEL-MND-003') as any;
    expect(breathingPlan.resolvedState.measurementGuidance).toBe(approvedMeasurementGuidance);
    expect(breathingPlan.resolvedState.measurementGuidance).not.toBe(
      candidate.records.find((record: any) => record.activityCode === 'WEL-MND-003').content.measurementGuidance,
    );
    const applied = await importS6Catalogue(testDb(), candidate, inventory, 'apply');
    expect(applied.applied).toBe(117);
    expect((await getKnowledgeByCode(testDb(), 'FIT-STR-001'))?.id).toBe(push.id);
    const reconciledBreathing = (await getKnowledgeByCode(testDb(), 'WEL-MND-003'))!;
    expect(reconciledBreathing.id).toBe(breath.id);
    expect(reconciledBreathing.lifecycle).toBe('published');
    expect(reconciledBreathing.knowledgeVersion).toBe(breathingVersionBeforeImport + 1);
    expect(reconciledBreathing.measurementGuidance).toBe(approvedMeasurementGuidance);
    const breathingVersionAfterImport = await getKnowledgeVersion(testDb(), breath.id, breathingVersionBeforeImport + 1);
    expect(breathingVersionAfterImport?.measurementGuidance).toBe(approvedMeasurementGuidance);
    expect(breathingVersionAfterImport?.setup).toBe(breathingPlan.resolvedState.setup);
    expect(reconciledBreathing.id).toBe(breath.id);
    expect((await getKnowledgeByCode(testDb(), 'WEL-MND-003'))?.activityCode).toBe('WEL-MND-003');
    expect((await testDb().query<{ count: string }>("SELECT count(*)::text AS count FROM knowledge_items WHERE activity_code = 'WEL-MND-003'")).rows[0].count).toBe('1');
  });

  it('resumes an already partially populated catalogue by Activity Code without replacing UUIDs', async () => {
    const [candidate, inventory] = await load();
    const record = candidate.records.find((x: any) => x.activityCode === 'FIT-STR-002');
    const partial = await createKnowledgeItem(testDb(), {
      kind: 'fitness', activityCode: record.activityCode, name: record.name,
      category: record.category, subcategory: record.family ?? record.classification ?? '',
      contentClasses: ['U', ...deriveS6KcsClasses(record).filter((x) => x !== 'S')],
      ...record.content,
      primaryMetrics: record.measurementContract.primaryMetrics,
      secondaryMetrics: record.measurementContract.secondaryMetrics,
      compatibleUnits: record.measurementContract.compatibleUnits,
      loadReportingBases: record.measurementContract.loadReportingBases,
      components: record.measurementContract.components,
    });
    const result = await importS6Catalogue(testDb(), candidate, inventory, 'apply');
    expect(result.readyForIngestion).toBe(true);
    expect(result.applied).toBe(117);
    expect((await getKnowledgeByCode(testDb(), 'FIT-STR-002'))?.id).toBe(partial.id);
    expect((await listKnowledgeForAdmin(testDb(), {}))).toHaveLength(118);
  });

  it('fails closed when an existing Activity Code is attached to a different canonical name', async () => {
    const [candidate, inventory] = await load();
    const record = candidate.records.find((x: any) => x.activityCode === 'FIT-STR-002');
    await createKnowledgeItem(testDb(), {
      kind: 'fitness', activityCode: record.activityCode, name: 'Different Activity',
      category: record.category, subcategory: record.family ?? '',
      description: 'A record deliberately conflicting with the canonical identity.',
      contentClasses: ['U'],
    });
    const report = await planS6CatalogueImport(testDb(), candidate, inventory);
    const entry = report.entries.find((x) => x.activityCode === 'FIT-STR-002')!;
    expect(entry.action).toBe('conflict');
    expect(entry.conflicts.join(' ')).toContain('name conflict');
    expect(report.readyForIngestion).toBe(false);
    const beforeApply = (await testDb().query<{ items: string; versions: string }>(
      'SELECT (SELECT count(*)::text FROM knowledge_items) AS items, (SELECT count(*)::text FROM knowledge_item_versions) AS versions',
    )).rows[0];
    const apply = await importS6Catalogue(testDb(), candidate, inventory, 'apply');
    const afterApply = (await testDb().query<{ items: string; versions: string }>(
      'SELECT (SELECT count(*)::text FROM knowledge_items) AS items, (SELECT count(*)::text FROM knowledge_item_versions) AS versions',
    )).rows[0];
    expect(apply.applied).toBe(0);
    expect(afterApply).toEqual(beforeApply);
  });

  it('keeps Fasting as duration/hours, servings as quantity/servings, and optional Weight bases empty', async () => {
    const [candidate, inventory] = await load();
    const checked = validateS6Candidate(candidate, inventory);
    expect(checked.errors).toEqual([]);
    const record = (code: string) => checked.candidate!.records.find((x) => x.activityCode === code)!;
    expect(record('WEL-NUT-009').measurementContract).toMatchObject({ primaryMetrics: ['duration'], compatibleUnits: ['hours'] });
    for (const code of ['WEL-NUT-002', 'WEL-NUT-003']) expect(record(code).measurementContract).toMatchObject({ primaryMetrics: ['quantity'], compatibleUnits: ['servings'] });
    for (const code of ['FIT-STR-019', 'FIT-STR-023', 'FIT-STR-025', 'FIT-STR-036']) expect(record(code).measurementContract.loadReportingBases).toEqual([]);
  });
});
