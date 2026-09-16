/**
 * S2b — deterministic LOCAL Founder preview harness (development only).
 *
 * Prepares the minimum deterministic state the V2 Challenge Creation journey
 * needs, without seeding any Challenges (the Founder creates those through the
 * V2 journey):
 *
 *   A. the authenticated Founder preview member (Auth emulator identity
 *      `founder1@tiizi.local`, created by `npm run preview:v2-auth:reset`);
 *   B. one valid active Group;
 *   C. the live Firestore membership the Group authority reads
 *      (`groups/{legacyId}`, `groupMembers/{legacyId}_{uid}`);
 *   D. the matching PostgreSQL member/group/membership shadow;
 *   E. the group identity mapping (`groups.legacy_firestore_id`);
 *   F. enough eligible canonical Knowledge for Together / Race / Streak.
 *
 * Loopback-only, refuses NODE_ENV=production, never touches production
 * Firestore/Auth/PostgreSQL. Idempotent: safe to run repeatedly.
 */
import 'dotenv/config';
import { getApps, initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createPool, databaseUrl } from '../api/src/db.js';
import {
  createKnowledgeItem,
  getKnowledgeByCode,
  setKnowledgeLifecycle,
  setMeasurementCompatibility,
  type CreateKnowledgeInput,
} from '../api/src/knowledge.js';
import type { Db } from '../api/src/db.js';
import {
  AUTH_EMULATOR_HOST,
  listPreviewAccounts,
  resolveEmulatorTarget,
  resolveProjectId,
  V2_PREVIEW_EMAIL,
} from './previewV2Auth.js';

const PREVIEW_GROUP_LEGACY_ID = 's2b-preview-group';
const PREVIEW_GROUP_NAME = 'Founder Preview Group';
const FIRESTORE_EMULATOR_PORT = 8080;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function resolveFirestoreEmulatorHost(): string {
  const raw = (process.env.FIRESTORE_EMULATOR_HOST ?? `${AUTH_EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}`).trim();
  const [host, portRaw] = raw.split(':');
  const port = Number(portRaw ?? FIRESTORE_EMULATOR_PORT);
  if (!LOOPBACK_HOSTS.has(host.toLowerCase()) || port !== FIRESTORE_EMULATOR_PORT) {
    throw new Error(
      `Refusing non-loopback Firestore target '${raw}'. Only 127.0.0.1:${FIRESTORE_EMULATOR_PORT} is allowed.`,
    );
  }
  return `${host}:${port}`;
}

async function upsertMember(db: Db, uid: string): Promise<string> {
  const found = await db.query<{ member_id: string }>(
    `SELECT member_id FROM members WHERE auth_provider = 'firebase' AND auth_subject = $1`,
    [uid],
  );
  if (found.rows[0]) return String(found.rows[0].member_id);
  const inserted = await db.query<{ member_id: string }>(
    `INSERT INTO members (auth_provider, auth_subject) VALUES ('firebase', $1) RETURNING member_id`,
    [uid],
  );
  return String(inserted.rows[0].member_id);
}

async function upsertGroup(db: Db, legacyId: string, name: string): Promise<string> {
  const existing = await db.query<{ group_id: string }>(
    `SELECT group_id FROM groups WHERE legacy_firestore_id = $1`,
    [legacyId],
  );
  if (existing.rows[0]) {
    await db.query(`UPDATE groups SET name = $2, status = 'active', updated_at = now() WHERE group_id = $1`, [
      String(existing.rows[0].group_id),
      name,
    ]);
    return String(existing.rows[0].group_id);
  }
  const inserted = await db.query<{ group_id: string }>(
    `INSERT INTO groups (legacy_firestore_id, name, description, is_private, status)
     VALUES ($1, $2, 'Local Founder preview Group.', FALSE, 'active') RETURNING group_id`,
    [legacyId, name],
  );
  return String(inserted.rows[0].group_id);
}

async function upsertMembership(db: Db, groupId: string, memberId: string): Promise<void> {
  await db.query(
    `INSERT INTO group_memberships (group_id, member_id, role, status)
     VALUES ($1, $2, 'owner', 'active')
     ON CONFLICT (group_id, member_id) DO UPDATE SET role = 'owner', status = 'active', updated_at = now()`,
    [groupId, memberId],
  );
}

interface KnowledgeSpec {
  code: string;
  name: string;
  kind: 'fitness' | 'wellness';
  category: string;
  subcategory: string;
  metrics: string[];
  units: string[];
  metricUnit: string;
  description: string;
}

/** Together / Race / Streak examples across both domains. */
const PREVIEW_KNOWLEDGE: KnowledgeSpec[] = [
  {
    code: 'FIT-CRD-001',
    name: 'Community Walk',
    kind: 'fitness',
    category: 'Cardio & Conditioning',
    subcategory: 'Walking',
    metrics: ['distance'],
    units: ['kilometres'],
    metricUnit: 'kilometres',
    description: 'A steady walk you can count in kilometres, ideal for a shared group goal.',
  },
  {
    code: 'FIT-STR-001',
    name: 'Push-Up',
    kind: 'fitness',
    category: 'Strength',
    subcategory: 'Push',
    metrics: ['repetitions'],
    units: ['reps'],
    metricUnit: 'reps',
    description: 'A foundational bodyweight push counted in repetitions.',
  },
  {
    code: 'WEL-MND-003',
    name: 'Breathing Practice',
    kind: 'wellness',
    category: 'Mind & Emotional Wellbeing',
    subcategory: 'Breathwork',
    metrics: ['duration'],
    units: ['minutes'],
    metricUnit: 'minutes',
    description: 'A short guided breathing practice counted in minutes each day.',
  },
];

