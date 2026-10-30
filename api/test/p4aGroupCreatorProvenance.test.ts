/**
 * TIIZI-FER-P4A-001 — original Group creator provenance.
 *
 * The member who ESTABLISHED a Group is recorded going forward, independently of
 * the current Steward, immutable once recorded, never backfilled without
 * independent proof (none exists, so legacy Groups stay NULL), and shown only to
 * viewers who are active members of the Group, as the governed display name.
 */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { listMigrationFiles, splitStatements } from '../src/migrate.js';
import { authHeaders, buildTestApp, seedMember, seedMembership, testDb } from './helpers.js';
import type { Db } from '../src/db.js';

const subject = async (db: Db, memberId: string) => (await db.query<{ auth_subject: string }>('SELECT auth_subject FROM members WHERE member_id=$1', [memberId])).rows[0].auth_subject;
const setName = (db: Db, memberId: string, name: string | null) => db.query('UPDATE members SET display_name = $2 WHERE member_id = $1', [memberId, name]);
const LEAK = /email|phone|@|firebase|auth_subject|authSubject/i;
const creatorOf = async (db: Db, groupId: string) => (await db.query<{ c: string | null }>('SELECT original_creator_member_id AS c FROM groups WHERE group_id=$1', [groupId])).rows[0].c;
const stewardOf = async (db: Db, groupId: string) => (await db.query<{ s: string | null }>('SELECT steward_member_id AS s FROM groups WHERE group_id=$1', [groupId])).rows[0].s;

/** Controlled disposable fixture (NOT a product feature): hand the Steward role to another active member, atomically. */
async function transferStewardFixture(db: Db, groupId: string, from: string, to: string) {
  await db.transaction(async (tx) => {
    await tx.query(`UPDATE group_memberships SET role='admin' WHERE group_id=$1 AND member_id=$2`, [groupId, from]);
    await tx.query(`UPDATE group_memberships SET role='owner' WHERE group_id=$1 AND member_id=$2`, [groupId, to]);
    await tx.query(`UPDATE groups SET steward_member_id=$2 WHERE group_id=$1`, [groupId, to]);
  });
}

describe('P4a migration 029 against a disposable database with representative legacy records', () => {
  it('adds the nullable column, never backfills, and leaves Steward and membership untouched', async () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
    const files = (await listMigrationFiles());
    const target = files.find((f) => f.startsWith('029_'));
    expect(target).toBe('029_group_original_creator.sql');
    const pg = new PGlite({ extensions: { pgcrypto } });
    const apply = async (file: string) => { for (const statement of splitStatements(await readFile(join(dir, file), 'utf8'))) await pg.query(statement); };
    for (const file of files.filter((f) => f < '029_')) await apply(file);
    // Representative legacy records at schema 028: Steward = owner membership, mirrored/legacy ids, an orphan-ish Group.
    const m = async (subject: string) => (await pg.query<{ member_id: string }>(`INSERT INTO members (auth_provider, auth_subject) VALUES ('firebase',$1) RETURNING member_id`, [subject])).rows[0].member_id;
    const [ownerA, ownerB, early] = [await m('legacy-a'), await m('legacy-b'), await m('legacy-early')];
    const legacyGroup = async (name: string, owner: string, legacyId: string | null) => {
      // The Steward invariant is deferred: Group and owner membership are created in one transaction.
      return pg.transaction(async (tx) => {
        const g = (await tx.query<{ group_id: string }>(`INSERT INTO groups (legacy_firestore_id, name, steward_member_id) VALUES ($1,$2,$3) RETURNING group_id`, [legacyId, name, owner])).rows[0].group_id;
        await tx.query(`INSERT INTO group_memberships (group_id, member_id, role, status, approved_at, approved_by_member_id) VALUES ($1,$2,'owner','active',now(),$2)`, [g, owner]);
        return g;
      });
    };
    const g1 = await legacyGroup('Legacy One', ownerA, 'fs-1');
    const g2 = await legacyGroup('Legacy Two', ownerB, null);
    await pg.query(`INSERT INTO group_memberships (group_id, member_id, role, status, joined_at) VALUES ($1,$2,'member','active', now() - interval '3 years')`, [g1, early]); // earliest member by date
    const before = (await pg.query<{ group_id: string; steward_member_id: string }>(`SELECT group_id, steward_member_id FROM groups ORDER BY name`)).rows;
    await apply(target!);
    const after = (await pg.query<{ group_id: string; steward_member_id: string; original_creator_member_id: string | null }>(`SELECT group_id, steward_member_id, original_creator_member_id FROM groups ORDER BY name`)).rows;
    expect(after.map((r) => r.original_creator_member_id)).toEqual([null, null]);          // nothing fabricated
    expect(after.map((r) => [r.group_id, r.steward_member_id])).toEqual(before.map((r) => [r.group_id, r.steward_member_id])); // Steward untouched
    expect((await pg.query(`SELECT count(*)::int AS n FROM group_memberships`)).rows[0]).toEqual({ n: 3 });
    // Never derived from the Steward or the earliest member: a later write needs the governed backfill declaration.
    await expect(pg.query(`UPDATE groups SET original_creator_member_id = steward_member_id WHERE group_id=$1`, [g1])).rejects.toThrow(/establishment or by a governed provenance backfill/);
    await expect(pg.query(`UPDATE groups SET original_creator_member_id = $2 WHERE group_id=$1`, [g1, early])).rejects.toThrow(/establishment or by a governed provenance backfill/);
    await pg.close();
  });
});

