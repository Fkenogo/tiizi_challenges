/**
 * Phase 17G — E2E-equivalent challenge creation audit
 *
 * Tests all 6 mode×type combinations against createChallengeWithCreatorMembershipCore
 * using the same FakeDb harness as testChallengeCreationBackend. No Firebase connection needed.
 *
 * Coverage:
 *  A. Payload correctness for Fitness × {Collective, Competitive, Streak}
 *  B. Payload correctness for Wellness × {Collective, Competitive, Streak}
 *  C. Membership document correctness for each combination
 *  D. Streak: requiredConsecutiveDays present, streakResetOnMiss present, no frequency required
 *  E. Collective: groupCumulativeTarget present
 *  F. engineVersion: 'v2' written for all
 *  G. No frequency field required in any combination
 *  H. Wellness: category is not 'fitness'
 *  I. Fitness: exerciseId written; Wellness: activityId written
 */

import assert from 'node:assert/strict';
import { createChallengeWithCreatorMembershipCore } from '../functions/src/challengeCreationBackend.js';

// ── Fake Firestore harness ────────────────────────────────────────────────────

class FakeDoc {
  constructor(private readonly store: Map<string, Record<string, unknown>>, readonly path: string) {}
  get id() { return this.path.split('/').at(-1) ?? ''; }
  async get() {
    const data = this.store.get(this.path);
    return { exists: data !== undefined, id: this.id, data: () => data };
  }
}

class FakeCollection {
  constructor(private readonly store: Map<string, Record<string, unknown>>, private readonly name: string, private readonly idFactory: () => string) {}
  doc(id?: string) { return new FakeDoc(this.store, `${this.name}/${id ?? this.idFactory()}`); }
}

class FakeDb {
  readonly store = new Map<string, Record<string, unknown>>();
  private nextId = 1;
  collection(name: string) { return new FakeCollection(this.store, name, () => `gen_${this.nextId++}`); }
  async runTransaction<T>(callback: (tx: FakeTx) => Promise<T>) {
    const tx = new FakeTx(this.store);
    const result = await callback(tx);
    tx.commit();
    return result;
  }
}

class FakeTx {
  private readonly staged = new Map<string, Record<string, unknown>>();
  constructor(private readonly store: Map<string, Record<string, unknown>>) {}
  async get(ref: FakeDoc) {
    const data = this.staged.get(ref.path) ?? this.store.get(ref.path);
    return { exists: data !== undefined, id: ref.id, data: () => data };
  }
  set(ref: FakeDoc, data: Record<string, unknown>, opts?: { merge?: boolean }) {
    if (opts?.merge) {
      this.staged.set(ref.path, { ...(this.store.get(ref.path) ?? {}), ...(this.staged.get(ref.path) ?? {}), ...data });
      return;
    }
    this.staged.set(ref.path, data);
  }
  commit() { this.staged.forEach((data, path) => this.store.set(path, data)); }
}

function seedActiveGroup(db: FakeDb, groupId = 'grp') {
  db.store.set(`groups/${groupId}`, { ownerId: 'owner', status: 'active', isPrivate: false, visibility: 'public', allowMemberChallenges: true });
  db.store.set(`groupMembers/grp_creator`, { groupId, userId: 'creator', role: 'member', status: 'active' });
}

// ── Common inputs ─────────────────────────────────────────────────────────────

const DURATION = 30;
const START = '2026-08-01T00:00:00.000Z';

const fitnessActivity = { exerciseId: 'pushups', exerciseName: 'Push-Ups', targetValue: 20, unit: 'Reps' };
const wellnessActivity = { activityId: 'wa-meditation', activityType: 'mindfulness', exerciseName: 'Meditation', targetValue: 15, unit: 'minutes' };

type Combo = { mode: 'fitness' | 'wellness'; type: 'collective' | 'competitive' | 'streak' };

const COMBOS: Combo[] = [
  { mode: 'fitness',  type: 'collective' },
  { mode: 'fitness',  type: 'competitive' },
  { mode: 'fitness',  type: 'streak' },
  { mode: 'wellness', type: 'collective' },
  { mode: 'wellness', type: 'competitive' },
  { mode: 'wellness', type: 'streak' },
];

function buildInput(combo: Combo) {
  const activity = combo.mode === 'wellness' ? wellnessActivity : fitnessActivity;
  const base = {
    actorUid: 'creator',
    groupId: 'grp',
    name: `Test ${combo.mode} ${combo.type}`,
    description: 'Phase 17G automated audit challenge',
    category: combo.mode === 'wellness' ? 'mindfulness' : 'fitness',
    challengeType: combo.type,
    startDate: START,
    durationDays: DURATION,
    activities: [activity],
    engineVersion: 'v2',
  };
  if (combo.type === 'collective') return { ...base, groupCumulativeTarget: 1000, autoCompleteOnGroupTarget: true };
  if (combo.type === 'streak') return { ...base, requiredConsecutiveDays: 30, streakResetOnMiss: true };
  return base;
}

// ── Run tests ─────────────────────────────────────────────────────────────────

