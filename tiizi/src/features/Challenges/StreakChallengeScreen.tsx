import { ArrowLeft, Check, Clock3, Flame, Share2 } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { useAuth } from '../../hooks/useAuth';
import { useChallenge } from '../../hooks/useChallenges';
import { useGroupMembers } from '../../hooks/useGroupInsights';
import { useChallengeWorkouts } from '../../hooks/useWorkouts';

function StreakChallengeScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const challengeId = params.get('challengeId') ?? undefined;
  const groupId = params.get('groupId') ?? undefined;
  const { user } = useAuth();
  const { data: challenge } = useChallenge(challengeId);
  const { data: workouts = [] } = useChallengeWorkouts(challengeId);
  const { data: members = [] } = useGroupMembers(groupId || challenge?.groupId);

  const title = challenge?.name || '30-Day Yoga Streak';
  const logWorkoutRoute = `/app/workouts/select-activity?challengeId=${challengeId || 'yoga-streak'}${groupId ? `&groupId=${groupId}` : ''}`;
  const leaderboardRoute = `/app/challenges/leaderboard?challengeId=${challengeId || 'yoga-streak'}${groupId ? `&groupId=${groupId}` : ''}`;
  const backToChallenges = `/app/challenges${groupId ? `?groupId=${groupId}` : ''}`;

  const leaders = useMemo(() => {
    const byUser = new Map<string, number>();
    workouts.forEach((item) => byUser.set(item.userId, (byUser.get(item.userId) ?? 0) + 1));
    const sorted = Array.from(byUser.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    const nameById = new Map(members.map((item) => [item.id, item.name]));
    return sorted.map(([uid, score], idx) => ({
      rank: idx + 1,
      name: uid === user?.uid ? `You (${nameById.get(uid) ?? 'Member'})` : nameById.get(uid) ?? `Member ${uid.slice(0, 6)}`,
      role: score >= 20 ? 'Elite Streaker' : score >= 10 ? 'Master Level' : 'Regular Streaker',
      score,
      status: score >= 20 ? 'ON TRACK' : score >= 10 ? 'NEEDS SESSION' : 'NUDGE',
      me: uid === user?.uid,
    }));
  }, [members, user?.uid, workouts]);

  const weekData = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    const mondayOffset = (now.getDay() + 6) % 7;
    monday.setDate(now.getDate() - mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const workoutDaysByMe = new Set<string>();
    const activeUsersThisWeek = new Set<string>();

    workouts.forEach((item) => {
      const completed = new Date(item.completedAt);
      const dayStart = new Date(completed);
      dayStart.setHours(0, 0, 0, 0);
      const diff = Math.floor((dayStart.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24));
      if (diff < 0 || diff > 6) return;

      if (item.userId === user?.uid) {
        const key = `${dayStart.getFullYear()}-${dayStart.getMonth()}-${dayStart.getDate()}`;
        workoutDaysByMe.add(key);
      }
      activeUsersThisWeek.add(item.userId);
    });

    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const todayDate = new Date(now);
    todayDate.setHours(0, 0, 0, 0);
    const days = labels.map((label, idx) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + idx);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const isToday = date.getTime() === todayDate.getTime();
      const isFuture = date.getTime() > todayDate.getTime();
      const logged = workoutDaysByMe.has(key);
      return { label, logged, isToday, isFuture, dayOfMonth: date.getDate() };
    });

    const weekActiveCount = days.filter((day) => day.logged).length;
    const consistency = members.length > 0 ? Math.round((activeUsersThisWeek.size / members.length) * 100) : 0;

    return {
      days,
      weekActiveCount,
      activeUsers: activeUsersThisWeek.size,
      consistency: Math.max(0, Math.min(100, consistency)),
    };
  }, [members.length, user?.uid, workouts]);

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[132px]">
        <header className="st-form-max flex items-center justify-between">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate(backToChallenges)}>
            <ArrowLeft size={28} className="text-slate-900" />
          </button>
          <h1 className="text-[20px] leading-[24px] font-black text-slate-900 text-center truncate px-2">{title}</h1>
          <button className="h-10 w-10 flex items-center justify-center">
            <Share2 size={22} className="text-slate-800" />
          </button>
        </header>

        <section className="st-form-max mt-4 st-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-[16px] leading-[20px] tracking-[0.08em] uppercase font-black text-[#3f5674]">Group Consistency</p>
            <p className="text-[20px] leading-[24px] font-black text-primary">{weekData.consistency}%</p>
          </div>
          <div className="st-progress-track mt-4 h-5 bg-slate-200">
            <div className="st-progress-fill" style={{ width: `${weekData.consistency}%` }} />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex -space-x-2">
              <div className="h-9 w-9 rounded-full bg-slate-300 border-2 border-white" />
              <div className="h-9 w-9 rounded-full bg-slate-400 border-2 border-white" />
              <div className="h-9 w-9 rounded-full bg-slate-200 border-2 border-white" />
              <div className="h-9 w-9 rounded-full bg-slate-300 border-2 border-white flex items-center justify-center text-[12px] font-bold text-slate-700">+15</div>
            </div>
            <p className="text-[16px] leading-[22px] font-medium text-[#4e6583]">{Math.min(members.length, weekData.activeUsers)}/{members.length || 0} members active this week</p>
          </div>
        </section>

        <section className="st-form-max mt-5 st-card p-5 border-primary/30 bg-[#fff5ef]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[16px] leading-[20px] font-semibold text-[#3f5674]">Personal Progress</p>
              <p className="mt-2 text-[24px] leading-[28px] font-black tracking-[-0.02em] text-slate-900">{weekData.weekActiveCount} Day</p>
              <p className="text-[24px] leading-[28px] font-black tracking-[-0.02em] text-slate-900">Streak</p>
            </div>
            <div className="rounded-[18px] bg-white border border-slate-200 px-4 py-3 text-right min-w-[86px]">
              <p className="text-[12px] leading-[14px] tracking-[0.08em] uppercase font-bold text-primary">Top</p>
              <p className="text-[20px] leading-[24px] font-black text-primary">{leaders.find((item) => item.me)?.rank ? Math.max(1, Math.round((leaders.find((item) => item.me)!.rank / Math.max(leaders.length, 1)) * 100)) : '--'}%</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2 text-center">
            {weekData.days.map((day) => (
              <div key={day.label}>
                <p className={`text-[12px] leading-[14px] tracking-[0.08em] uppercase font-bold ${day.isToday ? 'text-primary' : 'text-slate-400'}`}>{day.label}</p>
                <div
                  className={`mt-2 h-10 w-10 rounded-full mx-auto flex items-center justify-center ${
                    day.logged
                      ? 'bg-primary text-white'
                      : day.isToday
                        ? 'border-2 border-dashed border-primary text-primary bg-white'
                        : day.isFuture
                          ? 'bg-slate-200 text-slate-400'
                          : 'bg-[#ffe8d8] text-primary'
                  }`}
                >
                  {day.logged ? <Check size={16} /> : day.isToday ? <Clock3 size={16} /> : day.dayOfMonth}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="st-form-max mt-5">
          <div className="flex items-center justify-between">
            <p className="text-[16px] leading-[20px] font-black text-slate-900">Group Standings</p>
            <button className="text-[16px] leading-[20px] font-bold text-primary" onClick={() => navigate(leaderboardRoute)}>View All</button>
          </div>

          <div className="mt-3 space-y-3">
            {leaders.map((row) => (
              <div key={row.rank} className={`st-card px-4 py-4 flex items-center justify-between ${row.me ? 'border-primary bg-orange-50/50' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="w-6 text-[24px] leading-[24px] font-black text-slate-400">{row.rank}</span>
                  <div className="h-12 w-12 rounded-full bg-slate-200" />
                  <div>
                    <p className="text-[18px] leading-[22px] font-black text-slate-900">{row.name}</p>
                    <p className="text-[14px] leading-[18px] font-medium text-slate-500">{row.role}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[18px] leading-[22px] font-black text-primary flex items-center gap-1 justify-end"><Flame size={18} /> {row.score}</p>
                  <p className={`text-[11px] leading-[13px] tracking-[0.08em] uppercase font-bold ${row.status === 'ON TRACK' ? 'text-emerald-600' : row.status === 'NEEDS SESSION' ? 'text-primary' : 'text-amber-500'}`}>
                    {row.status}
                  </p>
                </div>
              </div>
            ))}
            {leaders.length === 0 && (
              <article className="st-card px-4 py-4">
                <p className="text-[14px] leading-[20px] text-slate-600">No workout logs yet for this challenge.</p>
              </article>
            )}
          </div>
        </section>
      </div>

      <div className="fixed bottom-[92px] left-0 right-0 z-30 px-5">
        <div className="mx-auto max-w-mobile">
          <button className="st-btn-primary" onClick={() => navigate(logWorkoutRoute)}>
            + Log Today's Session
          </button>
        </div>
      </div>

      <BottomNav active="challenges" />
    </Screen>
  );
}

export default StreakChallengeScreen;
