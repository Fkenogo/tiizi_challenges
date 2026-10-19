import { describe, expect, it } from 'vitest';
import { seedMember, testDb } from './helpers.js';
import {
  getMemberProfileIdentity,
  updateOwnDisplayName,
  InvalidProfileMutationError,
  UnauthenticatedProfileMutationError,
} from '../src/memberProfileIdentity.js';

describe('internal member Profile identity and display-name mutation', () => {
  it('resolves only the canonical member mapped to verified auth identity', async () => {
    const id = await seedMember(testDb(), 'verified-uid');
    await seedMember(testDb(), 'other-uid');
    expect(await getMemberProfileIdentity(testDb(), { provider: 'firebase', subject: 'verified-uid' }))
      .toEqual({ memberId: id, displayName: null });
    await expect(getMemberProfileIdentity(testDb(), { provider: 'firebase', subject: 'unknown' }))
      .rejects.toMatchObject({ code: 'unknown_member', statusCode: 401 });
  });

  it('requires authenticated canonical member context for mutation', async () => {
    await expect(updateOwnDisplayName(testDb(), null, { displayName: 'Name' }))
      .rejects.toBeInstanceOf(UnauthenticatedProfileMutationError);
    await expect(updateOwnDisplayName(testDb(), { memberId: '00000000-0000-4000-8000-000000000000' }, { displayName: 'Name' }))
      .rejects.toMatchObject({ code: 'unknown_member', statusCode: 401 });
  });

  it('rejects non-display-name, invalid, and cross-member mutation shapes', async () => {
    const id = await seedMember(testDb(), 'self');
    const otherId = await seedMember(testDb(), 'other');
    for (const input of [null, {}, { displayName: 'Name', email: 'x@y.z' },
      { memberId: otherId, displayName: 'Name' }]) {
      await expect(updateOwnDisplayName(testDb(), { memberId: id }, input))
        .rejects.toBeInstanceOf(InvalidProfileMutationError);
    }
    for (const displayName of ['', '   ', null, 'x'.repeat(121), 'bad\nname']) {
      await expect(updateOwnDisplayName(testDb(), { memberId: id }, { displayName }))
        .rejects.toMatchObject({ code: 'invalid_display_name', statusCode: 400 });
    }
  });

  it('normalizes, updates timestamp, and appends exactly one immutable history event', async () => {
    const id = await seedMember(testDb(), 'name-change');
    const before = await testDb().query<{ updated_at: Date }>('SELECT updated_at FROM members WHERE member_id = $1', [id]);
    const result = await updateOwnDisplayName(testDb(), { memberId: id }, { displayName: '  Cafe\u0301  ' });
    expect(result.displayName).toBe('Café');
    const member = await testDb().query<{ display_name: string; updated_at: Date }>('SELECT display_name, updated_at FROM members WHERE member_id = $1', [id]);
    expect(member.rows[0].display_name).toBe('Café');
    expect(new Date(member.rows[0].updated_at).getTime()).toBeGreaterThan(new Date(before.rows[0].updated_at).getTime());
    const events = await testDb().query<{ old_display_name: string | null; new_display_name: string; source: string }>(
      'SELECT old_display_name, new_display_name, source FROM member_display_name_history WHERE member_id = $1 ORDER BY history_id', [id]);
    expect(events.rows).toEqual([{ old_display_name: null, new_display_name: 'Café', source: 'profile_self_edit' }]);
    await expect(testDb().query('UPDATE member_display_name_history SET new_display_name = $1 WHERE member_id = $2', ['Tampered', id]))
      .rejects.toThrow();
  });

  it('treats a repeated normalized value as a no-op without history or timestamp change', async () => {
    const id = await seedMember(testDb(), 'no-op');
    await updateOwnDisplayName(testDb(), { memberId: id }, { displayName: 'Name' });
    const before = await testDb().query<{ updated_at: Date }>('SELECT updated_at FROM members WHERE member_id = $1', [id]);
    await updateOwnDisplayName(testDb(), { memberId: id }, { displayName: ' Name ' });
    const after = await testDb().query<{ updated_at: Date }>('SELECT updated_at FROM members WHERE member_id = $1', [id]);
    const count = await testDb().query<{ count: number }>('SELECT count(*) FROM member_display_name_history WHERE member_id = $1', [id]);
    expect(new Date(after.rows[0].updated_at).getTime()).toBe(new Date(before.rows[0].updated_at).getTime());
    expect(count.rows[0].count).toBe(1);
  });

  it('serializes concurrent updates and preserves event order', async () => {
    const id = await seedMember(testDb(), 'concurrent');
    await Promise.all([
      updateOwnDisplayName(testDb(), { memberId: id }, { displayName: 'First' }),
      updateOwnDisplayName(testDb(), { memberId: id }, { displayName: 'Second' }),
    ]);
    const rows = await testDb().query<{ old_display_name: string | null; new_display_name: string }>(
      'SELECT old_display_name, new_display_name FROM member_display_name_history WHERE member_id = $1 ORDER BY history_id', [id]);
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows[0].old_display_name).toBeNull();
    expect(rows.rows[1].old_display_name).toBe(rows.rows[0].new_display_name);
    const current = await testDb().query<{ display_name: string }>('SELECT display_name FROM members WHERE member_id = $1', [id]);
    expect(current.rows[0].display_name).toBe(rows.rows[1].new_display_name);
  });

  it('rolls back member update and history together when the append fails', async () => {
    const id = await seedMember(testDb(), 'rollback');
    await testDb().query(`CREATE FUNCTION reject_profile_member_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.display_name IS DISTINCT FROM OLD.display_name THEN RAISE EXCEPTION 'forced member update failure'; END IF; RETURN NEW; END $$`);
    await testDb().query(`CREATE TRIGGER reject_profile_member_update BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION reject_profile_member_update()`);
    await expect(updateOwnDisplayName(testDb(), { memberId: id }, { displayName: 'Name' })).rejects.toThrow('forced member update failure');
    const member = await testDb().query<{ display_name: string | null }>('SELECT display_name FROM members WHERE member_id = $1', [id]);
    const count = await testDb().query<{ count: number }>('SELECT count(*) FROM member_display_name_history WHERE member_id = $1', [id]);
    expect(member.rows[0].display_name).toBeNull();
    expect(count.rows[0].count).toBe(0);
    await testDb().query('DROP TRIGGER reject_profile_member_update ON members');
    await testDb().query('DROP FUNCTION reject_profile_member_update()');
  });
});
