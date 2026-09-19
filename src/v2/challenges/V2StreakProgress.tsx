import type { V2ChallengeDetail } from '../../api/v2ChallengeApi';
import { V2Card } from '../components/V2Primitives';
import { formatDay, timezoneLabel } from './challengeCreationDraft';
import { humanizeCanonicalKey } from './loggingView';
import { streakProgressFor } from './progressView';

/**
 * S3c — Daily Streak live state.
 *
 * Binds server-authoritative streak truth from the detail read:
 * governing today (projected by the server — the browser never
 * determines the Challenge day), current/best streak, days completed,
 * and today's requirement state from `dayStates[governingToday]`.
 *
 * Never implies grace (missed days reset; closed days reject) and never
 * marks a live streak terminally complete — the final outcome seals
 * when the Challenge ends (S3d), it is not rendered here.
 *
 * Experience Reference: Daily Streak treatment (Today's Daily
 * Consistency dominant, Done / Pending Today). Other-participant streak
 * state is NOT projected by the read model, so only the member's own
 * state renders.
 */
export function V2StreakProgress({ detail }: { detail: V2ChallengeDetail }) {
  const view = streakProgressFor(detail);

  return (
    <V2Card>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        Today&apos;s daily consistency
      </p>

      <div className="mt-2">
        <p className="text-2xl font-black text-slate-900" aria-live="polite">
          {view.todayComplete ? 'Today done' : 'Pending today'}
        </p>
        <p className="mt-0.5 text-sm text-slate-600">
          {formatDay(view.governingToday)} · {timezoneLabel(view.timezone)} time
        </p>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-orange-50 px-3 py-2">
          <dt className="text-[11px] font-bold uppercase tracking-wider text-orange-700">Current</dt>
          <dd className="text-xl font-black text-orange-900">
            {view.currentStreak}
            <span className="text-xs font-bold"> day{view.currentStreak === 1 ? '' : 's'}</span>
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Best</dt>
          <dd className="text-xl font-black text-slate-900">
            {view.bestStreak}
            <span className="text-xs font-bold"> day{view.bestStreak === 1 ? '' : 's'}</span>
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Days done</dt>
          <dd className="text-xl font-black text-slate-900">
            {view.daysCompleted}
            {view.requiredDays !== null && (
              <span className="text-xs font-bold"> of {view.requiredDays}</span>
            )}
          </dd>
        </div>
      </dl>

      {view.hasJoined && view.requirements.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Today&apos;s requirements
          </p>
          <ul className="mt-2 space-y-1.5">
            {view.requirements.map((req) => (
              <li
                key={`${req.canonicalKey}::${req.activityVariant ?? ''}`}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                  req.doneToday ? 'bg-emerald-50 font-bold text-emerald-900' : 'bg-slate-50 text-slate-700'
                }`}
              >
                <span>
                  {humanizeCanonicalKey(req.canonicalKey)}
                  {req.activityVariant ? ` (${req.activityVariant})` : ''} · {req.targetValue} {req.unit}
                </span>
                <span className="font-black">{req.doneToday ? 'Done' : 'Pending'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-xs leading-5 text-slate-500">
        Days roll over at midnight {timezoneLabel(view.timezone)} time. A missed day resets the
        current streak — there is no late logging. The final outcome seals when the Challenge ends.
      </p>
    </V2Card>
  );
}
