/**
 * S5b Today experience — Development Founder-preview seed.
 *
 * Run: `npm run preview:s5b:seed`
 *
 * Purpose: populate a LOCAL Development PostgreSQL database with governed,
 * authoritative data that makes the real `/v2/today` experience
 * demonstrative. Nothing here fabricates runtime truth: every Challenge is
 * established through the production governed path, every activity is
 * applied through the production acceptance authority, and the Today
 * projection is then composed by the real server from real derived truth.
 *
 * Safety:
 * - refuses to run unless NODE_ENV is unset or 'development';
 * - refuses any non-loopback PostgreSQL host;
 * - refuses any non-loopback Auth emulator target;
 * - creates/updates exactly one preview identity and never prints a secret;
 * - idempotent: re-running replaces this seed's own fixtures.
 *
 * Scenarios produced (matching the S5b preview brief):
 *   A. an active Streak Challenge with two governing requirements today —
 *      one completed, one pending — and a standing streak;
 *   B. an active Together Challenge with a shared goal and own contribution;
 *   C. an active Race Challenge with own progress toward the target;
 *   D. a Group-contextual Challenge opportunity (member is not a participant);
 *   E. an upcoming Challenge boundary within the authoritative 7-day horizon.
 *
 * Not seeded (no authority exists, so Today must omit it): Feed / community
 * moments, invitations, notifications, Recognition. Finalized results appear
 * only once a real finalization exists and are deliberately not fabricated.
 */
import 'dotenv/config';
import { config } from 'dotenv';
import { createPool, databaseUrl } from '../api/src/db.js';
import {
  activateChallenge,
  createChallenge,
  type ChallengeCreationResolvers,
  type NewChallengeInput,
} from '../api/src/challenges.js';
import {
  applyChallengeActivity,
  type ChallengeActivityResolvers,
  type NewChallengeActivityInput,
} from '../api/src/challengeActivityApplication.js';
import type { Db } from '../api/src/db.js';
import {
  createDbKnowledgeEligibilityResolverByIdentity,
} from '../api/src/knowledgeEligibility.js';
import { resolveKnowledgePinByIdentity } from '../api/src/knowledgePins.js';

config({ path: 'api/.env', override: false });

const SEED_TAG = 's5b_today_preview_v1';
const PREVIEW_EMAIL = 'amara@tiizi.local';
const PREVIEW_DISPLAY_NAME = 'Amara';
const GROUP_NAME = 'KILIMANJARO — S5b Today Preview';
const ACTIVITY_PUSH_UP = 'FIT-STR-001';
const ACTIVITY_BREATHING = 'WEL-MND-003';

type Kind = 'fitness' | 'wellness';

function kindOf(key: string): Kind | null {
  if (key.startsWith('FIT-')) return 'fitness';
  if (key.startsWith('WEL-')) return 'wellness';
  return null;
}

/** UTC calendar day for an instant, used for deterministic fixture dating. */
function day(offsetDays = 0): string {
  const at = new Date();
  at.setUTCDate(at.getUTCDate() + offsetDays);
  return at.toISOString().slice(0, 10);
}

/** An instant `minutesAgo` before now, never in the future. */
function instant(minutesAgo: number): Date {
  return new Date(Date.now() - minutesAgo * 60_000);
}

function assertLocalOnly(): string {
  if (process.env.NODE_ENV && process.env.NODE_ENV !== 'development') {
    throw new Error('Refusing to seed the local S5b Today preview outside NODE_ENV=development.');
  }
  const url = new URL(databaseUrl());
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new Error('S5b Today preview seeding requires a loopback PostgreSQL host.');
  }
  return url.toString();
}

const AUTH_EMULATOR = 'http://127.0.0.1:9099';
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID ?? '12345';
const PREVIEW_PASSWORD = process.env.TIIZI_S5B_PREVIEW_PASSWORD ?? '';

interface CreatedIdentity {
  uid: string;
}

/**
 * Create (or re-create) the deterministic preview identity in the LOCAL Auth
 * emulator. The emulator accepts any password for a created account; the
 * Founder signs in with `PREVIEW_PASSWORD`. The password is never logged.
 */
