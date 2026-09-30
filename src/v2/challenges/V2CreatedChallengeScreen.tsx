import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  V2Button,
  V2ErrorState,
  V2LoadingState,
  V2Page,
} from '../components/V2Primitives';
import {
  formatDayRange,
  timezoneLabel,
} from './challengeCreationDraft';
import { loggingViewFor } from './loggingView';
import {
  endStateFor,
  loggingAvailableForEndState,
  participationMutableForEndState,
  statusLabelForEndState,
} from './challengeEndState';
import { useChallengeDetailV2, useV2Memberships } from './useChallengeCreation';
import { V2LogActivityDialog } from './V2LoggingSection';
import { participationViewFor, V2LeaveChallengeDialog, V2ParticipationSection } from './V2ParticipationSection';
import { V2ProgressSection } from './V2ProgressSection';
import { V2ChallengeResults } from './V2ChallengeResults';
import { V2ChallengeHero } from './V2ChallengeHero';
import { fetchKnowledgeByCode, fetchKnowledgeById } from '../../api/knowledgeApi';
import { fetchActivityOptions } from '../../api/challengeCreationApi';
import { createChallengeWizardRouteState, createInitialWizardState, type WizardActivity } from './challengeCreationDraft';
import type { WizardState } from './challengeCreationDraft';

/**
 * S3c — created-Challenge context, reassembled by CORR-002 around the
 * participant-facing hierarchy (Experience Reference assembly, canonical
 * S3c truth preserved):
 *
 * A. Back to Challenges
 * B. Challenge hero (identity, host, schedule, purpose, Log Activity CTA)
 * C. Concise challenge context (status + participation in one line)
 * D. Type-specific live progress (Together / Race / Streak truth unchanged)
 * E. Secondary actions (taking part join/rejoin for non-participants,
 *    Create another Challenge).
 *
 * Everything shown comes from the persisted V2 read
 * (GET /v1/challenges/:id) plus the bounded S3c seams (contributors,
 * competitive leaderboard) plus neutral name resolution — there is no
 * mock-only success screen. S3a binds the existing join/withdraw seams
 * below the progress; S3b binds the existing activity-application seam
 * (POST /v1/challenges/:id/activity) through the hero CTA dialog for
 * joined participants on active Challenges; S3c binds live
 * progress/type-state reads. S3d routes the progress slot by honest
 * end-state: a live Challenge keeps the S3c surfaces unchanged, while an
 * ended/window-expired Challenge shows the neutral results-pending state and
 * a finalized Challenge shows the sealed results (V2ChallengeResults).
 *
 * Removed by CORR-002: the CREATED card, the CHALLENGE TYPE / STATUS grid
 * card, and the permanently expanded Log Activity form — valid facts that
 * must not dominate the participant journey.
 *
 * Removed by TIIZI-S3C-DETAIL-CLEANUP-001: the standalone "What counts"
 * card. Challenge configuration is already expressed by the participant
 * surfaces (Group Progress + shared target; Race Progress + target and
 * standings; Today's Daily Consistency + requirements, streak and days
 * completed) and by the governed Log Activity overlay, which exposes the
 * governed activity names and units at the point of logging. No canonical
 * Challenge truth, contract, projection, eligibility, target or unit
 * changed — presentation only. The Streak duration rule is preserved once
 * inside the Today's Daily Consistency surface.
 */

