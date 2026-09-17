/**
 * S2b — deterministic LOCAL Challenge Creation preview harness (development only).
 *
 * Prepares ONLY what the V2 Challenge Creation journey needs that the
 * governed product path does not create itself:
  *
 *   A. the authenticated Founder preview member identity link
 *      (`founder1@tiizi.local` Auth emulator account, created by
 *      `npm run preview:v2-auth:reset`, linked to a PostgreSQL `members`
 *      row with auth_provider 'firebase');
 *   B. enough eligible canonical Knowledge for Together / Race / Streak
 *      (canonical Knowledge fixtures only — never Group state).
 *
 * It deliberately manufactures NO product state:
 *
 *   - NO Group (`groups`, `groups/{id}`);
 *   - NO Group membership (`group_memberships`, `groupMembers/{id}`);
 *   - NO Challenge.
 *
 * The host Group MUST be established by the Founder through the governed
 * S2-G journey at `/v2/groups/new` (POST /v1/groups). The S2b Step 2
 * "Who is hosting?" picker reads the member's real Groups through the
 * accepted `GET /v1/memberships/me` contract. The previous S2b preview
 * manufacture of a Group/membership was removed on the S2-G alignment
 * and must not be reintroduced.
 *
 * Loopback-only, refuses NODE_ENV=production, never touches production
 * Auth/Firestore/PostgreSQL. Idempotent: safe to run repeatedly.
 */
import 'dotenv/config';
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
  listPreviewAccounts,
  resolveEmulatorTarget,
  resolveProjectId,
  V2_PREVIEW_EMAIL,
} from './previewV2Auth.js';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
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

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing: the S2b preview harness must not run with NODE_ENV=production.');
  }
  const projectId = resolveProjectId({ cliProject: arg('--project') });
  const target = resolveEmulatorTarget({});

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
    const knowledge = await ensureKnowledge(db);

    console.log('\nS2b local Challenge Creation preview data ready (local emulators only).');
    console.log(`  project            : ${projectId}`);
    console.log(`  auth emulator      : ${target.url}`);
    console.log(`  preview member     : ${account.email} (uid ${account.uid})`);
    console.log(`  member uuid        : ${memberId}`);
    console.log(`  canonical knowledge: ${knowledge.join(', ')}`);
    console.log('\nNo Group was seeded. Establish one through the S2-G journey at /v2/groups/new,');
    console.log('then create Challenges through the V2 journey at /v2/challenges/new.\n');
  } finally {
    await db.close();
  }
}

void main().catch((error) => {
  console.error(`S2b preview seed failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
