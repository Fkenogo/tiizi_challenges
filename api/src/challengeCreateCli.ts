/**
 * Phase C3A controlled clean-V2 Challenge establishment CLI.
 *
 * Operational/admin tool (NOT a public API, NOT a permanent privileged HTTP
 * endpoint): establishes the first clean V2 Challenges before frontend
 * Challenge creation is migrated. Thin orchestration over EXISTING domain
 * seams — createChallenge (challenge + immutable v1 config, one
 * transaction), activateChallenge, joinChallenge — plus existing trusted
 * resolvers (database Knowledge pins per activity kind, live Firestore
 * Group/Membership authority via ADC). No establishment logic is duplicated
 * here; no V1 import/conversion/migration of any kind.
 *
 * Usage:
 *   npm run challenge:create-v2 -- --input challenge.json        # dry-run (validates everything, persists nothing)
 *   npm run challenge:create-v2 -- --input challenge.json --apply # persist
 *
 * Input contract (validated JSON, governing inputs only — no Derived Truth,
 * no points, no Firestore ids as V2 identity):
 * {
 *   "group_id": "<Tiizi group UUID>",
 *   "creator_firebase_uid": "<Firebase UID of the establishing member>",
 *   "challenge_type": "collective" | "competitive" | "streak",
 *   "title": "...", "description": "...", "instructions": "...",
 *   "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD",
 *   "goal_value": 1000, "goal_unit": "reps",            // collective only
 *   "required_consecutive_days": 30,                    // streak only
 *   "reset_on_miss": true,
 *   "activities": [
 *     { "activity_kind": "fitness", "canonical_key": "push-up",
 *       "activity_variant": null, "target_value": 20, "unit": "reps" }
 *   ],
 *   "activate": true,       // establishment -> active when true
 *   "join_creator": true    // open a creator participation episode when true
 * }
 *
 * Safety: unknown member / inactive-missing group / non-member creator /
 * unpublished-unknown Knowledge / invalid collective units all fail closed.
 * Dry-run executes the FULL operation (create + optional activate + join)
 * inside one transaction that is always rolled back. --apply runs
 * createChallenge in its own atomic transaction first (challenge + config v1
 * never partial), then activation and creator-join as subsequent valid
 * lifecycle transitions — a later-step failure leaves a valid
 * establishment-state challenge, never a half-written config.
 */

import { readFile } from 'node:fs/promises';
import 'dotenv/config';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { createDbKnowledgeResolver } from './knowledgePins.js';
import { findMemberByAuth } from './members.js';
import { activateChallenge, createChallenge, type NewChallengeInput } from './challenges.js';
import { joinChallenge } from './challengeParticipations.js';
import { createPool, databaseUrl, type Db } from './db.js';
import {
  createAdminFirestoreReader,
  createFirestoreGroupMembershipAuthority,
  isGroupDocActive,
  type FirestoreReader,
} from './firestoreGroupAuthority.js';
import type { ChallengeCreationResolvers } from './challenges.js';
import type { ActivityConfigInput } from './challengeConfigs.js';

export interface CliActivityInput {
  activity_kind: 'fitness' | 'wellness';
  canonical_key: string;
  activity_variant?: string | null;
  target_value: number;
  unit: string;
}

export interface ChallengeCreateV2Input {
  group_id: string;
  creator_firebase_uid: string;
  challenge_type: 'collective' | 'competitive' | 'streak';
  title: string;
  description?: string;
  instructions?: string;
  start_date: string;
  end_date: string;
  goal_value?: number;
  goal_unit?: string;
  required_consecutive_days?: number;
  reset_on_miss?: boolean;
  activities: CliActivityInput[];
  activate?: boolean;
  join_creator?: boolean;
}

export interface ChallengeCreateV2Result {
  dryRun: boolean;
  challengeId: string;
  status: string;
  configVersion: number;
  activated: boolean;
  creatorParticipationId: string | null;
}

