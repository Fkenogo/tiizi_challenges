import { ArrowLeft, Minus, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useChallenge } from '../../hooks/useChallenges';
import { useLogWellnessActivity } from '../../hooks/useWorkouts';

function LogWellnessActivityScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const challengeId = params.get('challengeId') ?? undefined;
  const groupId = params.get('groupId') ?? undefined;
  const activityId = params.get('activityId') ?? undefined;
  const activityType = params.get('activityType') ?? 'wellness';
  const activityName = params.get('activityName') ?? 'Wellness Activity';
  const unit = params.get('unit') ?? 'count';
  const targetValue = Number(params.get('targetValue') ?? 1);

  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: challenge } = useChallenge(challengeId);
  const logWellness = useLogWellnessActivity();

  const [value, setValue] = useState(Math.max(1, targetValue || 1));
  const [notes, setNotes] = useState('');
  const valueOptions = useMemo(() => {
    const normalized = unit.toLowerCase();
    let options: number[] = [];
    if (normalized === 'hours' || normalized === 'hour') {
      options = Array.from({ length: 73 }, (_, index) => index);
    } else if (normalized === 'milliliters' || normalized === 'ml') {
      options = Array.from({ length: 101 }, (_, index) => index * 50);
    } else if (normalized === 'minutes' || normalized === 'minute') {
      options = Array.from({ length: 361 }, (_, index) => index);
    } else {
      options = Array.from({ length: 1001 }, (_, index) => index);
    }
    if (!options.includes(value)) {
      options.push(value);
      options.sort((a, b) => a - b);
    }
    return options;
  }, [unit, value]);

  const backPath = challengeId
    ? `/app/workouts/select-activity?challengeId=${challengeId}${groupId ? `&groupId=${groupId}` : ''}`
    : '/app/challenges';

  const metricLabel = useMemo(() => {
    const normalized = unit.toLowerCase();
    if (normalized === 'hours' || normalized === 'hour') return 'Hours';
    if (normalized === 'milliliters' || normalized === 'ml') return 'Milliliters';
    if (normalized === 'minutes' || normalized === 'minute') return 'Minutes';
    return unit;
  }, [unit]);

  const handleSave = async () => {
    if (!user?.uid || !challengeId || !groupId || !activityId) {
      showToast('Missing challenge context.', 'error');
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
      await logWellness.mutateAsync({
        userId: user.uid,
        challengeId,
        groupId,
        activityId,
        activityType,
        value,
        unit,
        notes: notes.trim() || undefined,
      });
      showToast('Wellness activity logged.', 'success');
      navigate(`/app/challenge/${challengeId}${groupId ? `?groupId=${groupId}` : ''}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to log wellness activity.';
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
            <h1 className="st-page-title truncate">Log {activityName}</h1>
            <span className="w-10" />
          </header>
        </div>

        <main className="st-form-max mt-6">
          <p className="text-center text-[11px] uppercase tracking-[0.12em] font-black text-primary">{activityType}</p>
          <p className="mt-2 text-center text-[14px] font-semibold text-slate-600">{metricLabel}</p>

          <div className="mt-4 flex items-center justify-between">
            <button className="h-[64px] w-[64px] rounded-full border-[2px] border-[#f4cdb5] text-primary flex items-center justify-center" onClick={() => setValue((prev) => Math.max(0, prev - 1))}>
              <Minus size={24} />
            </button>
            <p className="text-[48px] leading-[46px] tracking-[-0.02em] font-black text-[#1b120d]">{value}</p>
            <button className="h-[64px] w-[64px] rounded-full bg-primary text-white flex items-center justify-center" onClick={() => setValue((prev) => prev + 1)}>
              <Plus size={24} />
            </button>
          </div>

          <select
            className="mt-4 w-full h-12 rounded-xl border border-[#f4cdb5] bg-white px-4 text-center text-[18px] font-semibold text-[#1b120d] appearance-none"
            value={value}
            onChange={(event) => setValue(Number(event.target.value) || 0)}
            aria-label="Wellness value picker"
          >
            {valueOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <div className="mt-6">
            <p className="st-section-title">Notes</p>
            <textarea
              className="mt-2.5 w-full h-[150px] rounded-[22px] border border-[#f4cdb5] bg-white px-4 py-3 text-[14px] leading-[20px] text-[#2c2a28]"
              placeholder="Add optional context..."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <button className="st-btn-primary mt-6" disabled={logWellness.isPending} onClick={handleSave}>
            {logWellness.isPending ? 'Saving...' : 'Save Activity'}
          </button>
        </main>
      </div>
      <BottomNav active="challenges" />
    </Screen>
  );
}

export default LogWellnessActivityScreen;
