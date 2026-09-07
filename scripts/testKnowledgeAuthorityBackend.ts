import assert from 'node:assert/strict';
import { createChallengeWithCreatorMembershipCore } from '../functions/src/challengeCreationBackend.js';
import type {
  KnowledgeAuthorityReader,
  KnowledgeAuthorityRecord,
} from '../functions/src/knowledgeAuthority.js';

/**
 * Phase B knowledge-authority guard (run: npm run test:knowledge-authority-backend).
 * Exercises the trusted challenge-creation backend against stubbed
 * PostgreSQL authority readers (no database, no emulator):
 *
 * - PG hit published → server pins the authoritative knowledgeVersion;
 * - PG hit draft/retired → rejected even when Firestore holds a published doc
 *   (proves PostgreSQL decided, not Firestore);
 * - PG miss / PG infrastructure failure → transitional Firestore read-through;
 * - no authority → legacy Firestore behavior unchanged;
 * - custom activities (no canonical ID) pass through untouched.
 */

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

function seedMembership(db: FakeDb) {
  db.store.set('groups/group_1', {
    ownerId: 'owner_uid',
    status: 'active',
    isPrivate: false,
    visibility: 'public',
    allowMemberChallenges: true,
  });
  db.store.set('groupMembers/group_1_creator_uid', {
    groupId: 'group_1',
    userId: 'creator_uid',
    role: 'member',
    status: 'active',
  });
}

function fitnessInput(exerciseId: string, knowledgeVersion = 1) {
  return {
    actorUid: 'creator_uid',
    groupId: 'group_1',
    name: 'Authority Pilot',
    description: 'Phase B authority check',
    category: 'fitness',
    challengeType: 'collective',
    startDate: '2026-06-14T00:00:00.000Z',
    durationDays: 7,
    activities: [
      {
        exerciseId,
        exerciseName: 'Push-Ups',
        targetValue: 10,
        unit: 'reps',
        knowledgeVersion,
      },
    ],
  };
}

function stubAuthority(
  records: Record<string, KnowledgeAuthorityRecord>,
): KnowledgeAuthorityReader {
  return {
    async findCanonical(id: string) {
      return records[id] ?? null;
    },
  };
}

function storedVersion(db: FakeDb, challengeId: string): unknown {
  const challenge = db.store.get(`challenges/${challengeId}`) as
    | { activities?: Array<{ knowledgeVersion?: unknown }> }
    | undefined;
  return challenge?.activities?.[0]?.knowledgeVersion;
}

