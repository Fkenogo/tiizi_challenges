/**
 * EBC-01 Firestore Challenge-creation authority adapter.
 *
 * Application-boundary adapter for
 * `resolveChallengeCreationAuthority(groupId, memberId)` while Firestore
 * remains Group authority. The ONLY EBC-01 modules allowed to touch
 * Firebase/Firestore are this adapter, `firestoreGroupAuthority.ts`
 * (read authority) and `firestoreGroupMutationStore.ts` (governed writes);
 * provider-neutral domain modules stay Firebase-free (boundary-tested).
 *
 * Flow (fail closed at every step):
 * 1. PostgreSQL maps Tiizi identities to Firestore identities: Group UUID
 *    -> groups.legacy_firestore_id and member UUID -> members.auth_subject
 *    (auth_provider 'firebase'). A missing mapping returns null (the Group
 *    cannot host new Challenges) — the PG group_memberships shadow is never
 *    consulted.
 * 2. Firestore groups/{legacyId} must exist and be active (shared
 *    isGroupDocActive semantics: explicit status 'active'; legacy docs
 *    without a status count as active; moderationStatus 'deactivated'
 *    blocks). Missing -> null; inactive -> permitted:false/group_inactive.
 * 3. Firestore groupMembers/{legacyId}_{firebaseUid} must exist with an
 *    eligible status ('active'|'joined'). Missing -> no_membership;
 *    otherwise inactive -> membership_inactive.
 * 4. Charter rule (existing product semantics): when the group document
 *    sets allowMemberChallenges === false, only a live owner/admin may
 *    establish (charter_restricted). Absent flag counts as permitted
 *    (matches buildGroupDefaults: allowMemberChallenges ?? true).
 * 5. Firestore outages propagate as thrown errors so callers fail closed
 *    ("authority unreachable") instead of treating them as denials.
 *
 * Read-only get() calls. No writes, no dual writes.
 */

import type { Db } from './db.js';
import type {
  ChallengeCreationAuthority,
  ChallengeCreationAuthorityStatus,
} from './challengeCreationAuthority.js';
import {
  isGroupDocActive,
  type FirestoreReader,
} from './firestoreGroupAuthority.js';

const ELIGIBLE_MEMBER_STATUSES = new Set(['active', 'joined']);
const STEWARD_ROLES = new Set(['owner', 'admin']);

function memberDocId(legacyGroupId: string, firebaseUid: string): string {
  return `${legacyGroupId}_${firebaseUid}`;
}

export function createFirestoreChallengeCreationAuthority(
  db: Db,
  reader: FirestoreReader,
): ChallengeCreationAuthority {
  return {
    async resolveChallengeCreationAuthority(
      groupId: string,
      memberId: string,
    ): Promise<ChallengeCreationAuthorityStatus | null> {
      const mapping = await db.query<{ legacy_firestore_id: string | null; auth_subject: string | null }>(
        `SELECT
           (SELECT legacy_firestore_id FROM groups WHERE group_id = $1) AS legacy_firestore_id,
           (SELECT auth_subject FROM members WHERE member_id = $2 AND auth_provider = 'firebase') AS auth_subject`,
        [groupId, memberId],
      );
      const row = mapping.rows[0];
      const legacyGroupId = row?.legacy_firestore_id ?? null;
      const firebaseUid = row?.auth_subject ?? null;
      if (!legacyGroupId || !firebaseUid) return null;

      const groupSnap = await reader.getDocument('groups', legacyGroupId);
      if (!groupSnap.exists) return null;
      const groupData = groupSnap.data();
      if (!isGroupDocActive(groupData)) {
        return {
          permitted: false,
          reason: 'group_inactive',
          groupStatus: String(groupData?.status ?? 'group_inactive'),
          allowMemberChallenges: groupData?.allowMemberChallenges !== false,
          memberRole: null,
          memberStatus: null,
        };
      }
      const allowMemberChallenges = groupData?.allowMemberChallenges !== false;

      const memberSnap = await reader.getDocument('groupMembers', memberDocId(legacyGroupId, firebaseUid));
      if (!memberSnap.exists) {
        return {
          permitted: false,
          reason: 'no_membership',
          groupStatus: 'active',
          allowMemberChallenges,
          memberRole: null,
          memberStatus: null,
        };
      }
      const memberData = memberSnap.data() ?? {};
      const rawStatus = String(memberData.status ?? '');
      if (!ELIGIBLE_MEMBER_STATUSES.has(rawStatus.toLowerCase())) {
        return {
          permitted: false,
          reason: 'membership_inactive',
          groupStatus: 'active',
          allowMemberChallenges,
          memberRole: typeof memberData.role === 'string' ? memberData.role : null,
          memberStatus: rawStatus || 'ineligible',
        };
      }
      const role = typeof memberData.role === 'string' && memberData.role
        ? memberData.role.toLowerCase()
        : 'member';
      if (!allowMemberChallenges && !STEWARD_ROLES.has(role)) {
        return {
          permitted: false,
          reason: 'charter_restricted',
          groupStatus: 'active',
          allowMemberChallenges,
          memberRole: role,
          memberStatus: rawStatus,
        };
      }
      return {
        permitted: true,
        reason: null,
        groupStatus: 'active',
        allowMemberChallenges,
        memberRole: role,
        memberStatus: rawStatus,
      };
    },
  };
}
