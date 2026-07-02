/**
 * Phase 18I-6B — Group Deactivation Lifecycle tests
 *
 * Uses FakeDb pattern (same as testChallengeCreationBackend.ts).
 * Run: npm run test:group-lifecycle
 */

import { isGroupActive } from '../src/utils/groupLifecycle';

// ---------------------------------------------------------------------------
// Minimal FakeDb / fake service stubs
// ---------------------------------------------------------------------------

type Doc = Record<string, unknown>;

class FakeDb {
  private store: Map<string, Doc> = new Map();

  set(path: string, data: Doc) {
    this.store.set(path, { ...data });
  }

  get(path: string): { exists: boolean; data: Doc | null } {
    const doc = this.store.get(path);
    return doc ? { exists: true, data: { ...doc } } : { exists: false, data: null };
  }

  update(path: string, patch: Doc) {
    const existing = this.store.get(path) ?? {};
    this.store.set(path, { ...existing, ...patch });
  }

  query(collection: string, field: string, value: unknown): Doc[] {
    const results: Doc[] = [];
    for (const [path, doc] of this.store.entries()) {
      if (path.startsWith(`${collection}/`) && doc[field] === value) {
        results.push({ ...doc });
      }
    }
    return results;
  }

  has(path: string): boolean {
    return this.store.has(path);
  }
}

// ---------------------------------------------------------------------------
// Fake AdminGroupService
// ---------------------------------------------------------------------------

type AdminGroupStatus = 'active' | 'flagged' | 'deactivated';

interface LifecycleEvent {
  groupId: string;
  type: 'activated' | 'deactivated';
  performedBy: string;
  previousStatus: string;
  newStatus: string;
  moderationStatus: string;
  reason?: string;
  timestamp: string;
}

class FakeAdminGroupService {
  private db: FakeDb;
  readonly lifecycleEvents: LifecycleEvent[] = [];

  constructor(db: FakeDb) {
    this.db = db;
  }

  async setGroupModerationStatus(groupId: string, status: AdminGroupStatus, adminUid: string, reason?: string): Promise<void> {
    const newOperationalStatus = status === 'deactivated' ? 'inactive' : 'active';
    const prevSnap = this.db.get(`groups/${groupId}`);
    const previousStatus = prevSnap.exists ? String(prevSnap.data!.status ?? 'active') : 'unknown';

    this.db.update(`groups/${groupId}`, {
      status: newOperationalStatus,
      moderationStatus: status,
      moderatedBy: adminUid,
      moderatedAt: new Date().toISOString(),
    });

    this.lifecycleEvents.push({
      groupId,
      type: status === 'deactivated' ? 'deactivated' : 'activated',
      performedBy: adminUid,
      previousStatus,
      newStatus: newOperationalStatus,
      moderationStatus: status,
      ...(reason ? { reason } : {}),
      timestamp: new Date().toISOString(),
    });
  }

  async suspendGroup(groupId: string, adminUid: string, reason?: string): Promise<void> {
    await this.setGroupModerationStatus(groupId, 'deactivated', adminUid, reason);
  }

  async activateGroup(groupId: string, adminUid: string): Promise<void> {
    const snap = this.db.get(`groups/${groupId}`);
    if (!snap.exists) throw new Error('Group not found — cannot reactivate a deleted group.');
    await this.setGroupModerationStatus(groupId, 'active', adminUid);
  }
}

// ---------------------------------------------------------------------------
// Fake GroupService (relevant parts)
// ---------------------------------------------------------------------------

class FakeGroupService {
  private db: FakeDb;

  constructor(db: FakeDb) {
    this.db = db;
  }

  getGroups(): Array<Doc> {
    const results: Doc[] = [];
    for (const [path, doc] of (this.db as unknown as { store: Map<string, Doc> }).store.entries()) {
      if (path.startsWith('groups/')) {
        if (isGroupActive(doc as { status?: string })) {
          results.push(doc);
        }
      }
    }
    return results;
  }

