import { describe, expect, it } from 'vitest';
import { compareMembershipParity, parityMatches } from '../src/parity.js';

describe('parity comparison', () => {
  it('matches identical membership sets', async () => {
    const sides = [{ groupKey: 'g1', role: 'member', status: 'active' }];
    const report = {
      usersCompared: 1,
      firestoreMemberships: 1,
      apiMemberships: 1,
      differences: compareMembershipParity('u1', sides, [...sides]),
    };
    expect(parityMatches(report)).toBe(true);
  });

  it('reports missing, extra and mismatched memberships without provider ids', async () => {
    const firestore = [
      { groupKey: 'g1', role: 'member', status: 'active' },
      { groupKey: 'g2', role: 'admin', status: 'active' },
      { groupKey: 'g3', role: 'member', status: 'joined' },
    ];
    const api = [
      { groupKey: 'g1', role: 'member', status: 'active' },
      { groupKey: 'g2', role: 'member', status: 'active' },
      { groupKey: 'g4', role: 'member', status: 'active' },
    ];
    const differences = compareMembershipParity('u1', firestore, api);
    expect(differences.map((d) => [d.kind, d.groupKey].join(':')).sort()).toEqual([
      'missing_in_api:g3',
      'missing_in_firestore:g4',
      'role_mismatch:g2',
    ]);
    expect(JSON.stringify(differences)).not.toContain('uid');
  });

  it('detects status drift between the two stores', async () => {
    const differences = compareMembershipParity(
      'u1',
      [{ groupKey: 'g1', role: 'member', status: 'pending' }],
      [{ groupKey: 'g1', role: 'member', status: 'active' }],
    );
    expect(differences).toHaveLength(1);
    expect(differences[0].kind).toBe('status_mismatch');
  });
});
