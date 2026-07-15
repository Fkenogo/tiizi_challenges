import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { challengeService } from '../../services/challengeService';
import { groupService } from '../../services/groupService';
import { userProfileService } from '../../services/userProfileService';
import { Challenge } from '../../types';
import { isChallengeOngoing, isChallengeCompletedOrExpired } from '../../utils/challengeLifecycle';
import { buildChallengeProgress } from '../Challenges/challengeProgressDisplay';

type HomeScreenData = {
  profileSummary: {
    displayName: string;
    photoURL: string;
  };
  myGroupsCount: number;
  myChallenges: Array<{
    id: string;
    name: string;
    season: string;
    level: string;
    progress: number;
    progressLabel: string;
    secondaryLabel?: string;
    day: number;
    totalDays: number;
    groupId?: string;
    challengeType: 'collective' | 'competitive' | 'streak';
    actionLabel: 'Log Workout' | 'Log Activity';
    /** True when the user has personally completed their challenge goal. */
    isUserCompleted: boolean;
  }>;
  todaysGoals: Array<{
    id: string;
    text: string;
    completed: boolean;
  }>;
  mostActiveOngoing: Array<{
    id: string;
    name: string;
    members: string;
    imageUrl?: string;
    joined: boolean;
    daysLabel: string;
    actionLabel: 'Join' | 'View' | 'Log Workout' | 'Log Activity';
    groupId?: string;
    challengeType: 'collective' | 'competitive' | 'streak';
  }>;
};

function dayDiff(startIso: string, endIso: string) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.max(1, Math.ceil((end - start) / oneDay) + 1);
}

function currentDay(startIso: string) {
  const start = new Date(startIso).getTime();
  const now = Date.now();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.max(1, Math.floor((now - start) / oneDay) + 1);
}

function formatCompactCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${value}`;
}



export async function fetchHomeScreenData(uid: string): Promise<HomeScreenData> {
  const [
    profileResult,
    identityResult,
    myGroupsResult,
    membershipSummaryResult,
    visibleChallengesResult,
    accessibleChallengesResult,
  ] = await Promise.allSettled([
    userProfileService.getProfileSetup(uid),
    userProfileService.getUserIdentity(uid),
    groupService.getMyGroups(uid),
    challengeService.getUserChallengeMembershipSummaries(uid),
    challengeService.getVisibleChallengesForUser(uid, { maxResults: 60, statuses: ['active', 'completed'] }),
    challengeService.getUserAccessibleChallenges(uid),
  ]);
  const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
  const identity = identityResult.status === 'fulfilled' ? identityResult.value : null;
  const myGroups = myGroupsResult.status === 'fulfilled' ? myGroupsResult.value : [];
  const membershipSummaries = membershipSummaryResult.status === 'fulfilled' ? membershipSummaryResult.value : new Map();
  const visibleChallenges = visibleChallengesResult.status === 'fulfilled' ? visibleChallengesResult.value : [];
  const accessibleChallengesFromService = accessibleChallengesResult.status === 'fulfilled' ? accessibleChallengesResult.value : [];
  let allChallenges = visibleChallenges.length > 0 ? visibleChallenges : accessibleChallengesFromService;
  if (allChallenges.length === 0) {
    allChallenges = await challengeService
      .getVisibleChallengesForUser(uid, { maxResults: 60, statuses: ['active', 'completed'] })
      .catch(() => []);
  }
  const existingIds = new Set(allChallenges.map((challenge) => challenge.id));
  const membershipChallengeIds = Array.from(membershipSummaries.keys()).filter(Boolean);
  const missingMembershipIds = membershipChallengeIds.filter((id) => !existingIds.has(id));
  if (missingMembershipIds.length > 0) {
    const loadedMissing = await challengeService.getChallengesByIds(missingMembershipIds).catch(() => []);
    if (loadedMissing.length > 0) {
      allChallenges = [...allChallenges, ...loadedMissing];
    }
  }
  const myGroupIds = new Set([
    ...myGroups.map((group) => group.id),
    ...accessibleChallengesFromService.map((challenge) => challenge.groupId),
  ]);

  const accessibleChallenges = allChallenges
    .filter((challenge) => myGroupIds.has(challenge.groupId))
    .filter((item) => item.status === 'active' || (item.createdBy === uid && item.status === 'draft'))
    .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
  const activeMembershipChallengeIds = new Set(
    Array.from(membershipSummaries.entries())
      .filter(([, summary]) => {
        const normalized = String(summary.status ?? '').toLowerCase();
        return normalized !== 'abandoned' && normalized !== 'left' && normalized !== 'rejected';
      })
      .map(([challengeId]) => challengeId),
  );

  const challengeIndex = new Map(allChallenges.map((challenge) => [challenge.id, challenge]));
  const membershipChallenges = Array.from(activeMembershipChallengeIds)
    .map((challengeId) => challengeIndex.get(challengeId))
    .filter((challenge): challenge is Challenge => !!challenge);

  // Up to 10 joined ongoing challenges for the My Challenges carousel.
  const ongoingMemberChallenges = membershipChallenges
    .filter((challenge) => isChallengeOngoing(challenge))
    .sort((a, b) => {
      const aLast = membershipSummaries.get(a.id)?.lastActivityAt;
      const bLast = membershipSummaries.get(b.id)?.lastActivityAt;
      // Tier 1: has recent activity → sort by lastActivityAt desc
      if (aLast && bLast) return aLast > bLast ? -1 : aLast < bLast ? 1 : 0;
      if (aLast) return -1;
      if (bLast) return 1;
      // Tier 2: no activity → sort by endDate asc (soonest deadline first)
      return Date.parse(a.endDate) - Date.parse(b.endDate);
    })
    .slice(0, 10);

  // For competitive v2 challenges, fetch a lightweight leaderboard (all members for the
  // challenge, sorted by score in-memory) so home cards can show leader comparison.
  // At most 3 challenges, so at most 3 extra Firestore reads.
  const competitiveChallengeIds = ongoingMemberChallenges
    .filter((c) => c.challengeType === 'competitive' && c.engineVersion === 'v2')
    .map((c) => c.id);

  const competitiveLeaderboards = await challengeService.getCompetitiveLeaderboards(competitiveChallengeIds);

  // Read challengeActivitySummaries (CF-maintained canonical collective team totals) for all
  // member challenges. This read happens before card-building so the team total is available
  // without a second pass. Missing docs (first log ever or CF delayed) leave the map empty;
  // the resolver falls back to userContribFloor (cumulativeLoggedValue) as a lower bound.
  const memberChallengeIds = ongoingMemberChallenges.map((c) => c.id).filter(Boolean);
  const memberActivitySummaryMap = await challengeService.getChallengeActivitySummaries(memberChallengeIds);

  // Build base cards synchronously, then enrich the first card with live progress.
  const myChallengeCards: HomeScreenData['myChallenges'] = ongoingMemberChallenges.map((c) => {
    const totalDays = dayDiff(c.startDate, c.endDate);
    const rawDay = currentDay(c.startDate);
    const day = Math.min(totalDays, Math.max(1, rawDay));
    const membership = membershipSummaries.get(c.id) ?? null;
    const leaderboard = competitiveLeaderboards.get(c.id);
    // buildChallengeProgress guarantees that progress (bar) and progressLabel (text) derive
    // from the same source — no more "0 / 700 reps" while the bar shows 14%.
    const activitySummaryTotal = memberActivitySummaryMap.get(c.id)?.totalValue;
    const display = buildChallengeProgress(c, membership, leaderboard, uid, activitySummaryTotal, c.groupCurrentTotal);
    return {
      id: c.id,
      name: c.name,
      season: c.challengeType ? `${c.challengeType} challenge` : 'Group challenge',
      level: 'Active',
      day,
      totalDays,
      progress: display.progress,
      progressLabel: display.primaryLabel,
      secondaryLabel: display.secondaryLabel,
      groupId: c.groupId,
      challengeType: c.challengeType ?? 'collective',
      actionLabel: (c.category && c.category !== 'fitness' ? 'Log Activity' : 'Log Workout') as 'Log Workout' | 'Log Activity',
      isUserCompleted: display.isUserCompleted,
    };
  });

  // Enrich first card with live log-based progress (one Firestore read, same as before).
  let workoutLoggedToday = false;
  const firstChallenge = ongoingMemberChallenges[0] ?? null;
  const firstCard = myChallengeCards[0] ?? null;
  if (firstChallenge && firstCard) {
    const today = new Date().toISOString().slice(0, 10);
    const membership = membershipSummaries.get(firstCard.id);
    const lastActivityIso = membership?.lastActivityAt;
    workoutLoggedToday = Boolean(lastActivityIso && lastActivityIso.slice(0, 10) === today);

    const primaryActivity = firstChallenge.activities?.[0];
    const targetValue = Math.max(1, Number(primaryActivity?.targetValue ?? 0));

    if (targetValue > 0) {
      // Use challengeMembers.cumulativeLoggedValue as the source of truth for user progress.
      // Raw workout/wellnessLog queries were removed — they diverged from the field written
      // by client engines (workoutService, wellnessLogService, activityLogSessionService).
      const liveDisplay = buildChallengeProgress(
        firstChallenge,
        {
          completionRate: membership?.completionRate ?? 0,
          cumulativeLoggedValue: Math.max(0, Number(membership?.cumulativeLoggedValue ?? 0)),
          currentStreak: membership?.currentStreak ?? 0,
          status: membership?.status,
        },
        competitiveLeaderboards.get(firstCard.id),
        uid,
        memberActivitySummaryMap.get(firstCard.id)?.totalValue,
        firstChallenge.groupCurrentTotal,
      );
      firstCard.progress = liveDisplay.progress;
      firstCard.progressLabel = liveDisplay.primaryLabel;
      firstCard.secondaryLabel = liveDisplay.secondaryLabel;
      firstCard.isUserCompleted = liveDisplay.isUserCompleted;
    } else {
      firstCard.progress = Math.min(100, Math.round(membership?.completionRate ?? 0));
      firstCard.progressLabel = `${firstCard.progress}% complete`;
    }
  }

  const nowMs = Date.now();
  const oneDay = 1000 * 60 * 60 * 24;

  const membershipIndex = await challengeService.getUserChallengeMembershipIndex(uid).catch(() => new Map<string, string>());

  // Batch-read challengeActivitySummaries for all ongoing candidates to rank by totalLogs.
  // Maintained by Cloud Functions on every workout + wellness log. Missing docs → totalLogs = 0.
  const ongoingCandidates = allChallenges.filter((challenge) => isChallengeOngoing(challenge, nowMs));
  const candidateIds = ongoingCandidates.map((c) => c.id).filter(Boolean);
  const activitySummaryMap = await challengeService.getChallengeActivitySummaries(candidateIds);

  const mostActiveOngoing: HomeScreenData['mostActiveOngoing'] = ongoingCandidates
    .sort((a, b) => {
      const aLogs = activitySummaryMap.get(a.id)?.totalLogs ?? 0;
      const bLogs = activitySummaryMap.get(b.id)?.totalLogs ?? 0;
      if (bLogs !== aLogs) return bLogs - aLogs;
      return (b.participantCount ?? 0) - (a.participantCount ?? 0);
    })
    .slice(0, 5)
    .map((challenge) => {
      const end = Date.parse(challenge.endDate);
      const remaining = !Number.isNaN(end) ? Math.max(0, Math.ceil((end - nowMs) / oneDay)) : 0;
      const memberStatus = membershipIndex.get(challenge.id) ?? membershipSummaries.get(challenge.id)?.status;
      const joined = activeMembershipChallengeIds.has(challenge.id);
      let actionLabel: 'Join' | 'View' | 'Log Workout' | 'Log Activity' = 'Join';
      if (memberStatus === 'completed') {
        actionLabel = 'View';
      } else if (joined) {
        actionLabel = (challenge.category && challenge.category !== 'fitness') ? 'Log Activity' : 'Log Workout';
      }
      const totalLogs = activitySummaryMap.get(challenge.id)?.totalLogs ?? 0;
      return {
        id: challenge.id,
        name: challenge.name,
        groupId: challenge.groupId,
        challengeType: challenge.challengeType ?? 'collective',
        members: totalLogs > 0
          ? `${formatCompactCount(totalLogs)} logs`
          : `${formatCompactCount(challenge.participantCount ?? 0)} members`,
        imageUrl: challenge.coverImageUrl,
        joined,
        daysLabel: `${remaining} Days Left`,
        actionLabel,
      };
    });

  return {
    profileSummary: {
      displayName:
        profile?.personalInfo?.displayName
        || profile?.personalInfo?.fullName
        || identity?.displayName
        || 'Athlete',
      photoURL: profile?.personalInfo?.photoURL || identity?.photoURL || '',
    },
    myGroupsCount: myGroups.length,
    myChallenges: myChallengeCards,
    todaysGoals: [
      { id: 'goal-log-workout', text: 'Log today\'s challenge workout', completed: workoutLoggedToday },
      { id: 'goal-profile', text: 'Complete your profile setup', completed: !!profile?.onboardingCompleted },
      { id: 'goal-group', text: 'Join at least one active group', completed: myGroups.length > 0 },
    ],
    mostActiveOngoing,
  };
}

export function useHomeScreenData() {
  const { user, isReady } = useAuth();
  return useQuery({
    queryKey: ['home-screen-data', user?.uid],
    queryFn: async () => {
      if (!user?.uid) {
        return fetchHomeScreenData('');
      }
      // Ensure auth token is initialized before Firestore reads on first sign-in.
      await user.getIdToken();
      return fetchHomeScreenData(user.uid);
    },
    enabled: !!user?.uid && isReady,
    retry: (failureCount) => failureCount < 2,
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 2000),
    staleTime: 15 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
}
