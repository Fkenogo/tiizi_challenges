import { ArrowLeft, Clock3, Share2 } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { useChallenge } from '../../hooks/useChallenges';
import { useAuth } from '../../hooks/useAuth';
import { useGroupMembers } from '../../hooks/useGroupInsights';
import { useChallengeWorkouts } from '../../hooks/useWorkouts';

function CompetitiveChallengeScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const challengeId = params.get('challengeId') ?? undefined;
  const groupId = params.get('groupId') ?? undefined;
  const { user } = useAuth();
  const { data: challenge } = useChallenge(challengeId);
  const { data: workouts = [] } = useChallengeWorkouts(challengeId);
  const { data: members = [] } = useGroupMembers(groupId || challenge?.groupId);

  const title = challenge?.name || '30-Day Pushup Duel';
  const unit = challenge?.activities?.[0]?.unit ?? 'Pushups';

  const backToChallenges = `/app/challenges${groupId ? `?groupId=${groupId}` : ''}`;
  const logWorkoutRoute = `/app/workouts/select-activity?challengeId=${challengeId || 'pushup-daily'}${groupId ? `&groupId=${groupId}` : ''}`;
  const leaderboardRoute = `/app/challenges/leaderboard?challengeId=${challengeId || 'pushup-daily'}${groupId ? `&groupId=${groupId}` : ''}`;

  const ranks = useMemo(() => {
    const byUser = new Map<string, number>();
    workouts.forEach((item) => byUser.set(item.userId, (byUser.get(item.userId) ?? 0) + Math.max(1, Math.round(item.value))));
    const nameByUser = new Map(members.map((item) => [item.id, item.name]));
    return Array.from(byUser.entries())
      .map(([uid, score]) => ({
        uid,
        score,
        me: uid === user?.uid,
        name: uid === user?.uid ? `You (${nameByUser.get(uid) ?? 'Member'})` : nameByUser.get(uid) ?? `Member ${uid.slice(0, 6)}`,
      }))
      .sort((a, b) => b.score - a.score)
      .map((item, index) => ({ ...item, place: index + 1 }));
  }, [members, user?.uid, workouts]);

  const timelineMeta = useMemo(() => {
    const now = new Date();
    const end = challenge?.endDate ? new Date(challenge.endDate) : (() => {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() + 14);
      return fallback;
    })();
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / msPerDay));
    const endsLabel = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return { daysLeft, endsLabel };
  }, [challenge?.endDate]);

  const podium = ranks.slice(0, 3);
  const left = podium[1];
  const winner = podium[0];
  const right = podium[2];
  const currentUser = ranks.find((item) => item.me);

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[132px]">
        <header className="st-form-max flex items-center justify-between">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate(backToChallenges)}>
            <ArrowLeft size={28} className="text-slate-900" />
          </button>
          <span className="w-10" />
          <button className="h-10 w-10 flex items-center justify-center">
            <Share2 size={22} className="text-slate-800" />
          </button>
        </header>

        <section className="st-form-max mt-4">
          <h1 className="text-[20px] leading-[24px] font-black tracking-[-0.02em] text-slate-900">{title}</h1>
          <p className="mt-2 text-[14px] leading-[20px] font-semibold text-slate-500 flex items-center gap-2">
            <Clock3 size={16} className="text-primary" /> {timelineMeta.daysLeft} days left - Ends {timelineMeta.endsLabel}
          </p>
        </section>

        <section className="st-form-max mt-5 grid grid-cols-2 gap-3">
          <div className="st-card p-4">
            <p className="text-[12px] leading-[14px] tracking-[0.12em] uppercase font-bold text-slate-400">Your Rank</p>
            <p className="mt-2 text-[22px] leading-[26px] font-black text-primary tracking-[-0.02em]">#{currentUser?.place ?? '--'}</p>
            <p className="text-[14px] leading-[18px] font-bold text-emerald-600">{currentUser ? `Top ${Math.max(1, Math.round((currentUser.place / Math.max(ranks.length, 1)) * 100))}%` : ''}</p>
          </div>
          <div className="st-card p-4">
            <p className="text-[12px] leading-[14px] tracking-[0.12em] uppercase font-bold text-slate-400">Total {unit}</p>
            <p className="mt-2 text-[18px] leading-[24px] font-black text-slate-900 tracking-[-0.02em]">{currentUser?.score ?? 0} <span className="text-slate-400">/ {Math.max(1, challenge?.activities?.[0]?.targetValue ?? 0)}</span></p>
          </div>
        </section>

        <section className="st-form-max mt-7">
          <div className="flex items-end justify-between">
            <div className="text-center w-[92px]">
              <div className="h-[78px] w-[78px] rounded-full bg-slate-200 border-[5px] border-slate-300 mx-auto" />
              <p className="mt-2 text-[14px] leading-[16px] font-bold text-slate-500">2nd</p>
              <p className="mt-2 text-[16px] leading-[20px] font-black text-slate-900">{left?.name ?? '-'}</p>
              <p className="text-[14px] leading-[18px] font-black text-primary">{left?.score ?? 0}</p>
            </div>
            <div className="text-center flex-1 px-2">
              <div className="h-[112px] w-[112px] rounded-full bg-slate-200 border-[7px] border-primary mx-auto" />
              <span className="mt-2 inline-flex rounded-full bg-primary px-3 py-1 text-[12px] font-bold text-white uppercase tracking-[0.08em]">Winner</span>
              <p className="mt-2 text-[20px] leading-[24px] font-black text-slate-900">{winner?.name ?? '-'}</p>
              <p className="text-[16px] leading-[20px] font-black text-primary">{winner?.score ?? 0}</p>
            </div>
            <div className="text-center w-[92px]">
              <div className="h-[78px] w-[78px] rounded-full bg-slate-200 border-[5px] border-amber-200 mx-auto" />
              <p className="mt-2 text-[14px] leading-[16px] font-bold text-slate-500">3rd</p>
              <p className="mt-2 text-[16px] leading-[20px] font-black text-slate-900">{right?.name ?? '-'}</p>
              <p className="text-[14px] leading-[18px] font-black text-primary">{right?.score ?? 0}</p>
            </div>
          </div>
        </section>

        <section className="st-form-max mt-7">
          <div className="flex items-center justify-between">
            <p className="text-[14px] leading-[18px] tracking-[0.08em] uppercase font-black text-slate-400">Rankings</p>
            <button className="text-[14px] leading-[18px] font-black text-primary" onClick={() => navigate(leaderboardRoute)}>View Full</button>
          </div>
          <div className="mt-3 space-y-3">
            {ranks.map((row) => (
              <div key={row.place} className={`st-card px-4 py-4 flex items-center justify-between ${row.me ? 'border-primary/40 bg-orange-50/60' : ''}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 text-[20px] leading-[20px] font-black text-slate-400">{row.place}</span>
                  <div className="h-12 w-12 rounded-full bg-slate-200" />
                  <div className="min-w-0">
                    <p className="text-[16px] leading-[20px] font-black text-slate-900 truncate">{row.name}</p>
                    {row.me && <p className="text-[12px] leading-[16px] tracking-[0.08em] uppercase font-bold text-slate-500">Personal Best +10</p>}
                  </div>
                </div>
                <p className="text-[16px] leading-[20px] font-black text-slate-900">{row.score}</p>
              </div>
            ))}
            {ranks.length === 0 && (
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
            + LOG {unit.toUpperCase()}
          </button>
        </div>
      </div>

      <BottomNav active="challenges" />
    </Screen>
  );
}

export default CompetitiveChallengeScreen;
