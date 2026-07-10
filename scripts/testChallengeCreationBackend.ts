import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createChallengeWithCreatorMembershipCore } from '../functions/src/challengeCreationBackend.js';

class FakeDoc {
  constructor(
    private readonly store: Map<string, Record<string, unknown>>,
    readonly path: string,
  ) {}

  get id() {
    return this.path.split('/').at(-1) ?? '';
  }

  async get() {
    const data = this.store.get(this.path);
    return {
      exists: data !== undefined,
      id: this.id,
      data: () => data,
    };
  }
}

class FakeCollection {
  constructor(
    private readonly store: Map<string, Record<string, unknown>>,
    private readonly name: string,
    private readonly idFactory: () => string,
  ) {}

  doc(id?: string) {
    return new FakeDoc(this.store, `${this.name}/${id ?? this.idFactory()}`);
  }
}

class FakeDb {
  readonly store = new Map<string, Record<string, unknown>>();
  private nextId = 1;

  collection(name: string) {
    return new FakeCollection(this.store, name, () => `generated_${this.nextId++}`);
  }

  async runTransaction<T>(callback: (transaction: FakeTransaction) => Promise<T>) {
    const transaction = new FakeTransaction(this.store);
    const result = await callback(transaction);
    transaction.commit();
    return result;
  }
}

class FakeTransaction {
  private readonly staged = new Map<string, Record<string, unknown>>();

  constructor(private readonly store: Map<string, Record<string, unknown>>) {}

  async get(ref: FakeDoc) {
    const data = this.staged.get(ref.path) ?? this.store.get(ref.path);
    return {
      exists: data !== undefined,
      id: ref.id,
      data: () => data,
    };
  }

  set(ref: FakeDoc, data: Record<string, unknown>, options?: { merge?: boolean }) {
    if (options?.merge) {
      this.staged.set(ref.path, {
        ...(this.store.get(ref.path) ?? {}),
        ...(this.staged.get(ref.path) ?? {}),
        ...data,
      });
      return;
    }
    this.staged.set(ref.path, data);
  }

  commit() {
    this.staged.forEach((data, path) => {
      this.store.set(path, data);
    });
  }
}

async function assertRejectsWithCode(label: string, expectedCode: string, fn: () => Promise<unknown>) {
  await assert.rejects(fn, (error) => {
    assert.equal((error as { code?: string }).code, expectedCode, label);
    return true;
  });
}

function seedActiveGroup(db: FakeDb, groupId = 'group_1') {
  db.store.set(`groups/${groupId}`, {
    ownerId: 'owner_uid',
    status: 'active',
    isPrivate: false,
    visibility: 'public',
    allowMemberChallenges: true,
  });
}

const baseInput = {
  actorUid: 'creator_uid',
  groupId: 'group_1',
  name: 'Pilot Pushups',
  description: 'A safe pilot challenge',
  category: 'fitness',
  challengeType: 'collective',
  startDate: '2026-06-14T00:00:00.000Z',
  durationDays: 7,
  exerciseIds: ['pushups'],
  activities: [
    {
      exerciseId: 'pushups',
      exerciseName: 'Push-Ups',
      targetValue: 10,
      unit: 'reps',
    },
  ],
};

