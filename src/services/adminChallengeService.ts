import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Challenge } from '../types';
import { assertCanonicalActivitiesAvailable } from '../utils/canonicalActivityGate';

export type ModerationStatus = 'pending' | 'approved' | 'needs_changes';

export type AdminChallenge = Challenge & {
  moderationStatus?: ModerationStatus;
  moderatedBy?: string;
  moderatedAt?: string;
  moderationNote?: string;
};

export type ChallengeTemplate = {
  id: string;
  category?: 'fitness' | 'wellness';
  name: string;
  description: string;
  durationDays: number;
  challengeType: 'collective' | 'competitive' | 'streak';
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  activityCount: number;
  version: number;
  isPublished: boolean;
};

export type ChallengeStatusFilter = 'all' | 'active' | 'upcoming' | 'completed' | 'archived' | 'inactive' | 'draft' | 'pending';

export type AdminChallengeRow = {
  id: string;
  name: string;
  /** Raw status stored in Firestore */
  status: string;
  /** Effective display/filter status — accounts for date-based expiry and future start */
  effectiveStatus: string;
  challengeType: string;
  category: string;
  groupId?: string;
  groupName?: string;
  participantCount: number;
  startDate: string;
  endDate: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  moderationStatus?: string;
  progress?: number;
};

/**
 * Derives the display/filter status from stored status + dates.
 * Does NOT write back to Firestore.
 */
export function deriveEffectiveStatus(status: string, startDate: string, endDate: string): string {
  // Lifecycle statuses that are always respected as-is
  if (status === 'archived' || status === 'deleted' || status === 'inactive' || status === 'draft' || status === 'completed') {
    return status;
  }
  const now = new Date().toISOString();
  if (status === 'active') {
    if (endDate && endDate < now) return 'completed'; // expired
    if (startDate && startDate > now) return 'upcoming'; // not yet started
    return 'active';
  }
  // Fallback for unknown statuses
  return status;
}

export type ChallengeAnalytics = {
  totalChallenges: number;
  activeChallenges: number;
  upcomingChallenges: number;
  completedChallenges: number;
  archivedChallenges: number;
  draftChallenges: number;
  avgParticipants: number;
  avgCompletionRate: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  topByParticipants: Array<{ id: string; name: string; participantCount: number }>;
  completionRateByType: Record<string, number>;
  recentlyCreated: number;
};

class AdminChallengeService {
  private collectionName = 'challenges';
  private templatesCollection = 'challengeTemplates';

  private assertAuth(): void {
    if (!auth.currentUser) {
      throw new Error('Not authenticated. Admin operations require an active session.');
    }
  }