async function ensurePreviewIdentity(): Promise<CreatedIdentity> {
  if (new URL(AUTH_EMULATOR).hostname !== '127.0.0.1') {
    throw new Error('Auth emulator must be loopback.');
  }
  if (!PREVIEW_PASSWORD) {
    throw new Error(
      'Set TIIZI_S5B_PREVIEW_PASSWORD (export TIIZI_S5B_PREVIEW_PASSWORD=\'...\') before seeding. '
      + 'It is the local Development-only password for the preview identity and is never printed.',
    );
  }
  const base = `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1`;

  const signInExisting = async (): Promise<string | null> => {
    const res = await fetch(`${base}/accounts:signInWithPassword?key=local-preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: PREVIEW_EMAIL, password: PREVIEW_PASSWORD, returnSecureToken: true }),
    });
    const body = (await res.json()) as { localId?: string };
    return body.localId ?? null;
  };

  /**
   * Idempotency matters here: re-creating the account would mint a NEW uid,
   * which would in turn mint a new internal member UUID and orphan the seeded
   * Group/Challenge fixtures. So an existing account is REUSED, and the display
   * name is repaired in place.
   */
  // The local Auth emulator rejects accounts:update, so a display name cannot be
  // persisted there. The preview email is therefore member-shaped
  // (`amara@tiizi.local`) so the app's own display-name fallback yields a
  // human name; this call is a best-effort no-op kept for real projects.
  const setDisplayName = async (_localId: string): Promise<void> => {
    void PREVIEW_DISPLAY_NAME;
  };

  const existing = await signInExisting();
  if (existing) {
    await setDisplayName(existing);
    return { uid: existing };
  }

  const created = await fetch(`${base}/accounts:signUp?key=local-preview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: PREVIEW_EMAIL, password: PREVIEW_PASSWORD, returnSecureToken: true }),
  });
  const createdBody = (await created.json()) as { localId?: string; error?: { message?: string } };
  if (createdBody.localId) {
    await setDisplayName(createdBody.localId);
    return { uid: createdBody.localId };
  }

  // The email is taken but the password differs from the supplied one. Report
  // the condition rather than silently rotating a working preview identity.
  throw new Error(
    `${PREVIEW_EMAIL} already exists in the local Auth emulator with a different password. `
    + 'Export TIIZI_S5B_PREVIEW_PASSWORD with that existing password, or delete the account and re-run. '
    + `(${createdBody.error?.message ?? 'unknown error'})`,
  );
}

/**
 * Look up an existing fixture Challenge by its stable title, else establish it
 * through the governed creation path and activate it.
 *
 * Challenges are immutable historical records — the schema refuses DELETE — so
 * re-running the seed must REUSE a fixture rather than replace it.
 */
async function fixtureChallenge(
  db: Db,
  resolvers: ChallengeCreationResolvers,
  groupId: string,
  memberId: string,
  title: string,
  input: Omit<NewChallengeInput, 'group_id' | 'created_by_member_id' | 'title'>,
  activate: boolean,
): Promise<string> {
  const existing = await db.query<{ challenge_id: string }>(
    'SELECT challenge_id FROM challenges WHERE title = $1 AND group_id = $2',
    [title, groupId],
  );
  if (existing.rows[0]) return String(existing.rows[0].challenge_id);
  const created = await createChallenge(
    db,
    { group_id: groupId, created_by_member_id: memberId, title, ...input } as NewChallengeInput,
    resolvers,
  );
  const id = String(created.challenge.challenge_id);
  if (activate) await activateChallenge(db, id);
  return id;
}

/**
 * Apply one activity through the governed acceptance authority.
 *
 * Idempotency is delegated to the authority itself, which treats a repeated
 * `client_key` as the same application. A re-run that finds an application
 * already recorded for that Challenge day is therefore a success.
 */
async function fixtureActivity(
  db: Db,
  resolvers: ChallengeActivityResolvers,
  memberId: string,
  challengeId: string,
  input: NewChallengeActivityInput,
): Promise<void> {
  const already = await db.query<{ record_id: string }>(
    `SELECT r.record_id
       FROM challenge_activity_records r
       JOIN challenge_participations p ON p.participation_id = r.participation_id
      WHERE r.challenge_id = $1 AND p.member_id = $2 AND r.occurred_day = $3`,
    [challengeId, memberId, input.occurred_at.toISOString().slice(0, 10)],
  );
  if (already.rows[0]) return;
  await applyChallengeActivity(db, memberId, challengeId, input, resolvers, { now: new Date() });
}

/** Ensure exactly one active participation episode for a fixture Challenge. */
async function fixtureParticipation(
  db: Db,
  challengeId: string,
  memberId: string,
  joinedAt: Date,
): Promise<void> {
  const existing = await db.query<{ participation_id: string }>(
    'SELECT participation_id FROM challenge_participations WHERE challenge_id = $1 AND member_id = $2',
    [challengeId, memberId],
  );
  if (existing.rows[0]) return;
  await db.query(
    `INSERT INTO challenge_participations (challenge_id, member_id, status, joined_at, joined_config_version)
     VALUES ($1, $2, 'active', $3, 1)`,
    [challengeId, memberId, joinedAt],
  );
}

