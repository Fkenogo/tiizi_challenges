import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
const requiredEnvKeys = ['GOOGLE_APPLICATION_CREDENTIALS'] as const;

if (!projectId) {
  throw new Error('Missing FIREBASE_PROJECT_ID (or fallback VITE_FIREBASE_PROJECT_ID) env var.');
}
for (const key of requiredEnvKeys) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}
const seedTag = process.env.SEED_TAG ?? 'tiizi_seed_v1';
const applyMode = process.argv.includes('--apply');
const mode = applyMode ? 'apply' : 'dry-run';

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const collectionsToClean = [
  'users',
  'groups',
  'groupMembers',
  'challenges',
  'workouts',
  'exerciseInterests',
  'wellnessGoals',
  'onboardingContent',
  'notificationTemplates',
  'challengeTemplates',
  'supportTickets',
  'groupReports',
  'donationCampaigns',
  'donationTransactions',
  'systemLogs',
  'admins',
  'settings',
];

function sampleWellnessTemplateIds(): string[] {
  try {
    const raw = readFileSync(join(process.cwd(), 'wellness-templates-sample.json'), 'utf8');
    const parsed = JSON.parse(raw) as { templates?: Array<{ id?: string }> };
    return (parsed.templates ?? [])
      .map((t) => String(t.id ?? '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isSeedLikeId(id: string): boolean {
  return id.startsWith('seed_') || id.includes('_seed_') || id.includes('seed-');
}

async function collectSeedDocs(collectionName: string) {
  const byTag = await db.collection(collectionName).where('seedTag', '==', seedTag).get();
  const all = await db.collection(collectionName).get();
  const idBased = all.docs.filter((d) => isSeedLikeId(d.id));

  const merged = new Map<string, FirebaseFirestore.DocumentReference>();
  byTag.docs.forEach((d) => merged.set(d.id, d.ref));
  idBased.forEach((d) => merged.set(d.id, d.ref));
  return Array.from(merged.values());
}

async function collectWellnessTemplateSeedDocs() {
  const ids = sampleWellnessTemplateIds();
  if (ids.length === 0) return [];
  const refs = ids.map((id) => db.collection('wellnessTemplates').doc(id));
  const snaps = await db.getAll(...refs);
  return snaps.filter((s) => s.exists).map((s) => s.ref);
}

async function deleteRefs(refs: FirebaseFirestore.DocumentReference[]) {
  let deleted = 0;
  for (let i = 0; i < refs.length; i += 400) {
    const chunk = refs.slice(i, i + 400);
    const batch = db.batch();
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
}

async function run() {
  const report: Record<string, number> = {};
  const toDelete: FirebaseFirestore.DocumentReference[] = [];

  for (const collectionName of collectionsToClean) {
    const refs = await collectSeedDocs(collectionName);
    report[collectionName] = refs.length;
    toDelete.push(...refs);
  }

  const wellnessTemplateRefs = await collectWellnessTemplateSeedDocs();
  report.wellnessTemplates = wellnessTemplateRefs.length;
  toDelete.push(...wellnessTemplateRefs);

  const unique = new Map<string, FirebaseFirestore.DocumentReference>();
  toDelete.forEach((ref) => unique.set(ref.path, ref));
  const uniqueRefs = Array.from(unique.values());

  const payload = {
    mode,
    projectId,
    seedTag,
    targetDeleteCount: uniqueRefs.length,
    collections: report,
  };

  console.log(JSON.stringify(payload, null, 2));

  if (!applyMode) {
    console.log('Dry-run only. Re-run with --apply to delete matching docs.');
    return;
  }

  if (uniqueRefs.length === 0) {
    console.log('No seeded data found. Nothing to delete.');
    return;
  }

  const deleted = await deleteRefs(uniqueRefs);
  console.log(JSON.stringify({ mode, deleted }, null, 2));
}

run().catch((error) => {
  console.error('Seed cleanup failed:', error);
  process.exit(1);
});
