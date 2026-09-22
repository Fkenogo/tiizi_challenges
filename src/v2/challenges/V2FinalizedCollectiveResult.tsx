import type { V2ChallengeDetail } from '../../api/v2ChallengeApi';
import { V2Card, V2ErrorState, V2LoadingState } from '../components/V2Primitives';
import { formatDayRange } from './challengeCreationDraft';
import { formatResultDay } from './resultsFormat';
import { collectiveFinalResultFor, collectiveOutcomeFor } from './resultsView';
import { useChallengeContributorsV2 } from './useChallengeCreation';

/**
 * S3d — finalized Together / Collective result.
 *
 * Binds the frozen shared total and the bounded contributor rollup. The
 * shared total, goal, reached/not-reached and goal-crossing instant come from
 * the sealed terminal result; own contribution and member-level shares come
 * from the contributors seam. Overshoot is preserved honestly (never capped),
 * a missed goal is reported as the actual result — never as a failure — and
 * contributors are listed with no ranking of any kind.
 */
export function V2FinalizedCollectiveResult({ detail }: { detail: V2ChallengeDetail }) {
  const view = collectiveFinalResultFor(detail);
  const contributors = useChallengeContributorsV2(detail.challengeId, detail.challengeType);
  const ownId = detail.myParticipation?.participationId;
  const total = view.total;

  // CORR-001 fail closed: without sealed terminal truth nothing is presented
  // as a final result — the mutable live-derived total is never substituted.
  if (!view.hasFinalTruth || total === null) {
    return (
      <V2Card>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Final result</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The final result is not available right now. Please try again.
        </p>
      </V2Card>
    );
  }

  const percentLabel = view.percent !== null ? `${view.percent}%` : '—';
  const barWidth = view.percent !== null ? Math.min(100, view.percent) : 0;
  const outcome = collectiveOutcomeFor(view);

  return (
    <V2Card>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Final result</p>

      <div className="mt-2">
        <p className="text-2xl font-black text-slate-900">{outcome.primary}</p>
        {outcome.secondary && (
          <p className="mt-1 text-base font-bold text-slate-500">{outcome.secondary}</p>
        )}
        {view.percent !== null && (
          <div className="mt-2">
            <div
              className="h-2.5 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={Math.min(100, view.percent)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Final group total ${percentLabel}`}
            >
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${barWidth}%` }} />
            </div>
            <p className="mt-1 text-sm font-bold text-slate-700">
              Group total · {percentLabel}
              {view.overshoot !== null && (
                <span className="font-medium text-emerald-700">
                  {' '}· {view.overshoot.toLocaleString()}{view.unit ? ` ${view.unit}` : ''} over the goal
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {view.goalReached === true && view.goalCompletedAt && (
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Reached on {formatResultDay(view.goalCompletedAt, detail.timezone)}.
        </p>
      )}

      {view.hasTakenPart && (
        <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2">
          <p className="text-sm font-bold text-emerald-900">
            Your contribution: {view.ownContribution.toLocaleString()}{view.unit ? ` ${view.unit}` : ''}
            {view.ownShare !== null && (
              <span className="font-medium"> · {Math.round(view.ownShare * 100)}% of the group total</span>
            )}
          </p>
        </div>
      )}

      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Contributors</p>
        {contributors.isLoading && (
          <div className="mt-2"><V2LoadingState label="Loading contributors…" /></div>
        )}
        {contributors.isError && (
          <div className="mt-2">
            <V2ErrorState
              title="Contributors are unavailable right now"
              message="The final group total above is still authoritative. Please try again."
              onRetry={() => void contributors.refetch()}
            />
          </div>
        )}
        {contributors.data && contributors.data.contributors.length === 0 && (
          <p className="mt-2 text-sm text-slate-600">No contributions were recorded for this Challenge.</p>
        )}
        {contributors.data && contributors.data.contributors.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {contributors.data.contributors.map((entry) => {
              const own = ownId !== undefined && entry.participationId === ownId;
              return (
                <li
                  key={entry.participationId}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                    own ? 'bg-emerald-50 font-bold text-emerald-900' : 'bg-slate-50 text-slate-700'
                  }`}
                >
                  <span>{own ? 'You' : 'A fellow participant'}</span>
                  <span className="font-bold">
                    {entry.contributionTotal.toLocaleString()}{view.unit ? ` ${view.unit}` : ''}
                    {entry.share !== null && (
                      <span className="ml-1 font-medium opacity-70">{Math.round(entry.share * 100)}%</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        Ran {formatDayRange(detail.config.period.startDate, detail.config.period.endDate)}.
        {view.finalizedAt
          ? ` Results saved on ${formatResultDay(view.finalizedAt, detail.timezone)}.`
          : ' Results saved.'}
      </p>
    </V2Card>
  );
}
