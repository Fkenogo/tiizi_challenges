import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { V2ConfigActivity } from '../../api/v2ChallengeApi';
import {
  V2Button,
  V2Card,
  V2ErrorState,
  V2LoadingState,
  V2Page,
} from '../components/V2Primitives';
import {
  formatDayRange,
  loadBasisLabel,
  metricLabel,
  statusLabel,
  timezoneLabel,
} from './challengeCreationDraft';
import { loggingViewFor } from './loggingView';
import { V2ActivityName } from './activityNames';
import { useChallengeDetailV2, useV2Memberships } from './useChallengeCreation';
import { V2LogActivityDialog } from './V2LoggingSection';
import { V2ParticipationSection } from './V2ParticipationSection';
import { V2ProgressSection } from './V2ProgressSection';
import { V2ChallengeHero } from './V2ChallengeHero';

/**
 * S3c — created-Challenge context, reassembled by CORR-002 around the
 * participant-facing hierarchy (Experience Reference assembly, canonical
 * S3c truth preserved):
 *
 * A. Back to Challenges
 * B. Challenge hero (identity, host, schedule, purpose, Log Activity CTA)
 * C. Concise challenge context (status + participation in one line)
 * D. Type-specific live progress (Together / Race / Streak truth unchanged)
 * E. Supporting information (taking part incl. Leave, what counts,
 *    secondary metadata) — present but no longer dominant.
 *
 * Everything shown comes from the persisted V2 read
 * (GET /v1/challenges/:id) plus the bounded S3c seams (contributors,
 * competitive leaderboard) plus neutral name resolution — there is no
 * mock-only success screen. S3a binds the existing join/withdraw seams
 * below the progress; S3b binds the existing activity-application seam
 * (POST /v1/challenges/:id/activity) through the hero CTA dialog for
 * joined participants on active Challenges; S3c binds live
 * progress/type-state reads. Deliberately NOT results (S3d).
 *
 * Removed by CORR-002: the CREATED card, the CHALLENGE TYPE / STATUS grid
 * card, and the permanently expanded Log Activity form — valid facts that
 * must not dominate the participant journey.
 */

function durationModeLabel(mode: string | null | undefined): string | null {
  if (mode === 'CONTINUOUS') return 'all at once';
  if (mode === 'ACCUMULATED') return 'added up across the day';
  return null;
}

function MeasurementSummary({ activity }: { activity: V2ConfigActivity }) {
  const parts: string[] = [];
  parts.push(`${activity.targetValue} ${activity.unit}`);
  if (activity.durationMode) {
    const label = durationModeLabel(activity.durationMode);
    if (label) parts.push(label);
  }
  if (activity.loadReportingBasis) parts.push(loadBasisLabel(activity.loadReportingBasis));
  if (activity.completionOccurrence) parts.push(`“${activity.completionOccurrence}”`);
  return (
    <li className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-sm font-bold text-slate-900">
        <V2ActivityName canonicalKey={activity.canonicalKey} />
      </p>
      <p className="mt-0.5 text-xs text-slate-600">
        {metricLabel(activity.metric)} · {parts.join(' · ')}
      </p>
      {(activity.requiredComponents ?? []).length > 0 && (
        <p className="mt-0.5 text-xs text-slate-500">
          Every required part must meet this target ({(activity.requiredComponents ?? []).length} parts).
        </p>
      )}
    </li>
  );
}

export function V2CreatedChallengeScreen() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const navigate = useNavigate();
  const detail = useChallengeDetailV2(challengeId);
  const memberships = useV2Memberships();
  const [logOpen, setLogOpen] = useState(false);

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
  const loggable = loggingViewFor(challenge).kind === 'loggable';

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
          loggable={loggable}
          onLogActivity={() => setLogOpen(true)}
        />

        <p className="text-xs font-medium text-slate-500">
          {statusLabel(challenge.status)} · {formatDayRange(challenge.startDate, challenge.endDate)} · {timezoneLabel(challenge.timezone)} · {participationSentence}
        </p>

        <V2ProgressSection detail={challenge} />

        <V2ParticipationSection detail={challenge} />

        <V2Card>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            What counts
          </p>
          <ul className="mt-2 space-y-2">
            {challenge.config.activities.map((activity) => (
              <MeasurementSummary key={activity.position} activity={activity} />
            ))}
          </ul>
          {challenge.challengeType === 'collective' && challenge.goalValue !== null && (
            <p className="mt-3 text-sm font-bold text-slate-700">
              Shared goal: {challenge.goalValue} {challenge.goalUnit}
            </p>
          )}
          {challenge.challengeType === 'streak' && challenge.config.requiredConsecutiveDays !== null && (
            <p className="mt-3 text-sm font-bold text-slate-700">
              Every daily requirement must be complete for {challenge.config.requiredConsecutiveDays} days in a row.
            </p>
          )}
        </V2Card>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <V2Button variant="secondary" onClick={() => navigate('/v2/challenges/new')}>
            Create another Challenge
          </V2Button>
        </div>
      </div>

      <V2LogActivityDialog detail={challenge} open={logOpen} onClose={() => setLogOpen(false)} />
    </V2Page>
  );
}
