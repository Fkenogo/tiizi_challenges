import { ArrowLeft, BookOpen, Flame, Trophy, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { LearnMoreLink } from '../../components/LearnMoreLink';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useChallenge, useChallengeMembership, useChallengeSummary } from '../../hooks/useChallenges';
import { useExercise } from '../../hooks/useExercises';
import { useLogWorkout } from '../../hooks/useWorkouts';
import { buildActivitySuccessPath } from '../../services/challengeActivityFlow';
import { computeActivityScore, type ChallengeType } from '../../services/scoringConfig';
import { resolveChallengeProgress } from '../Challenges/challengeProgressResolver';

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
  const { data: membership } = useChallengeMembership(challengeId);
  const { data: challengeSummary } = useChallengeSummary(challengeId);

  const [value, setValue] = useState(1);
  const [notes, setNotes] = useState('');

  const displayUnit = unitParam || exercise?.metric.unit || 'Reps';
  const displayName = exercise?.name || exerciseNameParam || 'Pushups';
  const metricType = useMemo(() => {
    if (displayUnit.toLowerCase() === 'reps') return 'Strength Training';
    if (displayUnit.toLowerCase() === 'seconds' || displayUnit.toLowerCase() === 'minutes') return 'Time Training';
    return 'Distance Training';
  }, [displayUnit]);

  const engineVersion = challenge?.engineVersion;
  const challengeType = challenge?.challengeType ?? 'collective';
  const isV2 = engineVersion === 'v2';

  // Engine context values — from canonical resolver.
  // activitySummaryTotal: CF-maintained canonical team total (challengeActivitySummaries.totalValue).
  // priorTeamTotal: challenge.groupCurrentTotal as optimistic team floor before CF fires.
  const _rp = resolveChallengeProgress({
    challenge: challenge ?? null,
    membership: membership ?? null,
    activitySummaryTotal: challengeSummary?.totalValue,
    priorTeamTotal: challenge?.groupCurrentTotal,
  });
  const groupCurrentTotal = _rp.groupTotal;
  const groupCumulativeTarget = _rp.groupTarget;
  const groupPct = _rp.groupPercent;

  const currentActivity = useMemo(() => {
    if (!challenge?.activities || !exerciseId) return null;
    return challenge.activities.find((a) => a.exerciseId === exerciseId) ?? null;
  }, [challenge?.activities, exerciseId]);

  const currentCumulative = useMemo(() => {
    if (!currentActivity || !membership?.cumulativeValues) return 0;
    const key = currentActivity.exerciseId || currentActivity.exerciseName || '';
    return membership.cumulativeValues[key] ?? 0;
  }, [currentActivity, membership?.cumulativeValues]);

  const currentStreak = membership?.currentStreak ?? 0;
  const requiredDays = challenge?.requiredConsecutiveDays ?? 0;
  const daysRemaining = requiredDays > 0 ? Math.max(0, requiredDays - currentStreak) : null;

  // Initialize value from the activity's targetValue once the challenge loads.
  // Uses a ref flag so the user's own edits are never overwritten.
  const defaultSetRef = useRef(false);
  useEffect(() => {
    if (!defaultSetRef.current && currentActivity) {
      const tv = currentActivity.targetValue;
      setValue(tv && tv > 0 ? tv : 1);
      defaultSetRef.current = true;
    }
  }, [currentActivity]);

  const backPath = challengeId
    ? `/app/workouts/select-activity?challengeId=${challengeId}${groupId ? `&groupId=${groupId}` : ''}`
    : '/app/challenges';

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
      const targetValue = challenge?.activities?.find((a) => a.exerciseId === exerciseId)?.targetValue ?? 0;
      const scoring = computeActivityScore({
        value,
        targetValue,
        challengeType: (challenge?.challengeType ?? 'collective') as ChallengeType,
      });
      navigate(buildActivitySuccessPath({
        challengeId,
        groupId,
        source: 'workout',
        exerciseId,
        activityName: displayName,
        value,
        unit: displayUnit,
        targetValue,
        points: scoring.pointsEarned,
        metTarget: scoring.metTarget,
        scoringMethod: scoring.scoringMethod,
      }));
    } catch (error) {
      console.error('Workout logging failed:', error);
      const message = error instanceof Error ? error.message : 'Failed to log workout.';
      showToast(message, 'error');
    }
  };

  const saveLabel =
    isV2 && challengeType === 'collective' ? 'Contribute to Team'
    : isV2 && challengeType === 'competitive' ? 'Log Workout'
    : isV2 && challengeType === 'streak' ? 'Log Today'
    : 'Save Workout';

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[108px]">
        <div className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 pb-3">
          <header className="st-form-max flex items-center justify-between">
            <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate(backPath)}>
              <ArrowLeft size={22} className="text-slate-900" />
            </button>
            <div className="flex flex-col items-center min-w-0">
              <h1 className="st-page-title truncate">Log {displayName}</h1>
              <LearnMoreLink section="logging" />
            </div>
            <span className="w-10" />
          </header>
        </div>

        {/* Engine context banner */}
        {isV2 && (
          <div className="st-form-max mt-3">
            {challengeType === 'collective' && groupCumulativeTarget > 0 && (
              <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-4 gap-2 flex flex-col">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-primary flex-shrink-0" />
                  <p className="text-[11px] uppercase tracking-[0.1em] font-black text-primary">Team Progress</p>
                </div>
                <p className="text-[15px] font-bold text-primary leading-tight">
                  {groupCurrentTotal.toLocaleString()} / {groupCumulativeTarget.toLocaleString()} {displayUnit} · {groupPct}%
                </p>
                <div className="w-full h-1.5 rounded-full bg-primary/20 overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${groupPct}%` }} />
                </div>
                <p className="text-[12px] text-primary/70">Every contribution moves the team closer.</p>
                {_rp.userContributionTotal > 0 && (
                  <p className="text-[11px] text-primary/60">Your contribution: {_rp.userContributionTotal.toLocaleString()} {displayUnit} total</p>
                )}
              </div>
            )}
            {challengeType === 'competitive' && currentActivity && (
              <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 flex items-center gap-3">
                <Trophy size={16} className="text-primary flex-shrink-0" />
                <p className="text-[13px] leading-[18px] text-primary font-semibold">
                  {displayName}: {currentCumulative.toLocaleString()} / {(currentActivity.targetValue ?? 0).toLocaleString()} {displayUnit} so far
                </p>
              </div>
            )}
            {challengeType === 'streak' && (
              <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 flex items-center gap-3">
                <Flame size={16} className="text-primary flex-shrink-0" />
                <p className="text-[13px] leading-[18px] text-primary font-semibold">
                  Day {currentStreak} streak
                  {daysRemaining !== null ? ` · ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} to go` : ''}
                </p>
              </div>
            )}
          </div>
        )}

        <main className="st-form-max mt-5">
          <div className="mx-auto h-20 w-20 rounded-full bg-[#f8e9df] text-primary text-[24px] flex items-center justify-center">✕</div>
          <p className="mt-4 text-center text-[10px] leading-[12px] tracking-[0.14em] uppercase font-black text-primary">{metricType}</p>
          <p className="mt-1 text-center text-[14px] leading-[18px] font-bold text-[#6f6b68]">{displayUnit}</p>
          {exerciseId && (
            <div className="mt-2 flex justify-center">
              <button
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 active:opacity-70"
                onClick={() => {
                  const qs = new URLSearchParams({ exerciseId });
                  if (challengeId) qs.set('challengeId', challengeId);
                  if (groupId) qs.set('groupId', groupId);
                  navigate(`/app/exercises/${exerciseId}?${qs.toString()}`);
                }}
              >
                <BookOpen size={12} className="text-primary flex-shrink-0" />
                <span className="text-[12px] font-bold text-primary leading-none">View Exercise Guide</span>
              </button>
            </div>
          )}

          <div className="mt-5">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={value}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isNaN(next)) return;
                setValue(Math.max(0, Math.floor(next)));
              }}
              className="w-full h-[80px] rounded-2xl border-2 border-[#f4cdb5] bg-white px-4 text-center text-[40px] leading-[48px] font-black text-[#1b120d] focus:outline-none focus:border-primary"
              aria-label="Workout value"
            />
          </div>

          <div className="mt-8">
            <p className="st-section-title">How are you feeling?</p>
            <p className="mt-1 text-[12px] leading-[16px] text-[#61758f]">Share your progress, celebrate a milestone or encourage your teammates.</p>
            <textarea
              className="mt-2.5 w-full h-[120px] rounded-2xl border border-[#f4cdb5] bg-white px-4 py-3 text-[14px] leading-[20px] text-[#2c2a28] resize-none"
              placeholder="Feeling stronger today 💪"
              maxLength={280}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <p className="mt-1 text-right text-[11px] text-[#9ca9bd]">{notes.length}/280</p>
          </div>

          <button className="st-btn-primary mt-6" disabled={logWorkout.isPending} onClick={handleSave}>
            {logWorkout.isPending ? 'Saving...' : saveLabel}
          </button>
        </main>
      </div>
      <BottomNav active="home" />
    </Screen>
  );
}

export default LogWorkoutScreen;
