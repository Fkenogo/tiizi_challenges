/**
 * EBC-05 local Founder Preview bootstrap/reset CLI (LOCAL ONLY).
 *
 * Deterministic seed for the localhost preview: two test Members (linked
 * to Firebase Auth emulator UIDs — create matching emulator users and
 * sign in with them) plus a bounded set of published, KCS-ready,
 * compatibility-governed canonical Activities that the governed
 * establishment authority accepts for NEW V2 Challenges.
 *
 * Safety:
 * - refuses to run unless DATABASE_URL targets localhost/127.0.0.1;
 * - dry-run by default; writes only with --apply;
 * - reset truncates ONLY the V2 domain tables (never schema_migrations)
 *   and is equally localhost-guarded;
 * - never touches production PostgreSQL, Firebase, or hosted services.
 *
 * Usage:
 *   npm run preview:seed -- --apply
 *   npm run preview:reset -- --apply
 */
import 'dotenv/config';
import { createPool, databaseUrl, type Db } from './db.js';

const PREVIEW_UIDS = ['preview-founder-01', 'preview-founder-02'];

interface PreviewActivity {
  kind: 'fitness' | 'wellness';
  name: string;
  description: string;
  category: string;
  metricUnit: string;
  measurementGuidance: string;
  safetyNotes: string[];
  primaryMetrics: string[];
  compatibleUnits: string[];
}

const PREVIEW_ACTIVITIES: PreviewActivity[] = [
  {
    kind: 'fitness',
    name: 'Preview Push-Up',
    description: 'A governed preview pressing movement',
    category: 'Upper Body',
    metricUnit: 'reps',
    measurementGuidance: 'Count full-range repetitions',
    safetyNotes: ['Stop on sharp pain'],
    primaryMetrics: ['repetitions'],
    compatibleUnits: ['reps'],
  },
  {
    kind: 'fitness',
    name: 'Preview Squat',
    description: 'A governed preview lower-body movement',
    category: 'Lower Body',
    metricUnit: 'reps',
    measurementGuidance: 'Count full-depth repetitions',
    safetyNotes: ['Stop on sharp knee pain'],
    primaryMetrics: ['repetitions'],
    compatibleUnits: ['reps'],
  },
  {
    kind: 'fitness',
    name: 'Preview Run',
    description: 'A governed preview distance run',
    category: 'Cardio',
    metricUnit: 'kilometres',
    measurementGuidance: 'Record distance covered in one session',
    safetyNotes: ['Stop on chest pain or dizziness'],
    primaryMetrics: ['distance'],
    compatibleUnits: ['metres', 'kilometres'],
  },
  {
    kind: 'wellness',
    name: 'Preview Stillness',
    description: 'A governed preview mindfulness practice',
    category: 'Mindfulness',
    metricUnit: 'minutes',
    measurementGuidance: 'Record minutes of uninterrupted practice',
    safetyNotes: [],
    primaryMetrics: ['duration'],
    compatibleUnits: ['minutes'],
  },
  {
    kind: 'wellness',
    name: 'Preview Water',
    description: 'A governed preview hydration practice',
    category: 'Nutrition',
    metricUnit: 'millilitres',
    measurementGuidance: 'Record millilitres consumed in one day',
    safetyNotes: [],
    primaryMetrics: ['quantity'],
    compatibleUnits: ['millilitres', 'litres'],
  },
];

/** V2 domain tables wiped by reset (schema_migrations is never touched). */
const PREVIEW_DOMAIN_TABLES = [
  'challenge_participation_finals',
  'challenge_finalizations',
  'activity_submission_intents',
  'challenge_establishment_keys',
  'challenge_activity_records',
  'challenge_participation_derived',
  'challenge_derived_state',
  'challenge_activity_configs',
  'challenge_config_versions',
  'challenge_participations',
  'member_activity_events',
  'challenges',
  'group_memberships',
  'groups',
  'knowledge_item_texts',
  'knowledge_item_versions',
  'knowledge_items',
  'members',
];

function previewFail(message: string): never {
  throw new Error(`preview: ${message}`);
}

