import { useNavigate } from 'react-router-dom';
import { V2Button, V2EmptyState, V2ErrorState, V2LoadingState, V2Page, V2SectionHeader } from '../components/V2Primitives';
import { useChallengeListV2, useV2Memberships } from './useChallengeCreation';
import {
  challengeTypeLabel,
  formatDayRange,
  timezoneLabel,
} from './challengeCreationDraft';
import { endStateFor, statusLabelForEndState, type V2ChallengeEndState } from './challengeEndState';
import type { V2ChallengeSummary } from '../../api/v2ChallengeApi';

/**
 * S2b — V2 Challenges entry point.
 *
 * Real read binding to GET /v1/challenges (persisted V2 truth) with loading,
 * empty and populated states, and the Create Challenge action that starts the
 * V2 creation journey. Deliberately NOT full S3 discovery/detail/results.
 *
 * S3d (CORR-002 alignment) — the list lifecycle badge is derived from the
 * server-governed end state (`governingToday` vs `endDate`, plus `finalized`),
 * the SAME authority the detail hero uses. A window-expired-but-unprocessed
 * Challenge reads "Finished", never the raw domain status "Running"; the
 * device clock is never consulted.
 */

function statusTone(endState: V2ChallengeEndState): string {
  return endState === 'live' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600';
}

/**
 * S4a — shared with Group Home hosted-Challenge rows so both surfaces
 * present the SAME participation/end-state badges from the SAME code.
 */
export { statusTone };

function participationLabel(challenge: V2ChallengeSummary): { text: string; className: string } | null {
  // Bound directly to the authoritative read model — never inferred.
  if (challenge.myParticipation?.status === 'active') {
    return { text: 'Taking part', className: 'bg-emerald-100 text-emerald-800' };
  }
  if (challenge.status === 'ended') return null;
  if (challenge.myParticipation) {
    return { text: 'Not taking part', className: 'bg-slate-100 text-slate-600' };
  }
  return { text: 'Not joined', className: 'bg-slate-100 text-slate-600' };
}

/** S4a — shared with Group Home (see statusTone above). */
export { participationLabel };

export function V2ChallengeListScreen() {
  const navigate = useNavigate();
  const challenges = useChallengeListV2();
  const memberships = useV2Memberships();

  const groupName = (groupId: string): string | null =>
    memberships.data?.memberships.find((membership) => membership.groupId === groupId)?.group.name
    ?? null;

  const createAction = (
    <div className="flex flex-col items-end gap-1">
      <V2Button onClick={() => navigate('/v2/challenges/new')}>Create Challenge</V2Button>
      {/* Activity Guide is supporting Challenge guidance — a contextual
          secondary entry near Create Challenge, never a primary destination. */}
      <button
        type="button"
        onClick={() => navigate('/v2/guide')}
        className="text-[11px] font-bold text-slate-500 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-slate-900"
      >
        View Activity Guide
      </button>
    </div>
  );

  return (
    <V2Page wide>
      <V2SectionHeader
        eyebrow="Challenges"
        title="Challenges"
        description="Move together or race each other. Every Challenge belongs to a Group you are part of."
        action={createAction}
      />

      {challenges.isLoading && <V2LoadingState label="Loading your Challenges…" />}

      {challenges.isError && (
        <V2ErrorState
          title="We could not load your Challenges"
          message="Please try again. If this keeps happening, check your connection and try once more."
          onRetry={() => void challenges.refetch()}
        />
      )}

      {challenges.isSuccess && challenges.data.challenges.length === 0 && (
        <V2EmptyState
          title="No Challenges yet"
          message="Start one with a Group you belong to. You decide how it works, what counts, and when it runs."
          action={createAction}
        />
      )}

      {challenges.isSuccess && challenges.data.challenges.length > 0 && (
        <ul className="space-y-3">
          {challenges.data.challenges.map((challenge: V2ChallengeSummary) => {
            const participation = participationLabel(challenge);
            const endState = endStateFor(challenge);
            return (
            <li key={challenge.challengeId}>
              <button
                type="button"
                onClick={() => navigate(`/v2/challenges/${challenge.challengeId}`)}
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-slate-300"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                    {challengeTypeLabel(challenge.challengeType)}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusTone(endState)}`}>
                    {statusLabelForEndState(challenge.status, endState)}
                  </span>
                  {participation && (
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${participation.className}`}>
                      {participation.text}
                    </span>
                  )}
                  <span className="text-[11px] font-bold text-slate-400">
                    {groupName(challenge.groupId) ?? 'Your group'}
                  </span>
                </div>
                <p className="mt-2 text-base font-black text-slate-900">{challenge.title}</p>
                {challenge.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{challenge.description}</p>
                )}
                <p className="mt-2 text-xs font-bold text-slate-500">
                  {formatDayRange(challenge.startDate, challenge.endDate)} · {timezoneLabel(challenge.timezone)}
                </p>
              </button>
            </li>
            );
          })}
        </ul>
      )}
    </V2Page>
  );
}
