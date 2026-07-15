import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  approveGroupJoinRequestCore,
  createGroupInviteCore,
  listGroupInvitesCore,
  redeemGroupInviteCore,
  rejectGroupJoinRequestCore,
  revokeGroupInviteCore,
  requestGroupJoinCore,
} from '../functions/src/groupInviteBackend.js';
import {
  calculateGroupInviteAnalytics,
  getGroupInviteErrorMessage,
  normalizeCreateGroupInviteInput,
  normalizeInviteTokenInput,
  type GroupInvite,
} from '../src/services/groupInviteUtils.js';
import { buildInviteCodeMigrationPlan, legacyInviteDocumentId } from './migrateInviteCodes.js';
import { buildInviteMigrationReadinessReport } from './auditInviteMigrationReadiness.js';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

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

  async set(data: Record<string, unknown>, options?: { merge?: boolean }) {
    if (options?.merge) {
      this.store.set(this.path, { ...(this.store.get(this.path) ?? {}), ...data });
      return;
    }
    this.store.set(this.path, data);
  }

  async update(data: Record<string, unknown>) {
    if (!this.store.has(this.path)) throw new Error(`Missing doc ${this.path}`);
    this.store.set(this.path, { ...(this.store.get(this.path) ?? {}), ...data });
  }
}

class FakeCollection {
  private filters: Array<{ field: string; value: unknown }> = [];
  private orderField: string | null = null;
  private orderDirection: 'asc' | 'desc' = 'asc';
  private resultLimit = Number.POSITIVE_INFINITY;

  constructor(
    private readonly store: Map<string, Record<string, unknown>>,
    private readonly name: string,
  ) {}

  doc(id?: string) {
    return new FakeDoc(this.store, `${this.name}/${id ?? `auto_${this.store.size + 1}`}`);
  }

  where(field: string, op: '==', value: unknown) {
    assert.equal(op, '==');
    const next = new FakeCollection(this.store, this.name);
    next.filters = [...this.filters, { field, value }];
    next.orderField = this.orderField;
    next.orderDirection = this.orderDirection;
    next.resultLimit = this.resultLimit;
    return next;
  }

  orderBy(field: string, direction: 'asc' | 'desc') {
    const next = new FakeCollection(this.store, this.name);
    next.filters = [...this.filters];
    next.orderField = field;
    next.orderDirection = direction;
    next.resultLimit = this.resultLimit;
    return next;
  }

  limit(count: number) {
    const next = new FakeCollection(this.store, this.name);
    next.filters = [...this.filters];
    next.orderField = this.orderField;
    next.orderDirection = this.orderDirection;
    next.resultLimit = count;
    return next;
  }

  async get() {
    const prefix = `${this.name}/`;
    let rows = Array.from(this.store.entries())
      .filter(([path]) => path.startsWith(prefix))
      .map(([path, data]) => ({
        id: path.slice(prefix.length),
        data,
      }))
      .filter((row) => this.filters.every((filter) => row.data[filter.field] === filter.value));

    if (this.orderField) {
      rows = rows.sort((a, b) => {
        const left = String(a.data[this.orderField ?? ''] ?? '');
        const right = String(b.data[this.orderField ?? ''] ?? '');
        return this.orderDirection === 'desc' ? right.localeCompare(left) : left.localeCompare(right);
      });
    }

    return {
      docs: rows.slice(0, this.resultLimit).map((row) => ({
        id: row.id,
        ref: new FakeDoc(this.store, `${this.name}/${row.id}`),
        data: () => row.data,
      })),
    };
  }
}

class FakeDb {
  readonly store = new Map<string, Record<string, unknown>>();

  collection(name: string) {
    return new FakeCollection(this.store, name);
  }

  async runTransaction<T>(callback: (transaction: FakeTransaction) => Promise<T>) {
    const transaction = new FakeTransaction(this.store);
    return callback(transaction);
  }
}

class FakeTransaction {
  constructor(private readonly store: Map<string, Record<string, unknown>>) {}

  async get(target: FakeDoc | FakeCollection) {
    return target.get();
  }