describe('P4a establishment and immutability', () => {
  it('records the establishing member at creation, independent of the Steward; Steward changes leave it intact', async () => {
    const db = testDb();
    const creator = await seedMember(db, 'p4a-creator'); const successor = await seedMember(db, 'p4a-successor');
    const app = buildTestApp({ creator: await subject(db, creator), successor: await subject(db, successor) });
    const created = await app.inject({ method: 'POST', url: '/api/groups', headers: authHeaders('creator'), payload: { name: 'Provenance crew' } });
    expect(created.statusCode).toBe(201);
    const group = created.json() as { id: string };
    expect(await creatorOf(db, group.id)).toBe(creator);          // correct creator
    expect(await stewardOf(db, group.id)).toBe(creator);          // initially the same member
    await seedMembership(db, group.id, successor, { status: 'active', role: 'member' });
    await transferStewardFixture(db, group.id, creator, successor);
    expect(await stewardOf(db, group.id)).toBe(successor);        // creator and Steward now differ
    expect(await creatorOf(db, group.id)).toBe(creator);          // creator intact
    await expect(db.query(`UPDATE groups SET original_creator_member_id=$2 WHERE group_id=$1`, [group.id, successor])).rejects.toThrow(/immutable once recorded/);
    await expect(db.query(`UPDATE groups SET original_creator_member_id=NULL WHERE group_id=$1`, [group.id])).rejects.toThrow(/immutable once recorded/);
    // even a declared backfill cannot rewrite a recorded creator
    await expect(db.transaction(async (tx) => {
      await tx.query(`SELECT set_config('tiizi.group_creator_backfill','on', true)`);
      await tx.query(`UPDATE groups SET original_creator_member_id=$2 WHERE group_id=$1`, [group.id, successor]);
    })).rejects.toThrow(/immutable once recorded/);
    // ordinary Group operations (settings, rename) do not touch it
    await db.query(`UPDATE groups SET name='Renamed', tagline='x' WHERE group_id=$1`, [group.id]);
    expect(await creatorOf(db, group.id)).toBe(creator);
  });

  it('a governed backfill may set only a NULL value (and only when declared)', async () => {
    const db = testDb();
    const m = await seedMember(db, 'p4a-backfill');
    const g = (await db.query<{ group_id: string }>(`INSERT INTO groups (name) VALUES ('Unrecorded') RETURNING group_id`)).rows[0].group_id;
    expect(await creatorOf(db, g)).toBeNull();
    await db.transaction(async (tx) => {
      await tx.query(`SELECT set_config('tiizi.group_creator_backfill','on', true)`);
      await tx.query(`UPDATE groups SET original_creator_member_id=$2 WHERE group_id=$1`, [g, m]);
    });
    expect(await creatorOf(db, g)).toBe(m);
  });

  it('existing Group creation and membership behaviour is unchanged (owner membership, join, Steward invariant)', async () => {
    const db = testDb();
    const owner = await seedMember(db, 'p4a-own'); const joiner = await seedMember(db, 'p4a-join');
    const app = buildTestApp({ owner: await subject(db, owner), joiner: await subject(db, joiner) });
    const group = (await app.inject({ method: 'POST', url: '/api/groups', headers: authHeaders('owner'), payload: { name: 'Plain crew' } })).json() as { id: string; role: string; status: string };
    expect(group.role).toBe('owner'); expect(group.status).toBe('active');
    expect((await app.inject({ method: 'POST', url: `/api/groups/${group.id}/join`, headers: authHeaders('joiner'), payload: {} })).statusCode).toBe(200);
    const rows = (await db.query<{ member_id: string; role: string; status: string }>(`SELECT member_id, role, status FROM group_memberships WHERE group_id=$1 ORDER BY role`, [group.id])).rows;
    expect(rows.map((r) => [r.role, r.status])).toEqual([['member', 'active'], ['owner', 'active']]);
    expect(await stewardOf(db, group.id)).toBe(owner);
  });
});

