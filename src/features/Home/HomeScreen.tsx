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
import { isChallengeOngoing } from '../../utils/challengeLifecycle';

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

  const fallbackMyChallenges = useMemo(() => {
    const now = Date.now();
    return accessibleChallenges
      .filter((item) => isChallengeOngoing(item, now) && membershipIndex.has(item.id))
      .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate))
      .slice(0, 3)
      .map((item) => {
        const start = Date.parse(item.startDate);
        const end = Date.parse(item.endDate);
        const oneDay = 1000 * 60 * 60 * 24;
        const totalDays = Math.max(1, Math.ceil((end - start) / oneDay) + 1);
        const day = Math.min(totalDays, Math.max(1, Math.floor((now - start) / oneDay) + 1));
        const progress = Math.max(5, Math.round((day / totalDays) * 100));
        return {
          id: item.id,
          name: item.name,
          season: item.challengeType ? `${item.challengeType} challenge` : 'Group challenge',
          level: 'Active',
          progress,
          progressLabel: `${progress}% complete`,
          day,
          totalDays,
          groupId: item.groupId,
          challengeType: item.challengeType ?? 'collective',
          actionLabel: (item.category && item.category !== 'fitness' ? 'Log Activity' : 'Log Workout') as 'Log Workout' | 'Log Activity',
          isUserCompleted: false,
        };
      });
  }, [accessibleChallenges, membershipIndex]);

  const fallbackMostActive = useMemo(() => {
    const now = Date.now();
    const oneDay = 1000 * 60 * 60 * 24;
    return visibleChallenges
      .filter((item) => isChallengeOngoing(item, now))
      .sort((a, b) => Number(b.participantCount ?? 0) - Number(a.participantCount ?? 0))
      .slice(0, 3)
      .map((challenge) => {
        const end = Date.parse(challenge.endDate);
        const remaining = !Number.isNaN(end) ? Math.max(0, Math.ceil((end - now) / oneDay)) : 0;
        const joined = membershipIndex.get(challenge.id) === 'active';
        const actionLabel: 'Join' | 'View' | 'Log Workout' | 'Log Activity' = joined
          ? ((challenge.category && challenge.category !== 'fitness') ? 'Log Activity' : 'Log Workout')
          : 'Join';
        return {
          id: challenge.id,
          name: challenge.name,
          members: `${challenge.participantCount ?? 0}`,
          imageUrl: challenge.coverImageUrl,
          joined,
          daysLabel: `${remaining} Days Left`,
          actionLabel,
          groupId: challenge.groupId,
          challengeType: challenge.challengeType ?? 'collective',
        };
      });
  }, [visibleChallenges, membershipIndex]);

  const effectiveMyChallenges =
    (data?.myChallenges && data.myChallenges.length > 0)
      ? data.myChallenges
      : fallbackMyChallenges;
  const effectiveMostActive =
    (data?.mostActiveOngoing && data.mostActiveOngoing.length > 0)
      ? data.mostActiveOngoing
      : fallbackMostActive;

  const joinedGroupCount = data?.myGroupsCount ?? 0;
  const activeChallengeCount = effectiveMyChallenges.length;
  const showActivationCard = joinedGroupCount === 0 && activeChallengeCount === 0;

  useEffect(() => {
    hasRetriedEmptyHomeRef.current = false;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || isLoading || isError || hasRetriedEmptyHomeRef.current) return;
    if (effectiveMyChallenges.length > 0 || effectiveMostActive.length > 0) return;
    hasRetriedEmptyHomeRef.current = true;
    const timer = window.setTimeout(() => {
      void refetch();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [user?.uid, isLoading, isError, effectiveMyChallenges.length, effectiveMostActive.length, refetch]);

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
        <header className="px-4 pt-4 pb-3 border-b border-slate-200/70 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              {profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt={displayName}
                  className="w-10 h-10 rounded-full object-cover border-2 border-[#f6cdb5] flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full border-2 border-[#f6cdb5] bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[11px] leading-[14px] font-medium text-slate-400 uppercase tracking-[0.06em]">Welcome back</p>
                <h1 className="text-[17px] leading-[22px] font-black text-slate-900 truncate">
                  {displayName}
                </h1>
              </div>
            </div>
            <button className="relative h-9 w-9 flex items-center justify-center text-slate-700" onClick={() => navigate('/app/notifications')}>
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
            </button>
          </div>
        </header>

        <main className="px-4 pt-5 space-y-7">
          {showActivationCard && (
            <section>
              <article className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-base font-black text-slate-900">Start your Tiizi journey</p>
                <p className="mt-1.5 text-sm text-slate-600">
                  Join a group or create your first challenge to start building healthy habits together.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    className="h-10 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900"
                    onClick={() => navigate('/app/groups', { state: { tab: 'discover' } })}
                  >
                    Explore Groups
                  </button>
                  <button
                    className="h-10 rounded-xl bg-primary text-sm font-bold text-white"
                    onClick={() => navigate('/app/create-challenge')}
                  >
                    Create Challenge
                  </button>
                </div>
              </article>
            </section>
          )}

          <section>
            <h2 className="st-section-label mb-3">My Challenges</h2>
            {effectiveMyChallenges.length > 0 ? (
              <div className="-mx-4 overflow-x-auto px-4">
                <div className={effectiveMyChallenges.length > 1 ? 'flex gap-3 pb-1' : ''} style={effectiveMyChallenges.length > 1 ? { width: 'max-content' } : undefined}>
                  {effectiveMyChallenges.map((challenge) => (
                    <div key={challenge.id} className={effectiveMyChallenges.length > 1 ? 'w-[300px] shrink-0' : undefined}>
                      <ActiveChallengeCard challenge={challenge} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <article className="rounded-2xl border border-slate-200 bg-white px-3 py-4">
                <p className="text-sm font-bold text-slate-900">Get Started</p>
                <p className="mt-1 text-sm text-slate-600">Your active challenges will appear here once you join or create one.</p>
                {data?.myGroupsCount ? (
                  <button className="mt-3 h-10 rounded-xl bg-primary px-5 text-sm font-bold text-white" onClick={() => navigate('/app/challenges')}>
                    Browse Challenges
                  </button>
                ) : (
                  <button className="mt-3 h-10 rounded-xl bg-primary px-5 text-sm font-bold text-white" onClick={() => navigate('/app/groups', { state: { tab: 'discover' } })}>
                    Join a Group
                  </button>
                )}
              </article>
            )}
          </section>

          <section ref={goalsSectionRef}>
            <h3 className="st-section-label mb-3">Today's Goals</h3>
            <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex gap-2">
                <input
                  ref={goalInputRef}
                  className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[14px] placeholder:text-slate-400"
                  placeholder="Add a goal for today…"
                  value={goalInput}
                  onChange={(event) => setGoalInput(event.target.value)}
                  disabled={dailyGoals.length >= 3 || saveDailyGoals.isPending}
                />
                <button
                  className="h-10 rounded-xl bg-primary px-4 text-[13px] font-bold text-white disabled:opacity-50"
                  onClick={handleAddGoal}
                  disabled={!canAddGoal || saveDailyGoals.isPending}
                >
                  Add
                </button>
              </div>

              <div className="mt-3 space-y-1.5">
                {sortedGoals.map((goal) => (
                  <button
                    key={goal.id}
                    className={`w-full flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${goal.completed ? 'border-slate-100 bg-slate-50' : 'border-slate-200 bg-white'}`}
                    onClick={() => toggleGoal(goal.id)}
                    disabled={saveDailyGoals.isPending}
                  >
                    <span className={`text-[15px] leading-none flex-shrink-0 ${goal.completed ? 'text-primary' : 'text-slate-300'}`}>
                      {goal.completed ? '✓' : '○'}
                    </span>
                    <span className={`text-[13px] leading-[18px] ${goal.completed ? 'line-through text-slate-400' : 'text-slate-800 font-medium'}`}>
                      {goal.text}
                    </span>
                  </button>
                ))}
                {sortedGoals.length === 0 && (
                  <p className="text-[12px] text-slate-400 py-1">Up to 3 goals per day.</p>
                )}
              </div>
            </article>
          </section>

          <section>
            <div className="flex items-end justify-between mb-3">
              <h3 className="st-section-label">Most Active</h3>
              <button className="text-[13px] leading-[18px] font-semibold text-primary" onClick={() => navigate('/app/challenges')}>
                See all
              </button>
            </div>
            {effectiveMostActive.length > 0 && (
              <TrendingChallenges
                challenges={effectiveMostActive}
                onSelectChallenge={(challengeId) => {
                  const selected = effectiveMostActive.find((item) => item.id === challengeId);
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
            {effectiveMostActive.length === 0 && (
              <article className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                No ongoing challenges available yet.
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