function cliFail(message: string): never {
  throw new Error(`challenge-create-cli: ${message}`);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    cliFail(`${what} must be an object`);
  }
  return value as Record<string, unknown>;
}

function optString(raw: Record<string, unknown>, field: string, max: number): string | undefined {
  const value = raw[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    cliFail(`${field} must be 1..${max} chars when present`);
  }
  return value;
}

/** Narrow validated input contract: governing inputs only. */
export function parseChallengeCreateV2Input(raw: unknown): ChallengeCreateV2Input {
  const input = asRecord(raw, 'input');
  const groupId = input.group_id;
  if (typeof groupId !== 'string' || !UUID_RE.test(groupId)) {
    cliFail('group_id must be a Tiizi group UUID (never a Firestore document id)');
  }
  const creatorUid = input.creator_firebase_uid;
  if (typeof creatorUid !== 'string' || creatorUid.length === 0) {
    cliFail('creator_firebase_uid is required');
  }
  const challengeType = input.challenge_type;
  if (challengeType !== 'collective' && challengeType !== 'competitive' && challengeType !== 'streak') {
    cliFail('challenge_type must be collective|competitive|streak');
  }
  const title = input.title;
  if (typeof title !== 'string' || title.length === 0 || title.length > 200) {
    cliFail('title is required (1..200 chars)');
  }
  for (const field of ['start_date', 'end_date'] as const) {
    if (typeof input[field] !== 'string' || !DAY_RE.test(input[field] as string)) {
      cliFail(`${field} must be YYYY-MM-DD`);
    }
  }
  if ((input.start_date as string) > (input.end_date as string)) {
    cliFail('end_date must be on or after start_date');
  }
  const activities = input.activities;
  if (!Array.isArray(activities) || activities.length === 0 || activities.length > 50) {
    cliFail('activities must list 1..50 configured activities');
  }
  const parsedActivities: CliActivityInput[] = activities.map((entry, index) => {
    const activity = asRecord(entry, `activities[${index}]`);
    if (activity.activity_kind !== 'fitness' && activity.activity_kind !== 'wellness') {
      cliFail(`activities[${index}].activity_kind must be fitness|wellness`);
    }
    if (typeof activity.canonical_key !== 'string'
      || activity.canonical_key.length === 0 || activity.canonical_key.length > 200) {
      cliFail(`activities[${index}].canonical_key is required (1..200 chars)`);
    }
    const variant = activity.activity_variant;
    if (variant !== undefined && variant !== null
      && (typeof variant !== 'string' || variant.length === 0 || variant.length > 120)) {
      cliFail(`activities[${index}].activity_variant must be null or 1..120 chars`);
    }
    if (typeof activity.target_value !== 'number'
      || !Number.isFinite(activity.target_value) || activity.target_value < 0) {
      cliFail(`activities[${index}].target_value must be a finite number >= 0`);
    }
    if (typeof activity.unit !== 'string' || activity.unit.length === 0 || activity.unit.length > 40) {
      cliFail(`activities[${index}].unit is required (1..40 chars)`);
    }
    return {
      activity_kind: activity.activity_kind,
      canonical_key: activity.canonical_key,
      activity_variant: (variant ?? null) as string | null,
      target_value: activity.target_value,
      unit: activity.unit,
    };
  });
  const goalValue = input.goal_value;
  if (goalValue !== undefined && (typeof goalValue !== 'number' || !Number.isFinite(goalValue))) {
    cliFail('goal_value must be a finite number when present');
  }
  const requiredDays: unknown = input.required_consecutive_days;
  if (requiredDays !== undefined && (typeof requiredDays !== 'number' || !Number.isInteger(requiredDays) || requiredDays < 1)) {
    cliFail('required_consecutive_days must be an integer >= 1 when present');
  }
  for (const field of ['activate', 'join_creator'] as const) {
    if (input[field] !== undefined && typeof input[field] !== 'boolean') {
      cliFail(`${field} must be boolean when present`);
    }
  }
  if (input.reset_on_miss !== undefined && typeof input.reset_on_miss !== 'boolean') {
    cliFail('reset_on_miss must be boolean when present');
  }
  return {
    group_id: groupId as string,
    creator_firebase_uid: creatorUid as string,
    challenge_type: challengeType,
    title: title as string,
    description: optString(input, 'description', 2000),
    instructions: optString(input, 'instructions', 2000),
    start_date: input.start_date as string,
    end_date: input.end_date as string,
    goal_value: goalValue as number | undefined,
    goal_unit: optString(input, 'goal_unit', 40),
    required_consecutive_days: requiredDays as number | undefined,    reset_on_miss: (input.reset_on_miss as boolean | undefined) ?? undefined,
    activities: parsedActivities,
    activate: (input.activate as boolean | undefined) ?? false,
    join_creator: (input.join_creator as boolean | undefined) ?? false,
  };
}