describe('P4a authorized Group Details presentation (privacy matrix)', () => {
  async function scene() {
    const db = testDb();
    const ids = {
      creator: await seedMember(db, 'p4a-pc'), steward: await seedMember(db, 'p4a-ps'), member: await seedMember(db, 'p4a-pm'),
      outsider: await seedMember(db, 'p4a-po'), pending: await seedMember(db, 'p4a-pp'), former: await seedMember(db, 'p4a-pf'),
    };
    const uids: Record<string, string> = {};
    for (const [k, v] of Object.entries(ids)) uids[k] = await subject(db, v);
    await setName(db, ids.creator, 'Wanjiru Creator'); await setName(db, ids.steward, 'Amani Steward');
    const app = buildTestApp(uids);
    const group = (await app.inject({ method: 'POST', url: '/api/groups', headers: authHeaders('creator'), payload: { name: 'Matrix crew', requireAdminApproval: false } })).json() as { id: string };
    for (const k of ['steward', 'member']) await seedMembership(db, group.id, ids[k as 'steward'], { status: 'active', role: 'member' });
    await seedMembership(db, group.id, ids.former, { status: 'left' });
    await seedMembership(db, group.id, ids.pending, { status: 'pending' });
    await transferStewardFixture(db, group.id, ids.creator, ids.steward);
    const get = async (token: string) => app.inject({ method: 'GET', url: `/api/groups/${group.id}`, headers: authHeaders(token) });
    return { db, ids, app, group, get };
  }

  it('active members and the Steward see the original creator, distinct from the current Steward, as the governed display name only', async () => {
    const { ids, get, group } = await scene();
    for (const viewer of ['steward', 'member', 'creator']) {
      const response = await get(viewer);
      expect(response.statusCode).toBe(200);
      const body = response.json() as { originalCreator: { memberId: string; displayName: string | null }; steward: { memberId: string } };
      expect(body.originalCreator).toEqual({ memberId: ids.creator, displayName: 'Wanjiru Creator' });
      expect(body.steward.memberId).toBe(ids.steward);                 // Current Steward differs from the creator
      expect(Object.keys(body.originalCreator).sort()).toEqual(['displayName', 'memberId']);
      expect(response.body).not.toMatch(LEAK);
    }
    expect(group.id).toBeTruthy();
  });

  it('outsiders, pending applicants and former members receive no provenance and no protected identity', async () => {
    const { get } = await scene();
    for (const viewer of ['outsider', 'pending', 'former']) {
      const response = await get(viewer);
      expect(response.statusCode).toBe(200);
      expect(response.json()).not.toHaveProperty('originalCreator');
      expect(response.body).not.toMatch(/Wanjiru Creator|Amani Steward|originalCreator/);
    }
  });

  it('a private Group stays invisible to outsiders (404, no provenance)', async () => {
    const { db, ids, app } = await scene();
    const priv = (await app.inject({ method: 'POST', url: '/api/groups', headers: authHeaders('creator'), payload: { name: 'Hidden crew', isPrivate: true } })).json() as { id: string };
    const response = await app.inject({ method: 'GET', url: `/api/groups/${priv.id}`, headers: authHeaders('outsider') });
    expect(response.statusCode).toBe(404);
    expect(response.body).not.toMatch(/Wanjiru|originalCreator/);
    expect(await creatorOf(db, priv.id)).toBe(ids.creator);
  });

  it('a NULL display name yields a null name (neutral fallback in the UI); renames show the current name only', async () => {
    const { db, ids, get } = await scene();
    await setName(db, ids.creator, 'Old Creator Name'); await setName(db, ids.creator, null);
    expect(((await get('member')).json() as { originalCreator: { displayName: string | null } }).originalCreator.displayName).toBeNull();
    await setName(db, ids.creator, 'New Creator Name');
    const body = (await get('member')).body;
    expect(body).toContain('New Creator Name'); expect(body).not.toContain('Old Creator Name');
  });

  it('a creator who later left the Group is still shown to active members as a Group fact (current governed name)', async () => {
    const { db, ids, group, get } = await scene();
    await db.query(`UPDATE group_memberships SET status='left', left_at=now() WHERE group_id=$1 AND member_id=$2`, [group.id, ids.creator]);
    const body = (await get('member')).json() as { originalCreator: { memberId: string; displayName: string | null } };
    expect(body.originalCreator).toEqual({ memberId: ids.creator, displayName: 'Wanjiru Creator' });
    expect((await get('creator')).json()).not.toHaveProperty('originalCreator'); // the former member herself is now outside
  });

  it('a legacy Group with no recorded creator reports null (not recorded) — never the Steward or the earliest member', async () => {
    const { db, ids, app, get } = await scene();
    const legacy = await db.transaction(async (tx) => {
      const g = (await tx.query<{ group_id: string }>(`INSERT INTO groups (name, steward_member_id) VALUES ('Legacy crew', $1) RETURNING group_id`, [ids.steward])).rows[0].group_id;
      await tx.query(`INSERT INTO group_memberships (group_id, member_id, role, status) VALUES ($1,$2,'owner','active'), ($1,$3,'member','active')`, [g, ids.steward, ids.member]);
      return g;
    });
    const response = await app.inject({ method: 'GET', url: `/api/groups/${legacy}`, headers: authHeaders('member') });
    expect(response.statusCode).toBe(200);
    expect(response.json().originalCreator).toBeNull();
    expect(response.json().steward.memberId).toBe(ids.steward);
    expect(await creatorOf(db, legacy)).toBeNull();
    expect(get).toBeTruthy();
  });
});
