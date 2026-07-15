import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type DocumentData, type DocumentReference, type WriteBatch } from 'firebase-admin/firestore';

type CollectionName = 'challengeTemplates' | 'wellnessTemplates' | 'catalogExercises' | 'wellnessActivities';

type PlannedUpdate = {
  id: string;
  fields: Record<string, unknown>;
  warnings: string[];
};

type CollectionReport = {
  scanned: number;
  missingStatus: number;
  missingVisibility: number;
  missingIsPublished: number;
  missingSortName: number;
  missingCategory: number;
  missingDifficulty: number;
  duplicateSortNames: Array<{ sortName: string; ids: string[] }>;
  planned: PlannedUpdate[];
};

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
const applyMode = process.argv.includes('--apply');

if (!projectId) {
  throw new Error('Missing FIREBASE_PROJECT_ID (or VITE_FIREBASE_PROJECT_ID) env var.');
}

if (applyMode && projectId === 'tiizi-challenges' && process.env.CONFIRM_PROJECT_ID !== projectId) {
  throw new Error(`Refusing to apply catalog/template backfill to ${projectId} unless CONFIRM_PROJECT_ID=${projectId}.`);
}

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

function normalizeSortName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isActiveishStatus(value: unknown): boolean {
  const normalized = String(value ?? '').toLowerCase();
  return normalized === 'active' || normalized === 'published';
}

function defaultStatus(data: DocumentData): 'active' | 'draft' | 'archived' {
  const status = String(data.status ?? '').toLowerCase();
  if (status === 'archived') return 'archived';
  if (status === 'draft' || status === 'inactive') return 'draft';
  if (data.isPublished === false) return 'draft';
  return 'active';
}

function defaultVisibility(data: DocumentData): 'public' | 'private' {
  return data.visibility === 'private' || data.isPrivate === true ? 'private' : 'public';
}

function hasUsableString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function buildFields(collectionName: CollectionName, data: DocumentData): { fields: Record<string, unknown>; warnings: string[] } {
  const fields: Record<string, unknown> = {};
  const warnings: string[] = [];
  const name = hasUsableString(data.name) ? data.name : data.shortName;

  if (!hasUsableString(data.status)) fields.status = defaultStatus(data);
  if (data.visibility !== 'public' && data.visibility !== 'private') fields.visibility = defaultVisibility(data);
  if (typeof data.isPublished !== 'boolean') fields.isPublished = data.status ? isActiveishStatus(data.status) : data.isPublished !== false;
  if (!hasUsableString(data.sortName)) fields.sortName = normalizeSortName(name);

  if (!hasUsableString(name)) warnings.push('missing name/shortName for sortName');

  if ((collectionName === 'challengeTemplates' || collectionName === 'wellnessTemplates' || collectionName === 'wellnessActivities') && !hasUsableString(data.category)) {
    warnings.push('missing category');
  }
  if ((collectionName === 'wellnessTemplates' || collectionName === 'wellnessActivities' || collectionName === 'catalogExercises') && !hasUsableString(data.difficulty)) {
    warnings.push('missing difficulty');
  }
  if (collectionName === 'wellnessTemplates' && data.templateSource !== 'admin') {
    fields.templateSource = 'admin';
  }
  if (collectionName === 'challengeTemplates' && !hasUsableString(data.category)) {
    fields.category = 'fitness';
  }

  return { fields, warnings };
}

function updateBatch(batch: WriteBatch, ref: DocumentReference, fields: Record<string, unknown>) {
  batch.set(ref, fields, { merge: true });
}

