import {
  collection,
  deleteField,
  doc,
  documentId,
  DocumentSnapshot,
  getDoc,
  getDocs,
  limit,
  orderBy,
  QueryConstraint,
  query,
  setDoc,
  startAfter,
  updateDoc,
  where,
  increment,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Challenge, ChallengeMember } from '../types';
import { computeRequiredLogs } from './challengeCompletion';
import { isGroupActive } from '../utils/groupLifecycle';

type ChallengeCursor = DocumentSnapshot;

type ChallengeDiscoveryPageOptions = {
  pageSize?: number;
  statuses?: Challenge['status'][];
  cursor?: ChallengeCursor;
  userId?: string;
};

type PaginatedChallengeResponse = {
  items: Challenge[];
  nextCursor: ChallengeCursor | null;
  hasMore: boolean;
};

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
    frequency?: 'daily' | 'weekly' | '2x-week' | '3x-week' | '5x-week' | 'custom';
    pointsPerCompletion?: number;
    dailyFrequency?: number;
    targetType?: 'daily' | 'cumulative';
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
  // v2 engine fields
  engineVersion?: 'v2';
  groupCumulativeTarget?: number;
  autoCompleteOnGroupTarget?: boolean;
  requiredConsecutiveDays?: number;
  streakResetOnMiss?: boolean;
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