  set(ref: FakeDoc, data: Record<string, unknown>, options?: { merge?: boolean }) {
    const normalized = Object.fromEntries(
      Object.entries(data).map(([key, value]) => {
        if (
          value
          && typeof value === 'object'
          && (
            ('_methodName' in value && value._methodName === 'FieldValue.increment')
            || value.constructor?.name === 'NumericIncrementTransform'
            || 'operand' in value
          )
        ) {
          const current = Number(this.store.get(ref.path)?.[key] ?? 0);
          const operand = Number((value as { _operand?: number; operand?: number })._operand ?? (value as { operand?: number }).operand ?? 0);
          return [key, current + operand];
        }
        return [key, value];
      }),
    );
    if (options?.merge) {
      this.store.set(ref.path, { ...(this.store.get(ref.path) ?? {}), ...normalized });
      return;
    }
    this.store.set(ref.path, normalized);
  }
}

async function assertRejectsWithPermission(label: string, fn: () => Promise<unknown>) {
  await assert.rejects(fn, (error) => {
    const code = (error as { code?: string }).code;
    assert.equal(code, 'permission-denied', label);
    return true;
  });
}

async function assertRejectsWithInvalidArgument(label: string, fn: () => Promise<unknown>) {
  await assert.rejects(fn, (error) => {
    const code = (error as { code?: string }).code;
    assert.equal(code, 'invalid-argument', label);
    return true;
  });
}

async function assertRejectsWithCode(label: string, expectedCode: string, fn: () => Promise<unknown>) {
  await assert.rejects(fn, (error) => {
    const code = (error as { code?: string }).code;
    assert.equal(code, expectedCode, label);
    return true;
  });
}

function seedBase(db: FakeDb) {
  db.store.set('groups/group_public', {
    ownerId: 'owner_uid',
    status: 'active',
    isPrivate: false,
    visibility: 'public',
  });
  db.store.set('groups/group_private', {
    ownerId: 'owner_uid',
    status: 'active',
    isPrivate: true,
    visibility: 'private',
  });
  db.store.set('groupMembers/group_private_moderator_uid', {
    groupId: 'group_private',
    userId: 'moderator_uid',
    role: 'moderator',
    status: 'active',
  });
}