function requireLocalDatabaseUrl(): string {
  const url = databaseUrl();
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    previewFail('DATABASE_URL is not a valid URL — refusing to seed/reset');
  }
  if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1') {
    previewFail(`refusing to run against non-localhost host (${host})`);
  }
  return url;
}

async function seedMembers(db: Db, apply: boolean): Promise<string[]> {
  const ids: string[] = [];
  for (const uid of PREVIEW_UIDS) {
    const existing = await db.query<{ member_id: string }>(
      `SELECT member_id FROM members WHERE auth_provider = 'firebase' AND auth_subject = $1`,
      [uid],
    );
    if (existing.rows.length > 0) {
      ids.push(String(existing.rows[0].member_id));
      console.log(`preview:seed: member ${uid} already present`);
      continue;
    }
    if (!apply) {
      console.log(`preview:seed: would create member ${uid}`);
      continue;
    }
    const created = await db.query<{ member_id: string }>(
      `INSERT INTO members (auth_provider, auth_subject) VALUES ('firebase', $1) RETURNING member_id`,
      [uid],
    );
    ids.push(String(created.rows[0].member_id));
    console.log(`preview:seed: created member ${uid}`);
  }
  return ids;
}

async function seedKnowledge(db: Db, apply: boolean): Promise<void> {
  for (const activity of PREVIEW_ACTIVITIES) {
    const existing = await db.query<{ knowledge_id: string }>(
      `SELECT knowledge_id FROM knowledge_items WHERE kind = $1 AND name = $2`,
      [activity.kind, activity.name],
    );
    if (existing.rows.length > 0) {
      console.log(`preview:seed: knowledge ${activity.name} already present`);
      continue;
    }
    if (!apply) {
      console.log(`preview:seed: would create knowledge ${activity.name}`);
      continue;
    }
    await db.query(
      `INSERT INTO knowledge_items
         (kind, name, lifecycle, grandfathered, description, category,
          metric_unit, measurement_guidance, safety_notes,
          primary_metrics, secondary_metrics, compatible_units)
       VALUES ($1, $2, 'published', FALSE, $3, $4, $5, $6, $7, $8, ARRAY[]::TEXT[], $9)`,
      [
        activity.kind,
        activity.name,
        activity.description,
        activity.category,
        activity.metricUnit,
        activity.measurementGuidance,
        activity.safetyNotes,
        activity.primaryMetrics,
        activity.compatibleUnits,
      ],
    );
    console.log(`preview:seed: created knowledge ${activity.name}`);
  }
}

async function resetPreview(db: Db, apply: boolean): Promise<void> {
  if (!apply) {
    console.log(`preview:reset: would truncate ${PREVIEW_DOMAIN_TABLES.length} domain tables (dry run)`);
    return;
  }
  await db.query(`TRUNCATE ${PREVIEW_DOMAIN_TABLES.join(', ')}`);
  console.log(`preview:reset: truncated ${PREVIEW_DOMAIN_TABLES.length} domain tables`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const apply = argv.includes('--apply');
  if (command !== 'seed' && command !== 'reset') {
    console.log('Usage:');
    console.log('  npm run preview:seed -- [--apply]');
    console.log('  npm run preview:reset -- [--apply]');
    console.log('Localhost DATABASE_URL only; dry-run unless --apply is passed.');
    process.exit(2);
  }
  requireLocalDatabaseUrl();
  const db = createPool(databaseUrl());
  try {
    if (command === 'seed') {
      await seedMembers(db, apply);
      await seedKnowledge(db, apply);
      console.log(apply ? 'preview:seed: done' : 'preview:seed: dry run (pass --apply to write)');
    } else {
      await resetPreview(db, apply);
      console.log(apply ? 'preview:reset: done' : 'preview:reset: dry run (pass --apply to write)');
    }
  } finally {
    await db.close();
  }
}

const invokedAsCli =
  process.argv[1]?.endsWith('previewSeedCli.ts') || process.argv[1]?.endsWith('previewSeedCli.js');
if (invokedAsCli) {
  main().catch((error: unknown) => {
    console.error(`preview: failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
