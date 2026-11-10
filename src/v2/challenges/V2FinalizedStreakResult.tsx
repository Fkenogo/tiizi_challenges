import type { V2ChallengeDetail } from '../../api/v2ChallengeApi';
import { V2Card } from '../components/V2Primitives';
import { Link } from 'react-router-dom';
import { formatResultDay } from './resultsFormat';
import { streakFinalResultFor, streakOutcomeFor, streakPeriodDays } from './resultsView';

/**
 * S3d — finalized Daily Streak result.
 *
 * Streak results are PERSONAL (L.13 / FR-V2-211): no leaderboard, no ranking,
 * no comparison with other participants. The Final Streak shown here is the
 * frozen `challenge_participation_finals.final_streak`; the live
 * `currentStreak` can differ after finalization and is NEVER substituted.
 * A terminal outcome is stated plainly, never as a failure.
 */
export function V2FinalizedStreakResult({ detail }: { detail: V2ChallengeDetail }) {
  const view = streakFinalResultFor(detail);
  const period = streakPeriodDays(detail.config.period.startDate, detail.config.period.endDate);
  const daysCompleted = view.daysCompleted;
  const bestStreak = view.bestStreak;

  // CORR-001 fail closed: the sealed personal result is the only source of
  // truth; without it nothing is presented as a final result (the live
  // currentStreak/daysCompleted are never substituted).
  if (!view.hasFinalTruth || daysCompleted === null || bestStreak === null) {
    return (
      <V2Card>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Final result</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your final result is not available right now. Please try again.
        </p>
      </V2Card>
    );
  }

  const outcome = streakOutcomeFor(view);

  return (
    <V2Card>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Final result</p>

      <p className="mt-2 text-2xl font-black text-slate-900">{outcome.primary}</p>
      {outcome.secondary && (
        <p className="mt-1 text-sm font-medium text-slate-500">{outcome.secondary}</p>
      )}

      <dl className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-orange-50 px-3 py-2">
          <dt className="text-[11px] font-bold uppercase tracking-wider text-orange-700">Final streak</dt>
          <dd className="text-xl font-black text-orange-900">
            {view.finalStreak !== null ? view.finalStreak : '—'}
            {view.finalStreak !== null && (
              <span className="text-xs font-bold"> day{view.finalStreak === 1 ? '' : 's'}</span>
            )}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Best streak</dt>
          <dd className="text-xl font-black text-slate-900">
            {bestStreak}
            <span className="text-xs font-bold"> day{bestStreak === 1 ? '' : 's'}</span>
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Days completed</dt>
          <dd className="text-xl font-black text-slate-900">
            {daysCompleted}
            {view.periodDays !== null && (
              <span className="text-xs font-bold"> of {view.periodDays}</span>
            )}
          </dd>
        </div>
      </dl>

      {period.length > 0 && (
        <Link
          to={`/v2/challenges/${encodeURIComponent(detail.challengeId)}/history`}
          className="mt-3 inline-flex rounded-lg py-2 text-sm font-bold text-primary underline underline-offset-2"
        >
          View full history
        </Link>
      )}

      <p className="mt-3 text-xs leading-5 text-slate-500">
        This is your personal streak result — it is not compared with anyone else.
        {view.finalizedAt
          ? ` Results saved on ${formatResultDay(view.finalizedAt, detail.timezone)}.`
          : ' Results saved.'}
      </p>
    </V2Card>
  );
}