async function run() {
  {
    const db = new FakeDb();
    seedBase(db);
    await assertRejectsWithPermission('unauthorized invite creation should fail', () =>
      createGroupInviteCore(db as never, {
        actorUid: 'member_uid',
        groupId: 'group_private',
        type: 'multi_use',
        maxUses: 10,
        expiresAt: '2099-07-01T00:00:00.000Z',
      }),
    );
  }

  {
    const db = new FakeDb();
    seedBase(db);
    const invite = await createGroupInviteCore(db as never, {
      actorUid: 'owner_uid',
      groupId: 'group_private',
      type: 'multi_use',
      maxUses: 2,
      expiresAt: '2099-07-01T00:00:00.000Z',
    });
    const result = await redeemGroupInviteCore(db as never, {
      actorUid: 'new_member_uid',
      token: invite.token,
      nowMs: Date.parse('2026-06-11T00:00:00.000Z'),
    });
    assert.equal(result.groupId, 'group_private');
    assert.equal(result.status, 'joined');
    assert.equal(db.store.get(`groupInvites/${invite.inviteId}`)?.useCount, 1);
    assert.equal(db.store.get('groupMembers/group_private_new_member_uid')?.status, 'active');
    assert.equal(
      Array.from(db.store.values()).some((row) => row.action === 'invite_redeemed'),
      true,
      'redemption writes invite_redeemed audit log',
    );
  }

  {
    const db = new FakeDb();
    seedBase(db);
    await assertRejectsWithCode('invalid invite should fail', 'not-found', () =>
      redeemGroupInviteCore(db as never, {
        actorUid: 'new_member_uid',
        token: 'not-a-real-token',
        nowMs: Date.parse('2026-06-11T00:00:00.000Z'),
      }),
    );
  }

  {
    const db = new FakeDb();
    seedBase(db);
    db.store.set('groupInvites/expired_invite', {
      groupId: 'group_private',
      tokenHash: hashToken('expired-token'),
      status: 'active',
      type: 'multi_use',
      maxUses: 10,
      useCount: 0,
      expiresAt: '2020-01-01T00:00:00.000Z',
      revokedAt: null,
    });
    await assertRejectsWithCode('expired invite should fail', 'failed-precondition', () =>
      redeemGroupInviteCore(db as never, {
        actorUid: 'new_member_uid',
        token: 'expired-token',
        nowMs: Date.parse('2026-06-11T00:00:00.000Z'),
      }),
    );
  }

  {
    const db = new FakeDb();
    seedBase(db);
    db.store.set('groupInvites/revoked_invite', {
      groupId: 'group_private',
      tokenHash: hashToken('revoked-token'),
      status: 'active',
      type: 'multi_use',
      maxUses: 10,
      useCount: 0,
      expiresAt: '2099-01-01T00:00:00.000Z',
      revokedAt: '2026-01-01T00:00:00.000Z',
    });
    await assertRejectsWithCode('revoked invite should fail', 'failed-precondition', () =>
      redeemGroupInviteCore(db as never, {
        actorUid: 'new_member_uid',
        token: 'revoked-token',
        nowMs: Date.parse('2026-06-11T00:00:00.000Z'),
      }),
    );
  }

  {
    const db = new FakeDb();
    seedBase(db);
    db.store.set('groupInvites/exhausted_invite', {
      groupId: 'group_private',
      tokenHash: hashToken('exhausted-token'),
      status: 'active',
      type: 'multi_use',
      maxUses: 2,
      useCount: 2,
      expiresAt: '2099-01-01T00:00:00.000Z',
      revokedAt: null,
    });
    await assertRejectsWithCode('exhausted invite should fail', 'failed-precondition', () =>
      redeemGroupInviteCore(db as never, {
        actorUid: 'new_member_uid',
        token: 'exhausted-token',
        nowMs: Date.parse('2026-06-11T00:00:00.000Z'),
      }),
    );
  }

  {
    const db = new FakeDb();
    seedBase(db);
    const invite = await createGroupInviteCore(db as never, {
      actorUid: 'owner_uid',
      groupId: 'group_private',
      type: 'one_time',
      maxUses: 999,
      expiresAt: '2099-07-01T00:00:00.000Z',
    });
    await redeemGroupInviteCore(db as never, {
      actorUid: 'first_uid',
      token: invite.token,
      nowMs: Date.parse('2026-06-11T00:00:00.000Z'),
    });
    await assertRejectsWithCode('one-time invite reuse should fail', 'failed-precondition', () =>
      redeemGroupInviteCore(db as never, {
        actorUid: 'second_uid',
        token: invite.token,
        nowMs: Date.parse('2026-06-11T00:00:00.000Z'),
      }),
    );
    assert.equal(db.store.get(`groupInvites/${invite.inviteId}`)?.useCount, 1);
  }

  {
    const db = new FakeDb();
    seedBase(db);
    const invite = await createGroupInviteCore(db as never, {
      actorUid: 'owner_uid',
      groupId: 'group_private',
      type: 'multi_use',
      maxUses: 1,
      expiresAt: '2099-07-01T00:00:00.000Z',
    });
    await redeemGroupInviteCore(db as never, {
      actorUid: 'first_uid',
      token: invite.token,
      nowMs: Date.parse('2026-06-11T00:00:00.000Z'),
    });
    await assertRejectsWithCode('concurrent-style overuse should fail after maxUses reached', 'failed-precondition', () =>
      redeemGroupInviteCore(db as never, {
        actorUid: 'second_uid',
        token: invite.token,
        nowMs: Date.parse('2026-06-11T00:00:00.000Z'),
      }),
    );
  }

  {
    const db = new FakeDb();
    seedBase(db);
    const invite = await createGroupInviteCore(db as never, {
      actorUid: 'owner_uid',
      groupId: 'group_private',
      type: 'multi_use',
      maxUses: 5,
      expiresAt: '2099-07-01T00:00:00.000Z',
    });
    db.store.set('groupMembers/group_private_existing_uid', {
      groupId: 'group_private',
      userId: 'existing_uid',
      role: 'member',
      status: 'active',
    });
    await assertRejectsWithCode('duplicate active membership should fail', 'failed-precondition', () =>
      redeemGroupInviteCore(db as never, {
        actorUid: 'existing_uid',
        token: invite.token,
        nowMs: Date.parse('2026-06-11T00:00:00.000Z'),
      }),
    );
    assert.equal(db.store.get(`groupInvites/${invite.inviteId}`)?.useCount, 0);
  }

  {
    const db = new FakeDb();
    seedBase(db);
    await assertRejectsWithInvalidArgument('invalid expiration should fail', () =>
      createGroupInviteCore(db as never, {
        actorUid: 'owner_uid',
        groupId: 'group_private',
        type: 'multi_use',
        maxUses: 10,
        expiresAt: '2020-01-01T00:00:00.000Z',
      }),
    );
    await assertRejectsWithInvalidArgument('invalid maxUses should fail', () =>
      createGroupInviteCore(db as never, {
        actorUid: 'owner_uid',
        groupId: 'group_private',
        type: 'multi_use',
        maxUses: 0,
        expiresAt: '2099-07-01T00:00:00.000Z',
      }),
    );
    const normalized = normalizeCreateGroupInviteInput({
      groupId: ' group_private ',
      type: 'one_time',
      maxUses: 500,
      expiresAt: '2099-01-01T00:00:00.000Z',
      note: '  bring a friend  ',
    });
    assert.equal(normalized.maxUses, 1);
    assert.equal(normalized.note, 'bring a friend');
    assert.equal(normalizeInviteTokenInput(' early-birds '), 'EARLY-BIRDS');
    assert.equal(
      getGroupInviteErrorMessage({ code: 'functions/not-found' }),
      'Invalid invite code.',
    );
    assert.equal(
      getGroupInviteErrorMessage({ code: 'functions/failed-precondition', message: 'Invite has expired' }),
      'Invite has expired.',
    );
    assert.equal(
      getGroupInviteErrorMessage({ code: 'functions/failed-precondition', message: 'Invite has been revoked' }),
      'Invite is no longer valid.',
    );
    assert.equal(
      getGroupInviteErrorMessage({ code: 'functions/failed-precondition', message: 'Invite has no remaining uses' }),
      'Invite usage limit reached.',
    );
    assert.equal(
      getGroupInviteErrorMessage({ code: 'functions/failed-precondition', message: 'User is already an active group member' }),
      'You are already a member.',
    );
  }

  {
    const db = new FakeDb();
    seedBase(db);
    const result = await createGroupInviteCore(db as never, {
      actorUid: 'owner_uid',
      groupId: 'group_private',
      type: 'one_time',
      maxUses: 1,
      expiresAt: '2099-07-01T00:00:00.000Z',
      note: 'Owner invite',
    });
    assert.ok(result.inviteId);
    assert.equal(db.store.get(`groupInvites/${result.inviteId}`)?.createdBy, 'owner_uid');
    assert.equal(db.store.get(`groupInvites/${result.inviteId}`)?.status, 'active');
    assert.equal(db.store.get(`groupInvites/${result.inviteId}`)?.note, 'Owner invite');
    assert.equal(
      Array.from(db.store.values()).some((row) => row.action === 'invite_created'),
      true,
      'owner create writes invite_created audit log',
    );
  }

  {
    const db = new FakeDb();
    seedBase(db);
    const result = await createGroupInviteCore(db as never, {
      actorUid: 'moderator_uid',
      groupId: 'group_private',
      type: 'multi_use',
      maxUses: 25,
      expiresAt: '2099-07-01T00:00:00.000Z',
    });
    assert.ok(result.inviteId);
    assert.equal(db.store.get(`groupInvites/${result.inviteId}`)?.createdBy, 'moderator_uid');
  }

  {
    const db = new FakeDb();
    seedBase(db);
    const invite = await createGroupInviteCore(db as never, {
      actorUid: 'owner_uid',
      groupId: 'group_private',
      type: 'multi_use',
      maxUses: 10,
      expiresAt: '2099-07-01T00:00:00.000Z',
    });
    db.store.set('groupInvites/other_group_invite', {
      groupId: 'group_public',
      createdBy: 'owner_uid',
      createdAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2099-07-01T00:00:00.000Z',
      revokedAt: null,
      status: 'active',
      type: 'multi_use',
      maxUses: 10,
      useCount: 0,
      tokenHash: 'do-not-return',
      lastUsedAt: null,
    });
    const listed = await listGroupInvitesCore(db as never, {
      actorUid: 'owner_uid',
      groupId: 'group_private',
    });
    assert.equal(listed.invites.length, 1);
    assert.equal(listed.invites[0].id, invite.inviteId);
    assert.equal('tokenHash' in listed.invites[0], false, 'listGroupInvites must not expose tokenHash');
    await assertRejectsWithPermission('unauthorized invite listing should fail', () =>
      listGroupInvitesCore(db as never, {
        actorUid: 'member_uid',
        groupId: 'group_private',
      }),
    );
  }

  {
    const analytics = calculateGroupInviteAnalytics([
      { id: 'a', groupId: 'g', createdBy: 'u', createdAt: null, expiresAt: '2099-01-01T00:00:00.000Z', revokedAt: null, status: 'active', type: 'multi_use', maxUses: 10, useCount: 3, lastUsedAt: null, note: null },
      { id: 'b', groupId: 'g', createdBy: 'u', createdAt: null, expiresAt: '2020-01-01T00:00:00.000Z', revokedAt: null, status: 'active', type: 'multi_use', maxUses: 10, useCount: 2, lastUsedAt: null, note: null },
      { id: 'c', groupId: 'g', createdBy: 'u', createdAt: null, expiresAt: '2099-01-01T00:00:00.000Z', revokedAt: null, status: 'revoked', type: 'one_time', maxUses: 1, useCount: 1, lastUsedAt: null, note: null },
    ] satisfies GroupInvite[], Date.parse('2026-01-01T00:00:00.000Z'));
    assert.deepEqual(analytics, {
      activeInvites: 1,
      expiredInvites: 1,
      revokedInvites: 1,
      totalUses: 6,
    });
  }

  {
    const legacyGroups = [
      { groupId: 'private_group', name: 'Private', inviteCode: 'PRIVATE-CODE', isPrivate: true, visibility: 'private', status: 'active', ownerId: 'owner_uid' },
      { groupId: 'public_group', name: 'Public', inviteCode: 'PUBLIC-CODE', isPrivate: false, visibility: 'public', status: 'active', ownerId: 'owner_uid' },
      { groupId: 'empty_group', name: 'Empty', inviteCode: '', isPrivate: false, visibility: 'public', status: 'active', ownerId: 'owner_uid' },
    ];
    const plan = buildInviteCodeMigrationPlan(legacyGroups, [], new Date('2026-06-11T00:00:00.000Z'));
    assert.equal(plan.groupsRead, 3);
    assert.equal(plan.groupsWithInviteCode, 2);
    assert.equal(plan.privateGroupsWithInviteCode, 1);
    assert.equal(plan.publicGroupsWithInviteCode, 1);
    assert.equal(plan.proposedInvites.length, 2);
    assert.equal(plan.writesPlanned, 2);
    assert.equal(plan.skippedExisting.length, 0);
    assert.equal(plan.collisions.length, 0);
    assert.equal(plan.proposedInvites[0].documentId, legacyInviteDocumentId('private_group'));
    assert.equal(plan.proposedInvites[0].sourceInviteCode, 'PRIVATE-CODE');
    assert.notEqual(plan.proposedInvites[0].tokenHash, 'PRIVATE-CODE');
    assert.equal(plan.proposedInvites[0].note.includes('Original group field preserved'), true);

    const secondPlan = buildInviteCodeMigrationPlan(legacyGroups, [
      {
        inviteId: legacyInviteDocumentId('private_group'),
        groupId: 'private_group',
        tokenHash: plan.proposedInvites[0].tokenHash,
        migratedFrom: 'groups.inviteCode',
      },
      {
        inviteId: 'legacy_public_group',
        groupId: 'public_group',
        tokenHash: plan.proposedInvites[1].tokenHash,
        migratedFrom: 'groups.inviteCode',
      },
    ], new Date('2026-06-11T00:00:00.000Z'));
    assert.equal(secondPlan.proposedInvites.length, 0);
    assert.equal(secondPlan.writesPlanned, 0);
    assert.deepEqual(
      secondPlan.skippedExisting.map((item) => item.groupId).sort(),
      ['private_group', 'public_group'],
    );

    const collisionPlan = buildInviteCodeMigrationPlan(legacyGroups, [
      {
        inviteId: 'other_group_hash',
        groupId: 'other_group',
        tokenHash: plan.proposedInvites[0].tokenHash,
        migratedFrom: 'groups.inviteCode',
      },
    ], new Date('2026-06-11T00:00:00.000Z'));
    assert.equal(collisionPlan.proposedInvites.length, 1);
    assert.equal(collisionPlan.collisions.length, 1);
    assert.equal(collisionPlan.collisions[0].field, 'tokenHash');
  }

  {
    const readiness = buildInviteMigrationReadinessReport({
      groups: [
        { groupId: 'group_a', name: 'A', inviteCode: 'A-CODE', isPrivate: true },
        { groupId: 'group_b', name: 'B', inviteCode: 'B-CODE', isPrivate: false },
      ],
      invites: [
        { inviteId: 'invite_a', groupId: 'group_a', status: 'active', migratedFrom: 'groups.inviteCode' },
        { inviteId: 'orphan', groupId: 'missing_group', status: 'active', migratedFrom: 'groups.inviteCode' },
      ],
    });
    assert.equal(readiness.legacyInviteCodes, 2);
    assert.equal(readiness.migratedInviteRecords, 2);
    assert.deepEqual(readiness.missingMappings.map((item) => item.groupId), ['group_b']);
    assert.deepEqual(readiness.orphanedInviteRecords.map((item) => item.inviteId), ['orphan']);
  }

  {
    const db = new FakeDb();
    seedBase(db);
    const request = await requestGroupJoinCore(db as never, {
      actorUid: 'member_uid',
      groupId: 'group_private',
      source: 'request',
    });
    await assertRejectsWithPermission('unauthorized approval should fail', () =>
      approveGroupJoinRequestCore(db as never, {
        actorUid: 'member_uid',
        requestId: request.requestId,
      }),
    );
    await assertRejectsWithPermission('unauthorized rejection should fail', () =>
      rejectGroupJoinRequestCore(db as never, {
        actorUid: 'member_uid',
        requestId: request.requestId,
        rejectionReason: 'No',
      }),
    );
  }

  {
    const db = new FakeDb();
    seedBase(db);
    const request = await requestGroupJoinCore(db as never, {
      actorUid: 'member_uid',
      groupId: 'group_private',
      source: 'request',
    });
    await approveGroupJoinRequestCore(db as never, {
      actorUid: 'owner_uid',
      requestId: request.requestId,
    });
    assert.equal(db.store.get(`groupJoinRequests/${request.requestId}`)?.status, 'approved');
    assert.equal(db.store.get('groupMembers/group_private_member_uid')?.status, 'active');
    assert.equal(
      Array.from(db.store.values()).some((row) => row.action === 'join_approved'),
      true,
      'approval writes join_approved audit log',
    );
  }

  {
    const db = new FakeDb();
    seedBase(db);
    const request = await requestGroupJoinCore(db as never, {
      actorUid: 'member_uid',
      groupId: 'group_private',
      source: 'request',
    });
    await rejectGroupJoinRequestCore(db as never, {
      actorUid: 'moderator_uid',
      requestId: request.requestId,
      rejectionReason: 'Group is full',
    });
    assert.equal(db.store.get(`groupJoinRequests/${request.requestId}`)?.status, 'rejected');
    assert.equal(db.store.get(`groupJoinRequests/${request.requestId}`)?.rejectedBy, 'moderator_uid');
  }

  {
    const db = new FakeDb();
    seedBase(db);
    const invite = await createGroupInviteCore(db as never, {
      actorUid: 'owner_uid',
      groupId: 'group_private',
      type: 'multi_use',
      maxUses: 10,
      expiresAt: '2099-07-01T00:00:00.000Z',
    });
    await revokeGroupInviteCore(db as never, {
      actorUid: 'moderator_uid',
      inviteId: invite.inviteId,
    });
    assert.equal(db.store.get(`groupInvites/${invite.inviteId}`)?.status, 'revoked');
    assert.equal(
      Array.from(db.store.values()).some((row) => row.action === 'invite_revoked'),
      true,
      'revoke writes invite_revoked audit log',
    );
  }

  const rules = await import('node:fs/promises').then((fs) => fs.readFile('firestore.rules', 'utf8'));
  const groupServiceSource = await import('node:fs/promises').then((fs) => fs.readFile('src/services/groupService.ts', 'utf8'));
  const useGroupsSource = await import('node:fs/promises').then((fs) => fs.readFile('src/hooks/useGroups.ts', 'utf8'));
  const groupsScreenSource = await import('node:fs/promises').then((fs) => fs.readFile('src/features/Groups/GroupsScreen.tsx', 'utf8'));
  assert.equal(groupServiceSource.includes('joinGroupByInviteCode'), false, 'legacy groupService invite-code join is removed');
  assert.equal(useGroupsSource.includes('inviteCode'), false, 'useJoinGroup no longer accepts inviteCode');
  assert.equal(groupsScreenSource.includes('joinGroup.mutateAsync({ inviteCode'), false, 'GroupsScreen no longer uses legacy invite-code join');
  assert.equal(rules.includes("'inviteCode'"), false, 'client group rules no longer allow inviteCode');
  assert.match(rules, /match \/groupAuditLogs\/\{auditId\}/, 'groupAuditLogs rules block exists');
  assert.match(
    rules,
    /match \/groupAuditLogs\/\{auditId\}[\s\S]*allow create, update, delete: if false;/,
    'groupAuditLogs client writes are denied',
  );
  assert.match(
    rules,
    /match \/groupInvites\/\{inviteId\}[\s\S]*allow create, update, delete: if false;/,
    'groupInvites client writes are denied',
  );
  assert.match(
    rules,
    /match \/groupJoinRequests\/\{requestId\}[\s\S]*allow create, update, delete: if false;/,
    'groupJoinRequests direct client writes are denied',
  );

  console.log('Group invite backend security tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