async function auditCollection(collectionName: CollectionName): Promise<CollectionReport> {
  const snap = await db.collection(collectionName).get();
  const planned: PlannedUpdate[] = [];
  const sortNameToIds = new Map<string, string[]>();
  let missingStatus = 0;
  let missingVisibility = 0;
  let missingIsPublished = 0;
  let missingSortName = 0;
  let missingCategory = 0;
  let missingDifficulty = 0;

  snap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const currentSortName = hasUsableString(data.sortName) ? String(data.sortName) : normalizeSortName(data.name ?? data.shortName);
    if (currentSortName) {
      sortNameToIds.set(currentSortName, [...(sortNameToIds.get(currentSortName) ?? []), docSnap.id]);
    }

    if (!hasUsableString(data.status)) missingStatus += 1;
    if (data.visibility !== 'public' && data.visibility !== 'private') missingVisibility += 1;
    if (typeof data.isPublished !== 'boolean') missingIsPublished += 1;
    if (!hasUsableString(data.sortName)) missingSortName += 1;
    if ((collectionName === 'challengeTemplates' || collectionName === 'wellnessTemplates' || collectionName === 'wellnessActivities') && !hasUsableString(data.category)) missingCategory += 1;
    if ((collectionName === 'wellnessTemplates' || collectionName === 'wellnessActivities' || collectionName === 'catalogExercises') && !hasUsableString(data.difficulty)) missingDifficulty += 1;

    const { fields, warnings } = buildFields(collectionName, data);
    if (Object.keys(fields).length > 0 || warnings.length > 0) {
      planned.push({ id: docSnap.id, fields, warnings });
    }
  });

  return {
    scanned: snap.size,
    missingStatus,
    missingVisibility,
    missingIsPublished,
    missingSortName,
    missingCategory,
    missingDifficulty,
    duplicateSortNames: Array.from(sortNameToIds.entries())
      .filter(([, ids]) => ids.length > 1)
      .map(([sortName, ids]) => ({ sortName, ids })),
    planned,
  };
}

async function applyCollection(collectionName: CollectionName, planned: PlannedUpdate[]) {
  for (let index = 0; index < planned.length; index += 400) {
    const chunk = planned.slice(index, index + 400).filter((item) => Object.keys(item.fields).length > 0);
    if (chunk.length === 0) continue;
    const batch = db.batch();
    chunk.forEach((item) => updateBatch(batch, db.collection(collectionName).doc(item.id), item.fields));
    await batch.commit();
  }
}

async function run() {
  const startedAt = Date.now();
  const collections: CollectionName[] = ['challengeTemplates', 'wellnessTemplates', 'catalogExercises', 'wellnessActivities'];
  const reports: Record<CollectionName, CollectionReport> = {} as Record<CollectionName, CollectionReport>;

  for (const collectionName of collections) {
    reports[collectionName] = await auditCollection(collectionName);
  }

  if (applyMode) {
    for (const collectionName of collections) {
      await applyCollection(collectionName, reports[collectionName].planned);
    }
  }

  console.log(JSON.stringify({
    mode: applyMode ? 'apply' : 'dry-run',
    projectId,
    durationMs: Date.now() - startedAt,
    collections: Object.fromEntries(collections.map((collectionName) => {
      const report = reports[collectionName];
      return [collectionName, {
        scanned: report.scanned,
        missingStatus: report.missingStatus,
        missingVisibility: report.missingVisibility,
        missingIsPublished: report.missingIsPublished,
        missingSortName: report.missingSortName,
        missingCategory: report.missingCategory,
        missingDifficulty: report.missingDifficulty,
        duplicateSortNames: report.duplicateSortNames,
        writesPlanned: report.planned.filter((item) => Object.keys(item.fields).length > 0).length,
        writesApplied: applyMode ? report.planned.filter((item) => Object.keys(item.fields).length > 0).length : 0,
        warnings: report.planned.filter((item) => item.warnings.length > 0).map((item) => ({
          id: item.id,
          warnings: item.warnings,
        })),
        samplePlannedUpdates: report.planned.slice(0, 20),
      }];
    })),
  }, null, 2));

  if (!applyMode) {
    console.log('Dry-run only. Re-run with CONFIRM_PROJECT_ID=tiizi-challenges npm run backfill:catalog-template-fields:apply to write changes.');
  }
}

run().catch((error) => {
  console.error('Catalog/template field backfill failed:', error);
  process.exit(1);
});