async function run() {
  // 1. PG hit published → authoritative version pinned (client value ignored).
  {
    const db = new FakeDb();
    seedMembership(db);
    const authority = stubAuthority({
      'push-ups': {
        knowledgeId: '11111111-1111-1111-1111-111111111111',
        kind: 'fitness',
        legacyId: 'push-ups',
        lifecycle: 'published',
        knowledgeVersion: 7,
        metricType: 'count',
        tier1: 'Upper Body',
        tier2: 'Strength',
      },
    });
    const result = await createChallengeWithCreatorMembershipCore(
      db as never,
      fitnessInput('push-ups', 1),
      authority,
    );
    assert.equal(storedVersion(db, result.challenge.id), 7, 'PG version must be pinned');
  }

  // 2. PG hit draft → rejected even though Firestore holds a published doc.
  {
    const db = new FakeDb();
    seedMembership(db);
    db.store.set('catalogExercises/stale-doc', { name: 'Stale', lifecycleStatus: 'published' });
    const authority = stubAuthority({
      'stale-doc': {
        knowledgeId: '22222222-2222-2222-2222-222222222222',
        kind: 'fitness',
        legacyId: 'stale-doc',
        lifecycle: 'draft',
        knowledgeVersion: 2,
      },
    });
    await assertRejectsWithCode('PG draft must reject', 'invalid-argument', () =>
      createChallengeWithCreatorMembershipCore(db as never, fitnessInput('stale-doc'), authority),
    );
    assert.equal(
      Array.from(db.store.keys()).some((path) => path.startsWith('challenges/')),
      false,
      'rejected creation must write nothing',
    );
  }

  // 3. PG hit retired → rejected.
  {
    const db = new FakeDb();
    seedMembership(db);
    const authority = stubAuthority({
      'old-doc': {
        knowledgeId: '33333333-3333-3333-3333-333333333333',
        kind: 'fitness',
        legacyId: 'old-doc',
        lifecycle: 'retired',
        knowledgeVersion: 3,
      },
    });
    await assertRejectsWithCode('PG retired must reject', 'invalid-argument', () =>
      createChallengeWithCreatorMembershipCore(db as never, fitnessInput('old-doc'), authority),
    );
  }

  // 4. PG miss → transitional Firestore read-through succeeds.
  {
    const db = new FakeDb();
    seedMembership(db);
    db.store.set('catalogExercises/unmigrated', { name: 'Unmigrated', lifecycleStatus: 'published' });
    const result = await createChallengeWithCreatorMembershipCore(
      db as never,
      fitnessInput('unmigrated'),
      stubAuthority({}),
    );
    assert.equal(storedVersion(db, result.challenge.id), 1, 'Firestore fallback pins version 1');
  }

  // 5. PG infrastructure failure → transitional Firestore read-through succeeds.
  {
    const db = new FakeDb();
    seedMembership(db);
    db.store.set('catalogExercises/unmigrated', { name: 'Unmigrated', lifecycleStatus: 'published' });
    const failing: KnowledgeAuthorityReader = {
      async findCanonical() {
        throw new Error('connection refused');
      },
    };
    const result = await createChallengeWithCreatorMembershipCore(
      db as never,
      fitnessInput('unmigrated'),
      failing,
    );
    assert.ok(result.challenge.id, 'Firestore fallback must succeed on PG outage');
  }

  // 6. Tiizi UUID input resolves through the authority.
  {
    const db = new FakeDb();
    seedMembership(db);
    const uuid = '44444444-4444-4444-4444-444444444444';
    const authority = stubAuthority({
      [uuid]: {
        knowledgeId: uuid,
        kind: 'fitness',
        legacyId: 'push-ups',
        lifecycle: 'published',
        knowledgeVersion: 4,
      },
    });
    const result = await createChallengeWithCreatorMembershipCore(
      db as never,
      fitnessInput(uuid),
      authority,
    );
    assert.equal(storedVersion(db, result.challenge.id), 4, 'UUID input must resolve via PG');
  }

  // 7. Custom activities (no canonical ID) pass through untouched.
  {
    const db = new FakeDb();
    seedMembership(db);
    const result = await createChallengeWithCreatorMembershipCore(
      db as never,
      {
        ...fitnessInput('push-ups'),
        activities: [{ exerciseName: 'Freestyle', targetValue: 5, unit: 'reps' }],
      },
      stubAuthority({}),
    );
    assert.ok(result.challenge.id, 'custom activity must pass through');
  }

  // 8. Wellness activityId resolves through the authority.
  {
    const db = new FakeDb();
    seedMembership(db);
    const authority = stubAuthority({
      'fast-16': {
        knowledgeId: '55555555-5555-5555-5555-555555555555',
        kind: 'wellness',
        legacyId: 'fast-16',
        lifecycle: 'published',
        knowledgeVersion: 6,
      },
    });
    const result = await createChallengeWithCreatorMembershipCore(
      db as never,
      {
        ...fitnessInput('push-ups'),
        activities: [{ activityId: 'fast-16', targetValue: 16, unit: 'hours' }],
      },
      authority,
    );
    assert.equal(storedVersion(db, result.challenge.id), 6, 'wellness version must pin from PG');
  }

  // 9. No authority → legacy Firestore behavior unchanged.
  {
    const db = new FakeDb();
    seedMembership(db);
    db.store.set('catalogExercises/legacy-doc', { name: 'Legacy', lifecycleStatus: 'published' });
    const result = await createChallengeWithCreatorMembershipCore(
      db as never,
      fitnessInput('legacy-doc'),
      null,
    );
    assert.ok(result.challenge.id, 'null authority must keep Firestore behavior');
    await assertRejectsWithCode('unknown ID still rejected without authority', 'invalid-argument', () =>
      createChallengeWithCreatorMembershipCore(db as never, fitnessInput('ghost-doc'), null),
    );
  }

  console.log('knowledge authority backend: 9 scenarios passed');
}

await run();
