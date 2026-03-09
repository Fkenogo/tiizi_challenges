import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  QueryConstraint,
  query,
  setDoc,
  updateDoc,
  where,
  increment,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Challenge, ChallengeMember } from '../types';

type CreateChallengeInput = {
  category?: Challenge['category'];
  name: string;
  description: string;
  createdBy: string;
  groupId: string;
  startDate?: string;
  endDate?: string;
  durationDays?: number;
  challengeType?: 'collective' | 'competitive' | 'streak';
  coverImageUrl?: string;
  exerciseIds?: string[];
  activities?: Array<{
    exerciseId?: string;
    activityId?: string;
    activityType?: string;
    exerciseName?: string;
    description?: string;
    category?: string;
    difficulty?: string;
    icon?: string;
    targetValue: number;
    unit: string;
    instructions?: string[];
    protocolSteps?: string[];
    benefits?: string[];
    guidelines?: string[];
    warnings?: string[];
    frequency?: 'daily' | 'weekly' | '3x-week' | 'custom';
    pointsPerCompletion?: number;
    dailyFrequency?: number;
  }>;
  donation?: {
    enabled: boolean;
    causeName?: string;
    causeDescription?: string;
    targetAmountKes?: number;
    contributionStartDate?: string;
    contributionEndDate?: string;
    contributionPhoneNumber?: string;
    contributionCardUrl?: string;
    disclaimer?: string;
  };
};

const ACTIVE_GROUP_MEMBER_STATUSES = ['joined', 'active'];

function removeUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => removeUndefinedDeep(item)) as T;
  }

  if (value && typeof value === 'object') {
    const cleaned = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, removeUndefinedDeep(item)]);
    return Object.fromEntries(cleaned) as T;
  }

  return value;
}

function membershipDocId(groupId: string, userId: string) {
  return `${groupId}_${userId}`;
}

function challengeMemberDocId(challengeId: string, userId: string) {
  return `${challengeId}_${userId}`;
}

type ChallengeMembershipSummary = {
  status: ChallengeMember['status'];
  activitiesCompleted: number;
  totalActivities: number;
  completionRate: number;
  totalPoints: number;
  lastActivityAt?: string;
};

function unknownDateToIso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null) {
    const candidate = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
    if (typeof candidate.toDate === 'function') {
      return candidate.toDate().toISOString();
    }
    if (typeof candidate.seconds === 'number') {
      return new Date(candidate.seconds * 1000).toISOString();
    }
  }
  return undefined;
}

async function isGroupMember(groupId: string, userId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'groupMembers', membershipDocId(groupId, userId)));
  if (!snap.exists()) return false;
  const status = String((snap.data() as { status?: string }).status ?? '').toLowerCase();
  return ACTIVE_GROUP_MEMBER_STATUSES.includes(status);
}

class ChallengeService {
  private collectionName = 'challenges';
  private challengeMembersCollection = 'challengeMembers';
  private groupMembersCollection = 'groupMembers';

  async canAccessChallenge(userId: string, challengeId: string): Promise<boolean> {
    const challengeDoc = await getDoc(doc(db, this.collectionName, challengeId));
    if (!challengeDoc.exists()) return false;

    const challenge = challengeDoc.data() as Omit<Challenge, 'id'>;
    if (!challenge.groupId) return false;

    return isGroupMember(challenge.groupId, userId);
  }

  async isMember(userId: string, challengeId: string): Promise<boolean> {
    const membershipSnap = await getDoc(
      doc(db, this.challengeMembersCollection, challengeMemberDocId(challengeId, userId)),
    );
    if (!membershipSnap.exists()) return false;
    const status = String((membershipSnap.data() as { status?: string }).status ?? '').toLowerCase();
    return status === 'active';
  }

  async getChallengeMembership(userId: string, challengeId: string): Promise<ChallengeMember | null> {
    const membershipSnap = await getDoc(
      doc(db, this.challengeMembersCollection, challengeMemberDocId(challengeId, userId)),
    );
    if (!membershipSnap.exists()) return null;
    return membershipSnap.data() as ChallengeMember;
  }