function toNewChallengeInput(
  input: ChallengeCreateV2Input,
  creatorMemberId: string,
): NewChallengeInput {
  const activities: ActivityConfigInput[] = input.activities.map((a) => ({
    canonical_key: a.canonical_key,
    activity_variant: a.activity_variant ?? null,
    target_value: a.target_value,
    unit: a.unit,
  }));
  return {
    group_id: input.group_id,
    created_by_member_id: creatorMemberId,
    challenge_type: input.challenge_type,
    title: input.title,
    description: input.description,
    instructions: input.instructions,
    start_date: input.start_date,
    end_date: input.end_date,
    goal_value: input.goal_value,
    goal_unit: input.goal_unit,
    required_consecutive_days: input.required_consecutive_days,
    reset_on_miss: input.reset_on_miss,
    activities,
  };
}

/**
 * Core establishment (testable without Firestore): resolves the creator to an
 * internal member, pre-resolves every Knowledge pin through the trusted
 * database resolvers (unknown/unpublished keys fail closed before anything
 * persists), then runs createChallenge (+ optional activate/join).
 */
export async function runChallengeCreateV2(
  db: Db,
  input: ChallengeCreateV2Input,
  resolvers: ChallengeCreationResolvers,
): Promise<ChallengeCreateV2Result> {
  const creator = await findMemberByAuth(db, 'firebase', input.creator_firebase_uid);
  if (!creator) cliFail(`unknown member for creator_firebase_uid (no members row)`);
  // Pre-resolve pins per activity kind so mixed fitness/wellness configs use
  // the correct canonical namespace; failures abort before any write.
  const pinByKey = new Map<string, { knowledge_id: string; current_version: number }>();
  for (const activity of input.activities) {
    const resolvePin = (resolvers as ChallengeCreationResolvers & {
      resolveKnowledgePinFor?: (kind: string, key: string) => Promise<{ knowledge_id: string; current_version: number } | null>;
    }).resolveKnowledgePinFor;
    const pin = resolvePin
      ? await resolvePin(activity.activity_kind, activity.canonical_key)
      : await resolvers.resolveKnowledgePin(activity.canonical_key);
    if (!pin) {
      cliFail(`unknown or unpublished Knowledge for '${activity.canonical_key}' (${activity.activity_kind})`);
    }
    pinByKey.set(`${activity.activity_kind}::${activity.canonical_key}`, pin!);
  }
  const mappedResolvers: ChallengeCreationResolvers = {
    ...resolvers,
    resolveKnowledgePin: async (key: string) => {
      for (const activity of input.activities) {
        if (activity.canonical_key === key) {
          return pinByKey.get(`${activity.activity_kind}::${key}`) ?? null;
        }
      }
      return null;
    },
  };
  const created = await createChallenge(db, toNewChallengeInput(input, creator!.memberId), mappedResolvers);
  let status = created.challenge.status;
  let activated = false;
  if (input.activate && status !== 'active') {
    const next = await activateChallenge(db, created.challenge.challenge_id);
    status = next.status;
    activated = true;
  }
  let creatorParticipationId: string | null = null;
  if (input.join_creator) {
    const episode = await joinChallenge(
      db,
      created.challenge.challenge_id,
      creator!.memberId,
      mappedResolvers,
    );
    creatorParticipationId = episode.participation_id;
  }
  return {
    dryRun: false,
    challengeId: created.challenge.challenge_id,
    status,
    configVersion: created.version.version,
    activated,
    creatorParticipationId,
  };
}

