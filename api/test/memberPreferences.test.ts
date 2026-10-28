import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GROUP_FOCUS_AREAS, GROUP_GOALS } from '../src/groupVocabulary.js';
import { V2_FITNESS_CATEGORIES, V2_WELLNESS_CATEGORIES } from '../src/knowledge.js';
import {
  MAX_MEMBER_GOALS,
  MAX_MEMBER_INTERESTS,
  MEMBER_GOAL_OPTIONS,
  MEMBER_INTEREST_OPTIONS,
  getMemberPreferenceIds,
} from '../src/memberPreferences.js';
import { authHeaders, buildTestApp, seedGroup, seedMember, testDb } from './helpers.js';

let seq = 0;
async function member(label = 'pref'): Promise<{ memberId: string; token: string; app: ReturnType<typeof buildTestApp> }> {
  const subject = `${label}-${++seq}`;
  const memberId = await seedMember(testDb(), subject);
  const token = `tok-${subject}`;
  return { memberId, token, app: buildTestApp({ [token]: subject }) };
}
const put = (app: ReturnType<typeof buildTestApp>, token: string, payload: unknown) =>
  app.inject({ method: 'PUT', url: '/api/me/preferences', headers: { ...authHeaders(token), 'content-type': 'application/json' }, payload: payload as Record<string, unknown> });
const get = (app: ReturnType<typeof buildTestApp>, token: string) =>
  app.inject({ method: 'GET', url: '/api/me/preferences', headers: authHeaders(token) });
// Selections are stored as a canonical sorted set (order is not meaningful).
const ids = (n: number) => MEMBER_INTEREST_OPTIONS.slice(0, n).map((o) => o.id).sort();
const goals = (n: number) => MEMBER_GOAL_OPTIONS.slice(0, n).map((o) => o.id).sort();
async function events(memberId: string) {
  const r = await testDb().query<{ field: string; old_ids: string[]; new_ids: string[]; decision_only: boolean; actor_member_id: string }>(
    'SELECT field, old_ids, new_ids, decision_only, actor_member_id FROM member_preference_events WHERE member_id = $1 ORDER BY event_id', [memberId]);
  return r.rows;
}

