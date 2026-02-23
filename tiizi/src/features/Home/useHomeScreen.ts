import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { challengeService } from '../../services/challengeService';
import { challengeTemplateService } from '../../services/challengeTemplateService';
import { groupService } from '../../services/groupService';
import { userProfileService } from '../../services/userProfileService';
import { workoutService } from '../../services/workoutService';

type HomeScreenData = {
  activeChallenge: {
    id: string;
    name: string;
    season: string;
    level: string;
    progress: number;
    day: number;
    totalDays: number;
    groupId?: string;
    challengeType: 'collective' | 'competitive' | 'streak';
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
    gradient: string;
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

function formatParticipants(popularityText?: string) {
  if (!popularityText) return '0';
  const normalized = popularityText.toLowerCase().replace('joined', '').trim();
  return normalized.length > 0 ? normalized : '0';
}

function formatCompactCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${value}`;
}

async function fetchHomeScreenData(uid: string): Promise<HomeScreenData> {
  const [profileResult, myGroupsResult, allChallengesResult, templatesResult] = await Promise.allSettled([
    userProfileService.getProfileSetup(uid),
    groupService.getMyGroups(uid),
    challengeService.getChallenges(),
    challengeTemplateService.getPublishedTemplates(),
  ]);
  const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
  const myGroups = myGroupsResult.status === 'fulfilled' ? myGroupsResult.value : [];
  const allChallenges = allChallengesResult.status === 'fulfilled' ? allChallengesResult.value : [];
  const templates = templatesResult.status === 'fulfilled' ? templatesResult.value : [];

  const groupIds = new Set(myGroups.map((group) => group.id));
  const activeChallenge =
    allChallenges.find((challenge) => challenge.status === 'active' && challenge.groupId && groupIds.has(challenge.groupId)) ??
    null;

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
      }
    : null;

  if (activeChallengeCard && activeChallenge) {
    const rawDay = currentDay(activeChallenge.startDate);
    activeChallengeCard.day = Math.min(activeChallengeCard.totalDays, Math.max(1, rawDay));
  }

  let workoutLoggedToday = false;
  if (activeChallengeCard) {
    const workouts = await workoutService.getWorkoutsByChallenge(activeChallengeCard.id).catch(() => []);
    const today = new Date().toISOString().slice(0, 10);
    const myWorkouts = workouts.filter((item) => item.userId === uid);
    workoutLoggedToday = myWorkouts.some((item) => item.completedAt.slice(0, 10) === today);

    const percentFromDate = Math.round((activeChallengeCard.day / activeChallengeCard.totalDays) * 100);
    const percentFromLogs = Math.min(100, myWorkouts.length * 5);
    activeChallengeCard.progress = Math.max(5, Math.min(100, Math.max(percentFromDate, percentFromLogs)));
  }

  let trendingChallenges: HomeScreenData['trendingChallenges'] = [];
  if (templates.length > 0) {
    trendingChallenges = templates.slice(0, 2).map((template) => ({
      id: template.id,
      name: template.name,
      members: formatParticipants(template.popularityText),
      gradient:
        template.challengeType === 'streak'
          ? 'from-[#bde2de] to-[#8eb0ba]'
          : template.challengeType === 'competitive'
            ? 'from-[#222f4b] to-[#3d4c66]'
            : 'from-[#264f4b] to-[#15324a]',
    }));
  } else {
    const openChallenges = allChallenges
      .filter((challenge) => challenge.status === 'active')
      .slice(0, 2);

    const participantCounts = await Promise.all(
      openChallenges.map(async (challenge) => {
        const workouts = await workoutService.getWorkoutsByChallenge(challenge.id).catch(() => []);
        const uniqueParticipants = new Set(workouts.map((workout) => workout.userId)).size;
        return {
          challengeId: challenge.id,
          participants: uniqueParticipants,
        };
      }),
    );

    const participantMap = new Map(participantCounts.map((entry) => [entry.challengeId, entry.participants]));
    trendingChallenges = openChallenges.map((challenge) => ({
      id: challenge.id,
      name: challenge.name,
      members: formatCompactCount(participantMap.get(challenge.id) ?? 0),
      gradient:
        challenge.challengeType === 'streak'
          ? 'from-[#bde2de] to-[#8eb0ba]'
          : challenge.challengeType === 'competitive'
            ? 'from-[#222f4b] to-[#3d4c66]'
            : 'from-[#264f4b] to-[#15324a]',
    }));
  }

  return {
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
  const { user } = useAuth();
  return useQuery({
    queryKey: ['home-screen-data', user?.uid],
    queryFn: () => fetchHomeScreenData(String(user?.uid)),
    enabled: !!user?.uid,
    staleTime: 30 * 1000,
  });
}