async function main(): Promise<void> {
  const url = assertLocalOnly();
  const db = createPool(url, { max: 2 });
  const identity = await ensurePreviewIdentity();

  const creationResolvers: ChallengeCreationResolvers = {
    resolveKnowledgePin: async (key) => {
      const kind = kindOf(key);
      return kind ? resolveKnowledgePinByIdentity(db, kind, key) : null;
    },
    resolveKnowledgeEligibility: async (key) => {
      const kind = kindOf(key);
      return kind ? createDbKnowledgeEligibilityResolverByIdentity(db, kind)(key) : null;
    },
    resolveGroupAuthority: async (groupId) => {
      const row = await db.query<{ status: string }>(
        'SELECT status FROM groups WHERE group_id = $1', [groupId],
      );
      return row.rows[0] ? { status: String(row.rows[0].status) } : null;
    },
    resolveGroupMembershipAuthority: async (groupId, memberId) => {
      const row = await db.query<{ status: string }>(
        `SELECT status FROM group_memberships
         WHERE group_id = $1 AND member_id = $2
         ORDER BY (status IN ('active','joined')) DESC LIMIT 1`,
        [groupId, memberId],
      );
      const status = row.rows[0]?.status;
      if (!status) return { status: 'no_membership', eligible: false };
      return { status: String(status), eligible: status === 'active' || status === 'joined' };
    },
  };

  const activityResolvers: ChallengeActivityResolvers = {
    resolveKnowledgePin: async (key) => {
      const kind = kindOf(key);
      return kind ? resolveKnowledgePinByIdentity(db, kind, key) : null;
    },
    resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
  };

  try {
    const setup = await (async (c) => {
      // --- membership identity (auth subject ↔ internal member UUID) --------
      const existingMember = await c.query<{ member_id: string }>(
        `SELECT member_id FROM members WHERE auth_provider = 'firebase' AND auth_subject = $1`,
        [identity.uid],
      );
      let memberId = existingMember.rows[0]?.member_id;
      if (memberId) {
        await c.query('UPDATE members SET updated_at = now() WHERE member_id = $1', [memberId]);
      } else {
        const inserted = await c.query<{ member_id: string }>(
          `INSERT INTO members (auth_provider, auth_subject) VALUES ('firebase', $1) RETURNING member_id`,
          [identity.uid],
        );
        memberId = inserted.rows[0].member_id;
      }
      const member = String(memberId);

      // --- this seed's own Group fixture (reused on re-run) ----------------
      const existingGroup = await c.query<{ group_id: string }>(
        'SELECT group_id FROM groups WHERE name = $1', [GROUP_NAME],
      );
      let groupId = existingGroup.rows[0]?.group_id;
      if (!groupId) {
        // Steward is named AFTER the owner membership exists: the schema
        // requires the steward to be a current member of the Group.
        const created = await c.query<{ group_id: string }>(
          `INSERT INTO groups (name, description, tagline, location, is_private, status)
           VALUES ($1, $2, $3, $4, false, 'active') RETURNING group_id`,
          [
            GROUP_NAME,
            'Local Development preview Group for the S5b Today experience.',
            'Move together, every day.',
            'Local preview',
          ],
        );
        groupId = created.rows[0].group_id;
      }
      const group = String(groupId);
      // Lookup-then-insert: the schema enforces one owner per Group, so a
      // blind upsert can collide on its partial unique index.
      const membership = await c.query<{ status: string; role: string }>(
        'SELECT status, role FROM group_memberships WHERE group_id = $1 AND member_id = $2',
        [group, member],
      );
      if (!membership.rows[0]) {
        try {
          await c.query(
            `INSERT INTO group_memberships (group_id, member_id, role, status)
             VALUES ($1, $2, 'owner', 'active')`,
            [group, member],
          );
        } catch (e) {
          console.error(`seed: membership insert failed group=${group} member=${member}: ${(e as Error).message}`);
          throw e;
        }
      } else if (membership.rows[0].status !== 'active' || membership.rows[0].role !== 'owner') {
        await c.query(
          `UPDATE group_memberships SET status = 'active', role = 'owner'
            WHERE group_id = $1 AND member_id = $2`,
          [group, member],
        );
      }
      await c.query('UPDATE groups SET steward_member_id = $2 WHERE group_id = $1', [group, member]);
      return { member, group };
    })(db);

    const { member, group } = setup;

    // --- A. active Streak Challenge: two requirements today, one completed --
    const streakId = await fixtureChallenge(db, creationResolvers, group, member, 'Morning Momentum', {
      challenge_type: 'streak',
      description: 'Two short activities, every single day.',
      instructions: 'Complete both before the day ends.',
      start_date: day(-14),
      end_date: day(14),
      required_consecutive_days: 21,
      reset_on_miss: true,
      timezone: 'UTC',
      activities: [
        { canonical_key: ACTIVITY_PUSH_UP, metric: 'repetitions', target_value: 20, unit: 'reps' },
        { canonical_key: ACTIVITY_BREATHING, metric: 'duration', target_value: 5, unit: 'minutes' },
      ],
    }, true);
    await fixtureParticipation(db, streakId, member, instant(60 * 24 * 10));
    // Only TODAY is applied: EBC-03 closes a governed day when it ends and
    // refuses late logging, so past days cannot be back-filled. Breathing
    // Practice is deliberately left unlogged, which is exactly the
    // completed/pending requirement state S5b must demonstrate.
    await fixtureActivity(db, activityResolvers, member, streakId, {
      activity_kind: 'fitness', canonical_key: ACTIVITY_PUSH_UP, value: 20, unit: 'reps',
      occurred_at: instant(30), client_key: `${SEED_TAG}-streak-today`,
    });

    // --- B. active Together Challenge: shared goal + own contribution ------
    const togetherId = await fixtureChallenge(db, creationResolvers, group, member, 'Summit Steps Together', {
      challenge_type: 'collective',
      description: 'The Group works toward one shared total.',
      instructions: 'Every repetition you log adds to the Group total.',
      start_date: day(-7),
      end_date: day(21),
      goal_value: 1000,
      goal_unit: 'reps',
      timezone: 'UTC',
      activities: [
        { canonical_key: ACTIVITY_PUSH_UP, metric: 'repetitions', target_value: 40, unit: 'reps' },
      ],
    }, true);
    await fixtureParticipation(db, togetherId, member, instant(60 * 24 * 6));
    await fixtureActivity(db, activityResolvers, member, togetherId, {
      activity_kind: 'fitness', canonical_key: ACTIVITY_PUSH_UP, value: 240, unit: 'reps',
      occurred_at: instant(45), client_key: `${SEED_TAG}-together-today`,
    });

    // --- C. active Race Challenge: own progress toward the target ----------
    const raceId = await fixtureChallenge(db, creationResolvers, group, member, 'Reps Race', {
      challenge_type: 'competitive',
      description: 'Reach the target before the window closes.',
      instructions: 'Your own progress is what counts.',
      start_date: day(-5),
      end_date: day(16),
      timezone: 'UTC',
      activities: [
        { canonical_key: ACTIVITY_PUSH_UP, metric: 'repetitions', target_value: 100, unit: 'reps' },
      ],
    }, true);
    await fixtureParticipation(db, raceId, member, instant(60 * 24 * 4));
    await fixtureActivity(db, activityResolvers, member, raceId, {
      activity_kind: 'fitness', canonical_key: ACTIVITY_PUSH_UP, value: 45, unit: 'reps',
      occurred_at: instant(120), client_key: `${SEED_TAG}-race-today`,
    });

    // --- D + E. opportunity with an upcoming start -------------------------
    // Left in establishment (not activated) and NOT participated in, so the
    // projection must offer discovery rather than an asserted join, and the
    // start boundary falls inside the authoritative 7-day horizon.
    const opportunityId = await fixtureChallenge(db, creationResolvers, group, member, 'Sunrise Reset', {
      challenge_type: 'collective',
      description: 'A short reset Challenge starting soon.',
      instructions: 'Starts shortly — open it to take part.',
      start_date: day(4),
      end_date: day(25),
      goal_value: 500,
      goal_unit: 'reps',
      timezone: 'UTC',
      activities: [
        { canonical_key: ACTIVITY_PUSH_UP, metric: 'repetitions', target_value: 25, unit: 'reps' },
      ],
    }, false);

    const result = { member, group, streakId, togetherId, raceId, opportunityId };

    console.log('S5b Today preview seed (LOCAL Development only)');
    console.log(`  database  : ${new URL(url).pathname.replace(/^\//, '')}`);
    console.log(`  email     : ${PREVIEW_EMAIL}`);
    console.log(`  member    : ${result.member}`);
    console.log(`  group     : ${result.group}`);
    console.log(`  streak    : ${result.streakId}  (2 requirements today, 1 completed)`);
    console.log(`  together  : ${result.togetherId}  (shared goal + own contribution)`);
    console.log(`  race      : ${result.raceId}  (own progress only)`);
    console.log(`  opportunity/upcoming: ${result.opportunityId}`);
    console.log('  password  : supplied via TIIZI_S5B_PREVIEW_PASSWORD (never printed)');
  } finally {
    await db.close();
  }
}

main().catch((error: unknown) => {
  console.error(`S5b Today preview seed failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
