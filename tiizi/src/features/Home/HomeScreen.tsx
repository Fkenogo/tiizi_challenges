import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Screen, BottomNav } from '../../components/Layout';
import { useHomeScreenData } from './useHomeScreen';
import { useAuth } from '../../hooks/useAuth';
import { ActiveChallengeCard } from '../../components/Home/ActiveChallengeCard';
import { TodaysGoalsList } from '../../components/Home/TodaysGoalsList';
import { TrendingChallenges } from '../../components/Home/TrendingChallenges';
import { LoadingSpinner } from '../../components/Layout';

function HomeScreen() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { data, isLoading, isError } = useHomeScreenData();

  const handleGoalSelect = (goalId: string) => {
    if (goalId === 'goal-log-workout') {
      if (data?.activeChallenge) {
        const query = new URLSearchParams({ challengeId: data.activeChallenge.id });
        if (data.activeChallenge.groupId) query.set('groupId', data.activeChallenge.groupId);
        navigate(`/app/workouts/select-activity?${query.toString()}`);
        return;
      }
      navigate('/app/groups');
      return;
    }

    if (goalId === 'goal-profile') {
      navigate('/app/profile/completion');
      return;
    }

    if (goalId === 'goal-group') {
      navigate('/app/groups');
    }
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
              <img
                src={user?.photoURL || "https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=300&q=80"}
                alt="Avatar"
                className="w-14 h-14 rounded-full object-cover border-[3px] border-[#f6cdb5]"
              />
              <div className="min-w-0">
                <p className="text-[13px] leading-[16px] text-slate-500">Welcome back,</p>
                <h1 className="st-page-title truncate">
                  {profile?.displayName || user?.displayName || 'Athlete'}!
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
            {data?.activeChallenge ? (
              <ActiveChallengeCard challenge={data.activeChallenge} />
            ) : (
              <article className="rounded-2xl border border-slate-200 bg-white px-3 py-4">
                <p className="text-sm text-slate-600">No active group challenge yet.</p>
                <button className="mt-3 h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white" onClick={() => navigate('/app/groups')}>
                  Join a Group
                </button>
              </article>
            )}
          </section>

          <section>
            <h3 className="st-section-label mb-3">Today's Goals</h3>
            {data?.todaysGoals && (
              <TodaysGoalsList
                goals={data.todaysGoals}
                onSelectGoal={(goal) => handleGoalSelect(goal.id)}
              />
            )}
          </section>

          <section>
            <div className="flex items-end justify-between mb-3">
              <h3 className="st-section-label">Trending Challenges</h3>
              <button className="text-[14px] leading-[18px] font-semibold text-primary" onClick={() => navigate('/app/challenges')}>
                See All →
              </button>
            </div>
            {data?.trendingChallenges && (
              <TrendingChallenges
                challenges={data.trendingChallenges}
                onSelectChallenge={() => navigate('/app/challenges')}
              />
            )}
          </section>
        </main>

        <BottomNav active="home" />
      </div>
    </Screen>
  );
}

export default HomeScreen;
