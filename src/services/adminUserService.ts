import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Challenge, Group, Workout } from '../types';

export type AdminUserStatus = 'active' | 'suspended';

export type AdminUserRow = {
  id: string;
  displayName: string;
  email: string;
  createdAt: string;
  accountStatus: AdminUserStatus;
  lastActiveAt?: string;
};

export type AdminUserDetail = AdminUserRow & {
  profile: Record<string, unknown>;
  stats: {
    workoutCount: number;
    challengeCount: number;
    groupCount: number;
  };
};

export type AdminUserAnalytics = {
  totalUsers: number;
  active7d: number;
  active30d: number;
  newUsers7d: number;
  newUsers30d: number;
  churnEstimate30d: number;
};

export type SupportTicketStatus = 'new' | 'in_progress' | 'resolved';
export type SupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type SupportTicket = {
  id: string;
  userId: string;
  userEmail: string;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
};

function deriveDisplayName(data: Record<string, unknown>, fallbackId: string): string {
  const profile = data.profile as { displayName?: string; fullName?: string } | undefined;
  const direct = typeof data.displayName === 'string' ? data.displayName : undefined;
  return profile?.displayName || profile?.fullName || direct || `User ${fallbackId.slice(0, 6)}`;
}

function deriveEmail(data: Record<string, unknown>): string {
  const profile = data.profile as { email?: string } | undefined;
  const direct = typeof data.email === 'string' ? data.email : undefined;
  return profile?.email || direct || '';
}

function normalizeStatus(data: Record<string, unknown>): AdminUserStatus {
  const value = typeof data.accountStatus === 'string' ? data.accountStatus : 'active';
  return value === 'suspended' ? 'suspended' : 'active';
}

class AdminUserService {
  async getUsers(): Promise<AdminUserRow[]> {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs
      .map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          displayName: deriveDisplayName(data, d.id),
          email: deriveEmail(data),
          createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
          accountStatus: normalizeStatus(data),
          lastActiveAt: typeof data.lastActiveAt === 'string' ? data.lastActiveAt : undefined,
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async getUserDetail(uid: string): Promise<AdminUserDetail | null> {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists()) return null;

    const data = userSnap.data() as Record<string, unknown>;
    const [workoutSnap, challengeSnap, groupSnap] = await Promise.all([
      getDocs(query(collection(db, 'workouts'), where('userId', '==', uid))),
      getDocs(query(collection(db, 'challenges'), where('createdBy', '==', uid))),
      getDocs(query(collection(db, 'groups'), where('ownerId', '==', uid))),
    ]);

    const workouts = workoutSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Workout, 'id'>) }));
    const challenges = challengeSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Challenge, 'id'>) }));
    const groups = groupSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Group, 'id'>) }));

    const lastWorkout = [...workouts].sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))[0];

    return {
      id: userSnap.id,
      displayName: deriveDisplayName(data, userSnap.id),
      email: deriveEmail(data),
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
      accountStatus: normalizeStatus(data),
      lastActiveAt: lastWorkout?.completedAt,
      profile: (data.profile as Record<string, unknown> | undefined) ?? {},
      stats: {
        workoutCount: workouts.length,
        challengeCount: challenges.length,
        groupCount: groups.length,
      },
    };
  }

  async setUserStatus(uid: string, status: AdminUserStatus, adminUid: string): Promise<void> {
    await updateDoc(doc(db, 'users', uid), {
      accountStatus: status,
      moderatedBy: adminUid,
      moderatedAt: new Date().toISOString(),
    });
  }

  async getUserAnalytics(): Promise<AdminUserAnalytics> {
    const [usersSnap, workoutsSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'workouts')),
    ]);

    const users = usersSnap.docs.map((d) => d.data() as Record<string, unknown>);
    const workouts = workoutsSnap.docs.map((d) => d.data() as Record<string, unknown>);

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const active7 = new Set<string>();
    const active30 = new Set<string>();
    workouts.forEach((w) => {
      const uid = typeof w.userId === 'string' ? w.userId : '';
      const completedAt = typeof w.completedAt === 'string' ? w.completedAt : '';
      const ts = Date.parse(completedAt);
      if (!uid || Number.isNaN(ts)) return;
      if (now - ts <= 7 * dayMs) active7.add(uid);
      if (now - ts <= 30 * dayMs) active30.add(uid);
    });

    const newUsers7d = users.filter((u) => {
      const createdAt = typeof u.createdAt === 'string' ? u.createdAt : '';
      const ts = Date.parse(createdAt);
      return !Number.isNaN(ts) && now - ts <= 7 * dayMs;
    }).length;
    const newUsers30d = users.filter((u) => {
      const createdAt = typeof u.createdAt === 'string' ? u.createdAt : '';
      const ts = Date.parse(createdAt);
      return !Number.isNaN(ts) && now - ts <= 30 * dayMs;
    }).length;

    const churnEstimate30d = Math.max(users.length - active30.size, 0);

    return {
      totalUsers: users.length,
      active7d: active7.size,
      active30d: active30.size,
      newUsers7d,
      newUsers30d,
      churnEstimate30d,
    };
  }

  async getSupportTickets(): Promise<SupportTicket[]> {
    const snap = await getDocs(collection(db, 'supportTickets'));
    return snap.docs
      .map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          userId: String(data.userId ?? ''),
          userEmail: String(data.userEmail ?? ''),
          subject: String(data.subject ?? 'Support Request'),
          message: String(data.message ?? ''),
          status: (data.status as SupportTicketStatus) ?? 'new',
          priority: (data.priority as SupportTicketPriority) ?? 'medium',
          assignedTo: typeof data.assignedTo === 'string' ? data.assignedTo : undefined,
          createdAt: String(data.createdAt ?? ''),
          updatedAt: String(data.updatedAt ?? data.createdAt ?? ''),
        };
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  async setSupportTicketStatus(ticketId: string, status: SupportTicketStatus, actorUid: string): Promise<void> {
    await updateDoc(doc(db, 'supportTickets', ticketId), {
      status,
      assignedTo: actorUid,
      updatedAt: new Date().toISOString(),
    });
  }
}

export const adminUserService = new AdminUserService();
