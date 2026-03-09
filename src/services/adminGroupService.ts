import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Challenge, Group, Workout } from '../types';

export type AdminGroupStatus = 'active' | 'flagged' | 'deactivated';

export type AdminGroupRow = Group & {
  moderationStatus: AdminGroupStatus;
  isFeatured: boolean;
  challengeCount: number;
  workoutCount: number;
};

export type AdminGroupDetail = AdminGroupRow & {
  recentChallenges: Array<{ id: string; name: string; status: string; startDate: string }>;
  recentWorkouts: Array<{ id: string; userId: string; value: number; unit: string; completedAt: string }>;
};

export type GroupModerationItem = {
  id: string;
  groupId: string;
  groupName: string;
  reportType: string;
  reason: string;
  reportedUserId?: string;
  reportedBy?: string;
  status: 'open' | 'reviewed' | 'resolved';
  createdAt: string;
};

function normalizeStatus(data: Record<string, unknown>): AdminGroupStatus {
  const value = typeof data.moderationStatus === 'string' ? data.moderationStatus : 'active';
  if (value === 'flagged' || value === 'deactivated') return value;
  return 'active';
}

class AdminGroupService {
  async getGroups(): Promise<AdminGroupRow[]> {
    const groupSnap = await getDocs(collection(db, 'groups'));

    return groupSnap.docs
      .map((d) => {
        const data = d.data() as Omit<Group, 'id'> & Record<string, unknown>;
        return {
          id: d.id,
          name: data.name,
          description: data.description,
          ownerId: data.ownerId,
          memberCount: data.memberCount,
          createdAt: data.createdAt,
          moderationStatus: normalizeStatus(data),
          isFeatured: data.isFeatured === true,
          challengeCount: Number(data.activeChallenges ?? 0),
          workoutCount: Number(data.totalWorkouts ?? 0),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getGroupDetail(id: string): Promise<AdminGroupDetail | null> {
    const groupSnap = await getDoc(doc(db, 'groups', id));
    if (!groupSnap.exists()) return null;

    const [challengeCountSnap, workoutCountSnap, challengeSnap, workoutSnap] = await Promise.all([
      getCountFromServer(query(collection(db, 'challenges'), where('groupId', '==', id))),
      getCountFromServer(query(collection(db, 'workouts'), where('groupId', '==', id))),
      getDocs(query(collection(db, 'challenges'), where('groupId', '==', id), orderBy('startDate', 'desc'), limit(8))),
      getDocs(query(collection(db, 'workouts'), where('groupId', '==', id), orderBy('completedAt', 'desc'), limit(12))),
    ]);

    const data = groupSnap.data() as Omit<Group, 'id'> & Record<string, unknown>;
    const challenges = challengeSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Challenge, 'id'>) }))
      .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
    const workouts = workoutSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Workout, 'id'>) }))
      .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));

    return {
      id: groupSnap.id,
      name: data.name,
      description: data.description,
      ownerId: data.ownerId,
      memberCount: data.memberCount,
      createdAt: data.createdAt,
      moderationStatus: normalizeStatus(data),
      isFeatured: data.isFeatured === true,
      challengeCount: challengeCountSnap.data().count,
      workoutCount: workoutCountSnap.data().count,
      recentChallenges: challenges.slice(0, 8).map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        startDate: c.startDate,
      })),
      recentWorkouts: workouts.slice(0, 12).map((w) => ({
        id: w.id,
        userId: w.userId,
        value: w.value,
        unit: w.unit,
        completedAt: w.completedAt,
      })),
    };
  }

  async setGroupModerationStatus(groupId: string, status: AdminGroupStatus, adminUid: string): Promise<void> {
    await updateDoc(doc(db, 'groups', groupId), {
      moderationStatus: status,
      moderatedBy: adminUid,
      moderatedAt: new Date().toISOString(),
    });
  }

  async setGroupFeatured(groupId: string, isFeatured: boolean, adminUid: string): Promise<void> {
    await updateDoc(doc(db, 'groups', groupId), {
      isFeatured,
      featuredBy: adminUid,
      featuredAt: new Date().toISOString(),
    });
  }

  async getModerationQueue(): Promise<GroupModerationItem[]> {
    const snap = await getDocs(collection(db, 'groupReports'));
    return snap.docs
      .map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          groupId: String(data.groupId ?? ''),
          groupName: String(data.groupName ?? 'Unknown group'),
          reportType: String(data.reportType ?? 'content'),
          reason: String(data.reason ?? ''),
          reportedUserId: typeof data.reportedUserId === 'string' ? data.reportedUserId : undefined,
          reportedBy: typeof data.reportedBy === 'string' ? data.reportedBy : undefined,
          status: (data.status as GroupModerationItem['status']) ?? 'open',
          createdAt: String(data.createdAt ?? ''),
        };
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  async setModerationQueueStatus(reportId: string, status: GroupModerationItem['status'], adminUid: string): Promise<void> {
    await updateDoc(doc(db, 'groupReports', reportId), {
      status,
      reviewedBy: adminUid,
      reviewedAt: new Date().toISOString(),
    });
  }

  async suspendGroup(groupId: string, adminUid: string): Promise<void> {
    await updateDoc(doc(db, 'groups', groupId), {
      moderationStatus: 'deactivated',
      moderatedBy: adminUid,
      moderatedAt: new Date().toISOString(),
    });
  }

  async activateGroup(groupId: string, adminUid: string): Promise<void> {
    await updateDoc(doc(db, 'groups', groupId), {
      moderationStatus: 'active',
      moderatedBy: adminUid,
      moderatedAt: new Date().toISOString(),
    });
  }

  async suspendMemberInGroup(groupId: string, userId: string, adminUid: string): Promise<void> {
    await updateDoc(doc(db, 'groupMembers', `${groupId}_${userId}`), {
      status: 'expelled',
      moderatedBy: adminUid,
      moderatedAt: new Date().toISOString(),
    });
  }
}

export const adminGroupService = new AdminGroupService();
