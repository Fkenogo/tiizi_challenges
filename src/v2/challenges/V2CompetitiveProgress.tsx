import type { V2ChallengeDetail } from '../../api/v2ChallengeApi';
import { V2Card, V2ErrorState, V2LoadingState } from '../components/V2Primitives';
import { useCompetitiveLeaderboardV2 } from './useChallengeCreation';
import {
  competitiveProgressFor,
  isOwnBoardEntry,
  raceBoardFor,
} from './progressView';

/**
 * S3c — Race / Competitive live state.
 *
 * Binds the existing competitive leaderboard seam: own accumulation vs
 * target from the detail read, live positions ONLY from the server
 * response (standard competition ranking 1,1,3 — ties share,
 * non-completers null). The client never ranks. Finishers (positioned)
 * are separated from participants still progressing (positionless).
 *
 * Experience Reference: Race progress treatment — with one authority
 * correction: the prototype shows #1, #2, #2, which is NOT authoritative.
 * Served server positions are rendered; prototype ranking notation is not
 * reproduced. This screen is NOT sealed terminal presentation: it shows
 * live state only.
 */
export function V2CompetitiveProgress({ detail }: { detail: V2ChallengeDetail }) {
  // Hooks stay unconditional (Rules of Hooks); the query itself is
  // disabled once finalized, so no frozen final_position is ever fetched
  // as S3c live state.
  const board = useCompetitiveLeaderboardV2(detail.challengeId, detail.challengeType, detail.finalized);
  // CORR-001 Blocker 2: once finalized the leaderboard route serves
  // frozen end-state authority reserved for the later results slice.
  // The S3c live surface unmounts here instead of displaying final truth
  // as "live" — nothing is manufactured in its place.
  if (detail.finalized) return null;
  const entries = board.data?.entries ?? [];
  const view = competitiveProgressFor(detail, entries);
  const split = raceBoardFor(entries);

  const percentLabel = view.percent !== null ? `${view.percent}%` : '—';

  return (
    <V2Card>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        Live race state
      </p>

      {view.hasJoined && (
        <div className="mt-2">
          <p className="text-2xl font-black text-slate-900" aria-live="polite">
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
                aria-valuenow={view.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Your progress ${percentLabel}`}
              >
                <div className="h-full rounded-full bg-sky-500" style={{ width: `${view.percent}%` }} />
              </div>
              <p className="mt-1 text-sm font-bold text-slate-700">
                {percentLabel}
                {view.qualified && view.position !== null && (
                  <span className="font-medium text-sky-700"> · Placed #{view.position} (live)</span>
                )}
                {view.qualified && view.position === null && (
                  <span className="font-medium text-slate-500"> · Finished</span>
                )}
                {!view.qualified && (
                  <span className="font-medium text-slate-500"> · Finish to place</span>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Standings
          {board.data && (
            <span className="ml-1 font-medium normal-case">
              · {split.finishedCount} of {split.participantCount} finished
            </span>
          )}
        </p>
        {board.isLoading && (
          <div className="mt-2"><V2LoadingState label="Loading standings…" /></div>
        )}
        {board.isError && (
          <div className="mt-2">
            <V2ErrorState
              title="Standings are unavailable right now"
              message="Your own progress above is still authoritative. Please try again."
              onRetry={() => void board.refetch()}
            />
          </div>
        )}
        {board.data && (
          <div className="mt-2 space-y-3">
            {split.finished.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Finished</p>
                <ul className="mt-1.5 space-y-1.5">
                  {split.finished.map((entry) => {
                    const own = isOwnBoardEntry(entry, detail);
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
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Still progressing</p>
                <ul className="mt-1.5 space-y-1.5">
                  {split.progressing.map((entry) => {
                    const own = isOwnBoardEntry(entry, detail);
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
              <p className="mt-2 text-sm text-slate-600">No participants yet.</p>
            )}
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Live positions come from the Challenge server. Tied finishers share a position.
        </p>
      </div>
    </V2Card>
  );
}
