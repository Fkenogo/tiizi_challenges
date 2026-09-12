/**
 * EBC-01 production Group mutation store (Firebase Admin SDK).
 *
 * The ONLY module (with firestoreGroupAuthority.ts) that writes Firestore
 * Group/membership truth from the V2 API. Group creation uses one batched
 * write for the group + owner membership documents (atomic owner relation).
 * Counters use FieldValue.increment, matching current product behavior.
 */

import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { ensureFirebaseAdmin } from './auth.js';
import type { GroupMutationStore } from './groupMutations.js';

function membershipDocId(legacyGroupId: string, firebaseUid: string): string {
  return `${legacyGroupId}_${firebaseUid}`;
}

export function createAdminGroupMutationStore(): GroupMutationStore {
  const db = () => getFirestore(ensureFirebaseAdmin());
  return {
    async createGroupWithOwner(
      group: Record<string, unknown>,
      ownerUid: string,
      ownerMembership: Record<string, unknown>,
    ): Promise<string> {
      const firestore = db();
      const groupRef = firestore.collection('groups').doc();
      const memberRef = firestore
        .collection('groupMembers')
        .doc(membershipDocId(groupRef.id, ownerUid));
      const batch = firestore.batch();
      batch.set(groupRef, group);
      batch.set(memberRef, { ...ownerMembership, groupId: groupRef.id });
      await batch.commit();
      return groupRef.id;
    },
    async getGroup(legacyId: string): Promise<Record<string, unknown> | null> {
      const snap = await db().collection('groups').doc(legacyId).get();
      return snap.exists ? (snap.data() as Record<string, unknown>) : null;
    },
    async updateGroupCounter(legacyId: string, delta: number): Promise<void> {
      await db().collection('groups').doc(legacyId).update({
        memberCount: FieldValue.increment(delta),
      });
    },
    async getMembership(
      legacyId: string,
      firebaseUid: string,
    ): Promise<Record<string, unknown> | null> {
      const snap = await db()
        .collection('groupMembers')
        .doc(membershipDocId(legacyId, firebaseUid))
        .get();
      return snap.exists ? (snap.data() as Record<string, unknown>) : null;
    },
    async setMembership(
      legacyId: string,
      firebaseUid: string,
      data: Record<string, unknown>,
    ): Promise<void> {
      await db()
        .collection('groupMembers')
        .doc(membershipDocId(legacyId, firebaseUid))
        .set(data);
    },
    async updateMembership(
      legacyId: string,
      firebaseUid: string,
      patch: Record<string, unknown>,
    ): Promise<void> {
      await db()
        .collection('groupMembers')
        .doc(membershipDocId(legacyId, firebaseUid))
        .update(patch);
    },
  };
}