export function V2CreatedChallengeScreen() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const navigate = useNavigate();
  const detail = useChallengeDetailV2(challengeId);
  const memberships = useV2Memberships();
  const [logOpen, setLogOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [reuseLoading, setReuseLoading] = useState(false);
  const [reuseError, setReuseError] = useState('');

  if (detail.isLoading) {
    return (
      <V2Page>
        <V2LoadingState label="Loading your Challenge…" />
      </V2Page>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <V2Page>
        <V2ErrorState
          title="We could not open this Challenge"
          message="It may not be available under your current Group membership. Please try again."
          onRetry={() => void detail.refetch()}
        />
      </V2Page>
    );
  }

  const challenge = detail.data;
  const groupName =
    memberships.data?.memberships.find((membership) => membership.groupId === challenge.groupId)?.group.name
    ?? 'Your group';
  const participation = challenge.myParticipation;
  const participationSentence = participation?.status === 'active'
    ? 'You are taking part in this Challenge.'
    : participation
      ? 'You are not taking part in this Challenge right now.'
      : 'You are not taking part in this Challenge yet.';
  // S3d — route the progress slot by honest end-state. Logging and Leave are
  // live-only; ended, window-expired-unprocessed and finalized Challenges
  // never offer a mutation and never present live truth as final.
  const endState = endStateFor(challenge);
  const loggable = loggingAvailableForEndState(endState)
    && loggingViewFor(challenge).kind === 'loggable';
  // CORR-003: active participants leave via the hero's secondary action +
  // confirmation dialog; the standalone card only serves join/rejoin and
  // read-only states (it returns null while joined).
  const joined = participationMutableForEndState(endState)
    && participationViewFor(challenge).kind === 'joined';

  async function useAsNewChallenge() {
    setReuseError('');
    setReuseLoading(true);
    try {
      const activities = await Promise.all(challenge.config.activities.map(async (configured): Promise<WizardActivity> => {
        const knowledge = configured.activityCode
          ? await fetchKnowledgeByCode(configured.activityCode)
          : configured.knowledgeId
            ? await fetchKnowledgeById(configured.knowledgeId)
            : null;
        if (!knowledge) throw new Error('The configured Activity identity is unavailable.');
        const options = await fetchActivityOptions(knowledge.id);
        const metric = configured.metric ?? options.primaryMetrics[0] ?? options.secondaryMetrics[0] ?? '';
        return {
          activity: knowledge.id,
          activityCode: configured.activityCode ?? knowledge.activityCode,
          name: knowledge.name,
          kind: knowledge.kind,
          category: knowledge.category,
          subcategory: knowledge.subcategory,
          imageUrl: knowledge.imageUrl,
          observedVersion: options.currentVersion,
          options,
          metric,
          unit: configured.unit,
          targetValue: String(configured.targetValue),
          durationMode: configured.durationMode ?? '',
          completionOccurrence: configured.completionOccurrence ?? '',
          loadBasis: configured.loadReportingBasis ?? '',
        };
      }));
      const hostMembership = memberships.data?.memberships.find((membership) => membership.groupId === challenge.groupId);
      const mayHost = hostMembership && (hostMembership.group.allowMemberChallenges !== false
        || ['owner', 'admin', 'steward'].includes(hostMembership.role.toLowerCase()));
      const fresh = createInitialWizardState();
      const draft: WizardState = {
        ...fresh,
        challengeType: challenge.challengeType,
        groupId: mayHost ? challenge.groupId : null,
        groupName: mayHost ? challenge.groupName ?? hostMembership.group.name : null,
        title: challenge.title,
        description: challenge.description,
        coverId: challenge.coverId ?? null,
        activities,
        // Deliberately retain a fresh default schedule and opt-in state.
        creatorJoins: false,
      };
      navigate('/v2/challenges/new', { state: createChallengeWizardRouteState(draft, 0, { reusedFromChallengeId: challenge.challengeId }) });
    } catch {
      setReuseError('We could not prepare this Challenge as a new draft. Recheck its Activity configuration and try again.');
      setReuseLoading(false);
    }
  }

  return (
    <V2Page>
      <div className="mb-3">
        <button
          type="button"
          onClick={() => navigate('/v2/challenges')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900"
        >
          <span aria-hidden>←</span>
          <span>Back to Challenges</span>
        </button>
      </div>

      <div className="space-y-4">
        <V2ChallengeHero
          detail={challenge}
          groupName={groupName}
          groupId={challenge.groupId}
          loggable={loggable}
          onLogActivity={() => setLogOpen(true)}
          showLeave={joined}
          onLeave={() => setLeaveOpen(true)}
        />

        <p className="text-xs font-medium text-slate-500">
          {statusLabelForEndState(challenge.status, endState)} · {formatDayRange(challenge.startDate, challenge.endDate)} · {timezoneLabel(challenge.timezone)} · {participationSentence}
        </p>

        {endState === 'live'
          ? <V2ProgressSection detail={challenge} />
          : <V2ChallengeResults detail={challenge} endState={endState} />}

        <V2ParticipationSection detail={challenge} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <V2Button variant="secondary" onClick={() => navigate('/v2/challenges/new')}>
            Create another Challenge
          </V2Button>
          {endState === 'finalized' && <V2Button variant="secondary" disabled={reuseLoading} onClick={() => void useAsNewChallenge()}>
            {reuseLoading ? 'Preparing a new draft…' : 'Use as new Challenge'}
          </V2Button>}
        </div>
        {reuseError && <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{reuseError}</p>}
      </div>

      <V2LogActivityDialog detail={challenge} open={logOpen} onClose={() => setLogOpen(false)} />
      <V2LeaveChallengeDialog detail={challenge} open={leaveOpen} onClose={() => setLeaveOpen(false)} />
    </V2Page>
  );
}
