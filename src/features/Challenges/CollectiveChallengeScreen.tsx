import { ArrowLeft, Check, CirclePlus, Clock3, Moon } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { useAuth } from '../../hooks/useAuth';
import { useChallenge } from '../../hooks/useChallenges';
import { useGroupMembers } from '../../hooks/useGroupInsights';
import { useChallengeWorkouts } from '../../hooks/useWorkouts';

function CollectiveChallengeScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const challengeId = params.get('challengeId') ?? undefined;
  const groupId = params.get('groupId') ?? undefined;
  const { user } = useAuth();
  const { data: challenge } = useChallenge(challengeId);
  const { data: workouts = [] } = useChallengeWorkouts(challengeId);
  const { data: members = [] } = useGroupMembers(groupId || challenge?.groupId);

  const title = challenge?.name || 'Collective Challenge';
  const backToChallenges = `/app/challenges${groupId ? `?groupId=${groupId}` : ''}`;
  const selectActivityPath = `/app/workouts/select-activity?challengeId=${challengeId || ''}${groupId ? `&groupId=${groupId}` : ''}`;
  const leaderboardPath = `/app/challenges/leaderboard?challengeId=${challengeId || ''}${groupId ? `&groupId=${groupId}` : ''}`;

  const weeklyBars = useMemo(() => {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const now = new Date();
    const start = new Date(now);
    const mondayOffset = (now.getDay() + 6) % 7;
    start.setDate(now.getDate() - mondayOffset);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    const counts = Array.from({ length: 7 }, () => 0);
    workouts.forEach((item) => {
      const at = new Date(item.completedAt);
      if (at >= start && at < end) {
        const mondayIndex = (at.getDay() + 6) % 7;
        counts[mondayIndex] += 1;
      }
    });

    const maxCount = Math.max(1, ...counts);
    const todayIndex = (now.getDay() + 6) % 7;
    return counts.map((count, index) => ({
      label: labels[index],
      h: count > 0 ? 56 + Math.round((count / maxCount) * 122) : 56,
      muted: count === 0 && index < todayIndex,
      planned: count === 0 && index > todayIndex,
    }));
  }, [workouts]);

  const totalTarget = useMemo(
    () => (challenge?.activities ?? []).reduce((sum, item) => sum + Math.max(0, item.targetValue ?? 0), 0),
    [challenge?.activities],
  );
  const groupProgressValue = useMemo(
    () => workouts.reduce((sum, item) => sum + Math.max(0, Math.round(item.value)), 0),
    [workouts],
  );
  const progress = totalTarget > 0 ? Math.min(100, Math.round((groupProgressValue / totalTarget) * 100)) : 0;

  const participantRows = useMemo(() => {
    const counts = new Map<string, number>();
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const todaySet = new Set<string>();
    workouts.forEach((item) => {
      counts.set(item.userId, (counts.get(item.userId) ?? 0) + 1);
      const at = new Date(item.completedAt);
      const key = `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`;
      if (key === todayKey) todaySet.add(item.userId);
    });
    return members.map((member) => {
      const count = counts.get(member.id) ?? 0;
      const status: 'logged' | 'pending' | 'rest' = todaySet.has(member.id) ? 'logged' : count > 0 ? 'pending' : 'rest';
      return {
        id: member.id,
        name: member.name,
        completedDays: count,
        status,
      };
    });
  }, [members, workouts]);

  const myRow = participantRows.find((item) => item.id === user?.uid);
  const topRows = participantRows
    .slice()
    .sort((a, b) => b.completedDays - a.completedDays)
    .slice(0, 3);

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[108px]">
        <header className="st-form-max flex items-center justify-between">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate(backToChallenges)}>
            <ArrowLeft size={28} className="text-slate-900" />
          </button>
          <h1 className="text-[20px] leading-[24px] tracking-[-0.01em] font-black text-slate-900 truncate">{title}</h1>
          <span className="rounded-full border border-[#f1c8aa] px-4 py-2 text-[14px] leading-[14px] font-black text-primary">Joined</span>
        </header>

        <section className="st-form-max mt-5 st-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[15px] leading-[19px] font-black text-slate-900">Weekly Consistency</p>
              <p className="mt-1 text-[14px] leading-[19px] font-medium text-[#556d89]">Your activity this week</p>
            </div>
            <div className="text-right">
              <p className="text-[22px] leading-[24px] font-black text-primary">{myRow?.completedDays ?? 0}</p>
              <p className="text-[12px] leading-[14px] tracking-[0.12em] uppercase font-black text-[#555f70]">Logs</p>
            </div>
          </div>

          <div className="mt-5 flex items-end gap-3">
            {weeklyBars.map((bar) => (
              <div key={bar.label} className="flex-1">
                <div
                  className={`w-full rounded-t-[4px] ${bar.muted ? 'bg-[#f2d1be]' : bar.planned ? 'bg-[#d6dde8]' : 'bg-primary'}`}
                  style={{ height: `${bar.h}px`, borderTop: bar.planned ? '4px dashed #e2a983' : 'none' }}
                />
                <p className="mt-2 text-center text-[12px] leading-[14px] font-medium text-[#636d7d]">{bar.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="st-form-max mt-6">
          <div className="flex items-end justify-between">
            <h2 className="text-[20px] leading-[24px] tracking-[-0.01em] font-black text-slate-900">Collective Progress</h2>
            <p className="text-[20px] leading-[24px] font-black text-primary">{progress}%</p>
          </div>
          <div className="mt-4 h-5 rounded-full bg-[#dfe5ef] p-[2px]">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[14px] leading-[20px] font-medium text-[#556d89]">Total Group Goal</p>
            <p className="text-[14px] leading-[20px] font-black text-slate-900">
              <span className="text-primary">{groupProgressValue}</span> / {totalTarget || 0} total
            </p>
          </div>
        </section>

        <section className="st-form-max mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-[20px] leading-[24px] tracking-[-0.01em] font-black text-slate-900">Participants</h3>
            <button className="text-[14px] leading-[18px] font-black text-primary" onClick={() => navigate(leaderboardPath)}>
              View All
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {topRows.map((row) => (
              <article key={row.id} className={`st-card px-4 py-4 flex items-center justify-between ${row.status === 'rest' ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-full bg-orange-200" />
                  <div>
                    <p className="text-[16px] leading-[20px] font-black text-slate-900">{row.name}</p>
                    <p className="text-[13px] leading-[17px] font-medium text-[#556d89]">{row.completedDays} logs completed</p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`text-[14px] leading-[16px] font-black uppercase tracking-[0.08em] ${
                      row.status === 'logged' ? 'text-emerald-600' : row.status === 'pending' ? 'text-primary' : 'text-[#8da0ba]'
                    }`}
                  >
                    {row.status === 'logged' ? 'Logged Today' : row.status === 'pending' ? 'Pending' : 'Rest Day'}
                  </p>
                  {row.status === 'logged' ? (
                    <Check size={22} className="ml-auto mt-2 text-emerald-600" />
                  ) : row.status === 'pending' ? (
                    <Clock3 size={22} className="ml-auto mt-2 text-primary" />
                  ) : (
                    <Moon size={22} className="ml-auto mt-2 text-[#8da0ba]" />
                  )}
                </div>
              </article>
            ))}
            {participantRows.length === 0 && (
              <article className="st-card px-4 py-4">
                <p className="text-[14px] leading-[20px] text-slate-600">No participants found for this challenge group.</p>
              </article>
            )}
          </div>
        </section>

      </div>

      <div className="fixed bottom-[96px] left-0 right-0 z-30">
        <div className="mx-auto max-w-mobile px-4 flex justify-end">
          <button
            className="h-[68px] w-[68px] rounded-full border-4 border-white bg-primary text-white shadow-[0_10px_22px_rgba(255,111,0,0.35)] flex items-center justify-center"
            onClick={() => navigate(selectActivityPath)}
            aria-label="Log challenge activity"
          >
            <CirclePlus size={28} />
          </button>
        </div>
      </div>

      <BottomNav active="challenges" />
    </Screen>
  );
}

export default CollectiveChallengeScreen;
