import type { V2ChallengeDetail } from '../../api/v2ChallengeApi';
import { V2Card } from '../components/V2Primitives';
import { formatDay } from './challengeCreationDraft';
import { formatResultDay } from './resultsFormat';
import { streakFinalResultFor, streakPeriodDays } from './resultsView';

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

  const outcome = view.completed === true
    ? view.requiredDays !== null
      ? `Reached the required ${view.requiredDays}-day streak.`
      : 'Reached the required streak.'
    : view.completed === false
      ? view.requiredDays !== null
        ? `Best streak: ${bestStreak} of ${view.requiredDays} required.`
        : `Best streak: ${bestStreak}.`
      : null;

  return (
    <V2Card>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Final result</p>

      <p className="mt-2 text-2xl font-black text-slate-900">
        {daysCompleted}
        {view.periodDays !== null && (
          <span className="text-base font-bold text-slate-400"> of {view.periodDays} days completed</span>
        )}
        {view.periodDays === null && (
          <span className="text-base font-bold text-slate-400"> days completed</span>
        )}
      </p>

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

      {outcome && (
        <p className="mt-3 text-sm leading-6 text-slate-700">
          {outcome}
          {view.requiredDays !== null && (
            <span className="font-medium text-slate-500"> Required run: {view.requiredDays} days in a row.</span>
          )}
        </p>
      )}

      {period.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Day by day</p>
          <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {period.map((day) => {
              const state = view.dayStates[day];
              const complete = state?.complete === true;
              return (
                <li
                  key={day}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs ${
                    complete ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-50 text-slate-600'
                  }`}
                >
                  <span>{formatDay(day)}</span>
                  <span className="font-bold">{complete ? 'Complete' : 'Missed'}</span>
                </li>
              );
            })}
          </ul>
        </div>
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
