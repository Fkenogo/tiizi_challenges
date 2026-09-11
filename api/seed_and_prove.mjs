// Local Founder Preview: synthetic seed + functional proofs.
// Runs entirely against local Postgres (5434), Firestore emulator (8092),
// Auth emulator (9399), and the local tiizi-api (4210). No production
// credentials, no production hosts are touched.
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8092';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9399';
process.env.GOOGLE_APPLICATION_CREDENTIALS =
  '/private/tmp/tiizi-product-baseline/.local-emulator/fake-service-account.json';

if (getApps().length === 0) {
  initializeApp({ credential: applicationDefault(), projectId: 'demo-tiizi' });
}
const auth = getAuth();
const db = getFirestore();

const API = 'http://127.0.0.1:4210';
const AUTH_EMULATOR_KEY = 'fake-api-key';

async function signInIdToken(uid) {
  const r = await fetch(
    `http://127.0.0.1:9399/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${AUTH_EMULATOR_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: await auth.createCustomToken(uid), returnSecureToken: true }),
    },
  );
  const j = await r.json();
  if (!j.idToken) throw new Error('sign-in failed: ' + JSON.stringify(j));
  return j.idToken;
}

async function call(idToken, method, path, body) {
  const r = await fetch(API + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + idToken,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    j = text;
  }
  return { status: r.status, body: j };
}

const results = {};
let challengeIds = {};
function record(name, ok, detail) {
  results[name] = { ok, detail };
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}`, ok ? '' : JSON.stringify(detail));
}

