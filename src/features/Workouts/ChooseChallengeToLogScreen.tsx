import { ArrowLeft, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { useAuth } from '../../hooks/useAuth';
import { useChallenges } from '../../hooks/useChallenges';
import type { Challenge } from '../../types';

const TYPE_LABEL: Record<string, string> = {
  collective: 'Team',
  competitive: 'Competitive',
  streak: 'Streak',
};

function ChallengeRow({ challenge, onSelect }: { challenge: Challenge; onSelect: () => void }) {
  return (
    <button
      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left flex items-center gap-4"
      onClick={onSelect}
    >
      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Trophy size={22} className="text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-[20px] font-bold text-slate-900 truncate">{challenge.name}</p>
        <p className="text-[12px] leading-[16px] text-slate-500 mt-0.5">
          {TYPE_LABEL[challenge.challengeType ?? 'collective'] ?? 'Challenge'}
        </p>
      </div>
      <span className="text-primary font-bold text-[13px] flex-shrink-0">Log →</span>
    </button>
  );
}

function ChooseChallengeToLogScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: challenges = [], isLoading } = useChallenges();

  const active = challenges.filter(
    (c) => c.status === 'active' || !c.status,
  );

  const handleSelect = (challenge: Challenge) => {
    const qs = new URLSearchParams();
    qs.set('challengeId', challenge.id);
    if (challenge.groupId) qs.set('groupId', challenge.groupId);
    navigate(`/app/workouts/select-activity?${qs.toString()}`);
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen pb-[96px] bg-slate-50">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate(-1)}>
              <ArrowLeft size={24} className="text-slate-900" />
            </button>
            <h1 className="text-[18px] leading-[22px] font-black text-slate-900">Log Activity</h1>
          </div>
          <p className="mt-1 ml-[52px] text-[13px] text-slate-500">Choose a challenge to log against</p>
        </header>

        <main className="px-4 pt-4 space-y-3">
          {isLoading && (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-2xl bg-white border border-slate-200 animate-pulse" />
              ))}
            </>
          )}

          {!isLoading && active.length === 0 && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-center">
              <p className="text-[32px] leading-none">🏆</p>
              <p className="mt-3 text-[16px] leading-[22px] font-bold text-slate-900">No active challenges yet</p>
              <p className="mt-2 text-[14px] leading-[20px] text-slate-500">
                Join a challenge first to log your activity and track progress.
              </p>
              <button
                className="mt-5 h-11 rounded-xl bg-primary px-6 text-[14px] font-bold text-white"
                onClick={() => navigate('/app/challenges')}
              >
                Browse Challenges
              </button>
              <button
                className="mt-3 block w-full text-center text-[14px] font-semibold text-slate-500"
                onClick={() => navigate('/app/groups', { state: { tab: 'discover' } })}
              >
                Discover Groups
              </button>
            </div>
          )}

          {!isLoading && active.length > 0 && active.map((challenge) => (
            <ChallengeRow key={challenge.id} challenge={challenge} onSelect={() => handleSelect(challenge)} />
          ))}
        </main>
      </div>
      <BottomNav />
    </Screen>
  );
}

export default ChooseChallengeToLogScreen;
