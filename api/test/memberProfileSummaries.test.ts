import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import {
  classifyChallengeParticipation,
  getMemberProfileSummaries,
  listMemberChallengeSummaries,
  listMemberGroupSummaries,
  parseSummaryLimit,
  PROFILE_SUMMARY_PAGE_DEFAULT,
  PROFILE_SUMMARY_PAGE_MAX,
  type MemberChallengeSummaryItem,
  type ParticipationStatus,
} from '../src/memberProfileSummaries.js';
import { seedGroup, seedMember, seedMembership, testDb } from './helpers.js';

let seq = 0;

async function newMember(prefix = 'summary'): Promise<string> {
  return seedMember(testDb(), `${prefix}-${++seq}`);
}

async function newGroup(name = 'Group'): Promise<string> {
  return seedGroup(testDb(), { name });
}

async function newChallenge(
  groupId: string,
  creatorId: string,
  options: {
    title?: string;
    status?: 'establishment' | 'active' | 'ended';
    finalizedAt?: Date | null;
  } = {},
): Promise<string> {
  const result = await testDb().query<{ challenge_id: string }>(
    `INSERT INTO challenges
       (group_id, created_by_member_id, challenge_type, status, title,
        start_date, end_date, finalized_at)
     VALUES ($1, $2, 'competitive', $3, $4, '2026-01-01', '2026-12-31', $5)
     RETURNING challenge_id`,
    [
      groupId,
      creatorId,
      options.status ?? 'active',
      options.title ?? 'Challenge',
      options.finalizedAt ?? null,
    ],
  );
  return String(result.rows[0].challenge_id);
}

async function newParticipation(
  challengeId: string,
  memberId: string,
  options: {
    status?: ParticipationStatus;
    joinedAt?: Date;
    exitedAt?: Date;
  } = {},
): Promise<string> {
  const status = options.status ?? 'active';
  const exited = status === 'active' ? null : options.exitedAt ?? new Date('2026-05-02T09:00:00.000Z');
  const result = await testDb().query<{ participation_id: string }>(
    `INSERT INTO challenge_participations
       (challenge_id, member_id, status, joined_at, joined_config_version,
        exited_at, exit_reason)
     VALUES ($1, $2, $3, $4, 1, $5, $6)
     RETURNING participation_id`,
    [
      challengeId,
      memberId,
      status,
      options.joinedAt ?? new Date('2026-05-01T09:00:00.000Z'),
      exited,
      status === 'active' ? null : status,
    ],
  );
  return String(result.rows[0].participation_id);
}