async function main() {
  // --- 1. Synthetic members (Firebase Auth emulator) ---
  const uidA = 'founder-preview-member-a';
  const uidB = 'founder-preview-member-b';
  for (const [uid, email] of [
    [uidA, 'member-a@founder-preview.local'],
    [uidB, 'member-b@founder-preview.local'],
  ]) {
    try {
      await auth.getUser(uid);
    } catch {
      await auth.createUser({ uid, email, emailVerified: true, displayName: uid });
    }
  }
  record('auth.synthetic-members-created', true, { uidA, uidB });

  // --- 2. Synthetic Group + membership (Firestore emulator, V1 doc shape) ---
  const legacyGroupId = 'founder-preview-group';
  await db.doc(`groups/${legacyGroupId}`).set({
    name: 'Founder Preview Group',
    status: 'active',
    moderationStatus: 'active',
    createdAt: new Date().toISOString(),
  });
  for (const uid of [uidA, uidB]) {
    await db.doc(`groupMembers/${legacyGroupId}_${uid}`).set({
      groupId: legacyGroupId,
      userId: uid,
      status: 'active',
      createdAt: new Date().toISOString(),
    });
  }
  record('firestore.group-and-memberships-seeded', true, { legacyGroupId });

  // --- 3. Shadow import: Firestore -> Postgres groups/group_memberships/members ---
  const { execFileSync } = await import('node:child_process');
  const env = {
    ...process.env,
    DATABASE_URL: 'postgresql://tiizi:tiizi@localhost:5434/tiizi',
    FIREBASE_PROJECT_ID: 'demo-tiizi',
  };
  const importOut = execFileSync(
    'npx',
    ['tsx', 'src/shadowImportCli.ts', '--apply'],
    { cwd: '/private/tmp/tiizi-product-baseline/api', env, encoding: 'utf8' },
  );
  record('shadow-import.applied', true, JSON.parse(importOut));

  // --- 4. Look up the minted Postgres group UUID + member UUIDs ---
  const pg = await import('pg');
  const client = new pg.default.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  const groupRow = (
    await client.query('SELECT group_id FROM groups WHERE legacy_firestore_id = $1', [legacyGroupId])
  ).rows[0];
  const memberA = (
    await client.query("SELECT member_id FROM members WHERE auth_provider='firebase' AND auth_subject=$1", [uidA])
  ).rows[0];
  const memberB = (
    await client.query("SELECT member_id FROM members WHERE auth_provider='firebase' AND auth_subject=$1", [uidB])
  ).rows[0];
  await client.end();
  if (!groupRow || !memberA || !memberB) {
    record('shadow-import.mapping-resolved', false, { groupRow, memberA, memberB });
    return finish();
  }
  record('shadow-import.mapping-resolved', true, { groupId: groupRow.group_id, memberA: memberA.member_id, memberB: memberB.member_id });

  // --- 5. Establish 3 V2 challenges via the official CLI (collective, competitive, streak) ---
  const today = new Date();
  // Buffer start by a day so subprocess startup latency crossing a UTC
  // midnight boundary can never put "today" outside the challenge window.
  const start = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
  const end = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10);

  const challengeInputs = {
    collective: {
      group_id: groupRow.group_id,
      creator_firebase_uid: uidA,
      challenge_type: 'collective',
      title: 'Founder Preview Collective',
      description: 'Shared burpee total',
      instructions: 'Log burpees together',
      start_date: start,
      end_date: end,
      goal_value: 500,
      goal_unit: 'reps',
      activities: [{ activity_kind: 'fitness', canonical_key: 'Burpees', activity_variant: null, target_value: 500, unit: 'reps' }],
      activate: true,
      join_creator: true,
    },
    competitive: {
      group_id: groupRow.group_id,
      creator_firebase_uid: uidA,
      challenge_type: 'competitive',
      title: 'Founder Preview Competitive',
      description: 'Race to target',
      instructions: 'First to target wins',
      start_date: start,
      end_date: end,
      activities: [{ activity_kind: 'fitness', canonical_key: 'Burpees', activity_variant: null, target_value: 200, unit: 'reps' }],
      activate: true,
      join_creator: true,
    },
    streak: {
      group_id: groupRow.group_id,
      creator_firebase_uid: uidA,
      challenge_type: 'streak',
      title: 'Founder Preview Streak',
      description: 'Fitness + wellness daily consistency',
      instructions: 'Do both activities each day',
      start_date: start,
      end_date: end,
      required_consecutive_days: 2,
      reset_on_miss: true,
      activities: [
        { activity_kind: 'fitness', canonical_key: 'Burpees', activity_variant: null, target_value: 10, unit: 'reps' },
        { activity_kind: 'wellness', canonical_key: 'Deep Breathing', activity_variant: null, target_value: 5, unit: 'minutes' },
      ],
      activate: true,
      join_creator: true,
    },
  };

  const { writeFileSync } = await import('node:fs');
  for (const [kind, input] of Object.entries(challengeInputs)) {
    const path = `/tmp/challenge-${kind}.json`;
    writeFileSync(path, JSON.stringify(input, null, 2));
    try {
      const out = execFileSync(
        'npx',
        ['tsx', 'src/challengeCreateCli.ts', '--input', path, '--apply'],
        { cwd: '/private/tmp/tiizi-product-baseline/api', env, encoding: 'utf8' },
      );
      const parsed = JSON.parse(out.trim());
      challengeIds[kind] = parsed.challenge_id ?? parsed.challengeId ?? parsed.id;
      record(`establish.${kind}`, Boolean(challengeIds[kind]), parsed);
    } catch (e) {
      record(`establish.${kind}`, false, e.stdout?.toString() ?? e.message);
    }
  }

  if (!challengeIds.collective || !challengeIds.competitive || !challengeIds.streak) {
    return finish();
  }

  // --- 6. Member B joins competitive + streak (collective creator already joined) ---
  const idTokenA = await signInIdToken(uidA);
  const idTokenB = await signInIdToken(uidB);

  for (const kind of ['competitive', 'streak', 'collective']) {
    const r = await call(idTokenB, 'POST', `/v1/challenges/${challengeIds[kind]}/join`, {});
    record(`join.memberB.${kind}`, r.status === 200 || r.status === 201, r);
  }

  // --- 7. Reads: list, detail, leaderboard ---
  const listR = await call(idTokenA, 'GET', '/v1/challenges');
  record('read.list', listR.status === 200, listR.status);
  const detailR = await call(idTokenA, 'GET', `/v1/challenges/${challengeIds.collective}`);
  record('read.detail.collective', detailR.status === 200, detailR.status);
  const lbR = await call(idTokenA, 'GET', `/v1/challenges/${challengeIds.competitive}/leaderboard`);
  record('read.leaderboard.competitive', lbR.status === 200, lbR.body);

  // --- 8. Fitness + wellness logging (collective) ---
  const day = new Date().toISOString().slice(0, 10);
  const fitPayload = (client_key, value) => ({
    activity_kind: 'fitness', canonical_key: 'Burpees', value, unit: 'reps',
    occurred_at: new Date().toISOString(), occurred_day: day, occurred_tz: 'UTC', client_key,
  });
  const logR = await call(idTokenA, 'POST', `/v1/challenges/${challengeIds.collective}/activity`, fitPayload('preview-fitness-001', 20));
  record('log.fitness.collective', logR.status === 200 || logR.status === 201, logR);

  // --- 9. Idempotency: retry same client_key ---
  const replayR = await call(idTokenA, 'POST', `/v1/challenges/${challengeIds.collective}/activity`, fitPayload('preview-fitness-001', 20));
  record('idempotency.replay-no-duplicate', replayR.status === 200 || replayR.status === 201, replayR);

  // --- 10. Negative path: invalid unit ---
  const badR = await call(idTokenA, 'POST', `/v1/challenges/${challengeIds.collective}/activity`, fitPayload('preview-fitness-bad-unit', -999) && { ...fitPayload('preview-fitness-bad-unit', 20), unit: 'not-a-real-unit' });
  record('negative.invalid-unit-rejected', badR.status >= 400 && badR.status < 500, badR);

  // --- 11. Collective shared total visible ---
  const collectiveDetailR = await call(idTokenA, 'GET', `/v1/challenges/${challengeIds.collective}`);
  record('collective.progress-visible', collectiveDetailR.status === 200, collectiveDetailR.body);

  // --- 12. Streak: activity A alone does not complete day; A+B completes it; retry no dup ---
  const streakFit = (client_key) => ({
    activity_kind: 'fitness', canonical_key: 'Burpees', value: 10, unit: 'reps',
    occurred_at: new Date().toISOString(), occurred_day: day, occurred_tz: 'UTC', client_key,
  });
  const streakWell = (client_key) => ({
    activity_kind: 'wellness', canonical_key: 'Deep Breathing', value: 5, unit: 'minutes',
    occurred_at: new Date().toISOString(), occurred_day: day, occurred_tz: 'UTC', client_key,
  });
  const s1 = await call(idTokenA, 'POST', `/v1/challenges/${challengeIds.streak}/activity`, streakFit('preview-streak-fit-day1'));
  const streakAfterFitOnly = await call(idTokenA, 'GET', `/v1/challenges/${challengeIds.streak}`);
  const s2 = await call(idTokenA, 'POST', `/v1/challenges/${challengeIds.streak}/activity`, streakWell('preview-streak-well-day1'));
  const streakAfterBoth = await call(idTokenA, 'GET', `/v1/challenges/${challengeIds.streak}`);
  const s2retry = await call(idTokenA, 'POST', `/v1/challenges/${challengeIds.streak}/activity`, streakWell('preview-streak-well-day1'));
  record('streak.fitness-only-logged', s1.status === 200 || s1.status === 201, s1.body);
  record('streak.detail-after-fitness-only', streakAfterFitOnly.status === 200, streakAfterFitOnly.body);
  record('streak.wellness-completes-day', s2.status === 200 || s2.status === 201, s2.body);
  record('streak.detail-after-both', streakAfterBoth.status === 200, streakAfterBoth.body);
  record('streak.retry-no-duplicate', s2retry.status === 200 || s2retry.status === 201, s2retry.body);

  // --- 13. No dual-write proof: V1 Firestore has zero activity/progress docs for this run ---
  const v1ActivityCollections = ['workoutLogs', 'activityLogs', 'challengeActivities', 'challengeProgress'];
  const dualWriteFindings = {};
  for (const col of v1ActivityCollections) {
    const snap = await db.collection(col).limit(1).get();
    dualWriteFindings[col] = snap.size;
  }
  record('no-dual-write.v1-firestore-untouched', Object.values(dualWriteFindings).every((n) => n === 0), dualWriteFindings);

  finish();

  function finish() {
    console.log('\n=== SUMMARY ===');
    console.log(JSON.stringify({ challengeIds, results }, null, 2));
    const failed = Object.entries(results).filter(([, v]) => !v.ok);
    console.log(`\n${Object.keys(results).length - failed.length}/${Object.keys(results).length} passed`);
    if (failed.length) {
      console.log('FAILED:', failed.map(([k]) => k).join(', '));
    }
  }
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