  getMyGroups(): Array<Doc> {
    const results: Doc[] = [];
    for (const [path, doc] of (this.db as unknown as { store: Map<string, Doc> }).store.entries()) {
      if (path.startsWith('groups/')) results.push(doc);
    }
    return results;
  }

  joinGroup(groupId: string): { status: 'joined' } {
    const snap = this.db.get(`groups/${groupId}`);
    if (!snap.exists) throw new Error('Group not found');
    if (!isGroupActive(snap.data as { status?: string })) {
      throw new Error('This group is no longer active and cannot be joined.');
    }
    return { status: 'joined' };
  }
}

// ---------------------------------------------------------------------------
// Fake ChallengeService (relevant parts)
// ---------------------------------------------------------------------------

class FakeChallengeService {
  private db: FakeDb;

  constructor(db: FakeDb) {
    this.db = db;
  }

  filterActiveGroupIds(groupIds: string[]): string[] {
    return groupIds.filter((id) => {
      const snap = this.db.get(`groups/${id}`);
      return snap.exists && isGroupActive(snap.data as { status?: string });
    });
  }

  getChallengesForGroups(groupIds: string[]): Doc[] {
    const activeGroupIds = this.filterActiveGroupIds(groupIds);
    if (activeGroupIds.length === 0) return [];
    const results: Doc[] = [];
    for (const gid of activeGroupIds) {
      const challenges = this.db.query('challenges', 'groupId', gid);
      results.push(...challenges);
    }
    return results;
  }

  joinChallenge(userId: string, challengeId: string): void {
    const cSnap = this.db.get(`challenges/${challengeId}`);
    if (!cSnap.exists) throw new Error('Challenge not found');
    const challenge = cSnap.data!;
    const groupSnap = this.db.get(`groups/${challenge.groupId}`);
    if (!isGroupActive(groupSnap.exists ? (groupSnap.data as { status?: string }) : null)) {
      throw new Error('Cannot join a challenge in a deactivated group.');
    }
    this.db.set(`challengeMembers/${challengeId}_${userId}`, { userId, challengeId });
  }
}

// ---------------------------------------------------------------------------
// Fake WorkoutService
// ---------------------------------------------------------------------------

class FakeWorkoutService {
  private db: FakeDb;

  constructor(db: FakeDb) {
    this.db = db;
  }

  createWorkout(input: { userId: string; groupId?: string; challengeId: string }): void {
    if (input.groupId) {
      const groupSnap = this.db.get(`groups/${input.groupId}`);
      if (!isGroupActive(groupSnap.exists ? (groupSnap.data as { status?: string }) : null)) {
        throw new Error('Activity logging is not available — this group has been deactivated.');
      }
    }
    this.db.set(`workouts/w1`, { ...input });
  }
}

// ---------------------------------------------------------------------------
// Fake WellnessLogService
// ---------------------------------------------------------------------------

class FakeWellnessLogService {
  private db: FakeDb;

  constructor(db: FakeDb) {
    this.db = db;
  }

  createLog(input: { userId: string; groupId: string; challengeId: string }): void {
    const groupSnap = this.db.get(`groups/${input.groupId}`);
    if (!isGroupActive(groupSnap.exists ? (groupSnap.data as { status?: string }) : null)) {
      throw new Error('Activity logging is not available — this group has been deactivated.');
    }
    this.db.set(`wellnessLogs/l1`, { ...input });
  }
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

function assertThrows(fn: () => unknown, substring: string, label: string) {
  try {
    fn();
    console.error(`  ❌ FAIL (no throw): ${label}`);
    failed++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes(substring)) {
      console.log(`  ✅ ${label}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL (wrong error "${msg}"): ${label}`);
      failed++;
    }
  }
}

