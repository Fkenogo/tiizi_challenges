import { ArrowLeft, Check, Flame, Trophy, Users } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { ShareTiiziCard } from '../../components/ShareTiiziCard';
import { useChallenge, useChallengeMembership, useChallengeSummary } from '../../hooks/useChallenges';
import { useAuth } from '../../hooks/useAuth';
import { resolveChallengeProgress } from '../Challenges/challengeProgressResolver';

function WorkoutLoggedScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const challengeId = params.get('challengeId') ?? undefined;
  const groupId = params.get('groupId') ?? undefined;
  const exerciseId = params.get('exerciseId') ?? undefined;
  const exerciseName = params.get('exerciseName') ?? 'Workout';
  const unit = params.get('unit') ?? '';
  const value = Number(params.get('value') || 0);
  const scoringMethod = params.get('scoringMethod') ?? undefined;

  const { user } = useAuth();
  const { data: challenge } = useChallenge(challengeId);
  const { data: membership } = useChallengeMembership(challengeId);
  const { data: challengeSummary } = useChallengeSummary(challengeId);

  const engineVersion = challenge?.engineVersion;
  const challengeType = challenge?.challengeType ?? 'collective';
  const isV2 = engineVersion === 'v2';

  const toFeedPath = groupId
    ? `/app/group/${groupId}/feed`
    : (challengeId ? `/app/challenges/collective?challengeId=${challengeId}` : '/app/challenges');
  const toCompletionPath = challengeId
    ? `/app/challenges/completed?challengeId=${challengeId}${groupId ? `&groupId=${groupId}` : ''}&lastValue=${value}&lastUnit=${encodeURIComponent(unit)}`
    : '/app/challenges';

  // Resolve all progress through the canonical resolver.
  // sessionDelta = value from URL params — shown as "+N today" only, NOT added to totals.
  // priorTeamTotal = challenge.groupCurrentTotal — the team-level aggregate (not the user's
  // personal value). It acts as an optimistic floor while CF updates challengeActivitySummaries
  // (typically 1–5 s). It may already include this log (if the client engine wrote it first)
  // or may be the pre-log value; either way it is always >= any single user's contribution.
  const resolved = resolveChallengeProgress({
    challenge: challenge ?? null,
    membership: membership ?? null,
    currentUserId: user?.uid,
    sessionDelta: value,
    activitySummaryTotal: challengeSummary?.totalValue,
    priorTeamTotal: challenge?.groupCurrentTotal,
  });

  const groupCurrentTotal = resolved.groupTotal;
  const groupCumulativeTarget = resolved.groupTarget;
  const groupPct = resolved.groupPercent;
  const groupRemaining = resolved.groupRemaining;
  const myTotalContrib = resolved.userContributionTotal;

  // --- Competitive ---
  const competitiveActivities = useMemo(() => {
    if (!challenge?.activities) return [];
    return challenge.activities.map((activity) => {
      const key = activity.exerciseId || activity.activityId || activity.exerciseName || '';
      const cumulative = membership?.cumulativeValues?.[key] ?? 0;
      const target = activity.targetValue ?? 0;
      const pct = target > 0 ? Math.min(100, Math.round((cumulative / target) * 100)) : 0;
      return { name: activity.exerciseName || key, cumulative, target, unit: activity.unit, pct, key, isThis: activity.exerciseId === exerciseId };
    });
  }, [challenge?.activities, membership?.cumulativeValues, exerciseId]);


  // --- Streak (from resolver) ---
  const currentStreak = resolved.streakCurrentDays;
  const longestStreak = membership?.longestStreak ?? 0;
  const requiredDays = resolved.streakTargetDays;
  const daysRemaining = requiredDays > 0 ? Math.max(0, requiredDays - currentStreak) : null;
  const streakComplete = requiredDays > 0 && currentStreak >= requiredDays;

  void user;
  void scoringMethod;

  // Show "View Completion" (progress recap) whenever a challengeId exists.
  // The destination screen shows current progress and is meaningful at any point during
  // the challenge — it is not restricted to 100% completion.
  const showCompletion = !!challengeId;

  // Engine-type badge icon
  const engineIcon =
    isV2 && challengeType === 'streak' ? <Flame size={30} className="text-primary" />
    : isV2 && challengeType === 'competitive' ? <Trophy size={30} className="text-primary" />
    : isV2 && challengeType === 'collective' ? <Users size={30} className="text-primary" />
    : <Check size={30} className="text-primary" />;

  // Success headline per engine
  const headline =
    isV2 && challengeType === 'collective'
      ? `You added ${value.toLocaleString()} ${unit} to the team's goal!`
      : isV2 && challengeType === 'competitive'
        ? `${exerciseName}: ${value.toLocaleString()} ${unit} logged!`
        : isV2 && challengeType === 'streak'
          ? `Day ${currentStreak} completed. ${daysRemaining === 0 ? 'Challenge complete!' : 'Your streak continues.'}`
          : 'Workout Logged!';

  const subline =
    isV2 && challengeType === 'collective'
      ? (groupCumulativeTarget > 0 ? `Your team is ${groupPct}% toward its shared goal.` : 'Your contribution has been added to the team.')
      : isV2 && challengeType === 'competitive'
        ? `Keep going — you're making progress on every activity.`
        : isV2 && challengeType === 'streak'
          ? daysRemaining === 0
            ? 'You hit the required streak. Amazing consistency!'
            : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining to complete the streak.`
          : 'Your progress has been shared with the group. Keep the momentum going!';

  const challengeDetailPath = challengeId ? `/app/challenge/${challengeId}` : null;
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else if (challengeDetailPath) {
      navigate(challengeDetailPath);
    } else {
      navigate('/app/challenges');
    }
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[108px] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#f7dfcf 1.2px, transparent 1.2px)', backgroundSize: '18px 18px' }} />

        {/* Breadcrumb / back control */}
        <div className="relative z-10 flex items-center gap-2 px-4 pt-4 pb-1">
          <button
            aria-label="Back to Challenge Detail"
            className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 active:opacity-60"
            onClick={handleBack}
          >
            <ArrowLeft size={16} />
            Challenge Detail
          </button>
        </div>

        <main className="st-form-max relative z-10 pt-4">
          <div className="mx-auto h-[116px] w-[116px] rounded-full bg-primary flex items-center justify-center shadow-[0_14px_22px_rgba(255,111,0,0.24)]">
            <div className="h-[56px] w-[56px] rounded-full bg-white flex items-center justify-center">
              {engineIcon}
            </div>
          </div>

          <h1 className="mt-5 text-center text-[22px] leading-[26px] tracking-[-0.02em] font-black text-[#1c120d]">{headline}</h1>
          <p className="mt-3 text-center text-[14px] leading-[22px] font-medium text-[#5f5148]">{subline}</p>

          {/* Collective progress */}
          {isV2 && challengeType === 'collective' && groupCumulativeTarget > 0 && (
            <section className="mt-6 st-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users size={14} className="text-primary" />
                <p className="text-[11px] font-black uppercase tracking-widest text-primary">Team Progress</p>
              </div>
              <p className="text-[22px] leading-[26px] font-black text-[#1c120d]">
                {groupCurrentTotal.toLocaleString()} / {groupCumulativeTarget.toLocaleString()}
                {unit ? <span className="text-[16px] font-semibold text-[#7f746c]"> {unit}</span> : null}
              </p>
              <div className="mt-2 h-3 rounded-full bg-[#e8edf5] overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${Math.min(groupPct, 100)}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-[#7f746c]">
                <span>{groupPct}%</span>
                <span>{groupRemaining > 0 ? `${groupRemaining.toLocaleString()}${unit ? ` ${unit}` : ''} remaining` : 'Target reached!'}</span>
              </div>
              <div className="mt-3 pt-3 border-t border-[#e8edf5]">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#9597a0] mb-1">Your Contribution</p>
                {value > 0 && (
                  <p className="text-[18px] leading-[22px] font-black text-primary">+{value.toLocaleString()}{unit ? ` ${unit}` : ''} <span className="text-[12px] font-semibold text-[#7f746c]">today</span></p>
                )}
                {myTotalContrib > 0 && (
                  <p className="mt-0.5 text-[12px] text-[#7f746c]">{myTotalContrib.toLocaleString()}{unit ? ` ${unit}` : ''} total</p>
                )}
              </div>
            </section>
          )}

          {/* Competitive per-activity progress */}
          {isV2 && challengeType === 'competitive' && (
            <section className="mt-6 space-y-3">
              {competitiveActivities.map((activity) => (
                <div key={activity.key} className={`st-card p-4 ${activity.isThis ? 'border-primary/40' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className={`text-[15px] leading-[19px] font-black text-[#1c120d] ${activity.isThis ? 'text-primary' : ''}`}>
                      {activity.name}
                      {activity.isThis && <span className="ml-2 text-[11px] font-bold text-primary normal-case tracking-normal">just logged</span>}
                    </p>
                  </div>
                  <div className="h-3 rounded-full bg-[#e8edf5] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700"
                      style={{ width: `${activity.pct}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[12px] text-[#7f746c]">
                    {activity.cumulative.toLocaleString()} / {activity.target.toLocaleString()} {activity.unit}
                  </p>
                </div>
              ))}
            </section>
          )}

          {/* Streak progress */}
          {isV2 && challengeType === 'streak' && (
            <section className="mt-6 st-card p-4">
              <p className="text-[15px] leading-[19px] font-black text-[#1c120d] mb-3">{challenge?.name ?? 'Streak Challenge'}</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-[#fff3e8] py-3">
                  <p className="text-[24px] leading-[28px] font-black text-primary">{currentStreak}</p>
                  <p className="text-[11px] leading-[14px] uppercase tracking-[0.08em] font-bold text-[#9597a0] mt-1">Current</p>
                </div>
                <div className="rounded-xl bg-slate-50 py-3">
                  <p className="text-[24px] leading-[28px] font-black text-[#1c120d]">{longestStreak}</p>
                  <p className="text-[11px] leading-[14px] uppercase tracking-[0.08em] font-bold text-[#9597a0] mt-1">Best</p>
                </div>
                <div className="rounded-xl bg-slate-50 py-3">
                  <p className="text-[24px] leading-[28px] font-black text-[#1c120d]">{daysRemaining ?? '—'}</p>
                  <p className="text-[11px] leading-[14px] uppercase tracking-[0.08em] font-bold text-[#9597a0] mt-1">To Go</p>
                </div>
              </div>
              {requiredDays > 0 && (
                <div className="mt-3 h-3 rounded-full bg-[#e8edf5] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.round((currentStreak / requiredDays) * 100))}%` }}
                  />
                </div>
              )}
              {requiredDays > 0 && (
                <p className="mt-1.5 text-[12px] text-[#7f746c]">
                  Day {currentStreak} of {requiredDays} · {challenge?.streakResetOnMiss ? 'Streak resets on missed day' : 'Streak pauses on missed day'}
                </p>
              )}
              {currentStreak > 0 && currentStreak % 7 === 0 && (
                <p className="mt-2 text-[13px] font-bold text-primary">🔥 {currentStreak}-day milestone!</p>
              )}
              {streakComplete && (
                <p className="mt-2 text-[13px] font-bold text-emerald-600">✓ Streak complete — well done!</p>
              )}
            </section>
          )}

          {/* Unsupported/obsolete challenge record — no v2 engine data to display */}
          {!isV2 && challenge && (
            <section className="mt-6 st-card p-4 text-center">
              <p className="text-[14px] leading-[20px] text-[#7f746c]">This challenge is no longer supported.</p>
            </section>
          )}

          <button className="st-btn-primary mt-8" onClick={() => navigate(toFeedPath)}>Go to Feed →</button>
          {showCompletion && (
            <button
              className="mt-3 w-full h-12 rounded-2xl border border-slate-200 bg-white text-[15px] font-bold text-slate-700 active:opacity-70"
              onClick={() => navigate(toCompletionPath)}
            >
              View Completion
            </button>
          )}

          <div className="mt-5">
            <ShareTiiziCard />
          </div>
        </main>
      </div>

      <BottomNav active="home" />
    </Screen>
  );
}

export default WorkoutLoggedScreen;
