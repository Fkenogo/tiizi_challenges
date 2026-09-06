import { describe, expect, it } from 'vitest';
import { seedGroup, seedMember, seedMembership, testDb } from './helpers.js';

async function rejectsWithUniqueViolation(fn: () => Promise<unknown>): Promise<void> {
  await expect(fn()).rejects.toMatchObject({ code: '23505' });
}

describe('Phase A relational constraints', () => {
  it('prevents duplicate auth identities', async () => {
    const db = testDb();
    await seedMember(db, 'dup-uid');
    await rejectsWithUniqueViolation(() => seedMember(db, 'dup-uid'));
  });

  it('prevents duplicate memberships for the same group and member', async () => {
    const db = testDb();
    const memberId = await seedMember(db, 'uid-x');
    const groupId = await seedGroup(db, { name: 'Dupes' });
    await seedMembership(db, groupId, memberId);
    await rejectsWithUniqueViolation(() => seedMembership(db, groupId, memberId));
  });

  it('enforces foreign keys on memberships', async () => {
    const db = testDb();
    const memberId = await seedMember(db, 'uid-fk');
    const groupId = await seedGroup(db, { name: 'FK group' });
    await expect(
      seedMembership(db, '00000000-0000-0000-0000-000000000000', memberId),
    ).rejects.toMatchObject({ code: '23503' });
    await expect(
      seedMembership(db, groupId, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('rejects invalid roles and statuses', async () => {
    const db = testDb();
    const memberId = await seedMember(db, 'uid-ck');
    const groupId = await seedGroup(db, { name: 'Checks' });
    await expect(
      seedMembership(db, groupId, memberId, { role: 'superuser' }),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      seedMembership(db, groupId, memberId, { status: 'banned' }),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
