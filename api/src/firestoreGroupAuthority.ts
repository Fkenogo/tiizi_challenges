/**
 * Phase C2B transitional Group-Membership runtime authority adapter.
 *
 * This is the application-boundary adapter for
 * `resolveGroupMembershipAuthority(groupId, memberId)` while Firestore
 * remains Group Membership operational authority. It is the ONLY C2B module
 * (besides the pre-existing auth seam) allowed to touch Firebase/Firestore;
 * provider-neutral domain modules stay Firebase-free (boundary-tested).
 *
 * Flow (fail closed at every step):
 * 1. PostgreSQL maps Tiizi identities to Firestore identities: the Group
 *    UUID -> groups.legacy_firestore_id (existing compatibility mapping)
 *    and the member UUID -> members.auth_subject for auth_provider
 *    'firebase'. A missing mapping returns null (the authority cannot even
 *    be asked) — the PG group_memberships shadow is never consulted.
 * 2. Firestore groups/{legacyId} must exist and be active (V1 `isGroupActive`
 *    semantics: explicit status 'active'; legacy docs without a status count
 *    as active; moderationStatus 'deactivated' blocks). Otherwise ineligible.
 * 3. Firestore groupMembers/{legacyId}_{firebaseUid} (V1 document identity)
 *    must exist with status 'active'|'joined' (case-insensitive, matching
 *    V1 ACTIVE_MEMBER_STATUSES). Otherwise ineligible.
 * 4. Firestore outages propagate as thrown errors so callers fail closed
 *    ("authority unreachable") instead of treating them as non-membership.
 *
 * No Firestore activity write, no dual write, no Challenge-derived-truth
 * write. Read-only get() calls. Removed when Group authority migrates to
 * PostgreSQL (the domain contract does not change).
 */

import { getFirestore } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from './auth.js';
import type { Db } from './db.js';
import type {
  GroupMembershipAuthority,
  GroupMembershipAuthorityStatus,
} from './groupMembershipAuthority.js';

/** Minimal Firestore read surface (injectable for tests). */
export interface FirestoreDocSnapshot {
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
}

export interface FirestoreReader {
  getDocument(collection: string, docId: string): Promise<FirestoreDocSnapshot>;
}

const ACTIVE_MEMBER_STATUSES = new Set(['active', 'joined']);

function memberDocId(legacyGroupId: string, firebaseUid: string): string {
  return `${legacyGroupId}_${firebaseUid}`;
}

function isGroupDocActive(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;
  const status = String(data.status ?? 'active').toLowerCase();
  if (status !== 'active') return false;
  return String(data.moderationStatus ?? 'active').toLowerCase() !== 'deactivated';
}

/**
 * Resolve CURRENT membership under live Firestore authority.
 * Returns null when identities cannot be mapped; {eligible:false} with the
 * authority-reported status otherwise; throws on authority failure.
 */
export function createFirestoreGroupMembershipAuthority(
  db: Db,
  reader: FirestoreReader,
): GroupMembershipAuthority {
  return {
    async resolveGroupMembershipAuthority(
      groupId: string,
      memberId: string,
    ): Promise<GroupMembershipAuthorityStatus | null> {
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
      if (!groupSnap.exists) return { status: 'group_missing', eligible: false };
      const groupData = groupSnap.data();
      if (!isGroupDocActive(groupData)) {
        return { status: String(groupData?.status ?? 'group_inactive'), eligible: false };
      }

      const memberSnap = await reader.getDocument('groupMembers', memberDocId(legacyGroupId, firebaseUid));
      if (!memberSnap.exists) return { status: 'no_membership', eligible: false };
      const status = String(memberSnap.data()?.status ?? '');
      if (!ACTIVE_MEMBER_STATUSES.has(status.toLowerCase())) {
        return { status: status || 'ineligible', eligible: false };
      }
      return { status, eligible: true };
    },
  };
}

/** Production Firestore reader (read-only get() calls). */
export function createAdminFirestoreReader(): FirestoreReader {
  return {
    async getDocument(collection: string, docId: string): Promise<FirestoreDocSnapshot> {
      const snap = await getFirestore(ensureFirebaseAdmin()).collection(collection).doc(docId).get();
      return {
        exists: snap.exists,
        data: () => (snap.data() ?? undefined) as Record<string, unknown> | undefined,
      };
    },
  };
}
