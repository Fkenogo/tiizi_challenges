import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { appendCorrectionEvent } from '../src/activityEvents.js';
import {
  applyChallengeActivity,
  type ChallengeActivityResolvers,
  type NewChallengeActivityInput,
} from '../src/challengeActivityApplication.js';
import { finalizeChallenge } from '../src/challengeFinalization.js';
import {
  activateChallenge,
  createChallenge,
  endChallenge,
  type ChallengeCreationResolvers,
  type NewChallengeInput,
} from '../src/challenges.js';
import {
  createGovernedGroup,
  joinGovernedGroup,
  leaveGovernedGroup,
  reviewPendingMembership,
} from '../src/postgresGroupAuthority.js';
import {
  type PersonalTimelineItem,
  type PersonalTimelinePage,
} from '../src/memberTimeline.js';
import {
  authHeaders,
  buildTestApp,
  seedGroup,
  seedMember,
  seedMembership,
  stubEligibility,
  testDb,
} from './helpers.js';

beforeEach(async () => {
  await testDb().query(
    `TRUNCATE group_feed_projection, group_feed_outbox, challenge_feed_kudos, challenge_feed_shares,
      challenge_social_cause_decisions, challenge_social_causes,
      challenge_derived_state, challenge_participation_derived,
      challenge_activity_records, challenge_activity_configs, challenge_config_versions,
      challenge_participations, challenges, challenge_establishment_keys,
      member_activity_events, activity_submission_intents,
      challenge_finalizations, challenge_participation_finals,
      group_memberships, groups CASCADE`,
  );
});

let seq = 0;
const next = (prefix: string) => `${prefix}-${++seq}`;
const instant = (iso: string) => new Date(iso);

async function seedKnowledgePin() {
  const db = testDb();
  const knowledge = await db.query<{ knowledge_id: string; current_version: number }>(
    `INSERT INTO knowledge_items (kind, name, lifecycle)
     VALUES ('fitness', 'Push-Up', 'published')
     RETURNING knowledge_id, current_version`,
  );
  const pin = {
    knowledge_id: String(knowledge.rows[0].knowledge_id),
    current_version: Number(knowledge.rows[0].current_version),
  };
  await db.query(
    `INSERT INTO knowledge_item_versions (item_id, version, name) VALUES ($1, $2, $3)`,
    [pin.knowledge_id, pin.current_version, 'Push-Up'],
  );
  const pins: Record<string, typeof pin> = { 'push-up': pin };
  const creationResolvers: ChallengeCreationResolvers = {
    resolveKnowledgePin: async (key) => pins[key] ?? null,
    resolveKnowledgeEligibility: async () => stubEligibility(),
    resolveGroupAuthority: async () => ({ status: 'active' }),
    resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
  };
  const activityResolvers: ChallengeActivityResolvers = {
    resolveKnowledgePin: async (key) => pins[key] ?? null,
    resolveGroupMembershipAuthority: async () => ({ status: 'active', eligible: true }),
  };
  return { creationResolvers, activityResolvers };
}

function logInput(overrides: Partial<NewChallengeActivityInput> = {}): NewChallengeActivityInput {
  return {
    activity_kind: 'fitness',
    canonical_key: 'push-up',
    value: 20,
    unit: 'reps',
    occurred_at: instant('2026-06-10T12:00:00Z'),
    occurred_tz: 'America/New_York',
    client_key: next('client'),
    ...overrides,
  };
}

async function getTimeline(
  app: FastifyInstance,
  subject: string | null,
  params: Record<string, string | number> = {},
): Promise<{ statusCode: number; body: PersonalTimelinePage & { error?: { code: string; message: string } } }> {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) search.set(k, String(v));
  const query = search.toString();
  const res = await app.inject({
    method: 'GET',
    url: `/api/me/timeline${query ? `?${query}` : ''}`,
    headers: subject ? authHeaders(subject) : undefined,
  });
  return { statusCode: res.statusCode, body: res.json() };
}