async function run() {
  {
    const db = new FakeDb();
    seedActiveGroup(db);
    db.store.set('groupMembers/group_1_creator_uid', {
      groupId: 'group_1',
      userId: 'creator_uid',
      role: 'member',
      status: 'active',
    });

    const result = await createChallengeWithCreatorMembershipCore(db as never, baseInput);

    assert.equal(result.challenge.id, 'generated_1');
    assert.equal(db.store.get('challenges/generated_1')?.status, 'active');
    assert.equal(db.store.get('challenges/generated_1')?.participantCount, 0);
    assert.deepEqual(db.store.get('challengeMembers/generated_1_creator_uid'), {
      challengeId: 'generated_1',
      userId: 'creator_uid',
      groupId: 'group_1',
      joinedAt: result.challengeMember?.joinedAt,
      status: 'active',
      activitiesCompleted: 0,
      totalActivities: 7, // 1 activity × 7 durationDays
      totalPoints: 0,
      completionRate: 0,
    });
  }

  {
    const db = new FakeDb();
    seedActiveGroup(db);

    await assertRejectsWithCode('non-member challenge creation should fail atomically', 'permission-denied', () =>
      createChallengeWithCreatorMembershipCore(db as never, baseInput),
    );
    assert.equal(Array.from(db.store.keys()).some((path) => path.startsWith('challenges/')), false);
    assert.equal(Array.from(db.store.keys()).some((path) => path.startsWith('challengeMembers/')), false);
  }

  // member of public group → challenge is active/approved immediately
  {
    const db = new FakeDb();
    seedActiveGroup(db);
    db.store.set('groupMembers/group_1_creator_uid', {
      groupId: 'group_1',
      userId: 'creator_uid',
      role: 'member',
      status: 'active',
    });

    const result = await createChallengeWithCreatorMembershipCore(db as never, baseInput);
    assert.equal(db.store.get(`challenges/${result.challenge.id}`)?.status, 'active', 'public group member: challenge status must be active');
    assert.equal(db.store.get(`challenges/${result.challenge.id}`)?.moderationStatus, 'approved', 'public group member: moderationStatus must be approved');
  }

  // member of private group → challenge goes to pending moderation
  {
    const db = new FakeDb();
    db.store.set('groups/group_1', {
      ownerId: 'owner_uid',
      status: 'active',
      isPrivate: true,
      visibility: 'private',
    });
    db.store.set('groupMembers/group_1_creator_uid', {
      groupId: 'group_1',
      userId: 'creator_uid',
      role: 'member',
      status: 'active',
    });

    const result = await createChallengeWithCreatorMembershipCore(db as never, baseInput);
    assert.equal(db.store.get(`challenges/${result.challenge.id}`)?.status, 'pending', 'private group member: challenge status must be pending');
    assert.equal(db.store.get(`challenges/${result.challenge.id}`)?.moderationStatus, 'pending', 'private group member: moderationStatus must be pending');
    // creator still becomes a challenge member
    assert.ok(db.store.get(`challengeMembers/${result.challenge.id}_creator_uid`), 'private group member: creator must still be added as challengeMember');
  }

  // admin of private group → challenge is active/approved immediately
  {
    const db = new FakeDb();
    db.store.set('groups/group_1', {
      ownerId: 'owner_uid',
      status: 'active',
      isPrivate: true,
      visibility: 'private',
    });
    db.store.set('groupMembers/group_1_creator_uid', {
      groupId: 'group_1',
      userId: 'creator_uid',
      role: 'admin',
      status: 'active',
    });

    const result = await createChallengeWithCreatorMembershipCore(db as never, baseInput);
    assert.equal(db.store.get(`challenges/${result.challenge.id}`)?.status, 'active', 'private group admin: challenge status must be active');
    assert.equal(db.store.get(`challenges/${result.challenge.id}`)?.moderationStatus, 'approved', 'private group admin: moderationStatus must be approved');
  }

  {
    const db = new FakeDb();
    seedActiveGroup(db);
    const result = await createChallengeWithCreatorMembershipCore(db as never, {
      ...baseInput,
      actorUid: 'owner_uid',
    });

    assert.equal(result.challenge.createdBy, 'owner_uid');
    assert.equal(db.store.get('groupMembers/group_1_owner_uid')?.status, 'active');
    assert.equal(db.store.get(`challengeMembers/${result.challenge.id}_owner_uid`)?.status, 'active');
  }

  // ── Section: 18I-6A authorization tests ────────────────────────────────────

  // inactive member rejected
  await assertRejectsWithCode('inactive member must be rejected', 'permission-denied', async () => {
    const db = new FakeDb();
    seedActiveGroup(db);
    db.store.set('groupMembers/group_1_creator_uid', {
      groupId: 'group_1',
      userId: 'creator_uid',
      role: 'member',
      status: 'left',
    });
    return createChallengeWithCreatorMembershipCore(db as never, baseInput);
  });

  // inactive group rejected
  await assertRejectsWithCode('inactive group must be rejected', 'failed-precondition', async () => {
    const db = new FakeDb();
    db.store.set('groups/group_1', {
      ownerId: 'owner_uid',
      status: 'inactive',
      isPrivate: false,
      visibility: 'public',
    });
    db.store.set('groupMembers/group_1_creator_uid', {
      groupId: 'group_1',
      userId: 'creator_uid',
      role: 'member',
      status: 'active',
    });
    return createChallengeWithCreatorMembershipCore(db as never, baseInput);
  });

  // normal member (non-owner) creates challenge successfully
  {
    const db = new FakeDb();
    db.store.set('groups/group_1', {
      ownerId: 'owner_uid',
      status: 'active',
      isPrivate: false,
      visibility: 'public',
    });
    db.store.set('groupMembers/group_1_creator_uid', {
      groupId: 'group_1',
      userId: 'creator_uid',
      role: 'member',
      status: 'active',
    });
    const result = await createChallengeWithCreatorMembershipCore(db as never, baseInput);
    assert.equal(result.challenge.createdBy, 'creator_uid', '18I-6A: normal member must become createdBy');
    assert.equal(db.store.get(`challenges/${result.challenge.id}`)?.status, 'active', '18I-6A: normal member challenge must be active');
  }

  // ── Section: P5B static source guards ───────────────────────────────────────

  const challengeServiceSrc = readFileSync('src/services/challengeService.ts', 'utf8');
  const backfillGroupCountsSrc = readFileSync('scripts/backfillGroupCounts.ts', 'utf8');
  const memberCountersSrc = readFileSync('functions/src/memberCounters.ts', 'utf8');
  const functionsIndexSrc = readFileSync('functions/src/index.ts', 'utf8');

  // Challenge creation must go through the callable.
  // The Wizard calls httpsCallable('createChallengeWithCreatorMembership') directly —
  // it does NOT use challengeService.createChallenge for the submission.
  // Guard checks the actual call site: CreateChallengeWizard.
  const wizardSrc = readFileSync('src/features/Challenges/CreateChallengeWizard.tsx', 'utf8');
  assert.match(
    wizardSrc,
    /'createChallengeWithCreatorMembership'/,
    'CreateChallengeWizard must call the createChallengeWithCreatorMembership Cloud Function callable',
  );
  assert.match(
    wizardSrc,
    /httpsCallable/,
    'CreateChallengeWizard must use httpsCallable (not a direct Firestore write)',
  );

  // ARCH-1 (Phase 17G): joinChallenge currently writes participantCount via increment(1)
  // AND the onChallengeMemberCreated trigger also increments it. This is a double-write.
  // Guard verifies both joinChallenge and leaveChallenge exist, and that the service
  // does write participantCount (documenting the current double-write state for audit).
  const joinChallengeStart = challengeServiceSrc.indexOf('async joinChallenge');
  const joinChallengeEnd = challengeServiceSrc.indexOf('async leaveChallenge');
  assert.ok(joinChallengeStart > 0 && joinChallengeEnd > joinChallengeStart, 'joinChallenge and leaveChallenge must both exist in challengeService');
  const joinChallengeSrc = challengeServiceSrc.slice(joinChallengeStart, joinChallengeEnd);
  assert.match(
    joinChallengeSrc,
    /participantCount/,
    'ARCH-1: joinChallenge currently writes participantCount (double-write with trigger — see Phase 17G audit)',
  );

  // Server trigger wires up all three lifecycle events for participant count
  assert.match(
    functionsIndexSrc,
    /onChallengeMemberCreated/,
    'Cloud Functions index must export onChallengeMemberCreated to increment participantCount on join',
  );
  assert.match(
    functionsIndexSrc,
    /onChallengeMemberUpdated/,
    'Cloud Functions index must export onChallengeMemberUpdated to adjust participantCount on status change',
  );
  assert.match(
    functionsIndexSrc,
    /onChallengeMemberDeleted/,
    'Cloud Functions index must export onChallengeMemberDeleted to decrement participantCount on delete',
  );

  // Counter logic in memberCounters uses FieldValue.increment (server-side atomic operation)
  assert.match(
    memberCountersSrc,
    /FieldValue\.increment/,
    'memberCounters must use FieldValue.increment for atomic participantCount updates',
  );
  assert.match(
    memberCountersSrc,
    /updateParticipantCountForCreate/,
    'memberCounters must export updateParticipantCountForCreate',
  );

  // participantCount initialized to 0 in creation payload (P5N fix)
  {
    const db = new FakeDb();
    seedActiveGroup(db);
    db.store.set('groupMembers/group_1_creator_uid', {
      groupId: 'group_1',
      userId: 'creator_uid',
      role: 'member',
      status: 'active',
    });
    const result = await createChallengeWithCreatorMembershipCore(db as never, baseInput);
    const challengeDoc = db.store.get(`challenges/${result.challenge.id}`);
    assert.equal(
      challengeDoc?.participantCount,
      0,
      'participantCount must be initialized to 0 in the challenge creation payload so the field exists before the trigger fires',
    );
    // Creator's challengeMembers doc must exist with status active so the trigger fires (+1)
    const memberDoc = db.store.get(`challengeMembers/${result.challenge.id}_creator_uid`);
    assert.equal(
      memberDoc?.status,
      'active',
      'creator challengeMembers doc must be written with status active so the participation trigger fires',
    );
  }

  // backfillGroupCounts is the authoritative repair path for stale participantCount
  assert.match(
    backfillGroupCountsSrc,
    /participantCount/,
    'backfillGroupCounts must handle participantCount repair for all challenge docs',
  );
  assert.match(
    backfillGroupCountsSrc,
    /challengeMembers/,
    'backfillGroupCounts must read challengeMembers to recount active participants',
  );

  // ── P5N: Participant Count Integrity ─────────────────────────────────────────

  const memberCountersSrcP5N = readFileSync('functions/src/memberCounters.ts', 'utf8');
  const backfillSrcP5N = readFileSync('scripts/backfillGroupCounts.ts', 'utf8');
  const challengeCreationSrc = readFileSync('functions/src/challengeCreationBackend.ts', 'utf8');

  // 1. participantCount: 0 initialized in challenge creation payload
  assert.match(
    challengeCreationSrc,
    /participantCount:\s*0/,
    'challengeCreationBackend must initialize participantCount: 0 in the challenge payload so the field exists before the Cloud Function trigger fires',
  );

  // 2. completed memberships count as participants (product rule: they joined and participated)
  assert.match(
    memberCountersSrcP5N,
    /ACTIVE_MEMBER_STATUSES.*completed/s,
    'memberCounters ACTIVE_MEMBER_STATUSES must include "completed" — completed members still count as participants',
  );

  // 3. abandoned/left/removed/rejected statuses must NOT be in ACTIVE_MEMBER_STATUSES
  const activeMemberStatusesMatch = memberCountersSrcP5N.match(/const ACTIVE_MEMBER_STATUSES = new Set\(\[([^\]]+)\]\)/);
  const activeMemberStatusesStr = activeMemberStatusesMatch?.[1] ?? '';
  assert.ok(
    !activeMemberStatusesStr.includes('abandoned') && !activeMemberStatusesStr.includes('removed') && !activeMemberStatusesStr.includes('rejected'),
    'memberCounters ACTIVE_MEMBER_STATUSES must not include abandoned/removed/rejected — only active, joined, completed count as participants',
  );

  // 4. backfill uses same countable statuses as memberCounters (completed must be included)
  assert.match(
    backfillSrcP5N,
    /activeMemberStatuses.*completed/s,
    'backfillGroupCounts activeMemberStatuses must include "completed" to match memberCounters.ts semantics',
  );

  // 5. ARCH-1 (Phase 17G): joinChallenge currently writes participantCount AND the
  // trigger also increments it — double-write. Guard updated to document current state.
  const joinChallengeStartP5N = challengeServiceSrc.indexOf('async joinChallenge');
  const joinChallengeEndP5N = challengeServiceSrc.indexOf('async leaveChallenge');
  const joinChallengeSrcP5N = challengeServiceSrc.slice(joinChallengeStartP5N, joinChallengeEndP5N);
  assert.match(
    joinChallengeSrcP5N,
    /participantCount/,
    'ARCH-1: joinChallenge currently writes participantCount (double-write with trigger — see Phase 17G audit)',
  );

  // 6. Challenge creation payload includes participantCount: 0 (static source check)
  const creationPayloadStart = challengeCreationSrc.indexOf('const challengePayload = removeUndefinedDeep');
  const creationPayloadEnd = challengeCreationSrc.indexOf('const challengeMemberPayload');
  const creationPayloadBlock = challengeCreationSrc.slice(creationPayloadStart, creationPayloadEnd);
  assert.match(
    creationPayloadBlock,
    /participantCount:\s*0/,
    'challengeCreationBackend challengePayload block must contain participantCount: 0',
  );

  // ── Phase 18B: Inclusive duration guards ─────────────────────────────────────

  // Aug 1 → Aug 2 = 2 days (smallest valid multi-day span in the backend)
  {
    const db = new FakeDb();
    seedActiveGroup(db);
    db.store.set('groupMembers/group_1_creator_uid', {
      groupId: 'group_1', userId: 'creator_uid', role: 'member', status: 'active',
    });
    const result = await createChallengeWithCreatorMembershipCore(db as never, {
      ...baseInput,
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: '2026-08-02T00:00:00.000Z',
      durationDays: undefined,
    });
    const doc = db.store.get(`challenges/${result.challenge.id}`);
    assert.equal(doc?.durationDays, 2, 'Aug 1 → Aug 2 must equal 2 days (inclusive fallback)');
  }

  // Aug 1 → Aug 7 = 7 days (inclusive)
  {
    const db = new FakeDb();
    seedActiveGroup(db);
    db.store.set('groupMembers/group_1_creator_uid', {
      groupId: 'group_1', userId: 'creator_uid', role: 'member', status: 'active',
    });
    const result = await createChallengeWithCreatorMembershipCore(db as never, {
      ...baseInput,
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: '2026-08-07T00:00:00.000Z',
      durationDays: undefined,
    });
    const doc = db.store.get(`challenges/${result.challenge.id}`);
    assert.equal(doc?.durationDays, 7, 'Aug 1 → Aug 7 must equal 7 days (inclusive fallback)');
  }

  // 7-day streak with requiredConsecutiveDays=7 must pass when dates span 7 inclusive days
  {
    const db = new FakeDb();
    seedActiveGroup(db);
    db.store.set('groupMembers/group_1_creator_uid', {
      groupId: 'group_1', userId: 'creator_uid', role: 'member', status: 'active',
    });
    const result = await createChallengeWithCreatorMembershipCore(db as never, {
      ...baseInput,
      challengeType: 'streak',
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: '2026-08-07T00:00:00.000Z',
      durationDays: undefined,
      requiredConsecutiveDays: 7,
      streakResetOnMiss: true,
    });
    const doc = db.store.get(`challenges/${result.challenge.id}`);
    assert.equal(doc?.durationDays, 7, '7-day streak: durationDays must be 7');
    assert.equal(doc?.requiredConsecutiveDays, 7, '7-day streak: requiredConsecutiveDays must be 7');
  }

  // June 28 → July 4 = 7 days inclusive — regression guard (Phase 18F-1)
  // This specific span crosses a month boundary; backend must not return 6.
  {
    const db = new FakeDb();
    seedActiveGroup(db);
    db.store.set('groupMembers/group_1_creator_uid', {
      groupId: 'group_1', userId: 'creator_uid', role: 'member', status: 'active',
    });
    const result = await createChallengeWithCreatorMembershipCore(db as never, {
      ...baseInput,
      challengeType: 'streak',
      startDate: '2026-06-28T00:00:00.000Z',
      endDate: '2026-07-04T00:00:00.000Z',
      durationDays: undefined,
      requiredConsecutiveDays: 7,
      streakResetOnMiss: true,
    });
    const doc = db.store.get(`challenges/${result.challenge.id}`);
    assert.equal(doc?.durationDays, 7, 'June 28 → July 4 must be 7 inclusive days (regression guard)');
    assert.equal(doc?.requiredConsecutiveDays, 7, 'June 28 streak: requiredConsecutiveDays must be 7');
  }

  // requiredConsecutiveDays > durationDays must still reject
  await assertRejectsWithCode(
    'requiredConsecutiveDays (8) must not exceed durationDays (7)',
    'invalid-argument',
    async () => {
      const db = new FakeDb();
      seedActiveGroup(db);
      db.store.set('groupMembers/group_1_creator_uid', {
        groupId: 'group_1', userId: 'creator_uid', role: 'member', status: 'active',
      });
      return createChallengeWithCreatorMembershipCore(db as never, {
        ...baseInput,
        challengeType: 'streak',
        startDate: '2026-08-01T00:00:00.000Z',
        endDate: '2026-08-07T00:00:00.000Z',
        durationDays: undefined,
        requiredConsecutiveDays: 8,
        streakResetOnMiss: true,
      });
    },
  );

  console.log('challenge creation backend tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
