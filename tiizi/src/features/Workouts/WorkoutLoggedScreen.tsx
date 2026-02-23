import { Check } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { useChallenge } from '../../hooks/useChallenges';
import { useAuth } from '../../hooks/useAuth';
import { useChallengeWorkouts } from '../../hooks/useWorkouts';

function WorkoutLoggedScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const challengeId = params.get('challengeId') ?? undefined;
  const groupId = params.get('groupId') ?? undefined;
  const exerciseName = params.get('exerciseName') ?? 'Workout';
  const { user } = useAuth();
  const { data: challenge } = useChallenge(challengeId);
  const { data: workouts = [] } = useChallengeWorkouts(challengeId);

  const myWorkouts = useMemo(() => workouts.filter((item) => item.userId === user?.uid), [user?.uid, workouts]);
  const value = Number(params.get('value') || 0);
  const totalDays = useMemo(() => {
    if (!challenge) return 15;
    const start = new Date(challenge.startDate).getTime();
    const end = new Date(challenge.endDate).getTime();
    return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
  }, [challenge]);
  const target = Number(params.get('target') || totalDays);
  const completion = Math.max(0, Math.min(100, Math.round((myWorkouts.length / Math.max(target, 1)) * 100)));

  const toFeedPath = groupId ? `/app/group/${groupId}/feed` : `/app/challenges/collective?challengeId=${challengeId || 'core-blast'}`;
  const toCompletionPath = `/app/challenges/completed?challengeId=${challengeId || 'core-blast'}${groupId ? `&groupId=${groupId}` : ''}`;

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[108px] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#f7dfcf 1.2px, transparent 1.2px)', backgroundSize: '18px 18px' }} />

        <main className="st-form-max relative z-10 pt-7">
          <div className="mx-auto h-[116px] w-[116px] rounded-full bg-primary flex items-center justify-center shadow-[0_14px_22px_rgba(255,111,0,0.24)]">
            <div className="h-[56px] w-[56px] rounded-full bg-white flex items-center justify-center">
              <Check size={30} className="text-primary" />
            </div>
          </div>

          <h1 className="mt-5 text-center text-[22px] leading-[26px] tracking-[-0.02em] font-black text-[#1c120d]">Workout Logged!</h1>
          <p className="mt-3 text-center text-[14px] leading-[22px] font-medium text-[#5f5148]">
            Your progress has been shared with the group. Keep the momentum going!
          </p>

          <section className="mt-6 st-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-[15px] leading-[19px] tracking-[-0.01em] font-black text-[#1c120d]">{challenge?.name ?? 'Group Challenge'}</p>
              <span className="rounded-full bg-[#fff3e8] px-3 py-2 text-[13px] leading-[13px] font-black text-primary">Level Up!</span>
            </div>
            <div className="mt-3 h-6 rounded-full bg-[#e8edf5] p-[5px]">
              <div className="h-full rounded-full bg-primary" style={{ width: `${completion}%` }} />
            </div>
            <div className="mt-4 flex items-end justify-between">
              <p className="text-[18px] leading-[22px] font-black text-primary">
                {myWorkouts.length}
                <span className="text-[#a3a6ad]"> / {target} Workouts</span>
              </p>
              <div className="text-right">
                <p className="text-[12px] leading-[14px] tracking-[0.14em] uppercase font-black text-[#9597a0]">Completion</p>
                <p className="mt-1 text-[22px] leading-[22px] font-black text-[#1c120d]">{completion}%</p>
              </div>
            </div>
            <p className="mt-2 text-[13px] leading-[17px] text-[#7f746c]">Latest entry: {exerciseName}</p>
            {value > 0 && <p className="mt-1 text-[12px] leading-[15px] text-[#7f746c]">Current entry: {value}</p>}
          </section>

          <button className="st-btn-primary mt-8" onClick={() => navigate(toFeedPath)}>Go to Feed →</button>
          {completion >= 80 && (
            <button className="st-btn-secondary mt-3" onClick={() => navigate(toCompletionPath)}>
              View Completion
            </button>
          )}
        </main>
      </div>

      <BottomNav active="home" />
    </Screen>
  );
}

export default WorkoutLoggedScreen;
