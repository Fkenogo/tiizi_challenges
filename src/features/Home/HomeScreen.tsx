import { Bell } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Screen, BottomNav } from '../../components/Layout';
import { useHomeScreenData } from './useHomeScreen';
import { useAuth } from '../../hooks/useAuth';
import { useDailyGoals, useSaveDailyGoals } from '../../hooks/useDailyGoals';
import { ActiveChallengeCard } from '../../components/Home/ActiveChallengeCard';
import { TrendingChallenges } from '../../components/Home/TrendingChallenges';
import { LoadingSpinner } from '../../components/Layout';
import { useChallenges } from '../../hooks/useChallenges';
import { challengeService } from '../../services/challengeService';

function HomeScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const { data: dailyGoals = [] } = useDailyGoals(user?.uid);
  const saveDailyGoals = useSaveDailyGoals();
  const [goalInput, setGoalInput] = useState('');
  const goalsSectionRef = useRef<HTMLElement | null>(null);
  const goalInputRef = useRef<HTMLInputElement | null>(null);
  const hasRetriedEmptyHomeRef = useRef(false);
  const { data, isLoading, isError, refetch } = useHomeScreenData();
  const { data: accessibleChallenges = [] } = useChallenges();
  const { data: visibleChallenges = [] } = useQuery({
    queryKey: ['all-challenges-catalog-home-fallback', user?.uid],
    enabled: !!user?.uid,
    queryFn: () => challengeService.getVisibleChallengesForUser(String(user?.uid), { statuses: ['active', 'completed'], maxResults: 60 }),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
  const { data: membershipIndex = new Map<string, string>() } = useQuery({
    queryKey: ['challenge-memberships-index-home-fallback', user?.uid],
    enabled: !!user?.uid,
    queryFn: async () => {
      if (!user?.uid) return new Map<string, string>();
      return challengeService.getUserChallengeMembershipIndex(user.uid);
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
  const displayName =
    data?.profileSummary.displayName ||
    profile?.displayName ||
    user?.displayName ||
    'Athlete';
  const profilePhoto = data?.profileSummary.photoURL || user?.photoURL || '';

  const canAddGoal = goalInput.trim().length > 0 && dailyGoals.length < 3;
  const sortedGoals = useMemo(
    () => [...dailyGoals].sort((a, b) => Number(a.completed) - Number(b.completed)),
    [dailyGoals],
  );

  const fallbackActiveChallenge = useMemo(() => {
    const now = Date.now();
    const candidates = accessibleChallenges
      .filter((item) => item.status === 'active')
      .filter((item) => {
        const start = Date.parse(item.startDate);
        const end = Date.parse(item.endDate);
        return !Number.isNaN(start) && !Number.isNaN(end) && now >= start && now <= end;
      })
      .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
    const selected = candidates.find((item) => {
      const status = membershipIndex.get(item.id);
      return status === 'active' || status === 'completed';
    });
    if (!selected) return null;
    const start = Date.parse(selected.startDate);
    const end = Date.parse(selected.endDate);
    const oneDay = 1000 * 60 * 60 * 24;
    const totalDays = Math.max(1, Math.ceil((end - start) / oneDay) + 1);
    const day = Math.min(totalDays, Math.max(1, Math.floor((now - start) / oneDay) + 1));
    return {
      id: selected.id,
      name: selected.name,
      season: selected.challengeType ? `${selected.challengeType} challenge` : 'Group challenge',
      level: 'Active',
      progress: Math.max(5, Math.round((day / totalDays) * 100)),
      progressLabel: `${Math.max(5, Math.round((day / totalDays) * 100))}% complete`,
      day,
      totalDays,
      groupId: selected.groupId,
      challengeType: selected.challengeType ?? 'collective',
      actionLabel: selected.category && selected.category !== 'fitness' ? 'Log Activity' as const : 'Log Workout' as const,
    };
  }, [accessibleChallenges, membershipIndex]);

  const fallbackTrending = useMemo(() => {
    const now = Date.now();
    const oneDay = 1000 * 60 * 60 * 24;
    return visibleChallenges
      .filter((item) => item.status === 'active' || item.status === 'completed')
      .sort((a, b) => {
        const participantDelta = Number(b.participantCount ?? 0) - Number(a.participantCount ?? 0);
        if (participantDelta !== 0) return participantDelta;
        return Date.parse(b.startDate) - Date.parse(a.startDate);
      })
      .slice(0, 5)
      .map((challenge) => {
        const start = Date.parse(challenge.startDate);
        const end = Date.parse(challenge.endDate);
        const hasStarted = !Number.isNaN(start) && now >= start;
        const hasEnded = !Number.isNaN(end) && now > end;
        const remaining = !Number.isNaN(end) ? Math.max(0, Math.ceil((end - now) / oneDay)) : 0;
        const startsIn = !Number.isNaN(start) ? Math.max(0, Math.ceil((start - now) / oneDay)) : 0;
        const joined = (membershipIndex.get(challenge.id) === 'active') || (membershipIndex.get(challenge.id) === 'completed');
        const isCompleted = challenge.status === 'completed' || hasEnded;
        const actionLabel: 'Join' | 'View' | 'Log Workout' | 'Log Activity' = joined
          ? (isCompleted
            ? 'View'
            : hasStarted
            ? ((challenge.category && challenge.category !== 'fitness')
              ? 'Log Activity'
              : 'Log Workout')
            : 'View')
          : (isCompleted ? 'View' : 'Join');
        return {
          id: challenge.id,
          name: challenge.name,
          members: `${challenge.participantCount ?? 0}`,
          imageUrl: challenge.coverImageUrl,
          joined,
          daysLabel: isCompleted ? 'Completed' : (hasStarted ? `${remaining} Days Left` : `Starts in ${startsIn} Days`),
          actionLabel,
          groupId: challenge.groupId,
          challengeType: challenge.challengeType ?? 'collective',
        };
      });
  }, [visibleChallenges, membershipIndex]);

  const effectiveActiveChallenge = data?.activeChallenge ?? fallbackActiveChallenge;
  const effectiveTrendingChallenges =
    (data?.trendingChallenges && data.trendingChallenges.length > 0)
      ? data.trendingChallenges
      : fallbackTrending;

  useEffect(() => {
    hasRetriedEmptyHomeRef.current = false;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || isLoading || isError || hasRetriedEmptyHomeRef.current) return;
    if (effectiveActiveChallenge || effectiveTrendingChallenges.length > 0) return;
    hasRetriedEmptyHomeRef.current = true;
    const timer = window.setTimeout(() => {
      void refetch();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [user?.uid, isLoading, isError, effectiveActiveChallenge, effectiveTrendingChallenges.length, refetch]);

  useEffect(() => {
    if (searchParams.get('focusGoals') !== '1') return;
    const timer = window.setTimeout(() => {
      goalsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      goalInputRef.current?.focus();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  const handleAddGoal = async () => {
    if (!canAddGoal) return;
    const next = [...dailyGoals, { id: `goal-${Date.now()}`, text: goalInput.trim(), completed: false }];
    await saveDailyGoals.mutateAsync(next);
    setGoalInput('');
  };

  const toggleGoal = async (goalId: string) => {
    const next = dailyGoals.map((item) =>
      item.id === goalId ? { ...item, completed: !item.completed } : item,
    );
    await saveDailyGoals.mutateAsync(next);
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen label="Loading Home..." />;
  }

  if (isError) {
    return (
      <Screen className="st-page">
        <div className="st-frame flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-slate-500">Unable to load home data.</p>
        </div>
      </Screen>
    );
  }

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen pb-[96px] bg-slate-50">
        <header className="px-4 pt-5 pb-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt={displayName}
                  className="w-14 h-14 rounded-full object-cover border-[3px] border-[#f6cdb5]"
                />
              ) : (
                <div className="w-14 h-14 rounded-full border-[3px] border-[#f6cdb5] bg-primary/15 text-primary flex items-center justify-center text-lg font-bold">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[13px] leading-[16px] text-slate-500">Welcome back,</p>
                <h1 className="st-page-title truncate">
                  {displayName}!
                </h1>
              </div>
            </div>
            <button className="relative h-11 w-11 flex items-center justify-center text-slate-800" onClick={() => navigate('/app/notifications')}>
              <Bell size={22} />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
            </button>
          </div>
        </header>

        <main className="px-4 pt-5 space-y-8">
          <section>
            <h2 className="st-section-label mb-3">Active Challenge</h2>
            {effectiveActiveChallenge ? (
              <ActiveChallengeCard challenge={effectiveActiveChallenge} />
            ) : (
              <article className="rounded-2xl border border-slate-200 bg-white px-3 py-4">
                <p className="text-sm text-slate-600">No active group challenge yet.</p>
                {data?.myGroupsCount ? (
                  <button className="mt-3 h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white" onClick={() => navigate('/app/challenges')}>
                    Browse Challenges
                  </button>
                ) : (
                  <button className="mt-3 h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white" onClick={() => navigate('/app/groups')}>
                    Join a Group
                  </button>
                )}
              </article>
            )}
          </section>

          <section ref={goalsSectionRef}>
            <h3 className="st-section-label mb-3">Today's Goals</h3>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex gap-2">
                <input
                  ref={goalInputRef}
                  className="h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm"
                  placeholder="Write your goal for today..."
                  value={goalInput}
                  onChange={(event) => setGoalInput(event.target.value)}
                  disabled={dailyGoals.length >= 3 || saveDailyGoals.isPending}
                />
                <button
                  className="h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60"
                  onClick={handleAddGoal}
                  disabled={!canAddGoal || saveDailyGoals.isPending}
                >
                  Add
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">Up to 3 goals per day.</p>

              <div className="mt-3 space-y-2">
                {sortedGoals.map((goal) => (
                  <button
                    key={goal.id}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-left"
                    onClick={() => toggleGoal(goal.id)}
                    disabled={saveDailyGoals.isPending}
                  >
                    <span className={`text-sm ${goal.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                      {goal.completed ? '✓ ' : '○ '}
                      {goal.text}
                    </span>
                  </button>
                ))}
                {sortedGoals.length === 0 && (
                  <p className="text-sm text-slate-500">No goals yet. Add up to 3 goals for today.</p>
                )}
              </div>
            </article>
          </section>

          <section>
            <div className="flex items-end justify-between mb-3">
              <h3 className="st-section-label">Trending Challenges</h3>
              <button className="text-[14px] leading-[18px] font-semibold text-primary" onClick={() => navigate('/app/challenges')}>
                See All →
              </button>
            </div>
            {effectiveTrendingChallenges && (
              <TrendingChallenges
                challenges={effectiveTrendingChallenges}
                onSelectChallenge={(challengeId) => {
                  const selected = effectiveTrendingChallenges.find((item) => item.id === challengeId);
                  if (!selected) {
                    navigate('/app/challenges');
                    return;
                  }
                  const query = new URLSearchParams({ groupId: selected.groupId ?? '' });
                  if (!selected.groupId) query.delete('groupId');
                  const queryString = query.toString();
                  navigate(`/app/challenge/${challengeId}${queryString ? `?${queryString}` : ''}`);
                }}
              />
            )}
            {(!effectiveTrendingChallenges || effectiveTrendingChallenges.length === 0) && (
              <article className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                No trending challenges available yet.
              </article>
            )}
          </section>
        </main>

        <BottomNav active="home" />
      </div>
    </Screen>
  );
}

export default HomeScreen;