function knowledgeContent(spec: KnowledgeSpec): Record<string, unknown> {
  return {
    kind: spec.kind,
    name: spec.name,
    category: spec.category,
    subcategory: spec.subcategory,
    difficulty: 'Beginner',
    description: spec.description,
    metricUnit: spec.metricUnit,
    contentClasses: ['U', 'Q'],
    measurementGuidance: 'Report the total achieved for the day.',
    unitSemantics: `One ${spec.metricUnit === 'reps' ? 'repetition' : spec.metricUnit.slice(0, -1)} counts as one unit.`,
    setup: 'Prepare in a safe, comfortable position.',
    execution: 'Complete the movement with control.',
    formCues: ['Move with control'],
    adaptation: 'Reduce the amount to make it easier.',
    safetyNotes: ['Stop on sharp pain'],
  };
}

async function ensureKnowledge(db: Db): Promise<string[]> {
  const ready: string[] = [];
  for (const spec of PREVIEW_KNOWLEDGE) {
    const existing = await getKnowledgeByCode(db, spec.code);
    if (existing) {
      ready.push(`${spec.code} (${existing.lifecycle})`);
      continue;
    }
    const created = await createKnowledgeItem(
      db,
      { ...knowledgeContent(spec), activityCode: spec.code } as CreateKnowledgeInput,
    );
    await setMeasurementCompatibility(db, created.id, {
      primaryMetrics: spec.metrics,
      secondaryMetrics: [],
      compatibleUnits: spec.units,
    });
    await setKnowledgeLifecycle(db, created.id, 'published');
    ready.push(`${spec.code} (published)`);
  }
  return ready;
}

async function seedFirestore(projectId: string, uid: string, name: string): Promise<void> {
  const appName = 's2b-preview-seed';
  const app = getApps().find((candidate) => candidate.name === appName)
    ?? initializeApp({ projectId }, appName);
  try {
    const firestore = getFirestore(app);
    await firestore.collection('groups').doc(PREVIEW_GROUP_LEGACY_ID).set(
      {
        name,
        description: 'Local Founder preview Group.',
        isPrivate: false,
        status: 'active',
        allowMemberChallenges: true,
      },
      { merge: true },
    );
    await firestore
      .collection('groupMembers')
      .doc(`${PREVIEW_GROUP_LEGACY_ID}_${uid}`)
      .set({ groupId: PREVIEW_GROUP_LEGACY_ID, userId: uid, role: 'owner', status: 'active' }, { merge: true });
  } finally {
    await deleteApp(app);
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing: the S2b preview harness must not run with NODE_ENV=production.');
  }
  const projectId = resolveProjectId({ cliProject: arg('--project') });
  const target = resolveEmulatorTarget({});
  const firestoreHost = resolveFirestoreEmulatorHost();
  process.env.FIRESTORE_EMULATOR_HOST = firestoreHost;

  const accounts = await listPreviewAccounts({ projectId, target });
  const account = accounts.find((candidate) => candidate.email === V2_PREVIEW_EMAIL);
  if (!account) {
    throw new Error(
      `Preview account ${V2_PREVIEW_EMAIL} was not found in the Auth emulator. Run \`npm run preview:v2-auth:reset\` first.`,
    );
  }

  const db = createPool(databaseUrl(), { max: 2 });
  try {
    const memberId = await upsertMember(db, account.uid);
    const groupId = await upsertGroup(db, PREVIEW_GROUP_LEGACY_ID, PREVIEW_GROUP_NAME);
    await upsertMembership(db, groupId, memberId);
    const knowledge = await ensureKnowledge(db);
    await seedFirestore(projectId, account.uid, PREVIEW_GROUP_NAME);

    console.log('\nS2b local Founder preview data ready (local emulators only).');
    console.log(`  project            : ${projectId}`);
    console.log(`  auth emulator      : ${target.url}`);
    console.log(`  firestore emulator : ${firestoreHost}`);
    console.log(`  preview member     : ${account.email} (uid ${account.uid})`);
    console.log(`  preview group      : ${PREVIEW_GROUP_NAME} (${PREVIEW_GROUP_LEGACY_ID})`);
    console.log(`  group uuid (pg)    : ${groupId}`);
    console.log(`  live membership    : groupMembers/${PREVIEW_GROUP_LEGACY_ID}_${account.uid} = owner/active`);
    console.log(`  canonical knowledge: ${knowledge.join(', ')}`);
    console.log('\nNo Challenges were seeded: create them through the V2 journey at /v2/challenges/new.\n');
  } finally {
    await db.close();
  }
}

void main().catch((error) => {
  console.error(`S2b preview seed failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