async function assertAsyncThrows(fn: () => Promise<unknown>, substring: string, label: string) {
  try {
    await fn();
    console.error(`  ❌ FAIL (no throw): ${label}`);
    failed++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes(substring)) {
      console.log(`  ✅ ${label}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL (wrong error "${msg}"): ${label}`);
      failed++;
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function run() {
  // Shared setup
  const db = new FakeDb();
  const adminSvc = new FakeAdminGroupService(db);
  const groupSvc = new FakeGroupService(db);
  const challengeSvc = new FakeChallengeService(db);
  const workoutSvc = new FakeWorkoutService(db);
  const wellnessSvc = new FakeWellnessLogService(db);

  db.set('groups/g1', { id: 'g1', name: 'Active Group', status: 'active', memberCount: 5 });
  db.set('groups/g2', { id: 'g2', name: 'Inactive Group', status: 'inactive', memberCount: 3 });
  db.set('groups/g3', { id: 'g3', name: 'Legacy Group (no status)', memberCount: 2 });
  db.set('challenges/c1', { id: 'c1', groupId: 'g1', status: 'active', name: 'Active challenge' });
  db.set('challenges/c2', { id: 'c2', groupId: 'g2', status: 'active', name: 'Deactivated group challenge' });

  console.log('\n=== Phase 18I-6B: Group Deactivation Lifecycle Tests ===\n');

  // --- isGroupActive utility ---
  console.log('--- isGroupActive utility ---');
  assert(isGroupActive({ status: 'active' }), 'active group is active');
  assert(!isGroupActive({ status: 'inactive' }), 'inactive group is not active');
  assert(isGroupActive({}), 'group with no status field defaults to active (legacy)');
  assert(!isGroupActive(null), 'null group is not active');
  assert(!isGroupActive(undefined), 'undefined group is not active');

  // --- Test 1: setGroupModerationStatus writes correct fields ---
  console.log('\n--- Test 1: setGroupModerationStatus writes status: inactive ---');
  await adminSvc.setGroupModerationStatus('g1', 'deactivated', 'admin1', 'Policy violation');
  const g1 = db.get('groups/g1').data!;
  assert(g1.status === 'inactive', 'status written as inactive');
  assert(g1.moderationStatus === 'deactivated', 'moderationStatus written as deactivated');
  assert(g1.moderatedBy === 'admin1', 'moderatedBy set');

  // --- Test 2: lifecycle event logged ---
  console.log('\n--- Test 2: lifecycle event logged ---');
  const evt = adminSvc.lifecycleEvents.find((e) => e.groupId === 'g1');
  assert(!!evt, 'lifecycle event exists');
  assert(evt?.type === 'deactivated', 'event type is deactivated');
  assert(evt?.newStatus === 'inactive', 'newStatus is inactive');
  assert(evt?.reason === 'Policy violation', 'reason is stored');

  // --- Test 3: activateGroup writes active fields ---
  console.log('\n--- Test 3: activateGroup restores status: active ---');
  await adminSvc.activateGroup('g1', 'admin1');
  const g1Active = db.get('groups/g1').data!;
  assert(g1Active.status === 'active', 'status restored to active');
  assert(g1Active.moderationStatus === 'active', 'moderationStatus restored to active');

  // Deactivate again for remaining tests
  db.update('groups/g1', { status: 'inactive', moderationStatus: 'deactivated' });

  // --- Test 4: activateGroup throws when group not found ---
  console.log('\n--- Test 4: activateGroup throws when group not found ---');
  await assertAsyncThrows(
    () => adminSvc.activateGroup('nonexistent', 'admin1'),
    'Group not found',
    'activateGroup throws for nonexistent group',
  );

  // --- Test 5: joinGroup throws when group inactive ---
  console.log('\n--- Test 5: joinGroup rejects inactive group ---');
  assertThrows(
    () => groupSvc.joinGroup('g1'),
    'no longer active',
    'joinGroup throws for inactive group',
  );
  assert(groupSvc.joinGroup('g3').status === 'joined', 'joinGroup succeeds for legacy group (no status)');

  // --- Test 6: joinChallenge throws when group inactive ---
  console.log('\n--- Test 6: joinChallenge rejects challenges in inactive groups ---');
  assertThrows(
    () => challengeSvc.joinChallenge('user1', 'c2'),
    'deactivated group',
    'joinChallenge throws for challenge in inactive group',
  );

  // --- Test 7: createWorkout throws when group inactive ---
  console.log('\n--- Test 7: createWorkout rejects inactive group ---');
  assertThrows(
    () => workoutSvc.createWorkout({ userId: 'user1', groupId: 'g2', challengeId: 'c2' }),
    'deactivated',
    'createWorkout throws for inactive group',
  );

  // --- Test 8: wellness log creation throws when group inactive ---
  console.log('\n--- Test 8: wellness log rejects inactive group ---');
  assertThrows(
    () => wellnessSvc.createLog({ userId: 'user1', groupId: 'g2', challengeId: 'c2' }),
    'deactivated',
    'createLog throws for inactive group',
  );

  // --- Test 9: getGroups excludes inactive groups ---
  console.log('\n--- Test 9: getGroups excludes inactive ---');
  const allGroups = groupSvc.getGroups();
  const names = allGroups.map((g) => g.name);
  assert(!names.includes('Inactive Group'), 'inactive group excluded from discovery');
  assert(names.includes('Legacy Group (no status)'), 'legacy group (no status) included');

  // --- Test 10: getMyGroups includes inactive (history) ---
  console.log('\n--- Test 10: getMyGroups includes inactive (history) ---');
  const myGroups = groupSvc.getMyGroups();
  assert(myGroups.some((g) => g.name === 'Inactive Group'), 'inactive group visible in my-groups (history)');

  // --- Test 11: challenge discovery excludes challenges from inactive groups ---
  console.log('\n--- Test 11: challenge discovery excludes inactive group challenges ---');
  const challenges = challengeSvc.getChallengesForGroups(['g1', 'g2', 'g3']);
  assert(!challenges.some((c) => c.groupId === 'g2'), 'no challenges from inactive group in results');

  // --- Test 12: reactivation makes group operational again ---
  console.log('\n--- Test 12: reactivation makes group fully operational ---');
  // g1 was deactivated above
  db.update('groups/g1', { status: 'inactive' });
  assertThrows(() => groupSvc.joinGroup('g1'), 'no longer active', 'join blocked while inactive');
  await adminSvc.activateGroup('g1', 'admin1');
  assert(groupSvc.joinGroup('g1').status === 'joined', 'join succeeds after reactivation');

  // --- Test 13: (static) isGroupActive is referenced in groupService source ---
  console.log('\n--- Test 13: static guard — groupService imports isGroupActive ---');
  const fs = await import('fs');
  const groupServiceSrc = fs.readFileSync('src/services/groupService.ts', 'utf-8');
  assert(groupServiceSrc.includes('isGroupActive'), 'groupService.ts imports/uses isGroupActive');
  assert(groupServiceSrc.includes('filter((g) => isGroupActive'), 'getGroups filters with isGroupActive');

  // --- Test 14: (static) challengeService has filterActiveGroupIds ---
  console.log('\n--- Test 14: static guard — challengeService has filterActiveGroupIds ---');
  const challengeServiceSrc = fs.readFileSync('src/services/challengeService.ts', 'utf-8');
  assert(challengeServiceSrc.includes('filterActiveGroupIds'), 'challengeService has filterActiveGroupIds');

  // --- Test 15: (static) Firestore rules contain isActiveGroup helper ---
  console.log('\n--- Test 15: static guard — firestore.rules has isActiveGroup ---');
  const rulesSrc = fs.readFileSync('firestore.rules', 'utf-8');
  assert(rulesSrc.includes('function isActiveGroup'), 'isActiveGroup helper present');
  assert(rulesSrc.includes('isActiveGroup(request.resource.data.groupId)'), 'isActiveGroup applied to groupMembers/challengeMembers/workouts/wellnessLogs');

  // ---------------------------------------------------------------------------
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