const DRY_RUN_ROLLBACK = 'challenge-create-cli:dry-run-rollback';

/** Dry-run: full execution inside a transaction that always rolls back. */
export async function dryRunChallengeCreateV2(
  db: Db,
  input: ChallengeCreateV2Input,
  resolvers: ChallengeCreationResolvers,
): Promise<ChallengeCreateV2Result> {
  // Pre-validate outside the transaction so input errors read cleanly.
  parseChallengeCreateV2Input(JSON.parse(JSON.stringify(input)));
  try {
    const result = await db.transaction(async (tx) => {
      const created = await runChallengeCreateV2(tx, input, resolvers);
      throw new Error(DRY_RUN_ROLLBACK + JSON.stringify(created));
    });
    return result;
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith(DRY_RUN_ROLLBACK)) {
      const created = JSON.parse(message.slice(DRY_RUN_ROLLBACK.length)) as ChallengeCreateV2Result;
      return { ...created, dryRun: true };
    }
    throw error;
  }
}

interface ProductionResolvers {
  resolvers: ChallengeCreationResolvers;
  reader: FirestoreReader;
}

/** Production wiring: ADC Firestore reader + database Knowledge pins. */
export async function productionResolvers(db: Db): Promise<ProductionResolvers> {
  const reader = createAdminFirestoreReader();
  const membershipAuthority = createFirestoreGroupMembershipAuthority(db, reader);
  return {
    reader,
    resolvers: {
      resolveKnowledgePin: async () => null,
      resolveKnowledgePinFor: async (kind: string, key: string) => {
        if (kind !== 'fitness' && kind !== 'wellness') return null;
        return createDbKnowledgeResolver(db, kind)(key);
      },
      resolveGroupAuthority: async (groupId: string) => {
        const mapping = await db.query<{ legacy_firestore_id: string | null }>(
          `SELECT legacy_firestore_id FROM groups WHERE group_id = $1`,
          [groupId],
        );
        const legacyId = mapping.rows[0]?.legacy_firestore_id ?? null;
        if (!legacyId) return null;
        const snap = await reader.getDocument('groups', legacyId);
        if (!snap.exists || !isGroupDocActive(snap.data())) return null;
        return { status: 'active' };
      },
      resolveGroupMembershipAuthority: membershipAuthority.resolveGroupMembershipAuthority,
    } as ChallengeCreationResolvers & {
      resolveKnowledgePinFor: (kind: string, key: string) => Promise<{ knowledge_id: string; current_version: number } | null>;
    },
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const inputFlag = args.indexOf('--input');
  const inputPath = inputFlag >= 0 ? args[inputFlag + 1] : undefined;
  if (!inputPath) {
    console.log('Usage: npm run challenge:create-v2 -- --input <validated-json> [--apply]');
    console.log('  Without --apply: dry-run (validates everything, persists nothing).');
    process.exit(2);
  }
  const apply = args.includes('--apply');
  const raw = await readFile(inputPath, 'utf8');
  const input = parseChallengeCreateV2Input(JSON.parse(raw));
  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault() });
  }
  const db = createPool(databaseUrl());
  try {
    const { resolvers } = await productionResolvers(db);
    const result = apply
      ? await runChallengeCreateV2(db, input, resolvers)
      : await dryRunChallengeCreateV2(db, input, resolvers);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await db.close();
  }
}

const invokedAsCli =
  process.argv[1]?.endsWith('challengeCreateCli.ts') ||
  process.argv[1]?.endsWith('challengeCreateCli.js');
if (invokedAsCli) void main().catch((error) => {
  console.error((error as Error).message);
  process.exit(1);
});
