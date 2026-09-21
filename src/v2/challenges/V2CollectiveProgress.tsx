import type { V2ChallengeDetail } from '../../api/v2ChallengeApi';
import { V2Card, V2ErrorState, V2LoadingState } from '../components/V2Primitives';
import { useChallengeContributorsV2 } from './useChallengeCreation';
import {
  collectiveProgressFor,
  isOwnContributor,
} from './progressView';

/**
 * S3c — Together / Collective live progress.
 *
 * Binds authoritative reads: the shared total/goal from the detail read
 * and per-member contributions from the bounded contributors seam.
 * Contribution visibility, NOT a leaderboard: no placing of any kind —
 * the server response carries none and none is rendered.
 * Percentages/shares are presentation arithmetic over
 * projected values (overshoot preserved honestly).
 *
 * Experience Reference: Together detail/progress treatment (shared total
 * dominant, own contribution distinct). Prototype-only S8 dimensions and
 * social extras are NOT S3c and are omitted.
 */
export function V2CollectiveProgress({ detail }: { detail: V2ChallengeDetail }) {
  const view = collectiveProgressFor(detail);
  const contributors = useChallengeContributorsV2(detail.challengeId, detail.challengeType);

  const percentLabel = view.percent !== null ? `${view.percent}%` : '—';
  const barWidth = view.percent !== null ? Math.min(100, view.percent) : 0;

  return (
    <V2Card>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        Group progress
      </p>

      <div className="mt-2">
        <p className="text-2xl font-black text-slate-900" aria-live="polite">
          {view.total.toLocaleString()}
          {view.unit ? <span className="text-base font-bold text-slate-500"> {view.unit}</span> : null}
          {view.goal !== null && (
            <span className="text-base font-bold text-slate-400">
              {' '}of {view.goal.toLocaleString()}{view.unit ? ` ${view.unit}` : ''}
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
              aria-label={`Shared progress ${percentLabel}`}
            >
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${barWidth}%` }} />
            </div>
            <p className="mt-1 text-sm font-bold text-slate-700">
              {percentLabel}
              {view.remaining !== null && view.remaining > 0 && (
                <span className="font-medium text-slate-500">
                  {' '}· {view.remaining.toLocaleString()}{view.unit ? ` ${view.unit}` : ''} to go
                </span>
              )}
              {view.goalReached && (
                <span className="font-medium text-emerald-700"> · Shared goal reached</span>
              )}
            </p>
          </div>
        )}
      </div>

      {view.hasJoined && (
        <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2">
          <p className="text-sm font-bold text-emerald-900">
            Your contribution: {view.ownContribution.toLocaleString()}{view.unit ? ` ${view.unit}` : ''}
            {view.ownShare !== null && (
              <span className="font-medium"> · {Math.round(view.ownShare * 100)}% of the shared total</span>
            )}
          </p>
        </div>
      )}

      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Contributors
        </p>
        {contributors.isLoading && (
          <div className="mt-2"><V2LoadingState label="Loading contributors…" /></div>
        )}
        {contributors.isError && (
          <div className="mt-2">
            <V2ErrorState
              title="Contributors are unavailable right now"
              message="Your shared total above is still authoritative. Please try again."
              onRetry={() => void contributors.refetch()}
            />
          </div>
        )}
        {contributors.data && contributors.data.contributors.length === 0 && (
          <p className="mt-2 text-sm text-slate-600">No contributions yet. Log activity to start the shared total.</p>
        )}
        {contributors.data && contributors.data.contributors.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {contributors.data.contributors.map((entry) => {
              const own = isOwnContributor(entry, detail);
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
        <p className="mt-2 text-xs text-slate-500">
          Shares are of the current shared total{view.completionsCount > 0 ? ` · ${view.completionsCount} participant${view.completionsCount === 1 ? '' : 's'} completed` : ''}.
        </p>
      </div>
    </V2Card>
  );
}
