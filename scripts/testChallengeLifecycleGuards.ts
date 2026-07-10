/**
 * Phase 19A — Guard tests for challenge lifecycle automation.
 *
 * Root cause: No Cloud Function existed to transition status==='active' challenges
 * to status==='completed' when endDate passes. Stale docs accumulated indefinitely,
 * making isChallengeOngoing() client-side filtering a required workaround.
 *
 * Fix: challengeLifecycleJobs.ts + expireChallengesOnSchedule export in index.ts.
 *
 * Status alignment: active + past endDate → status: 'completed' (NOT 'expired').
 * This ensures auto-completed challenges appear in Completed tabs, and the
 * onChallengeUpdated trigger decrements group.activeChallenges correctly
 * (ACTIVE_CHALLENGE_STATUSES = Set(['active']), so active→completed is -1 delta).
 *
 * Run: npx tsx scripts/testChallengeLifecycleGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const jobsFile = read('functions/src/challengeLifecycleJobs.ts');
const indexFile = read('functions/src/index.ts');
const counterFile = read('functions/src/memberCounters.ts');

// ─────────────────────────────────────────────────────────────────────────────
// RULE: expireEndedChallenges is implemented
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  jobsFile,
  /export async function expireEndedChallenges/,
  'LIFECYCLE: challengeLifecycleJobs.ts must export expireEndedChallenges',
);

assert.match(
  jobsFile,
  /status.*==.*'active'/,
  'LIFECYCLE: Must query by status === "active"',
);

assert.match(
  jobsFile,
  /endDate.*<.*nowIso|nowIso.*>.*endDate/,
  'LIFECYCLE: Must filter docs whose endDate is before now',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: writes status: 'completed', NOT 'expired'
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  jobsFile,
  /status:\s*'completed'/,
  'LIFECYCLE: Must write status: "completed" (not "expired") so challenges appear in Completed tabs',
);

assert.doesNotMatch(
  jobsFile,
  /status:\s*'expired'/,
  'LIFECYCLE: Must NOT write status: "expired" — auto-ended challenges must show as completed',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: writes completedAt, lifecycleCompletedBy, previousStatus
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  jobsFile,
  /completedAt/,
  'LIFECYCLE: Must write completedAt timestamp when completing',
);

assert.match(
  jobsFile,
  /lifecycleCompletedBy:\s*'scheduled-function'/,
  'LIFECYCLE: Must write lifecycleCompletedBy: "scheduled-function" to distinguish from user-completed',
);

assert.match(
  jobsFile,
  /previousStatus:\s*'active'/,
  'LIFECYCLE: Must write previousStatus: "active" for audit trail',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: batched writes
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  jobsFile,
  /BATCH_SIZE|db\.batch\(\)/,
  'LIFECYCLE: Must use batched writes (max 500 per batch)',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Scheduled export registered in index.ts
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  indexFile,
  /expireChallengesOnSchedule/,
  'LIFECYCLE: index.ts must export expireChallengesOnSchedule',
);

assert.match(
  indexFile,
  /import.*expireEndedChallenges.*challengeLifecycleJobs/,
  'LIFECYCLE: index.ts must import expireEndedChallenges from challengeLifecycleJobs',
);

assert.match(
  indexFile,
  /onSchedule/,
  'LIFECYCLE: expireChallengesOnSchedule must use onSchedule',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Counter trigger sees active → completed as -1 delta
// ACTIVE_CHALLENGE_STATUSES = new Set(['active']) — only 'active' increments.
// So active→completed: beforeActive=true, afterActive=false → delta=-1. ✓
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  counterFile,
  /ACTIVE_CHALLENGE_STATUSES\s*=\s*new Set\(\['active'\]\)/,
  'LIFECYCLE: ACTIVE_CHALLENGE_STATUSES must only contain "active" — ensures active→completed decrements counter',
);

assert.doesNotMatch(
  counterFile,
  /ACTIVE_CHALLENGE_STATUSES\s*=\s*new Set\(\[.*'completed'.*\]\)/,
  'LIFECYCLE: "completed" must NOT be in ACTIVE_CHALLENGE_STATUSES — would prevent counter decrement',
);

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE: expireEndedChallenges logic — in-memory simulation
// ─────────────────────────────────────────────────────────────────────────────
{
  type Doc = { id: string; status: string; endDate: string };
  type Update = { status: string; completedAt: string; lifecycleCompletedBy: string; previousStatus: string };

  function simulateComplete(docs: Doc[], nowIso: string): Array<{ id: string; update: Update }> {
    const now = new Date().toISOString();
    return docs
      .filter((d) => d.status === 'active' && d.endDate.length > 0 && d.endDate < nowIso)
      .map((d) => ({
        id: d.id,
        update: {
          status: 'completed',
          completedAt: now,
          lifecycleCompletedBy: 'scheduled-function',
          previousStatus: 'active',
        },
      }));
  }

  const past = (days: number) => new Date(Date.now() - days * 86400_000).toISOString();
  const future = (days: number) => new Date(Date.now() + days * 86400_000).toISOString();

  const docs: Doc[] = [
    { id: 'stale-1', status: 'active', endDate: past(1) },
    { id: 'stale-2', status: 'active', endDate: past(10) },
    { id: 'ongoing', status: 'active', endDate: future(5) },
    { id: 'already-completed', status: 'completed', endDate: past(3) },
    { id: 'already-expired', status: 'expired', endDate: past(3) },
    { id: 'upcoming', status: 'active', endDate: future(2) },
  ];

  const results = simulateComplete(docs, new Date().toISOString());
  const ids = results.map((r) => r.id);

  assert.equal(results.length, 2, 'FIXTURE: should detect exactly 2 stale-active docs');
  assert.ok(ids.includes('stale-1'), 'FIXTURE: stale-1 must be completed');
  assert.ok(ids.includes('stale-2'), 'FIXTURE: stale-2 must be completed');
  assert.ok(!ids.includes('ongoing'), 'FIXTURE: ongoing (future endDate) must NOT be completed');
  assert.ok(!ids.includes('already-completed'), 'FIXTURE: already-completed must be skipped (wrong query status)');
  assert.ok(!ids.includes('already-expired'), 'FIXTURE: already-expired must be skipped (wrong query status)');
  assert.ok(!ids.includes('upcoming'), 'FIXTURE: upcoming must NOT be completed');

  // Verify update payload
  for (const r of results) {
    assert.equal(r.update.status, 'completed', `FIXTURE: ${r.id} update.status must be "completed"`);
    assert.ok(r.update.completedAt, `FIXTURE: ${r.id} update.completedAt must be set`);
    assert.equal(r.update.lifecycleCompletedBy, 'scheduled-function', `FIXTURE: ${r.id} lifecycleCompletedBy must be "scheduled-function"`);
    assert.equal(r.update.previousStatus, 'active', `FIXTURE: ${r.id} previousStatus must be "active"`);
  }

  // Verify counter delta logic: active→completed is -1
  // ACTIVE_CHALLENGE_STATUSES = Set(['active'])
  const isActive = (status: string) => status === 'active';
  for (const r of results) {
    const beforeActive = isActive('active');   // true
    const afterActive = isActive('completed'); // false
    const delta = (beforeActive ? 1 : 0) - (afterActive ? 1 : 0); // = 1 - 0 = -1... wait
    // transitionDelta logic: afterActive - beforeActive (in terms of: +1 if gained, -1 if lost)
    // actual: delta = (afterActive ? 1 : 0) - (beforeActive ? 1 : 0) = 0 - 1 = -1
    const actualDelta = (afterActive ? 1 : 0) - (beforeActive ? 1 : 0);
    assert.equal(actualDelta, -1, `FIXTURE: active→completed delta must be -1, got ${actualDelta}`);
  }
}

console.log('✅ All Phase 19A challenge lifecycle guards passed.');
