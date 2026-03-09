import { ArrowLeft, Minus, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useChallenge } from '../../hooks/useChallenges';
import { useExercise } from '../../hooks/useExercises';
import { useLogWorkout } from '../../hooks/useWorkouts';

function LogWorkoutScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const exerciseId = params.get('exerciseId') ?? undefined;
  const challengeId = params.get('challengeId') ?? undefined;
  const groupId = params.get('groupId') ?? undefined;
  const unitParam = params.get('unit') ?? undefined;
  const exerciseNameParam = params.get('exerciseName') ?? undefined;

  const { user } = useAuth();
  const { showToast } = useToast();
  const logWorkout = useLogWorkout();

  const { data: exercise } = useExercise(exerciseId);
  const { data: challenge } = useChallenge(challengeId);

  const [value, setValue] = useState(25);
  const [notes, setNotes] = useState('');
  const valueOptions = useMemo(() => Array.from({ length: 1001 }, (_, index) => index), []);

  const displayUnit = unitParam || exercise?.metric.unit || 'Reps';
  const displayName = exercise?.name || exerciseNameParam || 'Pushups';
  const metricType = useMemo(() => {
    if (displayUnit.toLowerCase() === 'reps') return 'Strength Training';
    if (displayUnit.toLowerCase() === 'seconds' || displayUnit.toLowerCase() === 'minutes') return 'Time Training';
    return 'Distance Training';
  }, [displayUnit]);

  useEffect(() => {
    if (!exercise && !exerciseId) setValue(25);
  }, [exercise, exerciseId]);

  const backPath = `/app/workouts/select-activity?challengeId=${challengeId || 'core-blast'}${groupId ? `&groupId=${groupId}` : ''}`;

  const handleSave = async () => {
    if (!user?.uid) {
      showToast('Please sign in to log workout.', 'error');
      return;
    }
    if (!exerciseId || !challengeId) {
      showToast('Missing exercise or challenge context.', 'error');
      return;
    }
    if (value <= 0) {
      showToast('Enter a valid value.', 'error');
      return;
    }
    const now = new Date();
    const startAt = challenge?.startDate ? new Date(challenge.startDate) : null;
    const endAt = challenge?.endDate ? new Date(challenge.endDate) : null;
    if (startAt && now < startAt) {
      showToast(`Challenge starts on ${startAt.toLocaleDateString()}.`, 'error');
      return;
    }
    if (endAt && now > endAt) {
      showToast('Challenge has ended.', 'error');
      return;
    }

    try {
      await logWorkout.mutateAsync({
        userId: user.uid,
        challengeId,
        exerciseId,
        value,
        unit: displayUnit,
        notes: notes.trim() || undefined,
        groupId,
      });
      showToast('Workout logged.', 'success');
      const target = challenge?.activities?.find((a) => a.exerciseId === exerciseId)?.targetValue ?? 15;
      const qs = new URLSearchParams({
        challengeId,
        exerciseId,
        exerciseName: displayName,
        value: String(value),
        target: String(target),
        unit: displayUnit,
      });
      if (groupId) qs.set('groupId', groupId);
      navigate(`/app/workouts/success?${qs.toString()}`);
    } catch (error) {
      console.error('Workout logging failed:', error);
      const message = error instanceof Error ? error.message : 'Failed to log workout.';
      showToast(message, 'error');
    }
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[108px]">
        <div className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 pb-3">
          <header className="st-form-max flex items-center justify-between">
            <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate(backPath)}>
              <ArrowLeft size={28} className="text-slate-900" />
            </button>
            <h1 className="st-page-title truncate">Log {displayName}</h1>
            <span className="w-10" />
          </header>
        </div>

        <main className="st-form-max mt-5">
          <div className="mx-auto h-20 w-20 rounded-full bg-[#f8e9df] text-primary text-[24px] flex items-center justify-center">✕</div>
          <p className="mt-4 text-center text-[10px] leading-[12px] tracking-[0.14em] uppercase font-black text-primary">{metricType}</p>
          <p className="mt-4 text-center text-[14px] leading-[18px] font-bold text-[#6f6b68]">{displayUnit}</p>

          <div className="mt-4 flex items-center justify-between">
            <button
              className="h-[64px] w-[64px] rounded-full border-[2px] border-[#f4cdb5] text-primary flex items-center justify-center"
              onClick={() => setValue((prev) => Math.max(0, prev - 1))}
            >
              <Minus size={24} />
            </button>
            <p className="text-[48px] leading-[46px] tracking-[-0.02em] font-black text-[#1b120d]">{value}</p>
            <button
              className="h-[64px] w-[64px] rounded-full bg-primary text-white flex items-center justify-center"
              onClick={() => setValue((prev) => prev + 1)}
            >
              <Plus size={24} />
            </button>
          </div>
          <div className="mt-4">
            <input
              type="number"
              min={0}
              step={1}
              value={value}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isNaN(next)) return;
                setValue(Math.max(0, Math.floor(next)));
              }}
              className="w-full h-12 rounded-xl border border-[#f4cdb5] bg-white px-4 text-center text-[22px] font-bold text-[#1b120d]"
              aria-label="Workout value"
            />
            <select
              className="mt-3 w-full h-12 rounded-xl border border-[#f4cdb5] bg-white px-4 text-center text-[18px] font-semibold text-[#1b120d] appearance-none"
              value={value}
              onChange={(event) => setValue(Number(event.target.value) || 0)}
              aria-label="Quick value picker"
            >
              {valueOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-8">
            <p className="st-section-title">Notes</p>
            <textarea
              className="mt-2.5 w-full h-[170px] rounded-[22px] border border-[#f4cdb5] bg-white px-4 py-3 text-[14px] leading-[20px] text-[#2c2a28]"
              placeholder="How did it feel? (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button className="st-btn-primary mt-6" disabled={logWorkout.isPending} onClick={handleSave}>
            {logWorkout.isPending ? 'Saving...' : 'Save Workout'}
          </button>
        </main>
      </div>
      <BottomNav active="home" />
    </Screen>
  );
}

export default LogWorkoutScreen;