export type ChallengeMembershipSummary = {
  status: ChallengeMember['status'];
  activitiesCompleted: number;
  totalActivities: number;
  completionRate: number;
  totalPoints: number;
  lastActivityAt?: string;
  /** Total value logged by the user across all activities (competitive / collective user contribution). */
  cumulativeLoggedValue: number;
  /** Current streak day count (streak challenges). */
  currentStreak: number;
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

    const [groupMemberSnap, groupSnap] = await Promise.all([
      getDoc(doc(db, this.groupMembersCollection, membershipDocId(challenge.groupId, userId))),
      getDoc(doc(db, 'groups', challenge.groupId)),
    ]);
    if (!groupMemberSnap.exists()) {
      throw new Error('Must be a group member to join this challenge');
    }
    if (!isGroupActive(groupSnap.exists() ? (groupSnap.data() as { status?: string }) : null)) {
      throw new Error('Cannot join a challenge in a deactivated group.');
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

    const totalActivities = computeRequiredLogs(challenge.durationDays, Math.max(1, challenge.activities?.length ?? 1));
    const now = Timestamp.now();
    const isStreakChallenge = challenge.engineVersion === 'v2' && challenge.challengeType === 'streak';

    const batch = writeBatch(db);

    // Base payload typed against ChallengeMember.
    const basePayload: ChallengeMember = {
      challengeId,
      userId,
      groupId: challenge.groupId,
      joinedAt: now,
      status: 'active',
      activitiesCompleted: 0,
      totalActivities: computeRequiredLogs(challenge.durationDays, Math.max(1, challenge.activities?.length ?? 1)),
      totalPoints: 0,
      completionRate: 0,
    };

    // For streak challenges, reset streak state so a stale streak from a prior
    // membership cannot carry over through an abandonment gap.
    // deleteField() removes lastLogDate rather than setting it to undefined
    // (which merge:true would leave unchanged).
    const streakReset = isStreakChallenge
      ? { currentStreak: 0, longestStreak: 0, lastLogDate: deleteField() }
      : {};

    batch.set(memberRef, { ...basePayload, ...streakReset }, { merge: true });

    // participantCount is maintained exclusively by onChallengeMemberCreated/Updated
    // Cloud Function triggers (memberCounters.ts). Client-side increment removed
    // in Phase 18G-2B to eliminate double-write (BUG-G1).

    // BUG-006: totalChallenges tracks active memberships.
    // Increment on any join/rejoin (status transitions to active).
    // leaveChallenge decrements when the membership is abandoned.
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

    // Block leave once the member has logged activity — their data is part of the
    // challenge record and removing them would corrupt team totals and leaderboards.
    if ((membership.activitiesCompleted ?? 0) > 0) {
      throw new Error(
        'You have already logged activity in this challenge and cannot leave. Contact your group admin if you need to be removed.',
      );
    }

    const userRef = doc(db, 'users', userId);
    const batch = writeBatch(db);

    batch.set(membershipRef, { status: 'abandoned', leftAt: Timestamp.now() }, { merge: true });

    // participantCount decrement removed in Phase 18G-2B — handled exclusively by
    // onChallengeMemberUpdated trigger (active→abandoned transition, delta = -1).

    // BUG-006: reverse the join-time increment so repeated join/leave cycles
    // do not inflate totalChallenges beyond the number of active memberships.
    batch.set(userRef, { stats: { totalChallenges: increment(-1) } }, { merge: true });

    await batch.commit();
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
        cumulativeLoggedValue: Number(data.cumulativeLoggedValue ?? 0),
        currentStreak: Number(data.currentStreak ?? 0),
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

    const activeGroupIds = await this.filterActiveGroupIds(userGroupIds);
    if (activeGroupIds.length === 0) return [];

    const chunks: string[][] = [];
    for (let i = 0; i < activeGroupIds.length; i += 10) {
      chunks.push(activeGroupIds.slice(i, i + 10));
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

  async getChallengesForMyGroups(userId: string): Promise<Challenge[]> {
    const membersSnap = await getDocs(
      query(collection(db, this.groupMembersCollection), where('userId', '==', userId)),
    );
    const userGroupIds = membersSnap.docs
      .map((item) => item.data() as { groupId?: string; status?: string })
      .filter((item) => ACTIVE_GROUP_MEMBER_STATUSES.includes(String(item.status ?? '').toLowerCase()))
      .map((item) => item.groupId)
      .filter((id): id is string => !!id);

    if (userGroupIds.length === 0) return [];

    const activeGroupIds = await this.filterActiveGroupIds(userGroupIds);
    if (activeGroupIds.length === 0) return [];

    // One query per group — avoids the Firestore rule `get()` call limit that
    // triggers permission-denied on `where('groupId', 'in', largeChunk)` queries.
    const snaps = await Promise.all(
      activeGroupIds.map((groupId) =>
        getDocs(
          query(
            collection(db, this.collectionName),
            where('groupId', '==', groupId),
            where('status', '==', 'active'),
          ),
        ).catch(() => null),
      ),
    );

    const all: Challenge[] = snaps
      .filter(Boolean)
      .flatMap((snap) =>
        snap!.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Challenge, 'id'>) })),
      );

    const deduped = Array.from(new Map(all.map((c) => [c.id, c])).values()).sort(
      (a, b) => Date.parse(b.startDate) - Date.parse(a.startDate),
    );
    const counts = await this.getChallengeParticipantCounts(deduped.map((c) => c.id));
    return deduped.map((c) => ({ ...c, participantCount: counts.get(c.id) ?? Number(c.participantCount ?? 0) }));
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

    const [membershipSnap, publicGroupsSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, this.groupMembersCollection),
          where('userId', '==', userId),
        ),
      ),
      // Scoped query — only public groups. Replaces the former unbounded
      // getDocs(collection(db, 'groups')) that read every group on the platform.
      getDocs(
        query(collection(db, 'groups'), where('isPrivate', '==', false)),
      ),
    ]);

    const myGroupIds = membershipSnap.docs
      .map((item) => item.data() as { groupId?: string; status?: string })
      .filter((item) =>
        ACTIVE_GROUP_MEMBER_STATUSES.includes(String(item.status ?? '').toLowerCase()),
      )
      .map((item) => item.groupId)
      .filter((id): id is string => !!id);

    const publicGroupIds = publicGroupsSnap.docs
      .filter((d) => isGroupActive(d.data() as { status?: string }))
      .map((item) => item.id);

    const rawAllowedGroupIds = Array.from(new Set([...myGroupIds, ...publicGroupIds]));
    if (rawAllowedGroupIds.length === 0) return [];

    const allowedGroupIds = await this.filterActiveGroupIds(rawAllowedGroupIds);
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
    // Simple direct query — rule allows group members and public-group visitors.
    // The [groupId, status] composite index covers this without an orderBy.
    const snap = await getDocs(
      query(
        collection(db, this.collectionName),
        where('groupId', '==', groupId),
        where('status', '==', 'active'),
      ),
    );
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Challenge, 'id'>) } as Challenge))
      .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
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

    // BUG-007: Collective challenges pool all activity values into a single
    // groupCurrentTotal. Mixed units (e.g. minutes + km) produce a meaningless total.
    if (
      input.challengeType === 'collective' &&
      input.activities &&
      input.activities.length > 1
    ) {
      const units = new Set(
        input.activities.map((a) => (a.unit ?? '').toLowerCase().trim()),
      );
      if (units.size > 1) {
        throw new Error(
          `Collective challenges must use a single measurement unit. Found mixed units: ${[...units].join(', ')}`,
        );
      }
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

    const durationDays = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
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
      durationDays,
      createdBy: input.createdBy,
      status: requiresDonationApproval ? 'draft' : 'active',
      participantCount: 0,
      moderationStatus: requiresDonationApproval ? 'pending' : 'approved',
      ...(input.engineVersion ? { engineVersion: input.engineVersion } : {}),
      ...(input.groupCumulativeTarget !== undefined ? { groupCumulativeTarget: input.groupCumulativeTarget } : {}),
      ...(input.autoCompleteOnGroupTarget !== undefined ? { autoCompleteOnGroupTarget: input.autoCompleteOnGroupTarget } : {}),
      ...(input.requiredConsecutiveDays !== undefined ? { requiredConsecutiveDays: input.requiredConsecutiveDays } : {}),
      ...(input.streakResetOnMiss !== undefined ? { streakResetOnMiss: input.streakResetOnMiss } : {}),
    };

    const challengeRef = doc(collection(db, this.collectionName));
    const challengeId = challengeRef.id;

    const sanitizedPayload = removeUndefinedDeep(payload);

    await setDoc(challengeRef, sanitizedPayload);
    if (!requiresDonationApproval) {
      try {
        await this.joinChallenge(input.createdBy, challengeId);
        // participantCount is now incremented atomically inside joinChallenge.
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

  async getCompletedChallengesForUser(userId: string, maxResults = 20): Promise<Array<{ challenge: Challenge; membership: ChallengeMember }>> {
    const membershipsSnap = await getDocs(
      query(
        collection(db, this.challengeMembersCollection),
        where('userId', '==', userId),
        where('status', '==', 'completed'),
        orderBy('completedAt', 'desc'),
        limit(maxResults),
      ),
    );
    if (membershipsSnap.empty) return [];
    const memberships = membershipsSnap.docs.map((d) => d.data() as ChallengeMember);
    const challengeIds = [...new Set(memberships.map((m) => m.challengeId))].filter(Boolean);
    const chunks: string[][] = [];
    for (let i = 0; i < challengeIds.length; i += 10) chunks.push(challengeIds.slice(i, i + 10));
    const challengeDocs = (
      await Promise.all(chunks.map((chunk) => getDocs(query(collection(db, this.collectionName), where(documentId(), 'in', chunk)))))
    ).flatMap((snap) => snap.docs);
    const challengeMap = new Map(challengeDocs.map((d) => [d.id, { id: d.id, ...(d.data() as Omit<Challenge, 'id'>) } as Challenge]));
    return memberships.flatMap((membership) => {
      const challenge = challengeMap.get(membership.challengeId);
      return challenge ? [{ challenge, membership }] : [];
    });
  }

  private mapChallengeDoc(id: string, data: Omit<Challenge, 'id'>): Challenge {
    return { id, ...data };
  }

  async getChallengesByGroupPage(
    groupId: string,
    options: ChallengeDiscoveryPageOptions = {},
  ): Promise<PaginatedChallengeResponse> {
    const pageSize = Math.min(Math.max(options.pageSize ?? 25, 1), 50);
    const statusFilter = options.statuses?.length ? options.statuses : ['active'];
    const results: Challenge[] = [];
    let nextCursor: ChallengeCursor | null = null;
    let hasMore = false;

    // The allow list rule requires visibility == 'public' OR groupVisibility == 'public'.
    // Run two queries (one per field) so Firestore can prove the constraint from the query alone.
    const visibilityFields: Array<'visibility' | 'groupVisibility'> = ['visibility', 'groupVisibility'];
    let primaryQueriesSucceeded = false;

    for (const status of statusFilter) {
      const snaps = await Promise.allSettled(
        visibilityFields.map((field) => {
          const constraints: QueryConstraint[] = [
            where('groupId', '==', groupId),
            where('status', '==', status),
            where(field, '==', 'public'),
            orderBy('startDate', 'desc'),
            limit(pageSize),
          ];
          if (options.cursor && statusFilter.length === 1) {
            constraints.splice(4, 0, startAfter(options.cursor));
          }
          return getDocs(query(collection(db, this.collectionName), ...constraints));
        }),
      );
      for (const result of snaps) {
        if (result.status === 'fulfilled') {
          primaryQueriesSucceeded = true;
          results.push(...result.value.docs.map((d) => this.mapChallengeDoc(d.id, d.data() as Omit<Challenge, 'id'>)));
          if (statusFilter.length === 1) {
            const lastDoc = result.value.docs.at(-1) ?? null;
            nextCursor = result.value.docs.length === pageSize ? lastDoc : null;
            hasMore = hasMore || result.value.docs.length === pageSize;
          }
        }
      }
    }

    // Membership-based fallback: only for private groups (where public visibility queries found nothing).
    if (!primaryQueriesSucceeded && options.userId) {
      try {
        const membershipSnap = await getDocs(
          query(collection(db, this.challengeMembersCollection), where('userId', '==', options.userId)),
        );
        const candidateIds = membershipSnap.docs
          .map((d) => (d.data() as { challengeId?: string }).challengeId)
          .filter((id): id is string => !!id);
        const fallbackSnaps = await Promise.all(
          candidateIds.slice(0, 30).map((id) => getDoc(doc(db, this.collectionName, id))),
        );
        for (const snap of fallbackSnaps) {
          if (snap.exists()) {
            const challenge = this.mapChallengeDoc(snap.id, snap.data() as Omit<Challenge, 'id'>);
            if (challenge.groupId === groupId && statusFilter.includes(challenge.status)) {
              results.push(challenge);
            }
          }
        }
      } catch {
        // Private-group fallback failed — return whatever primary queries found.
      }
    }

    const deduped = Array.from(new Map(results.map((item) => [item.id, item])).values())
      .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate))
      .slice(0, pageSize);
    return {
      items: deduped.map((item) => ({
        ...item,
        participantCount: Math.max(0, Number(item.participantCount ?? 0)),
      })),
      nextCursor,
      hasMore,
    };
  }

  private async filterActiveGroupIds(groupIds: string[]): Promise<string[]> {
    if (groupIds.length === 0) return [];
    const chunks: string[][] = [];
    for (let i = 0; i < groupIds.length; i += 10) chunks.push(groupIds.slice(i, i + 10));
    const snaps = await Promise.all(
      chunks.map((chunk) =>
        getDocs(query(collection(db, 'groups'), where(documentId(), 'in', chunk))),
      ),
    );
    return snaps
      .flatMap((snap) => snap.docs)
      .filter((d) => isGroupActive(d.data() as { status?: string }))
      .map((d) => d.id);
  }
}

export const challengeService = new ChallengeService();
export type { CreateChallengeInput };