async function allChallengePages(
  memberId: string,
  limit: number,
): Promise<{ pages: Awaited<ReturnType<typeof listMemberChallengeSummaries>>[]; items: MemberChallengeSummaryItem[] }> {
  const pages: Awaited<ReturnType<typeof listMemberChallengeSummaries>>[] = [];
  const items: MemberChallengeSummaryItem[] = [];
  let cursor: string | undefined;
  do {
    const page = await listMemberChallengeSummaries(testDb(), { memberId }, { limit, cursor });
    pages.push(page);
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return { pages, items };
}

async function allGroupPages(memberId: string, limit: number) {
  const pages: Awaited<ReturnType<typeof listMemberGroupSummaries>>[] = [];
  const items: Awaited<ReturnType<typeof listMemberGroupSummaries>>['items'] = [];
  let cursor: string | undefined;
  do {
    const page = await listMemberGroupSummaries(testDb(), { memberId }, { limit, cursor });
    pages.push(page);
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return { pages, items };
}

function decodeCursor(cursor: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Record<string, unknown>;
}

function encodeCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

describe('member-owned Group summaries', () => {
  it('returns only governed current memberships and preserves role and private visibility', async () => {
    const memberId = await newMember('groups-self');
    const otherMemberId = await newMember('groups-other');

    const activeGroup = await newGroup('Active private group');
    await testDb().query('UPDATE groups SET is_private = true WHERE group_id = $1', [activeGroup]);
    await seedMembership(testDb(), activeGroup, memberId, { role: 'owner', status: 'active' });

    const joinedGroup = await newGroup('Joined group');
    await seedMembership(testDb(), joinedGroup, memberId, { role: 'admin', status: 'joined' });

    for (const status of ['pending', 'rejected', 'left'] as const) {
      const groupId = await newGroup(`Excluded ${status} group`);
      await seedMembership(testDb(), groupId, memberId, { status });
    }

    const otherGroup = await newGroup('Other member group');
    await seedMembership(testDb(), otherGroup, otherMemberId, { status: 'active' });

    const page = await listMemberGroupSummaries(testDb(), { memberId });
    expect(page.count).toBe(2);
    expect(page.items.map((item) => item.groupId).sort()).toEqual([activeGroup, joinedGroup].sort());
    expect(page.items.find((item) => item.groupId === activeGroup)).toMatchObject({
      name: 'Active private group',
      role: 'owner',
      status: 'active',
    });
    expect(page.items.find((item) => item.groupId === joinedGroup)).toMatchObject({
      role: 'admin',
      status: 'joined',
    });
  });

  it('counts the complete qualifying set independently of the page and continues deterministically', async () => {
    const memberId = await newMember('groups-page');
    const groupIds: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const groupId = await newGroup(`Paged group ${i}`);
      await seedMembership(testDb(), groupId, memberId, { status: 'active' });
      groupIds.push(groupId);
    }
    const { pages, items } = await allGroupPages(memberId, 2);
    expect(pages.map((page) => page.count)).toEqual([3, 3]);
    expect(items).toHaveLength(3);
    expect(new Set(items.map((item) => item.groupId))).toEqual(new Set(groupIds));
    expect(pages[0].nextCursor).not.toBeNull();
    expect(pages[1].nextCursor).toBeNull();
  });

  it('orders equal join timestamps by groupId descending with no duplicates or skips', async () => {
    const memberId = await newMember('groups-tie');
    const groupIds: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const groupId = await newGroup(`Tie group ${i}`);
      await seedMembership(testDb(), groupId, memberId, { status: 'active' });
      groupIds.push(groupId);
    }
    await testDb().query(
      'UPDATE group_memberships SET joined_at = $2 WHERE member_id = $1',
      [memberId, new Date('2026-05-01T09:00:00.000Z')],
    );
    const { items } = await allGroupPages(memberId, 2);
    expect(items.map((item) => item.groupId)).toEqual([...groupIds].sort().reverse());
  });

  it('rejects a Challenge cursor used against the Group summary', async () => {
    const memberId = await newMember('groups-type');
    for (let i = 0; i < 2; i += 1) {
      const groupId = await newGroup(`Type group ${i}`);
      await seedMembership(testDb(), groupId, memberId, { status: 'active' });
    }
    const groupPage = await listMemberGroupSummaries(testDb(), { memberId }, { limit: 1 });
    expect(groupPage.nextCursor).not.toBeNull();

    const groupId = await newGroup('Challenge cursor source');
    const creatorId = await newMember('groups-type-creator');
    for (let i = 0; i < 2; i += 1) {
      const challengeId = await newChallenge(groupId, creatorId, { title: `Challenge cursor ${i}` });
      await newParticipation(challengeId, memberId, {
        joinedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
      });
    }
    const challengePage = await listMemberChallengeSummaries(testDb(), { memberId }, { limit: 1 });
    expect(challengePage.nextCursor).not.toBeNull();

    await expect(listMemberChallengeSummaries(testDb(), { memberId }, {
      limit: 1,
      cursor: groupPage.nextCursor,
    })).rejects.toMatchObject({ code: 'invalid_cursor', statusCode: 400 });
    await expect(listMemberGroupSummaries(testDb(), { memberId }, {
      limit: 1,
      cursor: challengePage.nextCursor,
    })).rejects.toMatchObject({ code: 'invalid_cursor', statusCode: 400 });
  });
});

