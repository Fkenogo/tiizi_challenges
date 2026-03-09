import {
  addDoc,
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
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
  status: 'joined' | 'active' | 'pending' | 'rejected' | 'left';
  createdAt: string;
  approvedAt?: string;
  seedTag?: string;
};

type ReportGroupInput = {
  groupId: string;
  reporterUid: string;
  reason: string;
  reportType?: 'group' | 'member';
  reportedUserId?: string;
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

  async getGroups(): Promise<Group[]> {
    const snap = await getDocs(collection(db, this.collectionName));
    return snap.docs
      .map((d) => {
        const data = d.data() as Omit<Group, 'id'>;
        return { id: d.id, ...data };
      })
      .map((group) => ({ ...group, memberCount: group.memberCount ?? 0 }))
      .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
  }

  async getMyGroups(userId: string): Promise<Group[]> {
    const membershipSnap = await getDocs(
      query(collection(db, this.membershipsCollection), where('userId', '==', userId)),
    );
    if (membershipSnap.empty) return [];

    const groupIds = membershipSnap.docs
      .map((item) => item.data() as GroupMembership)
      .filter((membership) => membership.status === 'joined' || membership.status === 'active')
      .map((membership) => membership.groupId);

    if (groupIds.length === 0) return [];

    return this.getGroupsByIds(groupIds);
  }

  async getGroupById(id: string): Promise<Group | null> {
    const snap = await getDoc(doc(db, this.collectionName, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<Group, 'id'>) };
  }

  async getGroupsByIds(groupIds: string[]): Promise<Group[]> {
    const uniqueIds = Array.from(new Set(groupIds)).filter(Boolean);
    if (uniqueIds.length === 0) return [];

    const chunks: string[][] = [];
    for (let i = 0; i < uniqueIds.length; i += 10) {
      chunks.push(uniqueIds.slice(i, i + 10));
    }

    const snaps = await Promise.all(
      chunks.map((chunk) =>
        getDocs(
          query(collection(db, this.collectionName), where(documentId(), 'in', chunk)),
        ),
      ),
    );

    const groups: Group[] = snaps.flatMap((snap) =>
      snap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Group, 'id'>) })),
    );

    return groups;
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
      status: 'active',
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
      if (existing.status === 'active') {
        return { group, status: 'joined' };
      }
      if (existing.status === 'joined') {
        await setDoc(memberRef, { status: 'active', approvedAt: nowIso }, { merge: true });
        return { group, status: 'joined' };
      }
      if (existing.status === 'pending') {
        return { group, status: 'pending' };
      }
    }

    const needsApproval = !!group.isPrivate || !!group.requireAdminApproval;
    const status: GroupMembership['status'] = needsApproval ? 'pending' : 'active';

    await setDoc(memberRef, {
      groupId,
      userId,
      role: 'member',
      status,
      createdAt: nowIso,
      approvedAt: status === 'active' ? nowIso : undefined,
    } satisfies GroupMembership);

    if (status === 'active') {
      return {
        group: {
          ...group,
          memberCount: Math.max(1, group.memberCount || 0),
        },
        status: 'joined',
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
    if (member.status === 'active') return 'joined';
    return member.status;
  }

  async getGroupMemberCount(groupId: string): Promise<number> {
    const membershipsSnap = await getDocs(
      query(collection(db, this.membershipsCollection), where('groupId', '==', groupId)),
    );

    return membershipsSnap.docs
      .map((item) => String((item.data() as GroupMembership).status ?? '').toLowerCase())
      .filter((status) => status === 'joined' || status === 'active')
      .length;
  }

  async leaveGroup(groupId: string, userId: string): Promise<void> {
    const group = await this.getGroupById(groupId);
    if (!group) throw new Error('Group not found');
    if (group.ownerId === userId) {
      throw new Error('Group owner cannot leave. Transfer ownership first.');
    }

    const memberRef = doc(db, this.membershipsCollection, `${groupId}_${userId}`);
    const memberSnap = await getDoc(memberRef);
    if (!memberSnap.exists()) return;

    const membership = memberSnap.data() as GroupMembership;
    if (membership.status !== 'joined' && membership.status !== 'active') return;

    await updateDoc(memberRef, {
      status: 'left',
      leftAt: new Date().toISOString(),
    });
  }

  async reportGroup(input: ReportGroupInput): Promise<string> {
    const group = await this.getGroupById(input.groupId);
    if (!group) throw new Error('Group not found');
    if (!input.reason.trim()) throw new Error('Reason is required');

    const ref = await addDoc(collection(db, 'groupReports'), {
      groupId: input.groupId,
      groupName: group.name,
      reportType: input.reportType ?? 'group',
      reason: input.reason.trim(),
      reportedUserId: input.reportedUserId || null,
      reportedBy: input.reporterUid,
      status: 'open',
      createdAt: new Date().toISOString(),
    });
    return ref.id;
  }
}

export const groupService = new GroupService();
export type { CreateGroupInput, GroupJoinResult, ReportGroupInput };
