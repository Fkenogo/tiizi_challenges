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

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

type RawTemplate = {
  id?: string;
  category?: string;
  name?: string;
  description?: string;
  difficulty?: string;
  type?: string;
  duration?: number;
  coverImage?: string;
  icon?: string;
  color?: string;
  activities?: Array<Record<string, unknown>>;
  benefits?: string[];
  guidelines?: string[];
  warnings?: string[];
};

function validateTemplate(template: RawTemplate) {
  const missing: string[] = [];
  if (!template.id) missing.push('id');
  if (!template.category) missing.push('category');
  if (!template.name) missing.push('name');
  if (!template.description) missing.push('description');
  if (!template.difficulty) missing.push('difficulty');
  if (!template.type) missing.push('type');
  if (!template.duration) missing.push('duration');
  if (!Array.isArray(template.activities) || template.activities.length === 0) missing.push('activities');
  return missing;
}

async function run() {
  const filePath = join(process.cwd(), 'wellness-templates-sample.json');
  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as { templates?: RawTemplate[] };
  const templates = parsed.templates ?? [];
  if (templates.length === 0) {
    throw new Error('No templates found in wellness-templates-sample.json');
  }

  const invalid = templates
    .map((template) => ({ id: template.id ?? '(unknown)', missing: validateTemplate(template) }))
    .filter((item) => item.missing.length > 0);

  if (invalid.length > 0) {
    throw new Error(`Validation failed: ${invalid.map((item) => `${item.id}: ${item.missing.join(', ')}`).join(' | ')}`);
  }

  const existingRefs = templates.map((template) => db.collection('wellnessTemplates').doc(String(template.id)));
  const existingSnaps = await db.getAll(...existingRefs);
  const existingById = new Map(existingSnaps.map((snap) => [snap.id, snap.exists]));

  let createdCount = 0;
  let updatedCount = 0;
  const batch = db.batch();
  templates.forEach((template) => {
    const ref = db.collection('wellnessTemplates').doc(String(template.id));
    if (existingById.get(String(template.id))) {
      updatedCount += 1;
    } else {
      createdCount += 1;
    }
    batch.set(ref, {
      ...template,
      templateSource: 'admin',
      isPublished: true,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  });
  await batch.commit();

  const snapshot = await db.collection('wellnessTemplates').get();
  const countsByCategory = snapshot.docs.reduce<Record<string, number>>((acc, item) => {
    const category = String((item.data() as { category?: string }).category ?? 'unknown');
    acc[category] = (acc[category] ?? 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    projectId,
    seededTemplates: templates.length,
    createdCount,
    updatedCount,
    totalTemplatesInCollection: snapshot.size,
    countsByCategory,
  }, null, 2));
}

run().catch((error) => {
  console.error('Wellness template seed failed:', error);
  process.exit(1);
});
