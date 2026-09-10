/**
 * Phase C3B V2 Challenge list surface.
 *
 * Data comes ONLY from GET /v1/challenges. V1 (Firestore) and V2
 * (PostgreSQL) Challenges are separate identities from separate sources:
 * this screen never merges, deduplicates, or heuristically matches them —
 * V1 cards render from Firestore, V2 cards from the V2 API.
 */
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Flame, Trophy, Users } from 'lucide-react';
import { BottomNav, Screen } from '../../components/Layout';
import { useV2ChallengeList } from '../../hooks/useV2Challenges';
import { isV2ChallengesEnabled } from '../../api/v2ChallengeMode';
import type { V2ChallengeSummary } from '../../api/v2ChallengeApi';

function typeIcon(type: V2ChallengeSummary['challengeType']) {
  if (type === 'collective') return <Users size={16} className="text-primary flex-shrink-0" />;
  if (type === 'competitive') return <Trophy size={16} className="text-primary flex-shrink-0" />;
  return <Flame size={16} className="text-primary flex-shrink-0" />;
}

function cardSubtitle(summary: V2ChallengeSummary): string {
  if (summary.challengeType === 'collective' && summary.goalValue != null) {
    const pct = summary.goalValue > 0
      ? Math.round((summary.collectiveTotal / summary.goalValue) * 100)
      : 0;
    // Textual truth retains the actual total (overshoot preserved); only a
    // progress-bar width below clamps at 100%.
    return `${summary.collectiveTotal.toLocaleString()} / ${summary.goalValue.toLocaleString()} ${summary.goalUnit ?? ''} · ${pct}%`.trim();
  }
  if (summary.challengeType === 'streak' && summary.myParticipation) {
    const p = summary.myParticipation.progress;
    return `${p.currentStreak}-day streak · ${p.daysCompleted} days done`;
  }
  if (summary.challengeType === 'competitive' && summary.myParticipation) {
    const p = summary.myParticipation.progress;
    return `${p.cumulativeTotal.toLocaleString()} total · ${p.totalPoints.toLocaleString()} pts`;
  }
  const participation = summary.myParticipation
    ? summary.myParticipation.status
    : 'not joined';
  return `${summary.status} · ${participation}`;
}

function V2ChallengesScreen() {
  const navigate = useNavigate();
  const enabled = isV2ChallengesEnabled();
  const { data, isLoading, isError, refetch } = useV2ChallengeList();
  const challenges = data?.challenges ?? [];

  if (!enabled) {
    return (
      <Screen noPadding noBottomPadding className="st-page">
        <div className="st-frame st-bottom-safe pb-[108px]">
          <main className="st-form-max mt-10 text-center">
            <p className="text-[15px] font-bold text-slate-900">V2 Challenges are not enabled.</p>
            <button
              className="st-btn-primary mt-6"
              onClick={() => navigate('/app/challenges')}
            >
              Back to Challenges
            </button>
          </main>
        </div>
        <BottomNav active="home" />
      </Screen>
    );
  }

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[108px]">
        <div className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 pb-3">
          <header className="st-form-max flex items-center justify-between">
            <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate('/app/challenges')}>
              <ArrowLeft size={22} className="text-slate-900" />
            </button>
            <h1 className="st-page-title">V2 Challenges</h1>
            <span className="w-10" />
          </header>
        </div>
        <main className="st-form-max mt-5 space-y-3">
          {isLoading && <p className="text-[14px] text-slate-500">Loading V2 challenges…</p>}
          {isError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-[14px] font-bold text-red-700">Could not load V2 challenges.</p>
              <button className="mt-2 text-[13px] font-bold text-red-600 underline" onClick={() => refetch()}>
                Retry
              </button>
            </div>
          )}
          {!isLoading && !isError && challenges.length === 0 && (
            <p className="text-[14px] text-slate-500">No V2 challenges yet. New V2 challenges are created by the controlled establishment flow.</p>
          )}
          {challenges.map((summary) => (
            <article
              key={summary.challengeId}
              className="st-card p-4 flex items-center justify-between gap-3 cursor-pointer"
              onClick={() => navigate(`/app/challenge/v2/${summary.challengeId}`)}
            >
              <div className="flex items-center gap-3 min-w-0">
                {typeIcon(summary.challengeType)}
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-slate-900 truncate">{summary.title}</p>
                  <p className="text-[12px] text-slate-500 truncate">{cardSubtitle(summary)}</p>
                </div>
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-primary flex-shrink-0">
                {summary.challengeType}
              </span>
            </article>
          ))}
        </main>
      </div>
      <BottomNav active="home" />
    </Screen>
  );
}

export default V2ChallengesScreen;