  async getPendingChallenges(): Promise<AdminChallenge[]> {
    this.assertAuth();
    // Scope to donation-enabled challenges only; complex multi-field logic handled in JS.
    const snap = await getDocs(
      query(collection(db, this.collectionName), where('donation.enabled', '==', true)),
    );
    const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdminChallenge, 'id'>) }));
    return all
      .filter((c) => {
        const donationStatus = c.donation?.approvalStatus;
        const normalized = c.moderationStatus ?? (donationStatus === 'approved' ? 'approved' : 'pending');
        return normalized === 'pending' || normalized === 'needs_changes' || donationStatus === 'pending';
      })
      .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
  }

  async getApprovedChallenges(): Promise<AdminChallenge[]> {
    this.assertAuth();
    // Two scoped queries (OR condition: approved moderation OR active status); deduplicate by id.
    const [byModeration, byStatus] = await Promise.all([
      getDocs(query(collection(db, this.collectionName), where('moderationStatus', '==', 'approved'))),
      getDocs(query(collection(db, this.collectionName), where('status', '==', 'active'))),
    ]);
    const seen = new Set<string>();
    const all: AdminChallenge[] = [];
    for (const snap of [byModeration, byStatus]) {
      for (const d of snap.docs) {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          all.push({ id: d.id, ...(d.data() as Omit<AdminChallenge, 'id'>) });
        }
      }
    }
    return all.sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
  }

  async getActiveChallenges(): Promise<AdminChallenge[]> {
    this.assertAuth();
    const snap = await getDocs(
      query(collection(db, this.collectionName), where('status', '==', 'active')),
    );
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<AdminChallenge, 'id'>) }))
      .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
  }

  async getAllChallenges(): Promise<AdminChallengeRow[]> {
    this.assertAuth();
    const snap = await getDocs(
      query(collection(db, this.collectionName), orderBy('startDate', 'desc')),
    );
    return snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      const status = String(data.status ?? 'active');
      const startDate = String(data.startDate ?? '');
      const endDate = String(data.endDate ?? '');
      return {
        id: d.id,
        name: String(data.name ?? 'Untitled'),
        status,
        effectiveStatus: deriveEffectiveStatus(status, startDate, endDate),
        challengeType: String(data.challengeType ?? 'collective'),
        category: String(data.category ?? 'fitness'),
        groupId: data.groupId ? String(data.groupId) : undefined,
        groupName: data.groupName ? String(data.groupName) : undefined,
        participantCount: Number(data.participantCount ?? 0),
        startDate,
        endDate,
        createdAt: data.createdAt ? String(data.createdAt) : undefined,
        updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
        createdBy: data.createdBy ? String(data.createdBy) : undefined,
        moderationStatus: data.moderationStatus ? String(data.moderationStatus) : undefined,
        progress: data.progress ? Number(data.progress) : undefined,
      };
    });
  }

  async archiveChallenge(challengeId: string, actorUid: string): Promise<void> {
    this.assertAuth();
    await updateDoc(doc(db, this.collectionName, challengeId), {
      status: 'archived',
      archivedAt: new Date().toISOString(),
      archivedBy: actorUid,
      updatedAt: new Date().toISOString(),
    });
  }

  async deactivateChallenge(challengeId: string, actorUid: string): Promise<void> {
    this.assertAuth();
    await updateDoc(doc(db, this.collectionName, challengeId), {
      status: 'inactive',
      deactivatedAt: new Date().toISOString(),
      deactivatedBy: actorUid,
      updatedAt: new Date().toISOString(),
    });
  }

  async reactivateChallenge(challengeId: string, actorUid: string): Promise<void> {
    this.assertAuth();
    await updateDoc(doc(db, this.collectionName, challengeId), {
      status: 'active',
      reactivatedAt: new Date().toISOString(),
      reactivatedBy: actorUid,
      updatedAt: new Date().toISOString(),
    });
  }

  async markChallengeCompleted(challengeId: string, actorUid: string): Promise<void> {
    this.assertAuth();
    await updateDoc(doc(db, this.collectionName, challengeId), {
      status: 'completed',
      completedAt: new Date().toISOString(),
      completedBy: actorUid,
      updatedAt: new Date().toISOString(),
    });
  }

  async deleteChallenge(challengeId: string, actorUid: string): Promise<void> {
    this.assertAuth();
    await updateDoc(doc(db, this.collectionName, challengeId), {
      status: 'deleted',
      deletedAt: new Date().toISOString(),
      deletedBy: actorUid,
      updatedAt: new Date().toISOString(),
    });
  }

  async getChallenge(challengeId: string): Promise<AdminChallengeRow | null> {
    this.assertAuth();
    const snap = await getDoc(doc(db, this.collectionName, challengeId));
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, unknown>;
    const status = String(data.status ?? 'active');
    const startDate = String(data.startDate ?? '');
    const endDate = String(data.endDate ?? '');
    return {
      id: snap.id,
      name: String(data.name ?? 'Untitled'),
      status,
      effectiveStatus: deriveEffectiveStatus(status, startDate, endDate),
      challengeType: String(data.challengeType ?? 'collective'),
      category: String(data.category ?? 'fitness'),
      groupId: data.groupId ? String(data.groupId) : undefined,
      groupName: data.groupName ? String(data.groupName) : undefined,
      participantCount: Number(data.participantCount ?? 0),
      startDate,
      endDate,
      createdAt: data.createdAt ? String(data.createdAt) : undefined,
      updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
      createdBy: data.createdBy ? String(data.createdBy) : undefined,
      moderationStatus: data.moderationStatus ? String(data.moderationStatus) : undefined,
      progress: data.progress ? Number(data.progress) : undefined,
      // Extra fields for detail view — stored on raw data
      ...(data.description ? { description: String(data.description) } : {}),
      ...(data.activities ? { activities: data.activities } : {}),
      ...(data.engineVersion ? { engineVersion: String(data.engineVersion) } : {}),
      ...(data.groupCumulativeTarget != null ? { groupCumulativeTarget: Number(data.groupCumulativeTarget) } : {}),
      ...(data.requiredConsecutiveDays != null ? { requiredConsecutiveDays: Number(data.requiredConsecutiveDays) } : {}),
    } as AdminChallengeRow & Record<string, unknown>;
  }

  async getTemplates(): Promise<ChallengeTemplate[]> {
    this.assertAuth();
    const [fitnessSnap, wellnessSnap] = await Promise.all([
      getDocs(collection(db, this.templatesCollection)),
      getDocs(collection(db, 'wellnessTemplates')),
    ]);

    const fitnessTemplates = fitnessSnap.docs
      .map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          category: (data.category as ChallengeTemplate['category']) ?? 'fitness',
          name: String(data.name ?? 'Untitled template'),
          description: String(data.description ?? ''),
          durationDays: Number(data.durationDays ?? 30),
          challengeType: (data.challengeType as ChallengeTemplate['challengeType']) ?? 'collective',
          difficultyLevel: (data.difficultyLevel as ChallengeTemplate['difficultyLevel']) ?? 'beginner',
          activityCount: Number(data.activityCount ?? 0),
          version: Number(data.version ?? 1),
          isPublished: data.isPublished !== false,
        };
      });

    const wellnessTemplates = wellnessSnap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        category: 'wellness' as const,
        name: String(data.name ?? 'Untitled wellness template'),
        description: String(data.description ?? ''),
        durationDays: Number(data.duration ?? 30),
        challengeType: (data.type as ChallengeTemplate['challengeType']) ?? 'streak',
        difficultyLevel: (data.difficulty as ChallengeTemplate['difficultyLevel']) ?? 'beginner',
        activityCount: Array.isArray(data.activities) ? data.activities.length : 0,
        version: 1,
        isPublished: data.isPublished !== false,
      };
    });

    return [...fitnessTemplates, ...wellnessTemplates].sort((a, b) => a.name.localeCompare(b.name));
  }

  async createChallengeFromAdmin(payload: {
    category?: 'fitness' | 'wellness' | 'fasting' | 'hydration' | 'sleep' | 'mindfulness' | 'nutrition' | 'habits' | 'stress' | 'social';
    name: string;
    description: string;
    challengeType: 'collective' | 'competitive' | 'streak';
    startDate: string;
    endDate: string;
    createdBy: string;
    coverImageUrl?: string;
    activities?: Array<{
      exerciseId?: string;
      activityId?: string;
      activityType?: string;
      exerciseName?: string;
      description?: string;
      category?: string;
      difficulty?: string;
      knowledgeVersion?: number;
      metric?: string;
      tier1?: string;
      tier2?: string;
      icon?: string;
      protocolSteps?: string[];
      benefits?: string[];
      guidelines?: string[];
      warnings?: string[];
      frequency?: 'daily' | 'weekly' | '2x-week' | '3x-week' | '5x-week' | 'custom';
      instructions?: string[];
      pointsPerCompletion?: number;
      dailyFrequency?: number;
      targetValue: number;
      unit: string;
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
  }): Promise<string> {
    this.assertAuth();
    // P2-1: entries referencing draft/retired canonical Knowledge cannot start
    // a new Challenge (custom entries without a canonical record are kept).
    await assertCanonicalActivitiesAvailable(payload.activities ?? []);
    const createdAt = new Date().toISOString();
    const requiresApproval = payload.donation?.enabled === true;
    const result = await addDoc(collection(db, this.collectionName), {
      ...payload,
      category: payload.category ?? 'fitness',
      exerciseIds: (payload.activities ?? [])
        .map((item) => item.exerciseId)
        .filter((item): item is string => !!item),
      status: requiresApproval ? 'draft' : 'active',
      progress: 0,
      participantCount: 0,
      moderationStatus: requiresApproval ? 'pending' : 'approved',
      donation: payload.donation?.enabled
        ? {
            ...payload.donation,
            approvalStatus: 'pending',
          }
        : payload.donation,
      createdAt,
    });
    return result.id;
  }

  async getChallengeAnalytics(): Promise<ChallengeAnalytics> {
    this.assertAuth();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [challengeSnap, memberSnap] = await Promise.all([
      getDocs(collection(db, this.collectionName)),
      getDocs(query(collection(db, 'challengeMembers'), where('status', 'in', ['active', 'completed']))),
    ]);

    const all = challengeSnap.docs.map((d) => {
      const raw = d.data() as Record<string, unknown>;
      const status = String(raw.status ?? 'active');
      const startDate = String(raw.startDate ?? '');
      const endDate = String(raw.endDate ?? '');
      return { id: d.id, ...raw, effectiveStatus: deriveEffectiveStatus(status, startDate, endDate) } as Record<string, unknown> & { id: string; effectiveStatus: string };
    });
    const nonDeleted = all.filter((c) => String(c.status ?? '') !== 'deleted');
    const totalChallenges = nonDeleted.length;
    const activeChallenges = nonDeleted.filter((c) => c.effectiveStatus === 'active').length;
    const upcomingChallenges = nonDeleted.filter((c) => c.effectiveStatus === 'upcoming').length;
    const completedChallenges = nonDeleted.filter((c) => c.effectiveStatus === 'completed').length;
    const archivedChallenges = nonDeleted.filter((c) => c.effectiveStatus === 'archived').length;
    const draftChallenges = nonDeleted.filter((c) => c.effectiveStatus === 'draft' || c.effectiveStatus === 'inactive').length;

    const participantCounts = nonDeleted.map((c) => Number(c.participantCount ?? 0));
    const avgParticipants = participantCounts.length
      ? Number((participantCounts.reduce((sum, v) => sum + v, 0) / participantCounts.length).toFixed(2))
      : 0;

    // challenge.progress is always 0 (no engine writes to it).
    // The correct source of truth is challengeMembers.completionRate,
    // written by each engine on every log event.
    // Average across all non-abandoned members to reflect real engagement.
    const memberRates = memberSnap.docs.map((d) => Number((d.data() as Record<string, unknown>).completionRate ?? 0));
    const avgCompletionRate = memberRates.length
      ? Number((memberRates.reduce((sum, v) => sum + v, 0) / memberRates.length).toFixed(2))
      : 0;

    const byType = nonDeleted.reduce<Record<string, number>>((acc, row) => {
      const key = String(row.challengeType ?? 'unknown');
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const byCategory = nonDeleted.reduce<Record<string, number>>((acc, row) => {
      const key = String(row.category ?? 'fitness');
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    // Completion rate by type — average member completionRate per challenge type.
    const membersByType = memberSnap.docs.reduce<Record<string, number[]>>((acc, d) => {
      const data = d.data() as Record<string, unknown>;
      const type = String(data.challengeType ?? 'unknown');
      if (!acc[type]) acc[type] = [];
      acc[type].push(Number(data.completionRate ?? 0));
      return acc;
    }, {});
    const completionRateByType: Record<string, number> = {};
    for (const [type, rates] of Object.entries(membersByType)) {
      completionRateByType[type] = rates.length
        ? Number((rates.reduce((s, v) => s + v, 0) / rates.length).toFixed(2))
        : 0;
    }

    const topByParticipants = nonDeleted
      .filter((c) => Number(c.participantCount ?? 0) > 0)
      .sort((a, b) => Number(b.participantCount ?? 0) - Number(a.participantCount ?? 0))
      .slice(0, 10)
      .map((c) => ({ id: c.id, name: String(c.name ?? 'Untitled'), participantCount: Number(c.participantCount ?? 0) }));

    const recentlyCreated = nonDeleted.filter((c) => String(c.createdAt ?? '') >= thirtyDaysAgo).length;

    return {
      totalChallenges,
      activeChallenges,
      upcomingChallenges,
      completedChallenges,
      archivedChallenges,
      draftChallenges,
      avgParticipants,
      avgCompletionRate,
      byType,
      byCategory,
      topByParticipants,
      completionRateByType,
      recentlyCreated,
    };
  }

  async approveChallenge(challengeId: string, moderatorUid: string): Promise<void> {
    this.assertAuth();
    await updateDoc(doc(db, this.collectionName, challengeId), {
      moderationStatus: 'approved',
      status: 'active',
      'donation.approvalStatus': 'approved',
      moderatedBy: moderatorUid,
      moderatedAt: new Date().toISOString(),
      moderationNote: '',
    });
  }

  async requestChallengeChanges(challengeId: string, moderatorUid: string, note: string): Promise<void> {
    this.assertAuth();
    await updateDoc(doc(db, this.collectionName, challengeId), {
      moderationStatus: 'needs_changes',
      status: 'draft',
      'donation.approvalStatus': 'rejected',
      moderatedBy: moderatorUid,
      moderatedAt: new Date().toISOString(),
      moderationNote: note.trim(),
    });
  }
}

export const adminChallengeService = new AdminChallengeService();
