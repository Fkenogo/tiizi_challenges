import { ArrowLeft, Flame, Trophy, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LearnMoreLink } from '../../components/LearnMoreLink';
import { BottomNav, Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useChallenge, useChallengeMembership, useChallengeSummary } from '../../hooks/useChallenges';
import { useLogWellnessActivity } from '../../hooks/useWorkouts';
import { buildActivitySuccessPath } from '../../services/challengeActivityFlow';
import { computeActivityScore, type ChallengeType } from '../../services/scoringConfig';
import { resolveChallengeProgress } from '../Challenges/challengeProgressResolver';

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
  const { data: membership } = useChallengeMembership(challengeId);
  const { data: challengeSummary } = useChallengeSummary(challengeId);
  const logWellness = useLogWellnessActivity();

  const [value, setValue] = useState(Math.max(1, targetValue || 1));
  const [notes, setNotes] = useState('');

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

  const currentCumulative = useMemo(() => {
    if (!membership?.cumulativeValues || !activityId) return 0;
    return membership.cumulativeValues[activityId] ?? 0;
  }, [membership?.cumulativeValues, activityId]);

  const currentStreak = _rp.streakCurrentDays;
  const requiredDays = _rp.streakTargetDays;
  const daysRemaining = requiredDays > 0 ? Math.max(0, requiredDays - currentStreak) : null;

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
      const scoring = computeActivityScore({
        value,
        targetValue,
        challengeType: (challenge?.challengeType ?? 'collective') as ChallengeType,
      });
      navigate(buildActivitySuccessPath({
        challengeId,
        groupId,
        source: 'wellness',
        activityId,
        activityName,
        value,
        unit,
        targetValue,
        points: scoring.pointsEarned,
        metTarget: scoring.metTarget,
        scoringMethod: scoring.scoringMethod,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to log wellness activity.';
      showToast(message, 'error');
    }
  };

  const saveLabel =
    isV2 && challengeType === 'collective' ? 'Contribute to Team'
    : isV2 && challengeType === 'competitive' ? 'Log My Progress'
    : isV2 && challengeType === 'streak' ? 'Log Today'
    : 'Save Activity';

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[108px]">
        <div className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 pb-3">
          <header className="st-form-max flex items-center justify-between">
            <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate(backPath)}>
              <ArrowLeft size={22} className="text-slate-900" />
            </button>
            <div className="flex flex-col items-center min-w-0">
              <h1 className="st-page-title truncate">Log {activityName}</h1>
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
                  {groupCurrentTotal.toLocaleString()} / {groupCumulativeTarget.toLocaleString()} {unit} · {groupPct}%
                </p>
                <div className="w-full h-1.5 rounded-full bg-primary/20 overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(groupPct, 100)}%` }} />
                </div>
                <p className="text-[12px] text-primary/70">Every contribution moves the team closer.</p>
                {_rp.userContributionTotal > 0 && (
                  <p className="text-[11px] text-primary/60">Your contribution: {_rp.userContributionTotal.toLocaleString()} {unit} total</p>
                )}
              </div>
            )}
            {challengeType === 'competitive' && targetValue > 0 && (
              <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 flex items-center gap-3">
                <Trophy size={16} className="text-primary flex-shrink-0" />
                <p className="text-[13px] leading-[18px] text-primary font-semibold">
                  {activityName}: {currentCumulative.toLocaleString()} / {targetValue.toLocaleString()} {unit} so far
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

        <main className="st-form-max mt-6">
          <p className="text-center text-[11px] uppercase tracking-[0.12em] font-black text-primary">{activityType}</p>
          <p className="mt-2 text-center text-[14px] font-semibold text-slate-600">{metricLabel}</p>

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
              aria-label="Wellness value"
            />
          </div>

          <div className="mt-6">
            <p className="st-section-title">How are you feeling?</p>
            <p className="mt-1 text-[12px] leading-[16px] text-[#61758f]">Share your progress, celebrate a milestone or encourage your teammates.</p>
            <textarea
              className="mt-2.5 w-full h-[120px] rounded-[22px] border border-[#f4cdb5] bg-white px-4 py-3 text-[14px] leading-[20px] text-[#2c2a28] resize-none"
              placeholder="Feeling stronger today 💪"
              maxLength={280}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
            <p className="mt-1 text-right text-[11px] text-[#9ca9bd]">{notes.length}/280</p>
          </div>

          <button className="st-btn-primary mt-6" disabled={logWellness.isPending} onClick={handleSave}>
            {logWellness.isPending ? 'Saving...' : saveLabel}
          </button>
        </main>
      </div>
      <BottomNav active="challenges" />
    </Screen>
  );
}

export default LogWellnessActivityScreen;
