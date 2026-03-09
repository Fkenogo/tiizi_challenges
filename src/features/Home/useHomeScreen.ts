import { useQuery } from '@tanstack/react-query';
import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';
import { challengeService } from '../../services/challengeService';
import { groupService } from '../../services/groupService';
import { userProfileService } from '../../services/userProfileService';
import { db } from '../../lib/firebase';
import { Challenge } from '../../types';

type HomeScreenData = {
  profileSummary: {
    displayName: string;
    photoURL: string;
  };
  myGroupsCount: number;
  activeChallenge: {
    id: string;
    name: string;
    season: string;
    level: string;
    progress: number;
    progressLabel: string;
    day: number;
    totalDays: number;
    groupId?: string;
    challengeType: 'collective' | 'competitive' | 'streak';
    actionLabel: 'Log Workout' | 'Log Activity';
  } | null;
  todaysGoals: Array<{
    id: string;
    text: string;
    completed: boolean;
  }>;
  trendingChallenges: Array<{
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

function isChallengeActiveNow(startDate: string, endDate: string) {
  const now = Date.now();
  const start = Date.parse(startDate);
  const end = Date.parse(endDate);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return now >= start && now <= end;
}

function formatMetric(value: number, unit: string) {
  const safeUnit = unit || 'units';
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(1));
  return `${rounded} ${safeUnit}`;
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
    const chunks: string[][] = [];
    for (let i = 0; i < missingMembershipIds.length; i += 10) {
      chunks.push(missingMembershipIds.slice(i, i + 10));
    }
    const missingSnaps = await Promise.all(
      chunks.map((chunk) =>
        getDocs(
          query(collection(db, 'challenges'), where(documentId(), 'in', chunk)),
        ),
      ),
    ).catch(() => []);
    const loadedMissing = missingSnaps.flatMap((snap) =>
      snap.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Challenge, 'id'>) })),
    );
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

  const activeChallenge =
    membershipChallenges.find((challenge) =>
      challenge.status === 'active' && isChallengeActiveNow(challenge.startDate, challenge.endDate),
    )
    ?? null;

  const activeChallengeCard = activeChallenge
    ? {
        id: activeChallenge.id,
        name: activeChallenge.name,
        season: activeChallenge.challengeType ? `${activeChallenge.challengeType} challenge` : 'Group challenge',
        level: activeChallenge.status === 'active' ? 'Active' : 'Open',
        day: 1,
        totalDays: dayDiff(activeChallenge.startDate, activeChallenge.endDate),
        progress: 0,
        groupId: activeChallenge.groupId,
        challengeType: activeChallenge.challengeType ?? 'collective',
        actionLabel:
          activeChallenge.category && activeChallenge.category !== 'fitness'
            ? 'Log Activity'
            : 'Log Workout' as 'Log Workout' | 'Log Activity',
        progressLabel: '0 complete',
      }
    : null;

  if (activeChallengeCard && activeChallenge) {
    const rawDay = currentDay(activeChallenge.startDate);
    activeChallengeCard.day = Math.min(activeChallengeCard.totalDays, Math.max(1, rawDay));
  }

  let workoutLoggedToday = false;
  if (activeChallengeCard && activeChallenge) {
    const selectedActiveChallenge = activeChallenge;
    const today = new Date().toISOString().slice(0, 10);
    const membership = membershipSummaries.get(activeChallengeCard.id);
    const lastActivityIso = membership?.lastActivityAt;
    workoutLoggedToday = Boolean(lastActivityIso && lastActivityIso.slice(0, 10) === today);

    const primaryActivity = selectedActiveChallenge.activities?.[0];
    const targetValue = Math.max(1, Number(primaryActivity?.targetValue ?? 0));
    const unit = String(primaryActivity?.unit ?? 'units');
    let progressValue = 0;

    if (targetValue > 0 && primaryActivity) {
      const isWellness = (selectedActiveChallenge.category && selectedActiveChallenge.category !== 'fitness') || !!primaryActivity.activityId;
      if (isWellness) {
        const logsSnap = await getDocs(
          query(collection(db, 'wellnessLogs'), where('challengeId', '==', selectedActiveChallenge.id)),
        );
        logsSnap.docs.forEach((item) => {
          const data = item.data() as { userId?: string; value?: number; activityId?: string };
          const shouldCount = selectedActiveChallenge.challengeType === 'collective'
            ? (primaryActivity.activityId ? data.activityId === primaryActivity.activityId : true)
            : data.userId === uid && (primaryActivity.activityId ? data.activityId === primaryActivity.activityId : true);
          if (shouldCount) {
            progressValue += Math.max(0, Number(data.value ?? 0));
          }
        });
      } else {
        const workoutsSnap = await getDocs(
          query(collection(db, 'workouts'), where('challengeId', '==', selectedActiveChallenge.id)),
        );
        workoutsSnap.docs.forEach((item) => {
          const data = item.data() as { userId?: string; value?: number; exerciseId?: string };
          const shouldCount = selectedActiveChallenge.challengeType === 'collective'
            ? (primaryActivity.exerciseId ? data.exerciseId === primaryActivity.exerciseId : true)
            : data.userId === uid && (primaryActivity.exerciseId ? data.exerciseId === primaryActivity.exerciseId : true);
          if (shouldCount) {
            progressValue += Math.max(0, Number(data.value ?? 0));
          }
        });
      }
    }

    if (targetValue > 0) {
      const metricPercent = Math.min(100, Math.round((progressValue / targetValue) * 100));
      activeChallengeCard.progress = metricPercent;
      activeChallengeCard.progressLabel = `${formatMetric(progressValue, unit)} of ${formatMetric(targetValue, unit)}`;
    } else {
      const fallbackPercent = Math.min(100, Math.round(membership?.completionRate ?? 0));
      activeChallengeCard.progress = fallbackPercent;
      activeChallengeCard.progressLabel = `${activeChallengeCard.progress}% complete`;
    }
  }

  // allChallenges already comes from visibility-safe queries
  // (public groups + member groups), so avoid secondary group lookups
  // that can hide data during first-auth hydration.
  const openChallenges = allChallenges
    .filter((challenge) => challenge.status === 'active' || challenge.status === 'completed')
    .slice(0, 30);

  const trendingChallenges: HomeScreenData['trendingChallenges'] = openChallenges
    .sort((a, b) => {
      const participantDelta = (b.participantCount ?? 0) - (a.participantCount ?? 0);
      if (participantDelta !== 0) return participantDelta;
      return Date.parse(b.startDate) - Date.parse(a.startDate);
    })
    .slice(0, 5)
    .map((challenge) => {
      const now = Date.now();
      const start = Date.parse(challenge.startDate);
      const end = Date.parse(challenge.endDate);
      const oneDay = 1000 * 60 * 60 * 24;
      const hasStarted = !Number.isNaN(start) && now >= start;
      const hasEnded = !Number.isNaN(end) && now > end;
      const remaining = !Number.isNaN(end) ? Math.max(0, Math.ceil((end - now) / oneDay)) : 0;
      const startsIn = !Number.isNaN(start) ? Math.max(0, Math.ceil((start - now) / oneDay)) : 0;
      const joined = activeMembershipChallengeIds.has(challenge.id);
      const isCompleted = challenge.status === 'completed' || hasEnded;
      return {
        id: challenge.id,
        name: challenge.name,
        groupId: challenge.groupId,
        challengeType: challenge.challengeType ?? 'collective',
        members: formatCompactCount(challenge.participantCount ?? 0),
        imageUrl: challenge.coverImageUrl,
        joined,
        daysLabel: isCompleted ? 'Completed' : (hasStarted ? `${remaining} Days Left` : `Starts in ${startsIn} Days`),
        actionLabel: isCompleted
          ? 'View'
          : joined
            ? (hasStarted
              ? ((challenge.category && challenge.category !== 'fitness') ? 'Log Activity' : 'Log Workout')
              : 'View')
            : 'Join',
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
    activeChallenge: activeChallengeCard,
    todaysGoals: [
      { id: 'goal-log-workout', text: 'Log today’s challenge workout', completed: workoutLoggedToday },
      { id: 'goal-profile', text: 'Complete your profile setup', completed: !!profile?.onboardingCompleted },
      { id: 'goal-group', text: 'Join at least one active group', completed: myGroups.length > 0 },
    ],
    trendingChallenges,
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
