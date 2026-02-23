import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Group } from '../types';

type CreateGroupInput = {
  name: string;
  description: string;
  ownerId: string;
  coverImageUrl?: string;
  isPrivate?: boolean;
  requireAdminApproval?: boolean;
  allowMemberChallenges?: boolean;
};

type GroupJoinResult = {
  group: Group;
  status: 'joined' | 'pending';
};

type GroupMembership = {
  groupId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  status: 'joined' | 'pending' | 'rejected';
  createdAt: string;
  approvedAt?: string;
};

function normalizeInviteCode(name: string) {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 12);
}

class GroupService {
  private collectionName = 'groups';
  private membershipsCollection = 'groupMembers';
  private seedTag = 'tiizi_seed_v1';

  private async bootstrapSeedMemberships(userId: string): Promise<void> {
    const existing = await getDocs(
      query(collection(db, this.membershipsCollection), where('userId', '==', userId), limit(1)),
    );
    if (!existing.empty) return;

    const seedGroupsSnap = await getDocs(
      query(
        collection(db, this.collectionName),
        where('seedTag', '==', this.seedTag),
        where('isPrivate', '==', false),
        limit(3),
      ),
    );

    if (seedGroupsSnap.empty) return;

    const nowIso = new Date().toISOString();
    await Promise.all(
      seedGroupsSnap.docs.map(async (groupDoc) => {
        const membershipRef = doc(db, this.membershipsCollection, `${groupDoc.id}_${userId}`);
        await setDoc(
          membershipRef,
          {
            groupId: groupDoc.id,
            userId,
            role: 'member',
            status: 'joined',
            createdAt: nowIso,
            approvedAt: nowIso,
            seedTag: this.seedTag,
          } satisfies GroupMembership & { seedTag: string },
          { merge: true },
        );
      }),
    );
  }

  async getGroups(): Promise<Group[]> {
    const snap = await getDocs(collection(db, this.collectionName));
    return snap.docs
      .map((d) => {
        const data = d.data() as Omit<Group, 'id'>;
        return { id: d.id, ...data };
      })
      .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
  }

  async getMyGroups(userId: string): Promise<Group[]> {
    let membershipSnap = await getDocs(
      query(collection(db, this.membershipsCollection), where('userId', '==', userId), where('status', '==', 'joined')),
    );

    if (membershipSnap.empty) {
      await this.bootstrapSeedMemberships(userId);
      membershipSnap = await getDocs(
        query(collection(db, this.membershipsCollection), where('userId', '==', userId), where('status', '==', 'joined')),
      );
    }

    if (membershipSnap.empty) return [];

    const groupIds = membershipSnap.docs.map((item) => (item.data() as GroupMembership).groupId);
    const groups = await Promise.all(groupIds.map((groupId) => this.getGroupById(groupId)));
    return groups.filter((group): group is Group => !!group);
  }

  async getGroupById(id: string): Promise<Group | null> {
    const snap = await getDoc(doc(db, this.collectionName, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<Group, 'id'>) };
  }

  async getGroupsByOwner(ownerId: string): Promise<Group[]> {
    const q = query(collection(db, this.collectionName), where('ownerId', '==', ownerId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Group, 'id'>) }));
  }

  async createGroup(input: CreateGroupInput): Promise<Group> {
    const inviteCodeBase = normalizeInviteCode(input.name || 'GROUP');
    const payload: Omit<Group, 'id'> = {
      name: input.name,
      description: input.description,
      ownerId: input.ownerId,
      memberCount: 1,
      createdAt: new Date().toISOString(),
      coverImageUrl: input.coverImageUrl,
      isPrivate: !!input.isPrivate,
      requireAdminApproval: !!input.requireAdminApproval,
      allowMemberChallenges: input.allowMemberChallenges ?? true,
      inviteCode: `${inviteCodeBase}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      activeChallenges: 0,
    };
    const ref = await addDoc(collection(db, this.collectionName), payload);

    const ownerMembershipRef = doc(db, this.membershipsCollection, `${ref.id}_${input.ownerId}`);
    await setDoc(ownerMembershipRef, {
      groupId: ref.id,
      userId: input.ownerId,
      role: 'owner',
      status: 'joined',
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
    } satisfies GroupMembership);

    return { id: ref.id, ...payload };
  }

  async joinGroup(groupId: string, userId: string): Promise<GroupJoinResult | null> {
    const group = await this.getGroupById(groupId);
    if (!group) return null;

    const memberRef = doc(db, this.membershipsCollection, `${groupId}_${userId}`);
    const memberSnap = await getDoc(memberRef);
    const nowIso = new Date().toISOString();

    if (memberSnap.exists()) {
      const existing = memberSnap.data() as GroupMembership;
      if (existing.status === 'joined') {
        return { group, status: 'joined' };
      }
      if (existing.status === 'pending') {
        return { group, status: 'pending' };
      }
    }

    const needsApproval = !!group.isPrivate || !!group.requireAdminApproval;
    const status: GroupMembership['status'] = needsApproval ? 'pending' : 'joined';

    await setDoc(memberRef, {
      groupId,
      userId,
      role: 'member',
      status,
      createdAt: nowIso,
      approvedAt: status === 'joined' ? nowIso : undefined,
    } satisfies GroupMembership);

    if (status === 'joined') {
      await updateDoc(doc(db, this.collectionName, groupId), {
        memberCount: increment(1),
      });
      return {
        group: {
          ...group,
          memberCount: (group.memberCount || 0) + 1,
        },
        status,
      };
    }

    return { group, status };
  }

  async joinGroupByInviteCode(inviteCode: string, userId: string): Promise<GroupJoinResult | null> {
    const normalized = inviteCode.trim().toUpperCase();
    if (!normalized) return null;

    const groupSnap = await getDocs(
      query(collection(db, this.collectionName), where('inviteCode', '==', normalized), limit(1)),
    );
    if (groupSnap.empty) return null;

    const groupDoc = groupSnap.docs[0];
    return this.joinGroup(groupDoc.id, userId);
  }

  async getMembershipStatus(groupId: string, userId: string): Promise<GroupMembership['status'] | 'none'> {
    const group = await this.getGroupById(groupId);
    if (group?.ownerId === userId) {
      return 'joined';
    }

    const memberRef = doc(db, this.membershipsCollection, `${groupId}_${userId}`);
    const memberSnap = await getDoc(memberRef);
    if (!memberSnap.exists()) return 'none';
    const member = memberSnap.data() as GroupMembership;
    return member.status;
  }
}

export const groupService = new GroupService();
export type { CreateGroupInput, GroupJoinResult };