describe('GET /api/me/timeline — Unified Private Timeline API (ACTIVITY-002)', () => {
  it('enforces authentication (401) and strict cross-account isolation', async () => {
    const db = testDb();
    const aliceSub = next('alice');
    const bobSub = next('bob');
    const aliceId = await seedMember(db, aliceSub);
    const bobId = await seedMember(db, bobSub);

    await createGovernedGroup(db, { memberId: bobId, firebaseUid: bobSub }, { name: 'Bob Secret Group', isPrivate: true });
    await createGovernedGroup(db, { memberId: aliceId, firebaseUid: aliceSub }, { name: 'Alice Group', isPrivate: false });

    const app = buildTestApp({ [aliceSub]: aliceSub, [bobSub]: bobSub });

    const unauth = await getTimeline(app, null);
    expect(unauth.statusCode).toBe(401);

    const aliceRes = await getTimeline(app, aliceSub);
    expect(aliceRes.statusCode).toBe(200);
    expect(aliceRes.body.items).toHaveLength(1);
    expect(aliceRes.body.items[0].eventType).toBe('group_created');
    expect(aliceRes.body.items[0].group?.name).toBe('Alice Group');

    // Query parameter trying to inject another memberId cannot widen authorization
    const injected = await getTimeline(app, aliceSub, { memberId: bobId, firebaseUid: bobSub });
    expect(injected.statusCode).toBe(200);
    expect(injected.body.items).toHaveLength(1);
    expect(injected.body.items[0].group?.name).toBe('Alice Group');
  });

  it('emits group_created without duplicate founding-owner group_joined, and never infers NULL creators', async () => {
    const db = testDb();
    const sub = next('founder');
    const memberId = await seedMember(db, sub);

    const created = await createGovernedGroup(
      db,
      { memberId, firebaseUid: memberId },
      { name: 'Morning Crew', isPrivate: false },
    );

    // Pre-029 Group with NULL original_creator_member_id, even with steward set
    const legacyGroupId = await seedGroup(db, { name: 'Legacy Pre-029 Group' });
    await seedMembership(db, legacyGroupId, memberId, { role: 'owner', status: 'active' });
    await db.query(`UPDATE groups SET steward_member_id = $2 WHERE group_id = $1`, [legacyGroupId, memberId]);

    const app = buildTestApp({ [sub]: sub });
    const res = await getTimeline(app, sub);
    expect(res.statusCode).toBe(200);

    const createdGroupEvents = res.body.items.filter((i) => i.group?.id === created.id);
    expect(createdGroupEvents).toHaveLength(1);
    expect(createdGroupEvents[0].eventType).toBe('group_created');
    expect(createdGroupEvents[0].category).toBe('group');
    expect(createdGroupEvents[0].displayTimezone).toBeNull();
    expect(createdGroupEvents[0].performedAt).toBeNull();
    expect(createdGroupEvents[0].navigation).toEqual({
      kind: 'group',
      path: `/v2/groups/${created.id}`,
      accessible: true,
    });

    // Legacy Group must NOT emit group_created (D4), only group_joined
    const legacyEvents = res.body.items.filter((i) => i.group?.id === legacyGroupId);
    expect(legacyEvents.map((e) => e.eventType)).toEqual(['group_joined']);
  });

  it('handles Group direct join, pending approval, approval, rejection, leave, and rejoin accurately', async () => {
    const db = testDb();
    const stewardSub = next('steward');
    const memberSub = next('member');
    const stewardId = await seedMember(db, stewardSub);
    const memberId = await seedMember(db, memberSub);

    const openGroup = await createGovernedGroup(
      db,
      { memberId: stewardId, firebaseUid: stewardSub },
      { name: 'Open Group', isPrivate: false, requireAdminApproval: false },
    );
    const approvalGroup = await createGovernedGroup(
      db,
      { memberId: stewardId, firebaseUid: stewardSub },
      { name: 'Approval Group', isPrivate: false, requireAdminApproval: true },
    );
    const rejectedGroup = await createGovernedGroup(
      db,
      { memberId: stewardId, firebaseUid: stewardSub },
      { name: 'Rejected Group', isPrivate: false, requireAdminApproval: true },
    );

    const app = buildTestApp({ [memberSub]: memberSub, [stewardSub]: stewardSub });

    // 1. Direct join on open group -> group_joined
    await joinGovernedGroup(db, { memberId, firebaseUid: memberId }, openGroup.id);
    // 2. Pending request on approval group -> NO group_joined yet
    await joinGovernedGroup(db, { memberId, firebaseUid: memberId }, approvalGroup.id);
    // 3. Pending request then rejected -> NO group_joined or group_left
    await joinGovernedGroup(db, { memberId, firebaseUid: memberId }, rejectedGroup.id);
    await reviewPendingMembership(db, stewardId, rejectedGroup.id, memberId, 'reject');

    let res = await getTimeline(app, memberSub);
    expect(res.statusCode).toBe(200);
    expect(res.body.items.map((i) => [i.eventType, i.group?.name])).toEqual([
      ['group_joined', 'Open Group'],
    ]);

    // 4. Approve pending membership -> emits group_joined
    await reviewPendingMembership(db, stewardId, approvalGroup.id, memberId, 'approve');
    res = await getTimeline(app, memberSub);
    expect(res.body.items.some((i) => i.eventType === 'group_joined' && i.group?.id === approvalGroup.id)).toBe(true);

    // 5. Leave open group -> emits both group_joined and group_left
    await leaveGovernedGroup(db, { memberId, firebaseUid: memberId }, openGroup.id);
    res = await getTimeline(app, memberSub);
    const openEvents = res.body.items.filter((i) => i.group?.id === openGroup.id);
    expect(openEvents.map((e) => e.eventType)).toEqual(['group_left', 'group_joined']);

    // 6. Leave approval group, then request rejoin (status = 'pending') -> NO group_joined until approved
    await leaveGovernedGroup(db, { memberId, firebaseUid: memberId }, approvalGroup.id);
    await joinGovernedGroup(db, { memberId, firebaseUid: memberId }, approvalGroup.id);
    res = await getTimeline(app, memberSub);
    expect(res.body.items.some((i) => i.group?.id === approvalGroup.id)).toBe(false);

    // 7. Rejoin open group -> emits group_joined at new joined_at without fabricating lost episode
    await joinGovernedGroup(db, { memberId, firebaseUid: memberId }, openGroup.id);
    res = await getTimeline(app, memberSub);
    const afterRejoinOpen = res.body.items.filter((i) => i.group?.id === openGroup.id);
    expect(afterRejoinOpen.map((e) => e.eventType)).toEqual(['group_joined']);
  });

  it('preserves Challenge creation, join, exit, rejoin episodes, Activity corrections/reversals, and finalization results', async () => {
    const db = testDb();
    const sub = next('athlete');
    const memberId = await seedMember(db, sub);
    const group = await createGovernedGroup(db, { memberId, firebaseUid: memberId }, { name: 'Runners', isPrivate: false });
    const { creationResolvers, activityResolvers } = await seedKnowledgePin();

    const created = await createChallenge(
      db,
      {
        group_id: group.id,
        created_by_member_id: memberId,
        title: 'June Push-Up Race',
        start_date: '2026-06-01',
        end_date: '2026-06-30',
        challenge_type: 'competitive',
        timezone: 'Africa/Nairobi',
        activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' }],
      } as NewChallengeInput,
      creationResolvers,
    );
    const challengeId = created.challenge.challenge_id;
    await activateChallenge(db, challengeId);

    // Episode 1: join -> withdraw
    const ep1 = await db.query<{ participation_id: string }>(
      `INSERT INTO challenge_participations (challenge_id, member_id, status, joined_at, joined_config_version, exited_at, exit_reason)
       VALUES ($1, $2, 'withdrawn', $3, 1, $4, 'withdrawn')
       RETURNING participation_id`,
      [challengeId, memberId, '2026-06-02T08:00:00Z', '2026-06-03T08:00:00Z'],
    );
    // Episode 2: rejoin -> active -> log activity -> correct -> reverse -> another activity -> finalize
    const ep2 = await db.query<{ participation_id: string }>(
      `INSERT INTO challenge_participations (challenge_id, member_id, status, joined_at, joined_config_version)
       VALUES ($1, $2, 'active', $3, 1)
       RETURNING participation_id`,
      [challengeId, memberId, '2026-06-04T08:00:00Z'],
    );
    const ep2Id = String(ep2.rows[0].participation_id);

    // Accepted activity 1 + correction
    const act1 = await applyChallengeActivity(
      db,
      memberId,
      challengeId,
      logInput({ value: 25, occurred_at: instant('2026-06-05T09:00:00Z') }),
      activityResolvers,
      { now: instant('2026-06-05T10:00:00Z') },
    );
    await appendCorrectionEvent(
      db,
      {
        member_id: memberId,
        activity_kind: 'fitness',
        canonical_key: 'push-up',
        unit: 'reps',
        occurred_tz: 'America/New_York',
        client_key: next('corr'),
        supersedes_event_id: act1.event.event_id,
        correction_kind: 'correction',
        value: 30,
        occurred_at: instant('2026-06-05T09:00:00Z'),
      },
      activityResolvers,
    );

    // Accepted activity 2 + reversal
    const act2 = await applyChallengeActivity(
      db,
      memberId,
      challengeId,
      logInput({ value: 40, occurred_at: instant('2026-06-07T09:00:00Z') }),
      activityResolvers,
      { now: instant('2026-06-07T10:00:00Z') },
    );
    await appendCorrectionEvent(
      db,
      {
        member_id: memberId,
        activity_kind: 'fitness',
        canonical_key: 'push-up',
        unit: 'reps',
        occurred_tz: 'America/New_York',
        client_key: next('rev'),
        supersedes_event_id: act2.event.event_id,
        correction_kind: 'reversal',
        value: 40,
        occurred_at: instant('2026-06-07T09:00:00Z'),
      },
      activityResolvers,
    );

    await endChallenge(db, challengeId);
    await finalizeChallenge(db, challengeId, instant('2026-07-01T00:00:00Z'));

    const app = buildTestApp({ [sub]: sub });
    const res = await getTimeline(app, sub, { challengeId });
    expect(res.statusCode).toBe(200);

    const types = res.body.items.map((i) => i.eventType);
    expect(types).toEqual([
      'challenge_finalized',
      'challenge_finalized',
      'activity_logged',
      'activity_logged',
      'challenge_created',
      'challenge_joined',
      'challenge_exited',
      'challenge_joined',
    ]);

    // Verify finalized result matches immutable challenge_participation_finals row
    const finalRow = await db.query<{
      completed: boolean;
      final_position: number | null;
      days_completed: number;
      best_streak: number;
      final_streak: number;
    }>(
      `SELECT completed, final_position, days_completed, best_streak, final_streak
         FROM challenge_participation_finals
        WHERE participation_id = $1`,
      [ep2Id],
    );
    const finalizedEp2 = res.body.items.find(
      (i) => i.eventType === 'challenge_finalized' && i.result?.participationId === ep2Id,
    );
    expect(finalizedEp2?.category).toBe('result');
    expect(finalizedEp2?.result?.completed).toBe(Boolean(finalRow.rows[0].completed));
    expect(finalizedEp2?.result?.finalPosition).toBe(
      finalRow.rows[0].final_position !== null ? Number(finalRow.rows[0].final_position) : null,
    );
    expect(finalizedEp2?.displayTimezone).toBe('Africa/Nairobi');

    // Verify activity_logged semantics (reversed retains original value, updated has new value)
    const reversed = res.body.items.find((i) => i.activity?.activityId === act2.event.event_id);
    expect(reversed?.activity?.revisionState).toBe('reversed');
    expect(reversed?.activity?.value).toBe(40);
    expect(reversed?.performedAt).toBe('2026-06-07T09:00:00.000Z');

    const updated = res.body.items.find((i) => i.activity?.activityId === act1.event.event_id);
    expect(updated?.activity?.revisionState).toBe('updated');
    expect(updated?.activity?.value).toBe(30);
    expect(updated?.performedAt).toBe('2026-06-05T09:00:00.000Z');

    // Verify ep1 exit
    const exited = res.body.items.find((i) => i.eventType === 'challenge_exited');
    expect(exited?.exit).toEqual({
      participationId: String(ep1.rows[0].participation_id),
      exitReason: 'withdrawn',
    });
  });

  it('orders deterministically at microsecond precision, paginates without duplicates/omissions, and validates cursors', async () => {
    const db = testDb();
    const sub = next('pager');
    const otherSub = next('other');
    const memberId = await seedMember(db, sub);
    const otherId = await seedMember(db, otherSub);

    // Create 5 groups with microsecond-close timestamps and one exact-timestamp tie (join + leave)
    const g1Res = await db.query<{ group_id: string }>(
      `INSERT INTO groups (name, original_creator_member_id, created_at)
       VALUES ('G1', $1, '2026-06-10T12:00:00.000001Z') RETURNING group_id`,
      [memberId],
    );
    const g2Res = await db.query<{ group_id: string }>(
      `INSERT INTO groups (name, original_creator_member_id, created_at)
       VALUES ('G2', $1, '2026-06-10T12:00:00.000002Z') RETURNING group_id`,
      [memberId],
    );
    const g1 = String(g1Res.rows[0].group_id);
    const g2 = String(g2Res.rows[0].group_id);
    const g3 = await seedGroup(db, { name: 'G3' });
    await db.query(
      `INSERT INTO group_memberships (group_id, member_id, role, status, joined_at, left_at)
       VALUES ($1, $2, 'member', 'left', '2026-06-10T12:00:00.000003Z', '2026-06-10T12:00:00.000003Z')`,
      [g3, memberId],
    );

    const app = buildTestApp({ [sub]: sub, [otherSub]: otherSub });

    // Full unpaginated baseline
    const full = await getTimeline(app, sub, { limit: 50 });
    expect(full.statusCode).toBe(200);
    expect(full.body.items.map((i) => i.eventType)).toEqual([
      'group_left',
      'group_joined',
      'group_created',
      'group_created',
    ]);
    expect(full.body.items[2].group?.id).toBe(g2);
    expect(full.body.items[3].group?.id).toBe(g1);

    // Paginate with limit=2 across all pages
    const page1 = await getTimeline(app, sub, { limit: 2 });
    expect(page1.statusCode).toBe(200);
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.nextCursor).toBeTruthy();

    const page2 = await getTimeline(app, sub, { limit: 2, cursor: page1.body.nextCursor! });
    expect(page2.statusCode).toBe(200);
    expect(page2.body.items).toHaveLength(2);
    expect(page2.body.nextCursor).toBeNull();

    const combinedIds = [...page1.body.items, ...page2.body.items].map((i) => i.timelineEventId);
    expect(combinedIds).toEqual(full.body.items.map((i) => i.timelineEventId));

    // Order-independent types filter works with cursor
    const filtered1 = await getTimeline(app, sub, { limit: 1, types: 'group_created,group_left' });
    expect(filtered1.statusCode).toBe(200);
    expect(filtered1.body.items[0].eventType).toBe('group_left');
    const filtered2 = await getTimeline(app, sub, {
      limit: 1,
      types: 'group_left,group_created',
      cursor: filtered1.body.nextCursor!,
    });
    expect(filtered2.statusCode).toBe(200);
    expect(filtered2.body.items[0].eventType).toBe('group_created');

    // Invalid cursors -> 400 invalid_cursor
    const crossAccount = await getTimeline(app, otherSub, { cursor: page1.body.nextCursor! });
    expect(crossAccount.statusCode).toBe(400);
    expect(crossAccount.body.error?.code).toBe('invalid_cursor');

    const filterMismatch = await getTimeline(app, sub, { types: 'group_created', cursor: page1.body.nextCursor! });
    expect(filterMismatch.statusCode).toBe(400);
    expect(filterMismatch.body.error?.code).toBe('invalid_cursor');

    const malformed = await getTimeline(app, sub, { cursor: 'not-valid-base64!!!' });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.body.error?.code).toBe('invalid_cursor');

    const nonCanonical = await getTimeline(app, sub, { cursor: `${page1.body.nextCursor!}=` });
    expect(nonCanonical.statusCode).toBe(400);
    expect(nonCanonical.body.error?.code).toBe('invalid_cursor');

    // Invalid limit / types -> 400
    expect((await getTimeline(app, sub, { limit: 0 })).statusCode).toBe(400);
    expect((await getTimeline(app, sub, { limit: 51 })).statusCode).toBe(400);
    expect((await getTimeline(app, sub, { types: 'unknown_type' })).statusCode).toBe(400);
  });

  it('redacts private Group and Challenge names/details and disables navigation when historic entity is inaccessible', async () => {
    const db = testDb();
    const stewardSub = next('priv-steward');
    const memberSub = next('priv-member');
    const stewardId = await seedMember(db, stewardSub);
    const memberId = await seedMember(db, memberSub);
    const { creationResolvers, activityResolvers } = await seedKnowledgePin();

    const privGroup = await createGovernedGroup(
      db,
      { memberId: stewardId, firebaseUid: stewardSub },
      { name: 'Secret Recovery Circle', isPrivate: true },
    );
    await joinGovernedGroup(db, { memberId, firebaseUid: memberId }, privGroup.id);
    await reviewPendingMembership(db, stewardId, privGroup.id, memberId, 'approve');

    const privChallenge = await createChallenge(
      db,
      {
        group_id: privGroup.id,
        created_by_member_id: stewardId,
        title: 'Secret Push-Up Challenge',
        start_date: '2026-06-01',
        end_date: '2026-06-30',
        challenge_type: 'competitive',
        activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' }],
      } as NewChallengeInput,
      creationResolvers,
    );
    const challengeId = privChallenge.challenge.challenge_id;
    await activateChallenge(db, challengeId);
    const ep = await db.query<{ participation_id: string }>(
      `INSERT INTO challenge_participations (challenge_id, member_id, status, joined_at, joined_config_version)
       VALUES ($1, $2, 'active', '2026-06-02T00:00:00Z', 1)
       RETURNING participation_id`,
      [challengeId, memberId],
    );
    const participationId = String(ep.rows[0].participation_id);
    const act = await applyChallengeActivity(
      db,
      memberId,
      challengeId,
      logInput({ value: 99, occurred_at: instant('2026-06-05T10:00:00Z') }),
      activityResolvers,
      { now: instant('2026-06-05T11:00:00Z') },
    );
    await endChallenge(db, challengeId);
    await finalizeChallenge(db, challengeId, instant('2026-07-01T00:00:00Z'));

    // Member leaves the private group -> loses access to private group & its private challenge
    await leaveGovernedGroup(db, { memberId, firebaseUid: memberId }, privGroup.id);

    // Also create an accessible public group so mixed accessible + redacted pagination is tested
    const pubGroup = await createGovernedGroup(
      db,
      { memberId, firebaseUid: memberId },
      { name: 'Public Runners', isPrivate: false },
    );

    const app = buildTestApp({ [memberSub]: memberSub });
    const res = await getTimeline(app, memberSub, { limit: 2 });
    expect(res.statusCode).toBe(200);
    expect(res.body.nextCursor).toBeTruthy();

    // Decode cursor and verify zero source UUID leakage in opaque cursor
    const decodedCursor = Buffer.from(res.body.nextCursor!, 'base64url').toString('utf8');
    expect(decodedCursor).not.toContain(privGroup.id);
    expect(decodedCursor).not.toContain(challengeId);
    expect(decodedCursor).not.toContain(participationId);
    expect(decodedCursor).not.toContain(act.event.event_id);
    expect(decodedCursor).not.toContain(pubGroup.id);

    // Traverse all pages and verify no duplicates or omissions with redacted items
    const allItems: PersonalTimelineItem[] = [...res.body.items];
    let cursor = res.body.nextCursor;
    while (cursor) {
      const nextPage = await getTimeline(app, memberSub, { limit: 2, cursor });
      expect(nextPage.statusCode).toBe(200);
      allItems.push(...nextPage.body.items);
      cursor = nextPage.body.nextCursor;
    }

    const full = await getTimeline(app, memberSub, { limit: 50 });
    expect(allItems).toEqual(full.body.items);

    const redactedItems = allItems.filter((i) => i.group?.id !== pubGroup.id);
    expect(redactedItems.length).toBeGreaterThanOrEqual(5);

    const serializedRedacted = JSON.stringify(redactedItems);
    expect(serializedRedacted).not.toContain('Secret Recovery Circle');
    expect(serializedRedacted).not.toContain('Secret Push-Up Challenge');
    expect(serializedRedacted).not.toContain(privGroup.id);
    expect(serializedRedacted).not.toContain(challengeId);
    expect(serializedRedacted).not.toContain(participationId);
    expect(serializedRedacted).not.toContain(act.event.event_id);
    expect(serializedRedacted).not.toContain('America/New_York');
    expect(serializedRedacted).not.toContain('Push-Up');
    expect(serializedRedacted).not.toContain('isPrivate');

    for (const item of redactedItems) {
      expect(item.timelineEventId).toMatch(new RegExp(`^redacted:${item.eventType}:[A-Za-z0-9_-]{22}$`));
      expect(item.performedAt).toBeNull();
      expect(item.displayTimezone).toBeNull();
      expect(item.navigation).toEqual({ kind: 'none', path: null, accessible: false });
      expect(item.group).toBeUndefined();
      expect(item.challenge).toBeUndefined();
      expect(item.activity).toBeUndefined();
      expect(item.exit).toBeUndefined();
      expect(item.result).toBeUndefined();
    }

    // Accessible public group retains full details and navigation
    const pubItem = allItems.find((i) => i.group?.id === pubGroup.id);
    expect(pubItem).toBeDefined();
    expect(pubItem?.group).toEqual({
      id: pubGroup.id,
      name: 'Public Runners',
      isPrivate: false,
      accessible: true,
    });
    expect(pubItem?.navigation).toEqual({
      kind: 'group',
      path: `/v2/groups/${pubGroup.id}`,
      accessible: true,
    });
  });

  it('rejects challengeId cursor-filter mismatches and supports removed participations and collective finalizations', async () => {
    const db = testDb();
    const stewardSub = next('col-steward');
    const memberSub = next('col-member');
    const stewardId = await seedMember(db, stewardSub);
    const memberId = await seedMember(db, memberSub);
    const group = await createGovernedGroup(
      db,
      { memberId: stewardId, firebaseUid: stewardSub },
      { name: 'Collective Crew', isPrivate: false },
    );
    await joinGovernedGroup(db, { memberId, firebaseUid: memberId }, group.id);
    const { creationResolvers, activityResolvers } = await seedKnowledgePin();

    const collective = await createChallenge(
      db,
      {
        group_id: group.id,
        created_by_member_id: stewardId,
        title: 'Team 50 Push-Ups',
        start_date: '2026-06-01',
        end_date: '2026-06-30',
        challenge_type: 'collective',
        goal_value: 50,
        goal_unit: 'reps',
        activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 10, unit: 'reps' }],
      } as NewChallengeInput,
      creationResolvers,
    );
    const challengeId = collective.challenge.challenge_id;
    await activateChallenge(db, challengeId);

    // Episode 1: removed by steward
    const ep1 = await db.query<{ participation_id: string }>(
      `INSERT INTO challenge_participations (challenge_id, member_id, status, joined_at, joined_config_version, exited_at, exit_reason, exited_by_member_id)
       VALUES ($1, $2, 'removed', '2026-06-02T08:00:00Z', 1, '2026-06-03T08:00:00Z', 'removed', $3)
       RETURNING participation_id`,
      [challengeId, memberId, stewardId],
    );
    // Episode 2: active + logged 60 reps -> exceeds collective goal 50
    await db.query(
      `INSERT INTO challenge_participations (challenge_id, member_id, status, joined_at, joined_config_version)
       VALUES ($1, $2, 'active', '2026-06-04T08:00:00Z', 1)`,
      [challengeId, memberId],
    );
    await applyChallengeActivity(
      db,
      memberId,
      challengeId,
      logInput({ value: 60, occurred_at: instant('2026-06-05T10:00:00Z') }),
      activityResolvers,
      { now: instant('2026-06-05T11:00:00Z') },
    );
    await endChallenge(db, challengeId);
    await finalizeChallenge(db, challengeId, instant('2026-07-01T00:00:00Z'));

    const app = buildTestApp({ [memberSub]: memberSub });
    const page1 = await getTimeline(app, memberSub, { limit: 1, challengeId });
    expect(page1.statusCode).toBe(200);
    expect(page1.body.nextCursor).toBeTruthy();

    // challengeId cursor-filter mismatch -> 400 invalid_cursor
    const mismatch = await getTimeline(app, memberSub, { limit: 1, cursor: page1.body.nextCursor! });
    expect(mismatch.statusCode).toBe(400);
    expect(mismatch.body.error?.code).toBe('invalid_cursor');

    const full = await getTimeline(app, memberSub, { limit: 50, challengeId });
    expect(full.statusCode).toBe(200);

    const removed = full.body.items.find((i) => i.eventType === 'challenge_exited');
    expect(removed?.label).toBe('Removed from Challenge');
    expect(removed?.exit).toEqual({
      participationId: String(ep1.rows[0].participation_id),
      exitReason: 'removed',
    });

    const finalized = full.body.items.find((i) => i.eventType === 'challenge_finalized');
    expect(finalized?.result?.goalValue).toBe(50);
    expect(finalized?.result?.goalUnit).toBe('reps');
    expect(finalized?.result?.collectiveTotal).toBe(60);
    expect(finalized?.result?.collectiveGoalReached).toBe(true);
  });

  it('never writes to public Feed tables and leaves GET /api/me/activity occurredAt-DESC compatibility untouched', async () => {
    const db = testDb();
    const sub = next('compat');
    const memberId = await seedMember(db, sub);
    const group = await createGovernedGroup(db, { memberId, firebaseUid: memberId }, { name: 'Compat Group', isPrivate: false });
    const { creationResolvers, activityResolvers } = await seedKnowledgePin();

    const created = await createChallenge(
      db,
      {
        group_id: group.id,
        created_by_member_id: memberId,
        title: 'Compat Challenge',
        start_date: '2026-06-01',
        end_date: '2026-06-30',
        challenge_type: 'collective',
        goal_value: 100,
        goal_unit: 'reps',
        activities: [{ canonical_key: 'push-up', metric: 'repetitions', target_value: 20, unit: 'reps' }],
      } as NewChallengeInput,
      creationResolvers,
    );
    const challengeId = created.challenge.challenge_id;
    await activateChallenge(db, challengeId);
    await db.query(
      `INSERT INTO challenge_participations (challenge_id, member_id, status, joined_at, joined_config_version)
       VALUES ($1, $2, 'active', '2026-06-01T00:00:00Z', 1)`,
      [challengeId, memberId],
    );

    // Log B first: performed June 09, recorded earlier
    const actB = await applyChallengeActivity(
      db,
      memberId,
      challengeId,
      logInput({ occurred_at: instant('2026-06-09T10:00:00Z') }),
      activityResolvers,
      { now: instant('2026-06-10T10:00:00Z') },
    );
    // Log A second: performed June 08, recorded later
    const actA = await applyChallengeActivity(
      db,
      memberId,
      challengeId,
      logInput({ occurred_at: instant('2026-06-08T10:00:00Z') }),
      activityResolvers,
      { now: instant('2026-06-12T10:00:00Z') },
    );

    const outboxBefore = await db.query<{ count: string }>('SELECT count(*) FROM group_feed_outbox');
    const projBefore = await db.query<{ count: string }>('SELECT count(*) FROM group_feed_projection');
    const shareBefore = await db.query<{ count: string }>('SELECT count(*) FROM challenge_feed_shares');

    const app = buildTestApp({ [sub]: sub });

    const timeline = await getTimeline(app, sub, { types: 'activity_logged' });
    expect(timeline.statusCode).toBe(200);
    expect(timeline.body.items.map((i) => i.activity?.activityId)).toEqual([
      actA.event.event_id, // newest recordedAt first
      actB.event.event_id,
    ]);

    const legacyActivityRes = await app.inject({
      method: 'GET',
      url: '/api/me/activity',
      headers: authHeaders(sub),
    });
    expect(legacyActivityRes.statusCode).toBe(200);
    const legacyItems = (legacyActivityRes.json() as { items: Array<{ activityId: string }> }).items;
    expect(legacyItems.map((i) => i.activityId)).toEqual([
      actB.event.event_id, // newest occurredAt first (unchanged!)
      actA.event.event_id,
    ]);

    // Zero public Feed writes from timeline/activity reads
    const outboxAfter = await db.query<{ count: string }>('SELECT count(*) FROM group_feed_outbox');
    const projAfter = await db.query<{ count: string }>('SELECT count(*) FROM group_feed_projection');
    const shareAfter = await db.query<{ count: string }>('SELECT count(*) FROM challenge_feed_shares');
    expect(Number(outboxAfter.rows[0].count)).toBe(Number(outboxBefore.rows[0].count));
    expect(Number(projAfter.rows[0].count)).toBe(Number(projBefore.rows[0].count));
    expect(Number(shareAfter.rows[0].count)).toBe(Number(shareBefore.rows[0].count));
  });
});
