import { ArrowLeft, Search } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { useChallenge } from '../../hooks/useChallenges';
import { useGroupMembers } from '../../hooks/useGroupInsights';
import { useChallengeWorkouts } from '../../hooks/useWorkouts';
import { useAuth } from '../../hooks/useAuth';

function ChallengeLeaderboardScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const challengeId = params.get('challengeId') || 'core-blast';
  const groupId = params.get('groupId') || undefined;
  const { user } = useAuth();
  const { data: challenge } = useChallenge(challengeId);
  const { data: workouts = [] } = useChallengeWorkouts(challengeId);
  const resolvedGroupId = groupId || challenge?.groupId;
  const { data: members = [] } = useGroupMembers(resolvedGroupId);

  const ranking = useMemo(() => {
    const byUser = new Map<string, number>();
    workouts.forEach((w) => byUser.set(w.userId, (byUser.get(w.userId) || 0) + Math.max(1, Math.round(w.value))));
    const namesById = new Map(members.map((item) => [item.id, item.name]));
    return Array.from(byUser.entries())
      .map(([uid, score]) => ({ uid, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((row, idx) => ({
        rank: idx + 1,
        name: row.uid === user?.uid ? `You (${namesById.get(row.uid) ?? 'Member'})` : namesById.get(row.uid) ?? `Member ${row.uid.slice(0, 6)}`,
        score: row.score,
        me: row.uid === user?.uid,
      }));
  }, [workouts, members, user?.uid]);

  const myEntry = ranking.find((row) => row.me);
  const toChallenges = `/app/challenges${groupId ? `?groupId=${groupId}` : ''}`;

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[108px]">
        <header className="st-form-max flex items-center justify-between">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate(toChallenges)}>
            <ArrowLeft size={28} className="text-slate-900" />
          </button>
          <div className="min-w-0 px-1">
            <p className="st-page-title">Challenge Leaderboard</p>
            <p className="st-caption truncate">{challenge?.name || '30-Day Fitness Blast'}</p>
          </div>
          <button className="h-10 w-10 flex items-center justify-center"><Search size={22} className="text-slate-900" /></button>
        </header>

        <section className="st-form-max mt-4 rounded-[24px] bg-primary text-white px-5 py-4">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <p className="text-[11px] leading-[13px] tracking-[0.1em] uppercase font-black text-white/90">Current Rank</p>
              <p className="mt-2 text-[22px] leading-[22px] font-black">#{myEntry?.rank ?? '--'}</p>
            </div>
            <div className="border-l border-white/30 pl-5 text-right">
              <p className="text-[11px] leading-[13px] tracking-[0.1em] uppercase font-black text-white/90">Total Points</p>
              <p className="mt-2 text-[22px] leading-[22px] font-black">{myEntry?.score ?? 0} <span className="text-[13px]">XP</span></p>
            </div>
          </div>
        </section>

        <section className="st-form-max mt-6">
          <p className="st-section-label">Global Rankings</p>
          <div className="mt-4 space-y-3">
            {ranking.slice(0, 10).map((row) => (
              <article key={row.rank} className={`st-card px-4 py-3.5 flex items-center justify-between ${row.me ? 'border-primary/40 bg-[#fff7f1]' : ''}`}>
                <div className="flex items-center gap-4 min-w-0">
                  <span className="w-8 text-[17px] leading-[19px] font-black text-[#6c7f9a]">{row.rank}</span>
                  <div className="h-12 w-12 rounded-full bg-slate-200" />
                  <p className={`text-[16px] leading-[20px] font-black truncate ${row.me ? 'text-primary' : 'text-slate-900'}`}>{row.name}</p>
                </div>
                <p className={`text-[16px] leading-[20px] font-black ${row.me ? 'text-primary' : 'text-slate-900'}`}>{row.score} <span className="text-[12px] text-[#9aa7b8]">XP</span></p>
              </article>
            ))}
            {ranking.length === 0 && (
              <article className="st-card px-4 py-4">
                <p className="text-[14px] leading-[20px] text-slate-600">No workout logs yet for this challenge.</p>
              </article>
            )}
          </div>
          <button className="mt-6 w-full text-center text-[16px] leading-[20px] font-black text-primary" onClick={() => navigate(toChallenges)}>
            View Full Rankings (Up to 20)
          </button>
        </section>
      </div>

      <BottomNav active="challenges" />
    </Screen>
  );
}

export default ChallengeLeaderboardScreen;