  async joinChallenge(userId: string, challengeId: string): Promise<void> {
    const challengeRef = doc(db, this.collectionName, challengeId);
    const challengeSnap = await getDoc(challengeRef);

    if (!challengeSnap.exists()) {
      throw new Error('Challenge not found');
    }

    const challenge = challengeSnap.data() as Omit<Challenge, 'id'>;
    if (!challenge.groupId) {
      throw new Error('Challenge has no group');
    }

    const groupMemberRef = doc(db, this.groupMembersCollection, membershipDocId(challenge.groupId, userId));
    const groupMemberSnap = await getDoc(groupMemberRef);
    if (!groupMemberSnap.exists()) {
      throw new Error('Must be a group member to join this challenge');
    }
    const groupMemberStatus = String((groupMemberSnap.data() as { status?: string }).status ?? '').toLowerCase();
    if (!ACTIVE_GROUP_MEMBER_STATUSES.includes(groupMemberStatus)) {
      throw new Error('Must be an active group member to join this challenge');
    }

    const memberRef = doc(
      db,
      this.challengeMembersCollection,
      challengeMemberDocId(challengeId, userId),
    );
    const memberSnap = await getDoc(memberRef);

    if (memberSnap.exists()) {
      const existing = memberSnap.data() as ChallengeMember;
      if (existing.status === 'active') return;
    }

    const totalActivities = challenge.activities?.length ?? 0;
    const now = Timestamp.now();

    const batch = writeBatch(db);
    batch.set(memberRef, {
      challengeId,
      userId,
      groupId: challenge.groupId,
      joinedAt: now,
      status: 'active',
      activitiesCompleted: 0,
      totalActivities,
      totalPoints: 0,
      completionRate: 0,
    } satisfies ChallengeMember, { merge: true });

    const userRef = doc(db, 'users', userId);
    batch.set(
      userRef,
      {
        stats: {
          totalChallenges: increment(1),
        },
        lastChallengeJoinedAt: now,
      },
      { merge: true },
    );

    await batch.commit();
  }

  async leaveChallenge(userId: string, challengeId: string): Promise<void> {
    const membershipRef = doc(
      db,
      this.challengeMembersCollection,
      challengeMemberDocId(challengeId, userId),
    );
    const membershipSnap = await getDoc(membershipRef);
    if (!membershipSnap.exists()) return;

    const membership = membershipSnap.data() as ChallengeMember;
    if (membership.status !== 'active') return;

    await setDoc(
      membershipRef,
      {
        status: 'abandoned',
        leftAt: Timestamp.now(),
      },
      { merge: true },
    );
  }

  async getChallengeParticipantCount(challengeId: string): Promise<number> {
    const [challengeSnap, membersSnap] = await Promise.all([
      getDoc(doc(db, this.collectionName, challengeId)),
      getDocs(query(collection(db, this.challengeMembersCollection), where('challengeId', '==', challengeId))),
    ]);

    const fromChallenge = challengeSnap.exists()
      ? Number((challengeSnap.data() as { participantCount?: number }).participantCount ?? 0)
      : 0;
    const fromMemberships = membersSnap.docs
      .map((item) => String((item.data() as { status?: string }).status ?? '').toLowerCase())
      .filter((status) => status === 'active' || status === 'completed')
      .length;

    return Math.max(0, Math.max(fromChallenge, fromMemberships));
  }

  async getChallengeParticipantCounts(challengeIds: string[]): Promise<Map<string, number>> {
    if (challengeIds.length === 0) return new Map();

    const uniqueIds = Array.from(new Set(challengeIds)).filter(Boolean);
    const counts = new Map<string, number>();

    for (let i = 0; i < uniqueIds.length; i += 10) {
      const chunk = uniqueIds.slice(i, i + 10);
      const [challengeSnap, membershipSnap] = await Promise.all([
        getDocs(query(collection(db, this.collectionName), where(documentId(), 'in', chunk))),
        getDocs(query(collection(db, this.challengeMembersCollection), where('challengeId', 'in', chunk))),
      ]);

      const persistedCounts = new Map<string, number>();
      challengeSnap.docs.forEach((item) => {
        const data = item.data() as { participantCount?: number };
        persistedCounts.set(item.id, Math.max(0, Number(data.participantCount ?? 0)));
      });

      const computedCounts = new Map<string, number>();
      membershipSnap.docs.forEach((item) => {
        const data = item.data() as { challengeId?: string; status?: string };
        if (!data.challengeId) return;
        const status = String(data.status ?? '').toLowerCase();
        if (status !== 'active' && status !== 'completed') return;
        computedCounts.set(data.challengeId, Number(computedCounts.get(data.challengeId) ?? 0) + 1);
      });

      chunk.forEach((id) => {
        counts.set(
          id,
          Math.max(
            0,
            Math.max(
              Number(persistedCounts.get(id) ?? 0),
              Number(computedCounts.get(id) ?? 0),
            ),
          ),
        );
      });
    }

    return counts;
  }

  async getUserChallengeMembershipIndex(userId: string): Promise<Map<string, ChallengeMember['status']>> {
    const snap = await getDocs(
      query(collection(db, this.challengeMembersCollection), where('userId', '==', userId)),
    );
    const index = new Map<string, ChallengeMember['status']>();
    snap.docs.forEach((item) => {
      const data = item.data() as Partial<ChallengeMember>;
      if (data.challengeId && data.status) {
        index.set(data.challengeId, data.status);
      }
    });
    return index;
  }

