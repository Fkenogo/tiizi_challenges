import { ArrowLeft } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { useAuth } from '../../hooks/useAuth';
import { useChallenges } from '../../hooks/useChallenges';
import { useDailyGoalsAnalytics } from '../../hooks/useDailyGoals';
import { useMyGroups } from '../../hooks/useGroups';
import { useUserStreak } from '../../hooks/useStreak';
import { useUserWorkouts } from '../../hooks/useWorkouts';

function isWithinDays(iso: string, days: number) {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return false;
  const now = Date.now();
  const diff = now - ts;
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function ProfileAnalyticsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: groups = [] } = useMyGroups();
  const { data: challenges = [] } = useChallenges();
  const { data: workouts = [] } = useUserWorkouts(user?.uid);
  const { data: streak } = useUserStreak(user?.uid);
  const { data: goalsAnalytics } = useDailyGoalsAnalytics(user?.uid);

  const insights = useMemo(() => {
    const workouts7d = workouts.filter((item) => isWithinDays(item.completedAt, 7)).length;
    const workouts30d = workouts.filter((item) => isWithinDays(item.completedAt, 30)).length;
    const activeChallenges = challenges.filter((item) => {
      const now = Date.now();
      const start = Date.parse(item.startDate);
      const end = Date.parse(item.endDate);
      return item.status === 'active' && now >= start && now <= end;
    }).length;
    const upcomingChallenges = challenges.filter((item) => Date.parse(item.startDate) > Date.now()).length;

    return {
      workouts7d,
      workouts30d,
      activeChallenges,
      upcomingChallenges,
      groupsCount: groups.length,
      currentStreak: streak?.current ?? 0,
      longestStreak: streak?.longest ?? 0,
      goalCompletionRate: goalsAnalytics?.completionRate ?? 0,
      goalsCompleted: goalsAnalytics?.totalGoalsCompleted ?? 0,
      goalsPlanned: goalsAnalytics?.totalGoalsPlanned ?? 0,
      daysTracked: goalsAnalytics?.totalDaysTracked ?? 0,
    };
  }, [workouts, challenges, groups.length, streak?.current, streak?.longest, goalsAnalytics]);

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen bg-slate-50 pb-[96px]">
        <header className="px-4 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate('/app/profile/settings')}>
            <ArrowLeft size={22} className="text-slate-900" />
          </button>
          <h1 className="text-[18px] leading-[22px] font-black text-slate-900">Reports & Analytics</h1>
          <span className="w-10" />
        </header>

        <main className="px-4 py-4 space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-[14px] leading-[18px] font-bold text-slate-500 uppercase tracking-[0.08em]">Consistency</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] uppercase font-bold tracking-[0.1em] text-slate-500">Current Streak</p>
                <p className="mt-1 text-[20px] leading-[24px] font-black text-primary">{insights.currentStreak}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] uppercase font-bold tracking-[0.1em] text-slate-500">Best Streak</p>
                <p className="mt-1 text-[20px] leading-[24px] font-black text-primary">{insights.longestStreak}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] uppercase font-bold tracking-[0.1em] text-slate-500">Workouts (7d)</p>
                <p className="mt-1 text-[20px] leading-[24px] font-black text-primary">{insights.workouts7d}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] uppercase font-bold tracking-[0.1em] text-slate-500">Workouts (30d)</p>
                <p className="mt-1 text-[20px] leading-[24px] font-black text-primary">{insights.workouts30d}</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-[14px] leading-[18px] font-bold text-slate-500 uppercase tracking-[0.08em]">Goals</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] uppercase font-bold tracking-[0.1em] text-slate-500">Completion Rate</p>
                <p className="mt-1 text-[20px] leading-[24px] font-black text-primary">{insights.goalCompletionRate}%</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] uppercase font-bold tracking-[0.1em] text-slate-500">Days Tracked</p>
                <p className="mt-1 text-[20px] leading-[24px] font-black text-primary">{insights.daysTracked}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] uppercase font-bold tracking-[0.1em] text-slate-500">Goals Completed</p>
                <p className="mt-1 text-[20px] leading-[24px] font-black text-primary">{insights.goalsCompleted}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] uppercase font-bold tracking-[0.1em] text-slate-500">Goals Planned</p>
                <p className="mt-1 text-[20px] leading-[24px] font-black text-primary">{insights.goalsPlanned}</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-[14px] leading-[18px] font-bold text-slate-500 uppercase tracking-[0.08em]">Community</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] uppercase font-bold tracking-[0.1em] text-slate-500">Groups</p>
                <p className="mt-1 text-[20px] leading-[24px] font-black text-primary">{insights.groupsCount}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] uppercase font-bold tracking-[0.1em] text-slate-500">Active Challenges</p>
                <p className="mt-1 text-[20px] leading-[24px] font-black text-primary">{insights.activeChallenges}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] uppercase font-bold tracking-[0.1em] text-slate-500">Upcoming Challenges</p>
                <p className="mt-1 text-[20px] leading-[24px] font-black text-primary">{insights.upcomingChallenges}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] uppercase font-bold tracking-[0.1em] text-slate-500">Total Challenges</p>
                <p className="mt-1 text-[20px] leading-[24px] font-black text-primary">{challenges.length}</p>
              </div>
            </div>
          </section>
        </main>

        <BottomNav active="profile" />
      </div>
    </Screen>
  );
}

export default ProfileAnalyticsScreen;
