import type { V2ChallengeDetail } from '../../api/v2ChallengeApi';
import { V2Card, V2ErrorState, V2LoadingState } from '../components/V2Primitives';
import { formatResultDay } from './resultsFormat';
import {
  competitiveFinalResultFor,
  isOwnStandingsEntry,
  raceStandingsFor,
} from './resultsView';
import { useFinalizedStandingsV2 } from './useResults';

/**
 * S3d — finalized Race / Competitive result.
 *
 * Uses the corrected member-scoped competitive truth (PR #41): one entry per
 * member, frozen standard-competition positions (1,1,3; ties share; the
 * earliest completed episode governs). The own result and the standings come
 * from sealed authority only — the client never ranks and never maps an
 * entry's `participationId` to the episode that earned the result.
 * Non-finishers keep their actual progress and receive no position, and are
 * never labelled failed.
 */
export function V2FinalizedCompetitiveResult({ detail }: { detail: V2ChallengeDetail }) {
  const view = competitiveFinalResultFor(detail);
  const standings = useFinalizedStandingsV2(detail.challengeId, detail.challengeType, detail.finalized);

  const percentLabel = view.percent !== null ? `${view.percent}%` : '—';
  const entries = standings.data?.entries ?? [];
  const split = raceStandingsFor(entries);

  return (
    <V2Card>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Final results</p>

      {view.hasTakenPart && (
        <div className="mt-2">
          <p className="text-2xl font-black text-slate-900">
            {view.ownTotal.toLocaleString()}
            {view.unit ? <span className="text-base font-bold text-slate-500"> {view.unit}</span> : null}
            {view.target > 0 && (
              <span className="text-base font-bold text-slate-400">
                {' '}of {view.target.toLocaleString()}{view.unit ? ` ${view.unit}` : ''}
              </span>
            )}
          </p>
          {view.percent !== null && (
            <div className="mt-2">
              <div
                className="h-2.5 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-valuenow={Math.min(100, view.percent)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Your final progress ${percentLabel}`}
              >
                <div
                  className="h-full rounded-full bg-sky-500"
                  style={{ width: `${Math.min(100, view.percent)}%` }}
                />
              </div>
              <p className="mt-1 text-sm font-bold text-slate-700">
                {percentLabel}
                {view.finished && view.position !== null && (
                  <span className="font-medium text-sky-700"> · Finished · Final position #{view.position}</span>
                )}
                {view.finished && view.position === null && (
                  <span className="font-medium text-slate-500"> · Finished</span>
                )}
                {!view.finished && (
                  <span className="font-medium text-slate-500">
                    {' '}· Progress at close
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Final standings
          {standings.data && (
            <span className="ml-1 font-medium normal-case">
              · {split.finishedCount} of {split.participantCount} finished
            </span>
          )}
        </p>
        {standings.isLoading && (
          <div className="mt-2"><V2LoadingState label="Loading final standings…" /></div>
        )}
        {standings.isError && (
          <div className="mt-2">
            <V2ErrorState
              title="Final standings are unavailable right now"
              message="Your own final result above is still authoritative. Please try again."
              onRetry={() => void standings.refetch()}
            />
          </div>
        )}
        {standings.data && (
          <div className="mt-2 space-y-3">
            {split.finished.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Finished</p>
                <ul className="mt-1.5 space-y-1.5">
                  {split.finished.map((entry) => {
                    const own = isOwnStandingsEntry(entry, detail);
                    return (
                      <li
                        key={entry.participationId}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                          own ? 'bg-sky-50 font-bold text-sky-900' : 'bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span>
                          <span className="mr-2 inline-block w-7 font-black">#{entry.position}</span>
                          {own ? 'You' : 'A fellow participant'}
                        </span>
                        <span className="font-bold">
                          {entry.cumulativeTotal.toLocaleString()}{view.unit ? ` ${view.unit}` : ''}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {split.progressing.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Progress at close</p>
                <ul className="mt-1.5 space-y-1.5">
                  {split.progressing.map((entry) => {
                    const own = isOwnStandingsEntry(entry, detail);
                    return (
                      <li
                        key={entry.participationId}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                          own ? 'bg-sky-50 font-bold text-sky-900' : 'bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span>{own ? 'You' : 'A fellow participant'}</span>
                        <span className="font-bold">
                          {entry.cumulativeTotal.toLocaleString()}{view.unit ? ` ${view.unit}` : ''}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {split.participantCount === 0 && (
              <p className="mt-2 text-sm text-slate-600">No participants took part in this Challenge.</p>
            )}
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Final positions come from the Challenge server. Tied finishers share a position.
        </p>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        {view.finalizedAt
          ? `Results saved on ${formatResultDay(view.finalizedAt, detail.timezone)}.`
          : 'Results saved.'}
      </p>
    </V2Card>
  );
}
