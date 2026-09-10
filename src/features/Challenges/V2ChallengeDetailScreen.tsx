/**
 * Phase C3B V2 Challenge detail surface.
 *
 * Governing and progress truth comes ONLY from GET /v1/challenges/:id
 * (immutable config, own Participation, Derived Truth). No V1
 * challengeMembers / challengeActivitySummaries / Firestore leaderboard /
 * workouts / wellnessLogs reads anywhere on this screen.
 *
 * Join/Leave buttons reuse the V1 visual language, but the mutations call
 * the V2 API exclusively; withdrawal closes the episode and preserves
 * history (never deletes, never touches Firestore challengeMembers).
 *
 * Competitive ranking renders the server-derived V2 leaderboard (order,
 * shared ties, 1,2,2,4, no position for non-completers). Collective totals
 * show actual values (overshoot preserved; only bar widths clamp at 100%).
 * Streak renders server dayStates — and never a leaderboard.
 */
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Flame, Trophy, Users } from 'lucide-react';
import { BottomNav, Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import {
  useV2ChallengeDetail,
  useV2CompetitiveLeaderboard,
  useV2JoinChallenge,
  useV2WithdrawChallenge,
} from '../../hooks/useV2Challenges';
import { isV2ChallengesEnabled } from '../../api/v2ChallengeMode';
import { mapV2ApiError } from '../../services/v2ActivityPayload';

function V2ChallengeDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const enabled = isV2ChallengesEnabled();
  const { data: detail, isLoading, isError, refetch } = useV2ChallengeDetail(enabled ? id : undefined);
  const join = useV2JoinChallenge();
  const withdraw = useV2WithdrawChallenge();
  const { data: board } = useV2CompetitiveLeaderboard(
    enabled ? id : undefined,
    detail?.challengeType,
  );

  const participation = detail?.myParticipation ?? null;
  const activeParticipation = participation?.status === 'active' ? participation : null;
  const progress = participation?.progress ?? null;

  const logLinks = useMemo(() => {
    if (!detail || !activeParticipation) return [];
    return detail.config.activities.map((activity) => {
      const qs = new URLSearchParams({
        challengeId: detail.challengeId,
        v2: '1',
        canonicalKey: activity.canonicalKey,
        unit: activity.unit,
        targetValue: String(activity.targetValue),
        activityKind: detail.challengeType === 'streak' && activity.canonicalKey.includes('water')
          ? 'wellness'
          : 'fitness',
      });
      if (activity.activityVariant) qs.set('activityVariant', activity.activityVariant);
      // Wellness-configured activities route to the wellness log screen; the
      // V2 config's canonical identity (not the Firestore id) travels along.
      const isWellness = activity.canonicalKey.startsWith('wellness:')
        || /water|sleep|fast|meditat|mindful|hydrat/i.test(activity.canonicalKey);
      return {
        key: `${activity.canonicalKey}::${activity.activityVariant ?? ''}`,
        label: activity.canonicalKey,
        unit: activity.unit,
        targetValue: activity.targetValue,
        path: isWellness
          ? `/app/workouts/log-wellness?${qs.toString()}&activityType=wellness&activityName=${encodeURIComponent(activity.canonicalKey)}`
          : `/app/workouts/log?${qs.toString()}&exerciseName=${encodeURIComponent(activity.canonicalKey)}`,
      };
    });
  }, [detail, activeParticipation]);

  const handleJoin = async () => {
    if (!id) return;
    try {
      await join.mutateAsync(id);
      showToast('Joined V2 challenge.', 'success');
    } catch (error) {
      showToast(mapV2ApiError(error).message, 'error');
    }
  };

  const handleWithdraw = async () => {
    if (!id) return;
    try {
      await withdraw.mutateAsync(id);
      showToast('You left this V2 challenge. Your history is preserved.', 'success');
    } catch (error) {
      showToast(mapV2ApiError(error).message, 'error');
    }
  };

  if (!enabled) {
    return (
      <Screen noPadding noBottomPadding className="st-page">
        <div className="st-frame st-bottom-safe pb-[108px]">
          <main className="st-form-max mt-10 text-center">
            <p className="text-[15px] font-bold text-slate-900">V2 Challenges are not enabled.</p>
            <button className="st-btn-primary mt-6" onClick={() => navigate('/app/challenges')}>
              Back to Challenges
            </button>
          </main>
        </div>
        <BottomNav active="home" />
      </Screen>
    );
  }

  const goalPct = detail && detail.goalValue != null && detail.goalValue > 0
    ? Math.round((detail.collectiveTotal / detail.goalValue) * 100)
    : 0;

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[108px]">
        <div className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 pb-3">
          <header className="st-form-max flex items-center justify-between">
            <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate('/app/challenges/v2')}>
              <ArrowLeft size={22} className="text-slate-900" />
            </button>
            <h1 className="st-page-title truncate">{detail?.title ?? 'V2 Challenge'}</h1>
            <span className="w-10" />
          </header>
        </div>
        <main className="st-form-max mt-5 space-y-4">
          {isLoading && <p className="text-[14px] text-slate-500">Loading V2 challenge…</p>}
          {isError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-[14px] font-bold text-red-700">This challenge is no longer available.</p>
              <button className="mt-2 text-[13px] font-bold text-red-600 underline" onClick={() => refetch()}>
                Retry
              </button>
            </div>
          )}
          {detail && (
            <>
              <p className="text-[13px] text-slate-600">{detail.description}</p>
              <p className="text-[12px] text-slate-500">
                {detail.challengeType} · {detail.status} · {detail.startDate} → {detail.endDate}
              </p>

              {detail.challengeType === 'collective' && (
                <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-primary flex-shrink-0" />
                    <p className="text-[11px] uppercase tracking-[0.1em] font-black text-primary">Team Progress</p>
                  </div>
                  <p className="text-[15px] font-bold text-primary leading-tight">
                    {detail.collectiveTotal.toLocaleString()} / {(detail.goalValue ?? 0).toLocaleString()} {detail.goalUnit ?? ''} · {goalPct}%
                  </p>
                  <div className="w-full h-1.5 rounded-full bg-primary/20 overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(goalPct, 100)}%` }} />
                  </div>
                  {detail.collectiveGoalReached && (
                    <p className="text-[12px] font-bold text-primary">Team goal reached.</p>
                  )}
                </div>
              )}

              {detail.challengeType === 'streak' && progress && (
                <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 flex items-center gap-3">
                  <Flame size={16} className="text-primary flex-shrink-0" />
                  <p className="text-[13px] leading-[18px] text-primary font-semibold">
                    {progress.currentStreak}-day streak · best {progress.bestStreak} · {progress.daysCompleted} days done
                  </p>
                </div>
              )}

              {detail.challengeType === 'competitive' && progress && (
                <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 flex items-center gap-3">
                  <Trophy size={16} className="text-primary flex-shrink-0" />
                  <p className="text-[13px] leading-[18px] text-primary font-semibold">
                    {progress.cumulativeTotal.toLocaleString()} total · {progress.totalPoints.toLocaleString()} pts
                    {progress.completionStatus === 'completed' ? ' · complete' : ''}
                  </p>
                </div>
              )}

              {detail.challengeType === 'competitive' && board && board.entries.length > 0 && (
                <section>
                  <h2 className="st-section-title">Leaderboard</h2>
                  <div className="mt-2 space-y-2">
                    {board.entries.map((entry) => (
                      <div key={entry.participationId} className="st-card px-4 py-3 flex items-center justify-between">
                        <p className="text-[14px] font-bold text-slate-900">
                          {entry.position != null ? `#${entry.position}` : '—'} · {entry.totalPoints.toLocaleString()} pts
                        </p>
                        <p className="text-[12px] text-slate-500">
                          {entry.completionStatus === 'completed' ? 'complete' : `${entry.cumulativeTotal.toLocaleString()} total`}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h2 className="st-section-title">Activities</h2>
                <div className="mt-2 space-y-2">
                  {detail.config.activities.map((activity) => (
                    <div key={`${activity.canonicalKey}::${activity.activityVariant ?? ''}`} className="st-card px-4 py-3">
                      <p className="text-[14px] font-bold text-slate-900">{activity.canonicalKey}</p>
                      <p className="text-[12px] text-slate-500">Target {activity.targetValue} {activity.unit}</p>
                    </div>
                  ))}
                </div>
              </section>

              {!participation && (
                <button
                  className="w-full h-12 rounded-2xl bg-primary text-white text-[15px] font-black transition-opacity active:opacity-80"
                  disabled={join.isPending}
                  onClick={handleJoin}
                >
                  {join.isPending ? 'Joining…' : 'Join Challenge'}
                </button>
              )}
              {activeParticipation && logLinks.length > 0 && (
                <div className="space-y-2">
                  {logLinks.map((link) => (
                    <button
                      key={link.key}
                      className="w-full h-12 rounded-2xl bg-primary text-white text-[15px] font-black transition-opacity active:opacity-80"
                      onClick={() => navigate(link.path)}
                    >
                      Log {link.label}
                    </button>
                  ))}
                </div>
              )}
              {participation && participation.status === 'active' && (
                <button
                  className="w-full h-12 rounded-2xl border border-red-200 bg-red-50 text-red-600 text-[14px] font-bold disabled:opacity-60"
                  disabled={withdraw.isPending}
                  onClick={handleWithdraw}
                >
                  {withdraw.isPending ? 'Leaving…' : 'Leave Challenge'}
                </button>
              )}
            </>
          )}
        </main>
      </div>
      <BottomNav active="home" />
    </Screen>
  );
}

export default V2ChallengeDetailScreen;