async function run() {
  for (const combo of COMBOS) {
    const label = `${combo.mode}+${combo.type}`;
    const db = new FakeDb();
    seedActiveGroup(db);

    const result = await createChallengeWithCreatorMembershipCore(db as never, buildInput(combo));
    const challengeId = result.challenge.id;
    const challengeDoc = db.store.get(`challenges/${challengeId}`);
    const memberDoc = db.store.get(`challengeMembers/${challengeId}_creator`);

    assert.ok(challengeDoc, `${label}: challenge document must exist`);

    // A/B. engineVersion
    assert.equal(challengeDoc.engineVersion, 'v2', `${label}: engineVersion must be 'v2'`);

    // A/B. challengeType
    assert.equal(challengeDoc.challengeType, combo.type, `${label}: challengeType must be '${combo.type}'`);

    // A/B. category
    if (combo.mode === 'wellness') {
      assert.notEqual(challengeDoc.category, 'fitness', `${label}: wellness challenge category must not be 'fitness'`);
      assert.equal(challengeDoc.category, 'mindfulness', `${label}: wellness category must be 'mindfulness'`);
    } else {
      assert.equal(challengeDoc.category, 'fitness', `${label}: fitness category must be 'fitness'`);
    }

    // A/B. activities present with correct identifiers
    const activities = challengeDoc.activities as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(activities) && activities.length === 1, `${label}: must have 1 activity`);
    if (combo.mode === 'fitness') {
      assert.equal(activities[0].exerciseId, 'pushups', `${label}: fitness activity must have exerciseId`);
    } else {
      assert.equal(activities[0].activityId, 'wa-meditation', `${label}: wellness activity must have activityId`);
    }

    // A/B. status (no donation — should be active)
    assert.equal(challengeDoc.status, 'active', `${label}: challenge status must be 'active'`);

    // A/B. participantCount initialized to 0
    assert.equal(challengeDoc.participantCount, 0, `${label}: participantCount must be 0`);

    // C. Creator membership document
    assert.ok(memberDoc, `${label}: creator challengeMembers doc must exist`);
    assert.equal(memberDoc.userId, 'creator', `${label}: member.userId must be 'creator'`);
    assert.equal(memberDoc.groupId, 'grp', `${label}: member.groupId must be 'grp'`);
    assert.equal(memberDoc.challengeId, challengeId, `${label}: member.challengeId must match`);
    assert.equal(memberDoc.status, 'active', `${label}: member.status must be 'active'`);

    // D. Streak-specific fields
    if (combo.type === 'streak') {
      assert.equal(challengeDoc.requiredConsecutiveDays, 30, `${label}: requiredConsecutiveDays must be 30`);
      assert.equal(challengeDoc.streakResetOnMiss, true, `${label}: streakResetOnMiss must be true`);
      // Streak member gets currentStreak + longestStreak initialized
      assert.equal(memberDoc.currentStreak, 0, `${label}: member.currentStreak must be 0`);
      assert.equal(memberDoc.longestStreak, 0, `${label}: member.longestStreak must be 0`);
    } else {
      assert.equal(challengeDoc.requiredConsecutiveDays, undefined, `${label}: non-streak must not have requiredConsecutiveDays`);
    }

    // E. Collective-specific fields
    if (combo.type === 'collective') {
      assert.equal(challengeDoc.groupCumulativeTarget, 1000, `${label}: groupCumulativeTarget must be 1000`);
      assert.equal(challengeDoc.autoCompleteOnGroupTarget, true, `${label}: autoCompleteOnGroupTarget must be true`);
    } else {
      assert.equal(challengeDoc.groupCumulativeTarget, undefined, `${label}: non-collective must not have groupCumulativeTarget`);
    }

    // G. No frequency field required — absence is correct; if present it must be valid
    const actFreq = activities[0].frequency;
    if (actFreq !== undefined) {
      const VALID = ['daily', 'weekly', '2x-week', '3x-week', '5x-week', 'custom'];
      assert.ok(VALID.includes(String(actFreq)), `${label}: if frequency is present it must be a valid value`);
    }
    // Streak does NOT require frequency in the challenge payload
    if (combo.type === 'streak') {
      assert.ok(challengeDoc.requiredConsecutiveDays !== undefined, `${label}: streak uses requiredConsecutiveDays, not frequency`);
    }

    // I. totalActivities in membership = activities.length × durationDays
    const expectedTotalActivities = 1 * DURATION;
    assert.equal(memberDoc.totalActivities, expectedTotalActivities, `${label}: totalActivities must be ${expectedTotalActivities}`);

    console.log(`  ✅ ${label}`);
  }

  // ── H. Wellness category guard: function accepts all wellness categories ─────
  const wellnessCategories = ['fasting', 'hydration', 'sleep', 'mindfulness', 'nutrition', 'habits', 'stress', 'social'];
  for (const cat of wellnessCategories) {
    const db = new FakeDb();
    seedActiveGroup(db);
    const result = await createChallengeWithCreatorMembershipCore(db as never, {
      actorUid: 'creator',
      groupId: 'grp',
      name: `Test ${cat}`,
      description: 'Wellness category check',
      category: cat,
      challengeType: 'competitive',
      startDate: START,
      durationDays: 7,
      activities: [wellnessActivity],
      engineVersion: 'v2',
    });
    const doc = db.store.get(`challenges/${result.challenge.id}`);
    assert.equal(doc?.category, cat, `wellness category '${cat}' must be preserved in challenge document`);
  }
  console.log(`  ✅ All 8 wellness categories accepted and preserved`);

  console.log('\ntestChallengeCreation6Combinations: all guards passed ✅');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
