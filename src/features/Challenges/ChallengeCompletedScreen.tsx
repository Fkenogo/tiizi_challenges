import { EllipsisVertical, X } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { useChallenge } from '../../hooks/useChallenges';
import { useAuth } from '../../hooks/useAuth';
import { useChallengeWorkouts } from '../../hooks/useWorkouts';

function ChallengeCompletedScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const challengeId = params.get('challengeId') || 'core-blast';
  const groupId = params.get('groupId') || undefined;
  const title = params.get('name') || '30-Day Sprint';
  const { user } = useAuth();
  const { data: challenge } = useChallenge(challengeId);
  const { data: workouts = [] } = useChallengeWorkouts(challengeId);

  const toHome = '/app/home';
  const toShare = `/app/share?challengeId=${challengeId}${groupId ? `&groupId=${groupId}` : ''}`;
  const myWorkouts = useMemo(() => workouts.filter((item) => item.userId === user?.uid), [user?.uid, workouts]);
  const totalValue = useMemo(() => myWorkouts.reduce((sum, item) => sum + Math.max(0, Number(item.value || 0)), 0), [myWorkouts]);
  const uniqueDays = useMemo(() => {
    const days = new Set<string>();
    myWorkouts.forEach((item) => {
      const date = new Date(item.completedAt);
      days.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
    });
    return days.size;
  }, [myWorkouts]);
  const totalDays = useMemo(() => {
    if (!challenge) return 30;
    const start = new Date(challenge.startDate).getTime();
    const end = new Date(challenge.endDate).getTime();
    return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
  }, [challenge]);
  const completionPct = Math.max(0, Math.min(100, Math.round((uniqueDays / Math.max(totalDays, 1)) * 100)));
  const points = Math.max(0, Math.round(totalValue * 0.4 + uniqueDays * 8));
  const averageValue = myWorkouts.length > 0 ? totalValue / myWorkouts.length : 0;
  const intensity = averageValue >= 40 ? 'High' : averageValue >= 20 ? 'Medium' : 'Light';
  const tier = completionPct >= 100 ? 'Gold Tier' : completionPct >= 75 ? 'Silver Tier' : 'Bronze Tier';

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[108px]">
        <header className="st-form-max flex items-center justify-between">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate(-1)}>
            <X size={26} className="text-[#3b4d67]" />
          </button>
          <p className="text-[12px] leading-[14px] tracking-[0.18em] uppercase font-black text-primary">Congratulations!</p>
          <button className="h-10 w-10 flex items-center justify-center">
            <EllipsisVertical size={22} className="text-[#3b4d67]" />
          </button>
        </header>

        <main className="st-form-max mt-5">
          <h1 className="text-center text-[40px] leading-[40px] tracking-[-0.03em] font-light text-primary">Challenge<br />Completed!</h1>
          <p className="mt-3 text-center text-[14px] leading-[22px] font-medium text-[#4f6785]">
            You've reached the finish line of the {title}
          </p>

          <div className="mt-6 rounded-full border-[5px] border-[#f5cdb8] bg-[#fff8f4] h-[278px] flex items-center justify-center shadow-[0_14px_30px_rgba(255,111,0,0.15)]">
            <div className="text-center">
              <div className="text-[72px] leading-none text-primary">🏆</div>
              <div className="mx-auto mt-3 inline-flex rounded-full bg-primary px-4 py-2 text-[14px] leading-[14px] tracking-[0.08em] uppercase font-black text-white">
                {tier}
              </div>
            </div>
          </div>

          <section className="st-card mt-7 p-5">
            <p className="text-[16px] leading-[20px] tracking-[0.12em] uppercase font-black text-[#8ca0ba]">Your Achievements</p>
            <div className="mt-4 grid grid-cols-2 gap-y-5 gap-x-4">
              <div>
                <p className="text-[12px] leading-[14px] tracking-[0.08em] uppercase font-bold text-primary">Total Reps</p>
                <p className="mt-2 text-[22px] leading-[26px] font-black text-slate-900">{totalValue.toLocaleString()}</p>
                <p className="mt-1 text-[14px] leading-[18px] font-medium text-emerald-600">{completionPct}% completion</p>
              </div>
              <div>
                <p className="text-[12px] leading-[14px] tracking-[0.08em] uppercase font-bold text-primary">Days Active</p>
                <p className="mt-2 text-[22px] leading-[26px] font-black text-slate-900">{uniqueDays}/{totalDays}</p>
                <p className="mt-1 text-[14px] leading-[18px] font-medium text-emerald-600">{uniqueDays >= totalDays ? 'Perfect Streak!' : 'Keep pushing!'}</p>
              </div>
              <div>
                <p className="text-[12px] leading-[14px] tracking-[0.08em] uppercase font-bold text-primary">Points</p>
                <p className="mt-2 text-[22px] leading-[26px] font-black text-slate-900">{points} XP</p>
              </div>
              <div>
                <p className="text-[12px] leading-[14px] tracking-[0.08em] uppercase font-bold text-primary">Avg Intensity</p>
                <p className="mt-2 text-[22px] leading-[26px] font-black text-slate-900">{intensity}</p>
              </div>
            </div>
          </section>

          <button className="st-btn-primary mt-6" onClick={() => navigate(toShare)}>
            Share Achievement
          </button>
          <button className="st-btn-secondary mt-3 border-primary/30 text-primary" onClick={() => navigate(toHome)}>
            Go to Home
          </button>
        </main>
      </div>

      <BottomNav active="challenges" />
    </Screen>
  );
}

export default ChallengeCompletedScreen;
