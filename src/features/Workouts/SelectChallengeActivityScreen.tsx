import { ArrowLeft, Circle, Clock3, Dumbbell } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { useChallenge } from '../../hooks/useChallenges';
import { useExercises } from '../../hooks/useExercises';

function SelectChallengeActivityScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const challengeId = params.get('challengeId') ?? undefined;
  const groupId = params.get('groupId') ?? undefined;
  const { data: challenge } = useChallenge(challengeId);
  const { data: exercises = [] } = useExercises();

  const activities = useMemo(() => {
    if (challenge?.activities && challenge.activities.length > 0) return challenge.activities;
    if (challenge?.exerciseIds && challenge.exerciseIds.length > 0) {
      return challenge.exerciseIds.map((exerciseId) => {
        const match = exercises.find((item) => item.id === exerciseId);
        return {
          exerciseId,
          exerciseName: match?.name ?? 'Activity',
          targetValue: 0,
          unit: match?.metric.unit ?? 'Reps',
        };
      });
    }
    return [];
  }, [challenge?.activities, challenge?.exerciseIds, exercises]);

  const displayName = challenge?.name || 'Challenge';
  const challengeType = challenge?.challengeType ?? 'collective';
  const backPath = challengeId
    ? `/app/challenges/${challengeType}?challengeId=${challengeId}${groupId ? `&groupId=${groupId}` : ''}`
    : '/app/challenges';

  const handleLog = (exerciseId: string, unit: string, exerciseName: string, disabled?: boolean) => {
    if (disabled) return;
    const qs = new URLSearchParams();
    if (challengeId) qs.set('challengeId', challengeId);
    if (groupId) qs.set('groupId', groupId);
    qs.set('exerciseId', exerciseId);
    qs.set('unit', unit);
    qs.set('exerciseName', exerciseName);
    navigate(`/app/workouts/log?${qs.toString()}`);
  };

  const subtitle = (unit: string) => {
    if (unit.toLowerCase() === 'reps') return 'Reps-based activity';
    if (unit.toLowerCase() === 'seconds' || unit.toLowerCase() === 'minutes') return 'Time-based activity';
    return 'Distance/Time-based';
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[108px]">
        <header className="st-form-max h-12 flex items-center gap-3">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate(backPath)}>
            <ArrowLeft size={28} className="text-slate-900" />
          </button>
          <h1 className="text-[24px] leading-[30px] tracking-[-0.01em] font-black text-slate-900">Select Activity</h1>
        </header>
        <div className="st-form-max mt-4 h-px bg-[#ead9cc]" />

        <section className="st-form-max mt-5 rounded-none border-y border-[#e7d7ca] bg-[#faf5f1] -mx-5 px-5 py-6">
          <p className="text-[12px] leading-[14px] tracking-[0.12em] uppercase font-black text-primary">Current Challenge</p>
          <p className="mt-2 text-[24px] leading-[30px] tracking-[-0.01em] font-black text-[#18110d]">{displayName}</p>
          <p className="mt-1 text-[16px] leading-[22px] font-medium text-[#5f5a55]">Pick an exercise to log your progress</p>
        </section>

        <section className="st-form-max mt-4 space-y-4">
          {activities.map((activity) => {
            const isOptional = false;
            const match = exercises.find((item) => item.id === activity.exerciseId || item.name.toLowerCase() === (activity.exerciseName || '').toLowerCase());
            const icon =
              activity.unit.toLowerCase() === 'reps'
                ? <Dumbbell size={28} />
                : activity.unit.toLowerCase() === 'seconds' || activity.unit.toLowerCase() === 'minutes'
                  ? <Clock3 size={28} />
                  : <Circle size={28} />;

            return (
              <article key={`${activity.exerciseId}-${activity.exerciseName}`} className={`st-card p-4 flex items-center justify-between ${isOptional ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-20 w-20 rounded-[22px] bg-[#f8e9df] text-primary flex items-center justify-center">{icon}</div>
                  <div className="min-w-0">
                    <p className="text-[20px] leading-[24px] tracking-[-0.01em] font-black text-[#18110d] truncate">
                      {match?.name || activity.exerciseName || 'Activity'}
                    </p>
                    <p className="mt-1 text-[16px] leading-[22px] font-medium text-[#68605a]">{isOptional ? 'Bonus challenge' : subtitle(activity.unit)}</p>
                  </div>
                </div>
                <button
                  className={`h-16 min-w-[104px] rounded-full px-6 text-[16px] leading-[16px] font-black ${isOptional ? 'bg-[#d7dbe1] text-[#8f96a1]' : 'bg-primary text-white'}`}
                  onClick={() => handleLog(match?.id || activity.exerciseId, activity.unit, match?.name || activity.exerciseName || 'Activity', isOptional)}
                >
                  Log
                </button>
              </article>
            );
          })}
          {activities.length === 0 && (
            <article className="st-card p-4">
              <p className="text-[14px] leading-[20px] text-slate-600">No challenge activities found yet. Ask your group admin to configure challenge activities.</p>
            </article>
          )}
        </section>
      </div>

      <BottomNav active="challenges" />
    </Screen>
  );
}

export default SelectChallengeActivityScreen;