  async getUserChallengeMembershipSummaries(userId: string): Promise<Map<string, ChallengeMembershipSummary>> {
    const snap = await getDocs(
      query(collection(db, this.challengeMembersCollection), where('userId', '==', userId)),
    );
    const index = new Map<string, ChallengeMembershipSummary>();
    snap.docs.forEach((item) => {
      const data = item.data() as Partial<ChallengeMember>;
      if (!data.challengeId || !data.status) return;
      index.set(data.challengeId, {
        status: data.status,
        activitiesCompleted: Number(data.activitiesCompleted ?? 0),
        totalActivities: Number(data.totalActivities ?? 0),
        completionRate: Number(data.completionRate ?? 0),
        totalPoints: Number(data.totalPoints ?? 0),
        lastActivityAt: unknownDateToIso(data.lastActivityAt),
      });
    });
    return index;
  }

  async getUserAccessibleChallenges(userId: string): Promise<Challenge[]> {
    const membersSnap = await getDocs(
      query(
        collection(db, this.groupMembersCollection),
        where('userId', '==', userId),
      ),
    );

    const userGroupIds = membersSnap.docs
      .map((item) => item.data() as { groupId?: string; status?: string })
      .filter((item) =>
        ACTIVE_GROUP_MEMBER_STATUSES.includes(String(item.status ?? '').toLowerCase()),
      )
      .map((item) => item.groupId)
      .filter((id): id is string => !!id);

    if (userGroupIds.length === 0) return [];

    const chunks: string[][] = [];
    for (let i = 0; i < userGroupIds.length; i += 10) {
      chunks.push(userGroupIds.slice(i, i + 10));
    }

    const snaps = await Promise.all(
      chunks.map((chunk) =>
        getDocs(
          query(
            collection(db, this.collectionName),
            where('groupId', 'in', chunk),
          ),
        ),
      ),
    );

    const all: Challenge[] = snaps.flatMap((chunkSnap) =>
      chunkSnap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Challenge, 'id'>) })),
    );

    const sorted = all
      .filter((item) => item.status === 'active' || (item.createdBy === userId && item.status === 'draft'))
      .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
    const counts = await this.getChallengeParticipantCounts(sorted.map((item) => item.id));

    return sorted.map((item) => ({
      ...item,
      participantCount: counts.get(item.id) ?? Number(item.participantCount ?? 0),
    }));
  }

  async getChallenges(): Promise<Challenge[]> {
    const snap = await getDocs(collection(db, this.collectionName));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Challenge, 'id'>) }))
      .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
  }

  async getActiveChallenges(maxResults?: number): Promise<Challenge[]> {
    const constraints: QueryConstraint[] = [where('status', '==', 'active')];
    if (typeof maxResults === 'number' && maxResults > 0) {
      constraints.push(limit(maxResults));
    }
    const snap = await getDocs(
      query(collection(db, this.collectionName), ...constraints),
    );
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Challenge, 'id'>) }))
      .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
  }

  async getVisibleChallengesForUser(
    userId: string,
    options?: { maxResults?: number; statuses?: Challenge['status'][] },
  ): Promise<Challenge[]> {
    if (!userId) return [];

    const [membershipSnap, groupsSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, this.groupMembersCollection),
          where('userId', '==', userId),
        ),
      ),
      getDocs(collection(db, 'groups')),
    ]);

    const myGroupIds = membershipSnap.docs
      .map((item) => item.data() as { groupId?: string; status?: string })
      .filter((item) =>
        ACTIVE_GROUP_MEMBER_STATUSES.includes(String(item.status ?? '').toLowerCase()),
      )
      .map((item) => item.groupId)
      .filter((id): id is string => !!id);

    const publicGroupIds = groupsSnap.docs
      .map((item) => ({ id: item.id, ...(item.data() as { isPrivate?: boolean }) }))
      .filter((group) => group.isPrivate !== true)
      .map((group) => group.id);

    const allowedGroupIds = Array.from(new Set([...myGroupIds, ...publicGroupIds]));
    if (allowedGroupIds.length === 0) return [];

    const chunks: string[][] = [];
    for (let i = 0; i < allowedGroupIds.length; i += 10) {
      chunks.push(allowedGroupIds.slice(i, i + 10));
    }

    const statusFilter = options?.statuses?.length ? options.statuses : ['active'];
    const results: Challenge[] = [];

    for (const chunk of chunks) {
      const snap = await getDocs(
        query(
          collection(db, this.collectionName),
          where('groupId', 'in', chunk),
        ),
      );
      snap.docs.forEach((item) => {
        const payload = { id: item.id, ...(item.data() as Omit<Challenge, 'id'>) };
        if (statusFilter.includes(payload.status)) {
          results.push(payload);
        }
      });
    }

    const deduped = Array.from(
      new Map(results.map((item) => [item.id, item])).values(),
    ).sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
    const counts = await this.getChallengeParticipantCounts(deduped.map((item) => item.id));
    const withCounts = deduped.map((item) => ({
      ...item,
      participantCount: counts.get(item.id) ?? Number(item.participantCount ?? 0),
    }));

    if (typeof options?.maxResults === 'number' && options.maxResults > 0) {
      return withCounts.slice(0, options.maxResults);
    }

    return withCounts;
  }

  async getChallengeById(id: string): Promise<Challenge | null> {
    const snap = await getDoc(doc(db, this.collectionName, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<Challenge, 'id'>) };
  }

  async getChallengesByGroup(groupId: string): Promise<Challenge[]> {
    const q = query(collection(db, this.collectionName), where('groupId', '==', groupId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Challenge, 'id'>) }));
  }

  async getGroupChallenges(groupId: string, userId: string): Promise<Challenge[]> {
    const hasMembership = await isGroupMember(groupId, userId);
    if (!hasMembership) {
      throw new Error('Not a member of this group');
    }

    const q = query(
      collection(db, this.collectionName),
      where('groupId', '==', groupId),
      where('status', '==', 'active'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Challenge, 'id'>) }));
  }

  async createChallenge(input: CreateChallengeInput): Promise<Challenge> {
    if (!input.groupId) {
      throw new Error('groupId is required to create a challenge');
    }

    const creatorMembershipRef = doc(db, 'groupMembers', membershipDocId(input.groupId, input.createdBy));
    let creatorMembershipSnap = await getDoc(creatorMembershipRef);
    if (!creatorMembershipSnap.exists()) {
      const groupSnap = await getDoc(doc(db, 'groups', input.groupId));
      const groupOwnerId = groupSnap.exists()
        ? String((groupSnap.data() as { ownerId?: string }).ownerId ?? '')
        : '';

      if (groupOwnerId === input.createdBy) {
        await setDoc(
          creatorMembershipRef,
          {
            groupId: input.groupId,
            userId: input.createdBy,
            role: 'owner',
            status: 'active',
            createdAt: new Date().toISOString(),
            approvedAt: new Date().toISOString(),
          },
          { merge: true },
        );
        creatorMembershipSnap = await getDoc(creatorMembershipRef);
      }
    }
    if (!creatorMembershipSnap.exists()) {
      throw new Error('You must join this group before creating a challenge');
    }

    const creatorMembership = creatorMembershipSnap.data() as { status?: string };
    const creatorStatus = String(creatorMembership.status ?? '').toLowerCase();
    if (!ACTIVE_GROUP_MEMBER_STATUSES.includes(creatorStatus)) {
      throw new Error('You must be an active group member to create a challenge');
    }

    const startDate = input.startDate ? new Date(input.startDate) : new Date();
    const endDate = input.endDate
      ? new Date(input.endDate)
      : (() => {
          const next = new Date(startDate);
          next.setDate(startDate.getDate() + (input.durationDays ?? 14));
          return next;
        })();

    const requiresDonationApproval = !!input.donation?.enabled;
    const payload: Omit<Challenge, 'id'> = {
      category: input.category ?? 'fitness',
      name: input.name,
      description: input.description,
      groupId: input.groupId,
      exerciseIds: input.exerciseIds ?? [],
      challengeType: input.challengeType ?? 'collective',
      coverImageUrl: input.coverImageUrl,
      activities: input.activities ?? [],
      donation: input.donation
        ? {
            ...input.donation,
            approvalRequired: !!input.donation.enabled,
            approvalStatus: input.donation.enabled ? 'pending' : 'approved',
            disclaimer:
              input.donation.disclaimer
              || (input.donation.enabled
                ? 'Tiizi does not hold or manage funds. Contributions are coordinated by the group.'
                : undefined),
          }
        : undefined,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      createdBy: input.createdBy,
      status: requiresDonationApproval ? 'draft' : 'active',
      participantCount: 0,
      moderationStatus: requiresDonationApproval ? 'pending' : 'approved',
    };

    const challengeRef = doc(collection(db, this.collectionName));
    const challengeId = challengeRef.id;

    const sanitizedPayload = removeUndefinedDeep(payload);

    await setDoc(challengeRef, sanitizedPayload);
    if (!requiresDonationApproval) {
      try {
        await this.joinChallenge(input.createdBy, challengeId);
        await setDoc(challengeRef, { participantCount: 1 }, { merge: true });
      } catch (error) {
        // Challenge is already created. Do not block launch if membership backfill fails.
        console.error('Challenge created but auto-join failed:', error);
      }
    }

    return { id: challengeId, ...sanitizedPayload };
  }

  async updateChallengeStatus(id: string, status: Challenge['status']): Promise<void> {
    await updateDoc(doc(db, this.collectionName, id), { status });
  }
}

export const challengeService = new ChallengeService();
export type { CreateChallengeInput };
