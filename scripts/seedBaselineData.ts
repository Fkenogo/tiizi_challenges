import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import catalogExercisesSource from '../catalogExercises_CLEAN.json';

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
const seedTag = process.env.SEED_TAG ?? 'tiizi_baseline_v1';
const nowIso = new Date().toISOString();

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

type DocWithId = Record<string, unknown> & { id: string };

const exerciseInterests = [
  ['running', 'Running', '🏃'],
  ['walking', 'Walking', '🚶'],
  ['gym-weightlifting', 'Gym/Weightlifting', '💪'],
  ['home-workouts', 'Home Workouts', '🏠'],
  ['yoga', 'Yoga', '🧘'],
  ['swimming', 'Swimming', '🏊'],
  ['cycling', 'Cycling', '🚴'],
  ['football', 'Football (Soccer)', '⚽'],
  ['hiking', 'Hiking', '⛰️'],
  ['group-fitness', 'Group Fitness Classes', '👥'],
  ['hiit', 'HIIT/Circuit Training', '⚡'],
  ['pilates', 'Pilates', '🤸'],
  ['dancing', 'Dancing', '💃'],
  ['stretching', 'Stretching/Mobility', '🙆'],
  ['other', 'Other', '✍️'],
] as const;

const wellnessGoals = [
  ['weight-loss', 'Weight Loss', 'Lose excess weight and burn fat', '⚖️'],
  ['stay-healthy', 'Stay Healthy & Active', 'Maintain overall health', '❤️'],
  ['build-strength', 'Build Strength', 'Get stronger and build muscle', '💪'],
  ['improve-fitness', 'Improve Fitness', 'Increase stamina and endurance', '🏃'],
  ['manage-health', 'Manage Health Condition', 'Support blood pressure, diabetes, and heart health', '🩺'],
  ['reduce-stress', 'Reduce Stress', 'Improve mental wellbeing and relaxation', '🧘'],
  ['increase-energy', 'Increase Energy', 'Combat fatigue and boost energy levels', '⚡'],
  ['improve-flexibility', 'Improve Flexibility', 'Improve mobility and movement', '🤸'],
  ['build-routine', 'Build Daily Routine', 'Create healthy and consistent habits', '📅'],
  ['feel-confident', 'Feel More Confident', 'Boost confidence and self-esteem', '✨'],
  ['stay-accountable', 'Stay Accountable', 'Get support and consistency from the group', '👥'],
  ['other', 'Other', 'Custom wellness goal', '✍️'],
] as const;

const onboardingContent: DocWithId[] = [
  {
    id: 'baseline_onboarding_welcome',
    stepKey: 'welcome',
    title: 'Fitness is Better Together',
    body: 'Join groups, pick challenges, and stay accountable with your community.',
    version: 1,
    isActive: true,
    seedTag,
    updatedAt: nowIso,
  },
  {
    id: 'baseline_onboarding_interests',
    stepKey: 'interests',
    title: 'What moves you?',
    body: 'Pick interests and goals to personalize your challenge journey.',
    version: 1,
    isActive: true,
    seedTag,
    updatedAt: nowIso,
  },
  {
    id: 'baseline_onboarding_privacy',
    stepKey: 'privacy',
    title: 'Privacy controls',
    body: 'Choose what to share and who can view your profile.',
    version: 1,
    isActive: true,
    seedTag,
    updatedAt: nowIso,
  },
];

const notificationTemplates: DocWithId[] = [
  {
    id: 'baseline_notification_challenge_reminder',
    name: 'Challenge Reminder',
    channel: 'in_app',
    audience: 'active-challenge-members',
    status: 'draft',
    updatedAt: nowIso,
    seedTag,
  },
];

const appSettings: DocWithId[] = [
  {
    id: 'app',
    appName: 'Tiizi Fitness',
    supportEmail: 'support@tiizi.app',
    termsUrl: 'https://tiizi.app/terms',
    privacyUrl: 'https://tiizi.app/privacy',
    maintenanceMode: false,
    maxChallengesPerUser: 12,
    maxGroupsPerUser: 10,
    maxWorkoutLogsPerDay: 40,
    seedTag,
    updatedAt: nowIso,
  },
];

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function setDocs(collectionName: string, docs: DocWithId[]) {
  for (const docsChunk of chunk(docs, 400)) {
    const batch = db.batch();
    docsChunk.forEach((item) => {
      const ref = db.collection(collectionName).doc(item.id);
      batch.set(ref, item, { merge: true });
    });
    await batch.commit();
  }
}

async function ensureCatalogExercisesLoaded() {
  const existing = await db.collection('catalogExercises').limit(1).get();
  if (!existing.empty) return 0;

  const source = (catalogExercisesSource as { documents?: Array<Record<string, unknown> & { id: string }> }).documents ?? [];
  if (source.length === 0) return 0;

  for (const docsChunk of chunk(source, 350)) {
    const batch = db.batch();
    docsChunk.forEach((exercise) => {
      const ref = db.collection('catalogExercises').doc(exercise.id);
      batch.set(ref, exercise, { merge: true });
    });
    await batch.commit();
  }
  return source.length;
}

async function run() {
  const interestDocs: DocWithId[] = exerciseInterests.map(([id, name, icon], index) => ({
    id: `baseline_interest_${id}`,
    sourceId: id,
    name,
    icon,
    category: 'Exercise',
    order: index + 1,
    isActive: true,
    isDefault: index < 8,
    seedTag,
    updatedAt: nowIso,
  }));

  const goalDocs: DocWithId[] = wellnessGoals.map(([id, name, description, icon], index) => ({
    id: `baseline_goal_${id}`,
    sourceId: id,
    name,
    description,
    icon,
    category: 'Wellness',
    order: index + 1,
    isActive: true,
    isDefault: index < 6,
    seedTag,
    updatedAt: nowIso,
  }));

  const catalogCount = await ensureCatalogExercisesLoaded();
  await setDocs('exerciseInterests', interestDocs);
  await setDocs('wellnessGoals', goalDocs);
  await setDocs('onboardingContent', onboardingContent);
  await setDocs('notificationTemplates', notificationTemplates);
  await setDocs('settings', appSettings);

  console.log(
    JSON.stringify(
      {
        projectId,
        seedTag,
        catalogExercisesLoaded: catalogCount,
        exerciseInterests: interestDocs.length,
        wellnessGoals: goalDocs.length,
        onboardingContent: onboardingContent.length,
        notificationTemplates: notificationTemplates.length,
        settings: appSettings.length,
        users: 0,
        groups: 0,
        challenges: 0,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error('Baseline seed failed:', error);
  process.exit(1);
});
