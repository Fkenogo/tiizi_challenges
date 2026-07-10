import type { Firestore } from 'firebase-admin/firestore';

export type AdminMetricsRebuildOptions = {
  apply?: boolean;
  generatedBy?: 'script' | 'scheduled-function';
  sourceVersion?: 'pilot-v1';
  log?: (message: string, data?: Record<string, unknown>) => void;
};

export type AdminMetricsRebuildResult = {
  mode: 'dry-run' | 'apply';
  generatedAt: string;
  durationMs: number;
  readCounts: Record<string, number>;
  writeCounts: Record<string, number>;
  metrics: {
    overview: {
      totalUsers: number;
      totalGroups: number;
      totalChallenges: number;
      activities30d: number;
    };
    engagement: {
      activeUsers30d: number;
      activities30d: number;
      topChallenges: number;
      topGroups: number;
    };
    revenue: {
      totalConfirmedDonations: number;
      pendingTransactions: number;
      donationApprovalPending: number;
    };
    userGrowth: {
      totalUsers: number;
      newUsers7d: number;
      newUsers30d: number;
      signupTrend30d: number;
      recentSignups: number;
    };
  };
};

type AnyRecord = Record<string, unknown> & { id: string };
type ActivityLog = {
  id: string;
  type: 'workout' | 'wellness';
  userId: string;
  completedAt: string;
  challengeId?: string;
  groupId?: string;
  value?: number;
  unit?: string;
};

type UserGrowthPoint = {
  date: string;
  signups: number;
  cumulativeUsers: number;
};

type RecentSignup = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
};