describe('member-owned Challenge participation summaries', () => {
  it('returns only actual episodes and excludes visible-but-unjoined Challenges', async () => {
    const memberId = await newMember('challenge-episode');
    const otherMemberId = await newMember('challenge-other');
    const groupId = await newGroup('Episode group');
    await seedMembership(testDb(), groupId, memberId, { status: 'active' });
    const creatorId = await newMember('challenge-creator');

    const joinedChallenge = await newChallenge(groupId, creatorId, { title: 'Joined challenge' });
    const visibleOnly = await newChallenge(groupId, creatorId, { title: 'Visible but unjoined' });
    const otherChallenge = await newChallenge(groupId, creatorId, { title: 'Other member challenge' });
    const participationId = await newParticipation(joinedChallenge, memberId);
    await newParticipation(otherChallenge, otherMemberId);

    const page = await listMemberChallengeSummaries(testDb(), { memberId });
    expect(page.totalCount).toBe(1);
    expect(page.items).toEqual([expect.objectContaining({
      challengeId: joinedChallenge,
      participationId,
      title: 'Joined challenge',
      bucket: 'active',
    })]);
    const ids = page.items.map((item) => item.challengeId);
    expect(ids).not.toContain(visibleOnly);
    expect(ids).not.toContain(otherChallenge);
  });

  it('keeps withdrawal and rejoin as distinct episodes with distinct participation identities', async () => {
    const memberId = await newMember('challenge-rejoin');
    const creatorId = await newMember('challenge-rejoin-creator');
    const groupId = await newGroup('Rejoin group');
    const challengeId = await newChallenge(groupId, creatorId, { title: 'Rejoin challenge' });

    const withdrawnId = await newParticipation(challengeId, memberId, {
      status: 'withdrawn',
      joinedAt: new Date('2026-05-01T09:00:00.000Z'),
      exitedAt: new Date('2026-05-02T09:00:00.000Z'),
    });
    const rejoinedId = await newParticipation(challengeId, memberId, {
      status: 'active',
      joinedAt: new Date('2026-05-03T09:00:00.000Z'),
    });

    const page = await listMemberChallengeSummaries(testDb(), { memberId });
    expect(page).toMatchObject({ activeCount: 1, historyCount: 1, totalCount: 2 });
    expect(page.items.map((item) => item.participationId)).toEqual([rejoinedId, withdrawnId]);
    expect(new Set(page.items.map((item) => item.participationId)).size).toBe(2);
    expect(page.items.map((item) => item.bucket)).toEqual(['active', 'history']);
    expect(page.items.every((item) => item.challengeId === challengeId)).toBe(true);
  });

  it('applies the approved disjoint active/history predicates', async () => {
    const memberId = await newMember('challenge-buckets');
    const creatorId = await newMember('challenge-buckets-creator');
    const groupId = await newGroup('Bucket group');

    const activeUnfinalized = await newChallenge(groupId, creatorId, { title: 'Active unfinalized' });
    await newParticipation(activeUnfinalized, memberId);

    const endedUnfinalized = await newChallenge(groupId, creatorId, {
      title: 'Ended but unfinalized',
      status: 'ended',
    });
    await newParticipation(endedUnfinalized, memberId);

    const finalizedActiveRow = await newChallenge(groupId, creatorId, {
      title: 'Finalized with preserved active row',
      status: 'ended',
      finalizedAt: new Date('2026-06-01T09:00:00.000Z'),
    });
    await newParticipation(finalizedActiveRow, memberId);

    const withdrawn = await newChallenge(groupId, creatorId, { title: 'Withdrawn' });
    await newParticipation(withdrawn, memberId, { status: 'withdrawn' });

    const removed = await newChallenge(groupId, creatorId, { title: 'Removed' });
    await newParticipation(removed, memberId, { status: 'removed' });

    const page = await listMemberChallengeSummaries(testDb(), { memberId });
    expect(page).toMatchObject({ activeCount: 2, historyCount: 3, totalCount: 5 });
    const byChallenge = new Map(page.items.map((item) => [item.challengeId, item]));
    expect(byChallenge.get(activeUnfinalized)?.bucket).toBe('active');
    expect(byChallenge.get(endedUnfinalized)?.bucket).toBe('active');
    expect(byChallenge.get(finalizedActiveRow)?.bucket).toBe('history');
    expect(byChallenge.get(finalizedActiveRow)?.status).toBe('active');
    expect(byChallenge.get(withdrawn)?.bucket).toBe('history');
    expect(byChallenge.get(removed)?.bucket).toBe('history');
  });

  it('keeps counts over the complete set on every page', async () => {
    const memberId = await newMember('challenge-counts');
    const creatorId = await newMember('challenge-counts-creator');
    const groupId = await newGroup('Counts group');
    for (let i = 0; i < 3; i += 1) {
      const challengeId = await newChallenge(groupId, creatorId, { title: `Active ${i}` });
      await newParticipation(challengeId, memberId);
    }
    for (let i = 0; i < 4; i += 1) {
      const challengeId = await newChallenge(groupId, creatorId, { title: `History ${i}` });
      await newParticipation(challengeId, memberId, {
        status: 'withdrawn',
        joinedAt: new Date(`2026-04-0${i + 1}T09:00:00.000Z`),
      });
    }

    const { pages, items } = await allChallengePages(memberId, 2);
    expect(pages).toHaveLength(4);
    for (const page of pages) {
      expect(page).toMatchObject({ activeCount: 3, historyCount: 4, totalCount: 7 });
    }
    expect(items).toHaveLength(7);
    expect(items.filter((item) => item.bucket === 'active')).toHaveLength(3);
    expect(items.filter((item) => item.bucket === 'history')).toHaveLength(4);
  });

  it('uses the default page size of 20 and the maximum of 50', async () => {
    const memberId = await newMember('challenge-limits');
    const creatorId = await newMember('challenge-limits-creator');
    const groupId = await newGroup('Limits group');
    for (let i = 0; i < PROFILE_SUMMARY_PAGE_MAX + 1; i += 1) {
      const challengeId = await newChallenge(groupId, creatorId, { title: `Page ${i}` });
      await newParticipation(challengeId, memberId, {
        joinedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
      });
    }

    const defaultPage = await listMemberChallengeSummaries(testDb(), { memberId });
    expect(defaultPage.items).toHaveLength(PROFILE_SUMMARY_PAGE_DEFAULT);
    expect(defaultPage.totalCount).toBe(PROFILE_SUMMARY_PAGE_MAX + 1);
    expect(defaultPage.nextCursor).not.toBeNull();

    const maxPage = await listMemberChallengeSummaries(testDb(), { memberId }, { limit: PROFILE_SUMMARY_PAGE_MAX });
    expect(maxPage.items).toHaveLength(PROFILE_SUMMARY_PAGE_MAX);
    expect(maxPage.nextCursor).not.toBeNull();

    const tail = await listMemberChallengeSummaries(testDb(), { memberId }, {
      limit: PROFILE_SUMMARY_PAGE_MAX,
      cursor: maxPage.nextCursor,
    });
    expect(tail.items).toHaveLength(1);
    expect(tail.nextCursor).toBeNull();
  });

  it.each([0, 51, -1, 1.5, '1.5', 'abc', '', null, {}, []])(
    'rejects invalid limit %p',
    async (limit) => {
      const memberId = await newMember('challenge-invalid-limit');
      await expect(listMemberChallengeSummaries(testDb(), { memberId }, { limit }))
        .rejects.toMatchObject({ code: 'invalid_limit', statusCode: 400 });
    },
  );

  it('validates cursor structure, version, ordering, member scope and page size', async () => {
    const memberId = await newMember('cursor-structure');
    const otherMemberId = await newMember('cursor-other');
    const creatorId = await newMember('cursor-creator');
    const groupId = await newGroup('Cursor group');
    for (let i = 0; i < 2; i += 1) {
      const challengeId = await newChallenge(groupId, creatorId, { title: `Cursor ${i}` });
      await newParticipation(challengeId, memberId, {
        joinedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
      });
    }
    const first = await listMemberChallengeSummaries(testDb(), { memberId }, { limit: 1 });
    expect(first.nextCursor).not.toBeNull();
    const original = decodeCursor(first.nextCursor as string);

    const malformed = [
      'not-base64url!!',
      Buffer.from('not json', 'utf8').toString('base64url'),
      encodeCursor({ ...original, v: 2 }),
      encodeCursor({ ...original, type: 'groups' }),
      encodeCursor({ ...original, memberId: otherMemberId }),
      encodeCursor({ ...original, limit: 2 }),
      encodeCursor({ ...original, ordering: 'joined_at_desc_group_id_desc' }),
      encodeCursor({ ...original, id: 'not-a-uuid' }),
      encodeCursor({ ...original, joinedAt: 'not-a-date' }),
      'A'.repeat(2049),
    ];
    for (const cursor of malformed) {
      await expect(listMemberChallengeSummaries(testDb(), { memberId }, { limit: 1, cursor }))
        .rejects.toMatchObject({ code: 'invalid_cursor', statusCode: 400 });
    }
  });

  it('cannot widen authorization through a forged continuation token', async () => {
    const memberId = await newMember('cursor-self');
    const otherMemberId = await newMember('cursor-victim');
    const creatorId = await newMember('cursor-boundary-creator');
    const groupId = await newGroup('Cursor boundary group');
    const ownChallenge = await newChallenge(groupId, creatorId, { title: 'Own' });
    const ownParticipation = await newParticipation(ownChallenge, memberId);
    const otherChallenge = await newChallenge(groupId, creatorId, { title: 'Other' });
    const otherParticipation = await newParticipation(otherChallenge, otherMemberId);

    const forged = encodeCursor({
      v: 1,
      type: 'challenges',
      memberId,
      limit: 20,
      ordering: 'joined_at_desc_participation_id_desc',
      joinedAt: '2099-01-01T00:00:00.000Z',
      id: '00000000-0000-4000-8000-000000000000',
    });
    const page = await listMemberChallengeSummaries(testDb(), { memberId }, { cursor: forged });
    expect(page.items).toEqual([expect.objectContaining({
      challengeId: ownChallenge,
      participationId: ownParticipation,
    })]);
    expect(page.items.map((item) => item.participationId)).not.toContain(otherParticipation);
    expect(page.items.map((item) => item.challengeId)).not.toContain(otherChallenge);
  });

  it('continues deterministically across equal timestamps without duplicates or skips', async () => {
    const memberId = await newMember('cursor-tie');
    const creatorId = await newMember('cursor-tie-creator');
    const groupId = await newGroup('Cursor tie group');
    const joinedAt = new Date('2026-05-01T09:00:00.000Z');
    for (let i = 0; i < 4; i += 1) {
      const challengeId = await newChallenge(groupId, creatorId, { title: `Tie ${i}` });
      await newParticipation(challengeId, memberId, { joinedAt });
    }

    const { pages, items } = await allChallengePages(memberId, 2);
    expect(pages.every((page) => page.totalCount === 4)).toBe(true);
    expect(items).toHaveLength(4);
    expect(new Set(items.map((item) => item.participationId)).size).toBe(4);

    const expected = await testDb().query<{ participation_id: string }>(
      `SELECT participation_id FROM challenge_participations
       WHERE member_id = $1
       ORDER BY joined_at DESC, participation_id DESC`,
      [memberId],
    );
    expect(items.map((item) => item.participationId)).toEqual(
      expected.rows.map((row) => String(row.participation_id)),
    );
  });

  it('treats only the schema statuses as classifiable and never invents history', async () => {
    expect(classifyChallengeParticipation('active', false)).toBe('active');
    expect(classifyChallengeParticipation('active', true)).toBe('history');
    expect(classifyChallengeParticipation('withdrawn', false)).toBe('history');
    expect(classifyChallengeParticipation('removed', true)).toBe('history');
    let unsupported: unknown;
    try {
      classifyChallengeParticipation('completed' as never, false);
    } catch (error) {
      unsupported = error;
    }
    expect(unsupported).toMatchObject({ code: 'summary_unavailable', statusCode: 500 });

    const memberId = await newMember('status-schema');
    const creatorId = await newMember('status-schema-creator');
    const groupId = await newGroup('Status group');
    const challengeId = await newChallenge(groupId, creatorId);
    const constraint = await testDb().query<{ definition: string }>(
      `SELECT pg_get_constraintdef(oid) AS definition
       FROM pg_constraint WHERE conname = 'challenge_participations_status_check'`,
    );
    expect(constraint.rows).toHaveLength(1);
    expect(constraint.rows[0].definition).toContain("'active'");
    expect(constraint.rows[0].definition).toContain("'withdrawn'");
    expect(constraint.rows[0].definition).toContain("'removed'");
    expect(constraint.rows[0].definition).not.toContain('completed');
    await expect(testDb().query(
      `INSERT INTO challenge_participations
         (challenge_id, member_id, status, joined_config_version, exited_at, exit_reason)
       VALUES ($1, $2, 'completed', 1, now(), 'withdrawn')`,
      [challengeId, memberId],
    )).rejects.toThrow(/check constraint/);
  });

  it('combines both summaries for the authenticated member', async () => {
    const memberId = await newMember('combined-self');
    const otherMemberId = await newMember('combined-other');
    const creatorId = await newMember('combined-creator');
    const groupId = await newGroup('Combined group');
    await seedMembership(testDb(), groupId, memberId, { role: 'member', status: 'active' });
    const challengeId = await newChallenge(groupId, creatorId, { title: 'Combined challenge' });
    const participationId = await newParticipation(challengeId, memberId);
    const otherGroup = await newGroup('Combined other group');
    await seedMembership(testDb(), otherGroup, otherMemberId, { status: 'active' });

    const summaries = await getMemberProfileSummaries(testDb(), { memberId });
    expect(summaries.memberId).toBe(memberId);
    expect(summaries.groups.count).toBe(1);
    expect(summaries.groups.items[0].groupId).toBe(groupId);
    expect(summaries.challenges).toMatchObject({ activeCount: 1, historyCount: 0, totalCount: 1 });
    expect(summaries.challenges.items[0]).toMatchObject({ challengeId, participationId });
  });
});

describe('member Profile summary authentication boundary', () => {
  it('requires authenticated member context for both summaries', async () => {
    await expect(listMemberGroupSummaries(testDb(), null))
      .rejects.toMatchObject({ code: 'missing_token', statusCode: 401 });
    await expect(listMemberChallengeSummaries(testDb(), null))
      .rejects.toMatchObject({ code: 'missing_token', statusCode: 401 });
    await expect(getMemberProfileSummaries(testDb(), null))
      .rejects.toMatchObject({ code: 'missing_token', statusCode: 401 });
  });

  it('exposes the supported limit bounds', async () => {
    expect(PROFILE_SUMMARY_PAGE_DEFAULT).toBe(20);
    expect(PROFILE_SUMMARY_PAGE_MAX).toBe(50);
    expect(parseSummaryLimit(undefined)).toBe(20);
    expect(parseSummaryLimit('50')).toBe(50);
    const memberId = await newMember('limit-bounds');
    await expect(listMemberGroupSummaries(testDb(), { memberId }, { limit: 51 }))
      .rejects.toMatchObject({ code: 'invalid_limit', statusCode: 400 });
  });
});