describe('canonical vocabulary (no competing vocabulary)', () => {
  it('Interests are exactly the governed 12 Focus Area concepts with unique stable IDs', () => {
    expect(MEMBER_INTEREST_OPTIONS).toHaveLength(12);
    expect(MEMBER_INTEREST_OPTIONS.map((o) => o.label)).toEqual(GROUP_FOCUS_AREAS.map((a) => a.label));
    expect(MEMBER_INTEREST_OPTIONS.map((o) => o.label)).toEqual([...V2_FITNESS_CATEGORIES, ...V2_WELLNESS_CATEGORIES]);
    const idList = MEMBER_INTEREST_OPTIONS.map((o) => o.id);
    expect(new Set(idList).size).toBe(12);
    expect(idList.every((id) => /^[a-z]+(_[a-z]+)*$/.test(id))).toBe(true);
    expect(MEMBER_INTEREST_OPTIONS.filter((o) => o.domain === 'Fitness')).toHaveLength(6);
  });
  it('Goals are exactly the governed 9 Group Goal concepts with their existing IDs', () => {
    expect(MEMBER_GOAL_OPTIONS).toEqual(GROUP_GOALS.map(({ id, label }) => ({ id, label })));
    expect(MEMBER_GOAL_OPTIONS).toHaveLength(9);
  });
  it('database allow-lists equal the application vocabulary (no drift)', () => {
    const sql = readFileSync(new URL('../migrations/028_member_interests_goals.sql', import.meta.url), 'utf8');
    const listIn = (column: string) => {
      const block = sql.split(`${column} <@ ARRAY[`)[1]?.split(']::text[]')[0] ?? '';
      return [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    };
    expect(listIn('interest_ids').sort()).toEqual(MEMBER_INTEREST_OPTIONS.map((o) => o.id).sort());
    expect(listIn('goal_ids').sort()).toEqual(MEMBER_GOAL_OPTIONS.map((o) => o.id).sort());
    expect(sql).toMatch(/cardinality\(interest_ids\) <= 5/);
    expect(sql).toMatch(/cardinality\(goal_ids\) <= 3/);
  });
});

describe('GET/PUT /api/me/preferences', () => {
  it('requires authentication', async () => {
    const { app } = await member();
    expect((await app.inject({ method: 'GET', url: '/api/me/preferences' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'PUT', url: '/api/me/preferences', payload: { interestIds: [] } })).statusCode).toBe(401);
  });

  it('a new member has empty, undecided preferences and receives the vocabulary and limits', async () => {
    const { app, token } = await member();
    const res = await get(app, token);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ interestIds: [], goalIds: [], interestsDecided: false, goalsDecided: false, limits: { interests: 5, goals: 3 } });
    expect(body.vocabulary.interests).toHaveLength(12);
    expect(body.vocabulary.goals).toHaveLength(9);
  });

  it('saves, reloads, edits and clears — each side independently', async () => {
    const { app, token, memberId } = await member();
    const saved = await put(app, token, { interestIds: ids(3), goalIds: goals(2) });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({ interestIds: ids(3), goalIds: goals(2), interestsDecided: true, goalsDecided: true });
    expect((await get(app, token)).json()).toMatchObject({ interestIds: ids(3), goalIds: goals(2) });

    // editing only goals leaves interests untouched
    const edited = await put(app, token, { goalIds: [goals(9)[8]] });
    expect(edited.json()).toMatchObject({ interestIds: ids(3), goalIds: [goals(9)[8]] });
    // clearing only interests leaves goals untouched
    const cleared = await put(app, token, { interestIds: [] });
    expect(cleared.json()).toMatchObject({ interestIds: [], goalIds: [goals(9)[8]], interestsDecided: true });
    expect(await getMemberPreferenceIds(testDb(), memberId)).toEqual({ interestIds: [], goalIds: [goals(9)[8]] });
  });

  it('accepts the exact bounds 5 Interests and 3 Goals and rejects one more', async () => {
    const { app, token } = await member();
    expect((await put(app, token, { interestIds: ids(5), goalIds: goals(3) })).statusCode).toBe(200);
    const tooManyInterests = await put(app, token, { interestIds: ids(6) });
    expect(tooManyInterests.statusCode).toBe(400);
    expect(tooManyInterests.json().error.code).toBe('preference_limit_exceeded');
    const tooManyGoals = await put(app, token, { goalIds: goals(4) });
    expect(tooManyGoals.statusCode).toBe(400);
    expect(tooManyGoals.json().error.code).toBe('preference_limit_exceeded');
    expect(MAX_MEMBER_INTERESTS).toBe(5);
    expect(MAX_MEMBER_GOALS).toBe(3);
    // the rejected writes changed nothing
    expect((await get(app, token)).json()).toMatchObject({ interestIds: ids(5), goalIds: goals(3) });
  });

  it('an empty selection is valid and records a skip without needing any choice', async () => {
    const { app, token, memberId } = await member();
    const skipInterests = await put(app, token, { interestIds: [] });
    expect(skipInterests.json()).toMatchObject({ interestIds: [], interestsDecided: true, goalsDecided: false });
    const skipGoals = await put(app, token, { goalIds: [] });
    expect(skipGoals.json()).toMatchObject({ goalIds: [], interestsDecided: true, goalsDecided: true });
    const log = await events(memberId);
    expect(log.map((e) => [e.field, e.decision_only])).toEqual([['interests', true], ['goals', true]]);
  });

  it('treats a re-ordered repeat as a true no-op and caps absurd array sizes cheaply', async () => {
    const { app, token, memberId } = await member();
    await put(app, token, { interestIds: ['strength', 'sleep_rest'] });
    const again = await put(app, token, { interestIds: ['sleep_rest', 'strength'] });
    expect(again.json().interestIds).toEqual(['sleep_rest', 'strength']);
    expect((await events(memberId)).length).toBe(1);
    const huge = await put(app, token, { goalIds: Array.from({ length: 5000 }, () => 'manage_weight') });
    expect(huge.statusCode).toBe(400);
  });

  it('concurrent saves of different sides for a brand-new member both land (no lost update)', async () => {
    const { app, token, memberId } = await member();
    const [a, b] = await Promise.all([
      put(app, token, { interestIds: ids(2) }),
      put(app, token, { goalIds: goals(2) }),
    ]);
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    expect(await getMemberPreferenceIds(testDb(), memberId)).toEqual({ interestIds: ids(2), goalIds: goals(2) });
  });

  it('rejects unknown IDs, labels, wrong types, extra keys and empty bodies', async () => {
    const { app, token, memberId } = await member();
    for (const payload of [
      { interestIds: ['not_a_real_interest'] },
      { interestIds: ['Strength'] },            // labels are never accepted
      { goalIds: ['bogus_goal'] },
      { interestIds: 'strength' },
      { interestIds: [1] },
      { goalIds: null },
      { memberId: 'someone-else', interestIds: [] },
      { displayName: 'x' },
      {},
      [] as unknown,
    ]) {
      const res = await put(app, token, payload);
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
    }
    expect((await put(app, token, { interestIds: ['not_a_real_interest'] })).json().error.code).toBe('unknown_preference_id');
    expect(await events(memberId)).toEqual([]);
  });

  it('is idempotent: repeating a save changes nothing and writes no second audit event', async () => {
    const { app, token, memberId } = await member();
    const first = await put(app, token, { interestIds: ids(2), goalIds: goals(1) });
    const second = await put(app, token, { interestIds: ids(2), goalIds: goals(1) });
    expect(second.json()).toEqual(first.json());
    expect((await events(memberId)).length).toBe(2); // one per side, not four
    // duplicates in the request are collapsed, not double counted against the limit
    const dup = await put(app, token, { interestIds: [...ids(2), ...ids(2)] });
    expect(dup.statusCode).toBe(200);
    expect(dup.json().interestIds).toEqual(ids(2));
    expect((await events(memberId)).length).toBe(2);
  });

  it('audits every real change append-only, with the member as actor', async () => {
    const { app, token, memberId } = await member();
    await put(app, token, { interestIds: ids(2) });
    await put(app, token, { interestIds: ids(1) });
    await put(app, token, { interestIds: [] });
    const log = await events(memberId);
    expect(log.map((e) => [e.old_ids, e.new_ids])).toEqual([[[], ids(2)], [ids(2), ids(1)], [ids(1), []]]);
    expect(log.every((e) => e.actor_member_id === memberId)).toBe(true);
    await expect(testDb().query('UPDATE member_preference_events SET field = $2 WHERE member_id = $1', [memberId, 'goals'])).rejects.toThrow(/append-only/);
    await expect(testDb().query('DELETE FROM member_preference_events WHERE member_id = $1', [memberId])).rejects.toThrow(/append-only/);
  });

  it('ownership: a member only reads and writes their own preferences', async () => {
    const a = await member('owner-a');
    const b = await member('owner-b');
    await put(a.app, a.token, { interestIds: ids(2), goalIds: goals(1) });
    expect((await get(b.app, b.token)).json()).toMatchObject({ interestIds: [], goalIds: [], interestsDecided: false });
    await put(b.app, b.token, { interestIds: [ids(5)[4]] });
    expect((await get(a.app, a.token)).json().interestIds).toEqual(ids(2));
    expect(await getMemberPreferenceIds(testDb(), b.memberId)).toEqual({ interestIds: [ids(5)[4]], goalIds: [] });
  });

  it('the database itself enforces bounds, allow-lists and uniqueness', async () => {
    const { memberId } = await member('db-guard');
    const write = (interest: string[], goal: string[]) =>
      testDb().query('INSERT INTO member_preferences (member_id, interest_ids, goal_ids) VALUES ($1, $2, $3)', [memberId, interest, goal]);
    await expect(write(['nope'], [])).rejects.toThrow();
    await expect(write(ids(6) as string[], [])).rejects.toThrow();
    await expect(write([], goals(4))).rejects.toThrow();
    await expect(write([ids(1)[0], ids(1)[0]], [])).rejects.toThrow();
    await expect(write(ids(5), goals(3))).resolves.toBeDefined();
  });

  it('preferences never change what a member is authorized to discover (relevance only)', async () => {
    const viewer = await member('discover');
    await seedGroup(testDb(), { name: 'Open discoverable Group' });
    const before = await viewer.app.inject({ method: 'GET', url: '/api/groups/discover', headers: authHeaders(viewer.token) });
    await put(viewer.app, viewer.token, { interestIds: ids(5), goalIds: goals(3) });
    const after = await viewer.app.inject({ method: 'GET', url: '/api/groups/discover', headers: authHeaders(viewer.token) });
    expect(before.statusCode).toBe(200);
    // P2: saved preferences may ORDER discovery (and annotate relevance) but the
    // authorized set itself is exactly the same.
    const idsOf = (res: { json(): { groups: Array<{ id: string }> } }) => res.json().groups.map((g) => g.id).sort();
    expect(idsOf(after)).toEqual(idsOf(before));
    // and no membership or participation is created by saving preferences
    const m = await testDb().query('SELECT 1 FROM group_memberships WHERE member_id = $1', [viewer.memberId]);
    const p = await testDb().query('SELECT 1 FROM challenge_participations WHERE member_id = $1', [viewer.memberId]);
    expect(m.rows).toHaveLength(0);
    expect(p.rows).toHaveLength(0);
  });
});