function parseDateLike(input: unknown): number | null {
  if (!input) return null;
  if (typeof input === 'string') {
    const parsed = Date.parse(input);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  if (typeof input === 'object') {
    const value = input as { toDate?: () => Date; seconds?: number };
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (typeof value.seconds === 'number') return value.seconds * 1000;
  }
  return null;
}

function toIso(input: unknown): string | undefined {
  const ts = parseDateLike(input);
  return ts == null ? undefined : new Date(ts).toISOString();
}

function isWithin(input: unknown, days: number): boolean {
  const ts = parseDateLike(input);
  return ts != null && ts >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function shortId(id: string): string {
  return id.slice(0, 6).toUpperCase();
}

function stringValue(row: Record<string, unknown>, key: string, fallback = ''): string {
  const value = row[key];
  return typeof value === 'string' ? value : fallback;
}

function numberValue(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  const number = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function labelFromRecord(row: Record<string, unknown>, fallback: string): string {
  const value = row.name ?? row.displayName ?? row.title ?? row.email;
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function donorLabel(row: Record<string, unknown>): string {
  const value = row.donorName ?? row.displayName ?? row.name ?? row.userName ?? row.email ?? row.userId;
  return typeof value === 'string' && value.trim() ? value.trim() : 'Anonymous';
}

function isActiveUser(user: Record<string, unknown>): boolean {
  const accountStatus = String(user.accountStatus ?? user.status ?? 'active').toLowerCase();
  return accountStatus === 'active' || accountStatus === '';
}

function isActiveGroup(group: Record<string, unknown>): boolean {
  const status = String(group.status ?? 'active').toLowerCase();
  const moderationStatus = String(group.moderationStatus ?? '').toLowerCase();
  return (status === 'active' || status === '') && moderationStatus !== 'deactivated';
}

function isFlaggedGroup(group: Record<string, unknown>): boolean {
  return String(group.moderationStatus ?? '').toLowerCase() === 'flagged'
    || String(group.reviewStatus ?? '').toLowerCase() === 'flagged'
    || Boolean(group.flaggedReason);
}

function isVerifiedGroup(group: Record<string, unknown>): boolean {
  return group.isVerified === true
    || String(group.moderationStatus ?? '').toLowerCase() === 'verified'
    || String(group.reviewStatus ?? '').toLowerCase() === 'verified';
}

function isActiveChallenge(challenge: Record<string, unknown>): boolean {
  if (String(challenge.status ?? '').toLowerCase() !== 'active') return false;
  const now = Date.now();
  const start = parseDateLike(challenge.startDate);
  const end = parseDateLike(challenge.endDate);
  if (start != null && start > now) return false;
  if (end != null && end < now) return false;
  return true;
}

function isCompletedExpiredChallenge(challenge: Record<string, unknown>): boolean {
  if (String(challenge.status ?? '').toLowerCase() === 'completed') return true;
  const end = parseDateLike(challenge.endDate);
  return String(challenge.status ?? '').toLowerCase() === 'active' && end != null && end < Date.now();
}

async function readCollection(db: Firestore, collectionName: string): Promise<AnyRecord[]> {
  const snap = await db.collection(collectionName).get();
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

function mapActivityLogs(workouts: AnyRecord[], wellnessLogs: AnyRecord[]): ActivityLog[] {
  return [
    ...workouts.map((row) => ({
      id: row.id,
      type: 'workout' as const,
      userId: stringValue(row, 'userId'),
      completedAt: toIso(row.completedAt) ?? '',
      challengeId: stringValue(row, 'challengeId') || undefined,
      groupId: stringValue(row, 'groupId') || undefined,
      value: numberValue(row, 'value'),
      unit: stringValue(row, 'unit'),
    })),
    ...wellnessLogs.map((row) => ({
      id: row.id,
      type: 'wellness' as const,
      userId: stringValue(row, 'userId'),
      completedAt: toIso(row.loggedAt) ?? toIso(row.completedAt) ?? '',
      challengeId: stringValue(row, 'challengeId') || undefined,
      groupId: stringValue(row, 'groupId') || undefined,
      value: numberValue(row, 'value'),
      unit: stringValue(row, 'unit'),
    })),
  ].filter((row) => row.userId && row.completedAt);
}

function buildRecentActivity(activityLogs: ActivityLog[], challenges: AnyRecord[], groups: AnyRecord[]) {
  return [
    ...activityLogs
      .slice()
      .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
      .slice(0, 6)
      .map((activity) => ({
        id: `${activity.type}-${activity.id}`,
        message: `${activity.type === 'workout' ? 'Workout' : 'Wellness activity'} logged by user ${shortId(activity.userId)}${activity.value ? ` (${activity.value} ${activity.unit ?? ''})` : ''}`,
        at: activity.completedAt,
      })),
    ...challenges
      .slice()
      .sort((a, b) => (parseDateLike(b.startDate) ?? 0) - (parseDateLike(a.startDate) ?? 0))
      .slice(0, 3)
      .map((challenge) => ({
        id: `challenge-${challenge.id}`,
        message: `Challenge created: ${labelFromRecord(challenge, `Challenge ${shortId(challenge.id)}`)}`,
        at: toIso(challenge.startDate) ?? toIso(challenge.createdAt) ?? new Date().toISOString(),
      })),
    ...groups
      .slice()
      .sort((a, b) => (parseDateLike(b.createdAt) ?? 0) - (parseDateLike(a.createdAt) ?? 0))
      .slice(0, 2)
      .map((group) => ({
        id: `group-${group.id}`,
        message: `Group created: ${labelFromRecord(group, `Group ${shortId(group.id)}`)}`,
        at: toIso(group.createdAt) ?? new Date().toISOString(),
      })),
  ]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 8);
}

function buildTopTargets(activityLogs: ActivityLog[], namesById: Map<string, string>, idKey: 'challengeId' | 'groupId') {
  const counts = new Map<string, { activities: number; users: Set<string> }>();
  activityLogs.filter((activity) => isWithin(activity.completedAt, 30)).forEach((activity) => {
    const id = activity[idKey];
    if (!id) return;
    const current = counts.get(id) ?? { activities: 0, users: new Set<string>() };
    current.activities += 1;
    current.users.add(activity.userId);
    counts.set(id, current);
  });

  return Array.from(counts.entries())
    .map(([id, value]) => ({
      id,
      name: namesById.get(id) ?? `${idKey === 'challengeId' ? 'Challenge' : 'Group'} ${shortId(id)}`,
      activities: value.activities,
      activeUsers: value.users.size,
    }))
    .sort((a, b) => b.activities - a.activities || b.activeUsers - a.activeUsers)
    .slice(0, 5);
}

function buildRecentDonations(supportDonations: AnyRecord[], challengePledges: AnyRecord[], donationTransactions: AnyRecord[]) {
  const supportRows = supportDonations.map((row) => ({
    id: row.id,
    source: 'Platform Support',
    donor: donorLabel(row),
    amount: numberValue(row, 'amountKes'),
    status: stringValue(row, 'status', 'pending_confirmation'),
    createdAt: toIso(row.confirmedAt) ?? toIso(row.createdAt) ?? '',
    reference: stringValue(row, 'referenceId') || stringValue(row, 'transactionReference') || stringValue(row, 'paymentReference'),
  }));
  const pledgeRows = challengePledges
    .filter((row) => stringValue(row, 'status') === 'pledged')
    .map((row) => ({
      id: row.id,
      source: 'Challenge/Cause',
      donor: donorLabel(row),
      amount: numberValue(row, 'amountKes'),
      status: 'pledged',
      createdAt: toIso(row.createdAt) ?? '',
      reference: stringValue(row, 'referenceId') || stringValue(row, 'transactionReference') || stringValue(row, 'paymentReference'),
    }));
  const transactionRows = donationTransactions
    .filter((row) => stringValue(row, 'status') === 'success')
    .map((row) => ({
      id: row.id,
      source: stringValue(row, 'source', 'challenge_cause') === 'legacy' ? 'Legacy' : 'Challenge/Cause',
      donor: donorLabel(row),
      amount: numberValue(row, 'amount'),
      status: 'success',
      createdAt: toIso(row.createdAt) ?? '',
      reference: stringValue(row, 'referenceId') || stringValue(row, 'transactionReference') || stringValue(row, 'paymentReference'),
    }));

  return [...supportRows, ...pledgeRows, ...transactionRows]
    .filter((row) => row.createdAt)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 10);
}

function utcDateKey(input: number | Date): string {
  return new Date(input).toISOString().slice(0, 10);
}

function startOfUtcDay(input: number | Date): Date {
  const date = new Date(input);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function userRole(user: AnyRecord): string {
  const profile = user.profile as Record<string, unknown> | undefined;
  return stringValue(user, 'role') || (profile ? stringValue(profile, 'role') : '') || 'member';
}

function buildUserGrowthMetrics(
  users: AnyRecord[],
  generatedAt: string,
  generatedBy: AdminMetricsRebuildOptions['generatedBy'],
  sourceVersion: AdminMetricsRebuildOptions['sourceVersion'],
) {
  const now = Date.now();
  const start30d = startOfUtcDay(now);
  start30d.setUTCDate(start30d.getUTCDate() - 29);
  const start30dMs = start30d.getTime();

  const buckets = new Map<string, number>();
  for (let i = 0; i < 30; i += 1) {
    const day = new Date(start30d);
    day.setUTCDate(start30d.getUTCDate() + i);
    buckets.set(utcDateKey(day), 0);
  }

  users.forEach((user) => {
    const createdAtMs = parseDateLike(user.createdAt);
    if (createdAtMs == null || createdAtMs < start30dMs) return;
    const key = utcDateKey(createdAtMs);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  });

  let cumulativeUsers = 0;
  const signupTrend30d: UserGrowthPoint[] = Array.from(buckets.entries()).map(([date, signups]) => {
    cumulativeUsers += signups;
    return { date, signups, cumulativeUsers };
  });

  const recentSignups: RecentSignup[] = users
    .map((user) => {
      const createdAt = toIso(user.createdAt) ?? '';
      return {
        id: user.id,
        name: labelFromRecord(user, `User ${shortId(user.id)}`),
        email: stringValue(user, 'email'),
        role: userRole(user),
        status: stringValue(user, 'accountStatus') || stringValue(user, 'status', 'active'),
        createdAt,
      };
    })
    .filter((user) => user.createdAt)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 8);

  const newUsers7d = users.filter((user) => isWithin(user.createdAt, 7)).length;
  const newUsers30d = users.filter((user) => isWithin(user.createdAt, 30)).length;

  return {
    generatedAt,
    generatedBy,
    sourceVersion,
    totalUsers: users.length,
    newUsers7d,
    newUsers30d,
    avgDailySignups30d: Number((newUsers30d / 30).toFixed(2)),
    signupTrend30d,
    recentSignups,
  };
}

export async function rebuildAdminMetrics(
  db: Firestore,
  options: AdminMetricsRebuildOptions = {},
): Promise<AdminMetricsRebuildResult> {
  const startedAt = Date.now();
  const apply = options.apply === true;
  const generatedAt = new Date().toISOString();
  const generatedBy = options.generatedBy ?? 'script';
  const sourceVersion = options.sourceVersion ?? 'pilot-v1';
  options.log?.('admin metrics rebuild started', { mode: apply ? 'apply' : 'dry-run', generatedBy, sourceVersion });

  const [
    users,
    groups,
    challenges,
    workouts,
    wellnessLogs,
    supportDonations,
    challengePledges,
    donationTransactions,
  ] = await Promise.all([
    readCollection(db, 'users'),
    readCollection(db, 'groups'),
    readCollection(db, 'challenges'),
    readCollection(db, 'workouts'),
    readCollection(db, 'wellnessLogs'),
    readCollection(db, 'supportDonations'),
    readCollection(db, 'challengeContributionPledges'),
    readCollection(db, 'donationTransactions'),
  ]);

  const readCounts = {
    users: users.length,
    groups: groups.length,
    challenges: challenges.length,
    workouts: workouts.length,
    wellnessLogs: wellnessLogs.length,
    supportDonations: supportDonations.length,
    challengeContributionPledges: challengePledges.length,
    donationTransactions: donationTransactions.length,
  };
  options.log?.('admin metrics source reads complete', { readCounts });

  const activityLogs = mapActivityLogs(workouts, wellnessLogs);
  const activityLogs30d = activityLogs.filter((activity) => isWithin(activity.completedAt, 30));
  const users1d = new Set(activityLogs.filter((activity) => isWithin(activity.completedAt, 1)).map((activity) => activity.userId));
  const users7d = new Set(activityLogs.filter((activity) => isWithin(activity.completedAt, 7)).map((activity) => activity.userId));
  const users30d = new Set(activityLogs30d.map((activity) => activity.userId));
  const challengeParticipants30d = new Set(activityLogs30d.filter((activity) => activity.challengeId).map((activity) => activity.userId));
  const groupActiveUsers30d = new Set(activityLogs30d.filter((activity) => activity.groupId).map((activity) => activity.userId));
  const challengeNames = new Map(challenges.map((row) => [row.id, labelFromRecord(row, `Challenge ${shortId(row.id)}`)]));
  const groupNames = new Map(groups.map((row) => [row.id, labelFromRecord(row, `Group ${shortId(row.id)}`)]));
  const confirmedSupport = supportDonations.filter((row) => stringValue(row, 'status') === 'confirmed');
  const pendingSupport = supportDonations.filter((row) => ['intent', 'pending_confirmation'].includes(stringValue(row, 'status')));
  const pledgedChallengeIntents = challengePledges.filter((row) => stringValue(row, 'status') === 'pledged');
  const successfulTransactions = donationTransactions.filter((row) => stringValue(row, 'status') === 'success');
  const challengeCauseTransactions = successfulTransactions.filter((row) => stringValue(row, 'source', 'challenge_cause') === 'challenge_cause');
  const legacyTransactions = successfulTransactions.filter((row) => stringValue(row, 'source') === 'legacy' || !row.source);
  const platformSupportConfirmed = confirmedSupport.reduce((sum, row) => sum + numberValue(row, 'amountKes'), 0);
  const platformSupportConfirmed30d = confirmedSupport
    .filter((row) => isWithin(row.confirmedAt ?? row.createdAt, 30))
    .reduce((sum, row) => sum + numberValue(row, 'amountKes'), 0);
  const challengeCauseConfirmed = challengeCauseTransactions.reduce((sum, row) => sum + numberValue(row, 'amount'), 0);
  const challengeCauseConfirmed30d = challengeCauseTransactions
    .filter((row) => isWithin(row.createdAt, 30))
    .reduce((sum, row) => sum + numberValue(row, 'amount'), 0);
  const legacyConfirmed = legacyTransactions.reduce((sum, row) => sum + numberValue(row, 'amount'), 0);
  const totalConfirmedDonations = platformSupportConfirmed + challengeCauseConfirmed + legacyConfirmed;
  const confirmedDonations30d = platformSupportConfirmed30d + challengeCauseConfirmed30d
    + legacyTransactions.filter((row) => isWithin(row.createdAt, 30)).reduce((sum, row) => sum + numberValue(row, 'amount'), 0);
  const confirmedAmounts = [
    ...confirmedSupport.map((row) => numberValue(row, 'amountKes')),
    ...challengeCauseTransactions.map((row) => numberValue(row, 'amount')),
    ...legacyTransactions.map((row) => numberValue(row, 'amount')),
  ].filter((amount) => amount > 0);
  const pendingSupportTotal = pendingSupport.reduce((sum, row) => sum + numberValue(row, 'amountKes'), 0);
  const pendingChallengeTotal = pledgedChallengeIntents.reduce((sum, row) => sum + numberValue(row, 'amountKes'), 0);
  const donationApprovalPending = challenges.filter((row) => {
    const donation = row.donation as Record<string, unknown> | undefined;
    return donation?.enabled === true && String(donation.approvalStatus ?? '') === 'pending';
  }).length;
  const activeChallengeCauseCampaigns = challenges.filter((row) => {
    const donation = row.donation as Record<string, unknown> | undefined;
    return isActiveChallenge(row) && donation?.enabled === true && donation.approvalStatus === 'approved' && donation.acceptingDonations === true;
  }).length;

  const overview = {
    generatedAt,
    generatedBy,
    sourceVersion,
    totalUsers: users.length,
    activeUsers: users.filter(isActiveUser).length,
    activeUsers7d: users7d.size,
    activities30d: activityLogs30d.length,
    totalActivities: activityLogs.length,
    totalGroups: groups.length,
    activeGroups: groups.filter(isActiveGroup).length,
    flaggedGroups: groups.filter(isFlaggedGroup).length,
    verifiedGroups: groups.filter(isVerifiedGroup).length,
    totalChallenges: challenges.length,
    activeChallenges: challenges.filter(isActiveChallenge).length,
    activeChallengesNow: challenges.filter(isActiveChallenge).length,
    completedExpiredChallenges: challenges.filter(isCompletedExpiredChallenge).length,
    completedChallenges: challenges.filter(isCompletedExpiredChallenge).length,
    pendingSupportConfirmations: pendingSupport.length,
    pendingDonationReview: donationApprovalPending,
    donationApprovalPending,
    challengeApprovalsPending: challenges.filter((row) => String(row.moderationStatus ?? '') === 'pending').length,
    platformSupportConfirmed,
    challengeDonationsConfirmed: challengeCauseConfirmed,
    recentActivity: buildRecentActivity(activityLogs, challenges, groups),
  };

  const engagement = {
    generatedAt,
    generatedBy,
    sourceVersion,
    activeUsers1d: users1d.size,
    activeUsers7d: users7d.size,
    activeUsers30d: users30d.size,
    dau: users1d.size,
    wau: users7d.size,
    mau: users30d.size,
    activities30d: activityLogs30d.length,
    activitiesLast30d: activityLogs30d.length,
    workoutActivities30d: workouts.filter((row) => isWithin(row.completedAt, 30)).length,
    workoutActivitiesLast30d: workouts.filter((row) => isWithin(row.completedAt, 30)).length,
    workoutsLast7Days: workouts.filter((row) => isWithin(row.completedAt, 7)).length,
    workoutsLast30Days: workouts.filter((row) => isWithin(row.completedAt, 30)).length,
    wellnessActivities30d: wellnessLogs.filter((row) => isWithin(row.loggedAt ?? row.completedAt, 30)).length,
    wellnessActivitiesLast30d: wellnessLogs.filter((row) => isWithin(row.loggedAt ?? row.completedAt, 30)).length,
    wellnessLogsLast7Days: wellnessLogs.filter((row) => isWithin(row.loggedAt ?? row.completedAt, 7)).length,
    wellnessLogsLast30Days: wellnessLogs.filter((row) => isWithin(row.loggedAt ?? row.completedAt, 30)).length,
    activeParticipants: users30d.size,
    avgActivitiesPerUser30d: users30d.size ? Number((activityLogs30d.length / users30d.size).toFixed(2)) : 0,
    avgActivitiesPerActiveUser30d: users30d.size ? Number((activityLogs30d.length / users30d.size).toFixed(2)) : 0,
    challengeParticipants30d: challengeParticipants30d.size,
    challengeParticipationUsers30d: challengeParticipants30d.size,
    challengeParticipationRate: users30d.size ? Number((challengeParticipants30d.size / users30d.size).toFixed(4)) : 0,
    groupActiveUsers30d: groupActiveUsers30d.size,
    topChallenges: buildTopTargets(activityLogs, challengeNames, 'challengeId'),
    topGroups: buildTopTargets(activityLogs, groupNames, 'groupId'),
  };

  const revenue = {
    generatedAt,
    generatedBy,
    sourceVersion,
    confirmedSupportTotal: platformSupportConfirmed,
    pendingSupportTotal,
    confirmedChallengeTotal: challengeCauseConfirmed,
    pendingChallengeTotal,
    confirmedTransactions: confirmedSupport.length + challengeCauseTransactions.length + legacyTransactions.length,
    pendingTransactions: pendingSupport.length + pledgedChallengeIntents.length,
    totalConfirmedDonations,
    confirmedDonations30d,
    averageConfirmedDonation: confirmedAmounts.length ? Number((totalConfirmedDonations / confirmedAmounts.length).toFixed(2)) : 0,
    platformSupportConfirmed,
    platformSupportConfirmed30d,
    platformSupport30d: platformSupportConfirmed30d,
    challengeCauseConfirmed,
    challengeCauseConfirmed30d,
    challengeDonationsConfirmed: challengeCauseConfirmed,
    challengeDonations30d: challengeCauseConfirmed30d,
    legacyConfirmed,
    legacyDonationsConfirmed: legacyConfirmed,
    pendingSupportConfirmations: pendingSupport.length,
    pendingChallengeIntents: pledgedChallengeIntents.length,
    pendingChallengeDonationIntents: pledgedChallengeIntents.length,
    unverifiedPendingAmount: pendingSupportTotal + pendingChallengeTotal,
    pendingUnverifiedAmount: pendingSupportTotal + pendingChallengeTotal,
    donationApprovalPending,
    activeChallengeCauseCampaigns,
    breakdown: [
      {
        source: 'Platform Support',
        confirmedAmount: platformSupportConfirmed,
        pendingAmount: pendingSupportTotal,
        donorCount: new Set(confirmedSupport.map((row) => String(row.userId ?? row.donorEmail ?? row.id))).size,
      },
      {
        source: 'Challenge/Cause',
        confirmedAmount: challengeCauseConfirmed,
        pendingAmount: pendingChallengeTotal,
        donorCount: new Set(challengeCauseTransactions.map((row) => String(row.userId ?? row.donorEmail ?? row.id))).size,
      },
      {
        source: 'Legacy',
        confirmedAmount: legacyConfirmed,
        pendingAmount: 0,
        donorCount: new Set(legacyTransactions.map((row) => String(row.userId ?? row.donorEmail ?? row.id))).size,
      },
    ],
    recentDonations: buildRecentDonations(supportDonations, challengePledges, donationTransactions),
  };

  const userGrowth = buildUserGrowthMetrics(users, generatedAt, generatedBy, sourceVersion);

  const writeCounts = {
    adminMetrics: apply ? 4 : 0,
    overview: apply ? 1 : 0,
    engagement: apply ? 1 : 0,
    revenue: apply ? 1 : 0,
    userGrowth: apply ? 1 : 0,
  };

  if (apply) {
    const batch = db.batch();
    batch.set(db.collection('adminMetrics').doc('overview'), overview, { merge: true });
    batch.set(db.collection('adminMetrics').doc('engagement'), engagement, { merge: true });
    batch.set(db.collection('adminMetrics').doc('revenue'), revenue, { merge: true });
    batch.set(db.collection('adminMetrics').doc('userGrowth'), userGrowth, { merge: true });
    await batch.commit();
    options.log?.('admin metrics writes complete', { writeCounts });
  }

  const result: AdminMetricsRebuildResult = {
    mode: apply ? 'apply' : 'dry-run',
    generatedAt,
    durationMs: Date.now() - startedAt,
    readCounts,
    writeCounts,
    metrics: {
      overview: {
        totalUsers: overview.totalUsers,
        totalGroups: overview.totalGroups,
        totalChallenges: overview.totalChallenges,
        activities30d: overview.activities30d,
      },
      engagement: {
        activeUsers30d: engagement.activeUsers30d,
        activities30d: engagement.activities30d,
        topChallenges: engagement.topChallenges.length,
        topGroups: engagement.topGroups.length,
      },
      revenue: {
        totalConfirmedDonations: revenue.totalConfirmedDonations,
        pendingTransactions: revenue.pendingTransactions,
        donationApprovalPending: revenue.donationApprovalPending,
      },
      userGrowth: {
        totalUsers: userGrowth.totalUsers,
        newUsers7d: userGrowth.newUsers7d,
        newUsers30d: userGrowth.newUsers30d,
        signupTrend30d: userGrowth.signupTrend30d.length,
        recentSignups: userGrowth.recentSignups.length,
      },
    },
  };
  options.log?.('admin metrics rebuild finished', { durationMs: result.durationMs, readCounts, writeCounts });
  return result;
}
