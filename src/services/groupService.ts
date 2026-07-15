import {
  addDoc,
  collection,
  deleteField,
  doc,
  documentId,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Group } from '../types';
import { buildGroupDefaults, isGroupActive } from '../utils/groupLifecycle';

type CreateGroupInput = {
  name: string;
  description: string;
  ownerId: string;
  coverImageUrl?: string;
  isPrivate?: boolean;
  requireAdminApproval?: boolean;
  allowMemberChallenges?: boolean;
  groupType?: string;
  activityInterests?: string[];
  wellnessTopics?: string[];
  groupGoals?: string[];
  locationScope?: string;
  groupRules?: string[];
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

  /**
   * Public group discovery. Filters server-side on status == 'active',
   * isPrivate == false, and visibility == 'public' so private, inactive, or
   * moderated-out groups never come back from Firestore for browsing —
   * client-side filtering alone would still transmit that data to the client.
   * isPrivate and visibility are redundant by design (visibility is derived
   * from isPrivate) — requiring both is defense-in-depth in case the two ever
   * drift. moderationStatus is still checked client-side via isGroupActive().
   * Requires a composite index on (status ASC, isPrivate ASC, visibility ASC,
   * createdAt DESC); see firestore.indexes.json.
   */
  async getGroupsPage(): Promise<Group[]> {
    const snap = await getDocs(
      query(
        collection(db, this.collectionName),
        where('status', '==', 'active'),
        where('isPrivate', '==', false),
        where('visibility', '==', 'public'),
        orderBy('createdAt', 'desc'),
        limit(100),
      ),
    );
    return snap.docs
      .map((d) => {
        const data = d.data() as Omit<Group, 'id'>;
        return { id: d.id, ...data };
      })
      .filter((g) => isGroupActive(g))
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

    const groups = await this.getGroupsByIds(groupIds);
    return groups.filter((g) => isGroupActive(g));
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
    const defaults = buildGroupDefaults({
      name: input.name,
      description: input.description,
      ownerId: input.ownerId,
      coverImageUrl: input.coverImageUrl,
      isPrivate: input.isPrivate,
      requireAdminApproval: input.requireAdminApproval,
      allowMemberChallenges: input.allowMemberChallenges,
      inviteCode: `${inviteCodeBase}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    });
    // buildGroupDefaults's GroupDefaultsInput/return type only covers the
    // lifecycle-critical fields; it does not know about these optional
    // metadata fields, so they must be spread onto the payload here rather
    // than passed into buildGroupDefaults (where they were previously
    // silently dropped — excess properties in a conditional spread aren't
    // caught by the type checker, so this went unnoticed).
    const payload: Omit<Group, 'id'> = {
      ...defaults,
      ...(input.groupType && { groupType: input.groupType as Group['groupType'] }),
      ...(input.activityInterests?.length && { activityInterests: input.activityInterests }),
      ...(input.wellnessTopics?.length && { wellnessTopics: input.wellnessTopics }),
      ...(input.groupGoals?.length && { groupGoals: input.groupGoals }),
      ...(input.locationScope && { locationScope: input.locationScope as Group['locationScope'] }),
      ...(input.groupRules?.length && { groupRules: input.groupRules }),
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
    if (!isGroupActive(group)) {
      throw new Error('This group is no longer active and cannot be joined.');
    }

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
      await updateDoc(doc(db, this.collectionName, groupId), {
        memberCount: increment(1),
      });
      return {
        group: {
          ...group,
          memberCount: Math.max(1, (group.memberCount || 0) + 1),
        },
        status: 'joined',
      };
    }

    return { group, status };
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
    await updateDoc(doc(db, this.collectionName, groupId), {
      memberCount: increment(-1),
    });
  }

  async updateGroup(groupId: string, patch: UpdateGroupInput): Promise<void> {
    const ref = doc(db, this.collectionName, groupId);
    const payload: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.description !== undefined) payload.description = patch.description;
    // Same null-to-clear contract as the 6 metadata fields below: `null`
    // means the owner explicitly removed the cover image and it must be
    // deleted from Firestore, not merely omitted (which would leave the old
    // cover in place — the same stale-field bug fixed for metadata).
    if (patch.coverImageUrl !== undefined) payload.coverImageUrl = patch.coverImageUrl === null ? deleteField() : patch.coverImageUrl;
    if (patch.isPrivate !== undefined) {
      payload.isPrivate = patch.isPrivate;
      // Keep the denormalized visibility field in sync so discovery queries
      // (which filter on visibility, not isPrivate) never leak a group whose
      // privacy was flipped via edit. See getGroupsPage().
      payload.visibility = patch.isPrivate ? 'private' : 'public';
    }
    if (patch.requireAdminApproval !== undefined) payload.requireAdminApproval = patch.requireAdminApproval;
    if (patch.allowMemberChallenges !== undefined) payload.allowMemberChallenges = patch.allowMemberChallenges;
    // These 6 fields are optional metadata that an owner can clear via Edit.
    // `undefined` means "not part of this patch, leave untouched"; `null` is
    // the explicit clear sentinel and must translate to Firestore's
    // deleteField() — never a literal `undefined` (which addDoc/updateDoc
    // reject) and never silently dropped (which would leave stale data, the
    // exact regression this guards against).
    if (patch.groupType !== undefined) payload.groupType = patch.groupType === null ? deleteField() : patch.groupType;
    if (patch.activityInterests !== undefined) payload.activityInterests = patch.activityInterests === null ? deleteField() : patch.activityInterests;
    if (patch.wellnessTopics !== undefined) payload.wellnessTopics = patch.wellnessTopics === null ? deleteField() : patch.wellnessTopics;
    if (patch.groupGoals !== undefined) payload.groupGoals = patch.groupGoals === null ? deleteField() : patch.groupGoals;
    if (patch.locationScope !== undefined) payload.locationScope = patch.locationScope === null ? deleteField() : patch.locationScope;
    if (patch.groupRules !== undefined) payload.groupRules = patch.groupRules === null ? deleteField() : patch.groupRules;

    await updateDoc(ref, payload);
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

export type UpdateGroupInput = {
  name?: string;
  description?: string;
  isPrivate?: boolean;
  requireAdminApproval?: boolean;
  allowMemberChallenges?: boolean;
  // `null` explicitly clears the field (translated to Firestore's
  // deleteField() by updateGroup); `undefined`/omitted leaves it untouched.
  coverImageUrl?: string | null;
  groupType?: string | null;
  activityInterests?: string[] | null;
  wellnessTopics?: string[] | null;
  groupGoals?: string[] | null;
  locationScope?: string | null;
  groupRules?: string[] | null;
};

export type { CreateGroupInput, GroupJoinResult, ReportGroupInput };
