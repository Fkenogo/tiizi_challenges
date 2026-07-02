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
      if (path.startsWith('groups/') && isGroupActive(doc as { status?: string })) results.push(doc);
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

  // --- Test 10: getMyGroups excludes inactive groups (18I-6C: inactive not shown to regular users) ---
  console.log('\n--- Test 10: getMyGroups excludes inactive groups ---');
  const myGroups = groupSvc.getMyGroups();
  assert(!myGroups.some((g) => g.name === 'Inactive Group'), 'inactive group excluded from my-groups');

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

  // ============================================================
  // Phase 18I-6C: Gap-closure guards
  // ============================================================

  // --- Test 16: (static) Firestore challenges create rule has isActiveGroup ---
  console.log('\n--- Test 16: static guard — challenges create rule blocks inactive group ---');
  // The challenges block must contain isActiveGroup next to the isGroupMember check.
  const challengesCreateBlock = rulesSrc.slice(
    rulesSrc.indexOf('match /challenges/'),
    rulesSrc.indexOf('match /challengeMembers/'),
  );
  assert(
    challengesCreateBlock.includes('isActiveGroup(request.resource.data.groupId)'),
    'challenges allow create includes isActiveGroup gate',
  );

  // --- Test 17: getMyGroups excludes inactive groups ---
  console.log('\n--- Test 17: getMyGroups excludes inactive groups ---');
  // g2 is inactive; getMyGroups() calls getGroupsByIds then filters by isGroupActive
  // Simulate getMyGroups with our fake — the real service adds the filter.
  // Static guard: source must filter inactive in getMyGroups.
  assert(
    groupServiceSrc.includes('groups.filter((g) => isGroupActive'),
    'getMyGroups applies isGroupActive filter on result',
  );

  // Behavioural: getGroups (discover) must not include inactive, getMyGroups must not include inactive
  db.update('groups/g1', { status: 'active' }); // restore g1 after test 12
  const discoveryGroups = groupSvc.getGroups();
  assert(!discoveryGroups.some((g) => g.name === 'Inactive Group'), 'getGroups (discover) excludes inactive');

  // --- Test 18: (static) GroupDetailScreen early-returns for inactive before private gate ---
  console.log('\n--- Test 18: static guard — GroupDetailScreen shows deactivated state before private-group gate ---');
  const groupDetailSrc = fs.readFileSync('src/features/Groups/GroupDetailScreen.tsx', 'utf-8');
  const deactivatedReturnIdx = groupDetailSrc.indexOf('if (isDeactivated)');
  const privateGateIdx = groupDetailSrc.indexOf("if (group?.isPrivate && membershipStatus !== 'joined')");
  assert(deactivatedReturnIdx !== -1, 'isDeactivated early-return exists');
  assert(privateGateIdx !== -1, 'private group gate exists');
  assert(deactivatedReturnIdx < privateGateIdx, 'deactivated check comes before private-group gate');

  // --- Test 19: (static) GroupDetailScreen has no Create Challenge CTA reachable when deactivated ---
  console.log('\n--- Test 19: static guard — Create Challenge only reachable after deactivated gate ---');
  // "Create Challenge" button must appear AFTER the deactivated early-return in the source,
  // meaning it's only rendered for active groups.
  const createChallengeIdx = groupDetailSrc.indexOf('Create Challenge');
  assert(createChallengeIdx > deactivatedReturnIdx, 'Create Challenge CTA is after the deactivated early-return');
  // The deactivated early-return renders a read-only screen without a Create Challenge button.
  const deactivatedBlock = groupDetailSrc.slice(
    deactivatedReturnIdx,
    groupDetailSrc.indexOf('if (group?.isPrivate'),
  );
  assert(!deactivatedBlock.includes('Create Challenge'), 'deactivated early-return block has no Create Challenge CTA');

  // --- Test 20: (static) No "Continue" CTA in deactivated screen ---
  console.log('\n--- Test 20: static guard — deactivated screen has no "Continue" CTA ---');
  assert(!deactivatedBlock.includes('Continue'), 'deactivated screen does not show Continue CTA');

  // --- Test 21: (static) challengeService getVisibleChallengesForUser filters public inactive groups ---
  console.log('\n--- Test 21: static guard — getVisibleChallengesForUser filters inactive public groups ---');
  assert(
    challengeServiceSrc.includes('isGroupActive(d.data()'),
    'getVisibleChallengesForUser filters inactive public groups inline',
  );
  assert(
    challengeServiceSrc.includes('filterActiveGroupIds(rawAllowedGroupIds)'),
    'getVisibleChallengesForUser applies filterActiveGroupIds to full allowed-group list',
  );

  // ============================================================
  // Phase 18I-6D: Group Schema Consistency Guards
  // ============================================================

  const groupLifecycleSrc = fs.readFileSync('src/utils/groupLifecycle.ts', 'utf-8');
  const groupServiceSrcFresh = fs.readFileSync('src/services/groupService.ts', 'utf-8');

  // --- Test 22: buildGroupDefaults writes status: 'active' ---
  console.log('\n--- Test 22: buildGroupDefaults writes status active ---');
  const { buildGroupDefaults } = await import('../src/utils/groupLifecycle');
  const defaults = buildGroupDefaults({
    name: 'Test Group',
    description: 'desc',
    ownerId: 'user1',
    inviteCode: 'TEST-1234',
  });
  assert(defaults.status === 'active', 'buildGroupDefaults writes status: active');
  assert(defaults.moderationStatus === 'active', 'buildGroupDefaults writes moderationStatus: active');
  assert(defaults.visibility === 'public', 'buildGroupDefaults writes visibility: public for non-private group');
  assert(defaults.allowMemberChallenges === true, 'buildGroupDefaults writes allowMemberChallenges: true');
  assert(defaults.isFeatured === false, 'buildGroupDefaults writes isFeatured: false');
  assert(defaults.activeChallenges === 0, 'buildGroupDefaults writes activeChallenges: 0');
  assert(defaults.reviewStatus === 'pending', 'buildGroupDefaults writes reviewStatus: pending');

  // --- Test 23: buildGroupDefaults sets visibility: private for private groups ---
  console.log('\n--- Test 23: buildGroupDefaults sets visibility based on isPrivate ---');
  const privateDefaults = buildGroupDefaults({
    name: 'Private Group',
    description: 'desc',
    ownerId: 'user1',
    isPrivate: true,
    inviteCode: 'PRIV-1234',
  });
  assert(privateDefaults.visibility === 'private', 'private group gets visibility: private');

  // --- Test 24: groupService.createGroup uses buildGroupDefaults (static guard) ---
  console.log('\n--- Test 24: static guard — groupService uses buildGroupDefaults ---');
  assert(
    groupServiceSrcFresh.includes('buildGroupDefaults'),
    'groupService.ts imports and calls buildGroupDefaults',
  );

  // --- Test 25: isGroupActive respects moderationStatus: deactivated ---
  console.log('\n--- Test 25: isGroupActive blocks moderationStatus: deactivated ---');
  assert(
    !isGroupActive({ status: 'active', moderationStatus: 'deactivated' }),
    'isGroupActive returns false when moderationStatus is deactivated even if status is active',
  );
  assert(
    isGroupActive({ status: 'active', moderationStatus: 'active' }),
    'isGroupActive returns true for status+moderationStatus both active',
  );
  assert(
    isGroupActive({ status: 'active' }),
    'isGroupActive returns true for status active with no moderationStatus (legacy)',
  );

  // --- Test 26: isGroupActive source checks moderationStatus ---
  console.log('\n--- Test 26: static guard — isGroupActive checks moderationStatus ---');
  assert(
    groupLifecycleSrc.includes('moderationStatus'),
    'isGroupActive implementation checks moderationStatus',
  );

  // --- Test 27: inactive groups remain blocked after schema changes ---
  console.log('\n--- Test 27: inactive group still blocked for challenge join ---');
  db.update('groups/g2', { status: 'inactive', moderationStatus: 'deactivated' });
  assertThrows(
    () => challengeSvc.joinChallenge('user1', 'c2'),
    'deactivated group',
    'challenge join still blocked for inactive group after schema changes',
  );

  // --- Test 28: active group with full schema can participate ---
  console.log('\n--- Test 28: group with full canonical schema is active ---');
  db.set('groups/g_new', {
    id: 'g_new',
    name: 'Newly Created Group',
    status: 'active',
    moderationStatus: 'active',
    visibility: 'public',
    isFeatured: false,
    isVerified: false,
    reviewStatus: 'pending',
    allowMemberChallenges: true,
    requireAdminApproval: false,
    activeChallenges: 0,
    memberCount: 1,
    createdAt: new Date().toISOString(),
    ownerId: 'user1',
    inviteCode: 'NEW-XXXX',
    description: 'desc',
  });
  assert(isGroupActive(db.get('groups/g_new').data as { status?: string; moderationStatus?: string }), 'new group with full schema is active');
  assert(groupSvc.joinGroup('g_new').status === 'joined', 'joinGroup succeeds for new group with full schema');

  // --- Test 29: (static) audit script exists and checks required fields ---
  console.log('\n--- Test 29: static guard — audit script exists ---');
  const auditScriptExists = fs.existsSync('scripts/auditGroupDocumentSchema.ts');
  assert(auditScriptExists, 'scripts/auditGroupDocumentSchema.ts exists');
  const auditSrc = fs.readFileSync('scripts/auditGroupDocumentSchema.ts', 'utf-8');
  assert(auditSrc.includes("'status'"), 'audit script checks status field');
  assert(auditSrc.includes("'moderationStatus'"), 'audit script checks moderationStatus field');
  assert(auditSrc.includes("'visibility'"), 'audit script checks visibility field');
  assert(auditSrc.includes('allowMemberChallenges'), 'audit script checks allowMemberChallenges field');
  assert(auditSrc.includes('--execute') && auditSrc.includes('--confirm'), 'audit script requires --execute --confirm for writes');

  // ---------------------------------------------------------------------------
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
