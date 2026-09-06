export interface ParitySide {
  /** Stable cross-store key: Firestore group doc id on the Firestore side. */
  groupKey: string;
  role: string;
  status: string;
}

export interface ParityDifference {
  userKey: string;
  kind: 'missing_in_api' | 'missing_in_firestore' | 'role_mismatch' | 'status_mismatch';
  groupKey: string;
  firestore?: ParitySide;
  api?: ParitySide;
}

export interface ParityReport {
  usersCompared: number;
  firestoreMemberships: number;
  apiMemberships: number;
  differences: ParityDifference[];
}

export function parityMatches(report: ParityReport): boolean {
  return report.differences.length === 0;
}

function keyOf(side: ParitySide): string {
  return `${side.groupKey}`;
}

/**
 * Semantic comparison of one user's memberships across the two stores.
 * Compares group mapping, role, and status — never provider-specific ids.
 */
export function compareMembershipParity(
  userKey: string,
  firestore: ParitySide[],
  api: ParitySide[],
): ParityDifference[] {
  const differences: ParityDifference[] = [];
  const apiByGroup = new Map(api.map((a) => [keyOf(a), a]));
  const fsByGroup = new Map(firestore.map((f) => [keyOf(f), f]));

  for (const f of firestore) {
    const a = apiByGroup.get(keyOf(f));
    if (!a) {
      differences.push({ userKey, kind: 'missing_in_api', groupKey: f.groupKey, firestore: f });
    } else {
      if (a.role !== f.role) {
        differences.push({ userKey, kind: 'role_mismatch', groupKey: f.groupKey, firestore: f, api: a });
      }
      if (a.status !== f.status) {
        differences.push({ userKey, kind: 'status_mismatch', groupKey: f.groupKey, firestore: f, api: a });
      }
    }
  }
  for (const a of api) {
    if (!fsByGroup.has(keyOf(a))) {
      differences.push({ userKey, kind: 'missing_in_firestore', groupKey: a.groupKey, api: a });
    }
  }
  return differences;
}
