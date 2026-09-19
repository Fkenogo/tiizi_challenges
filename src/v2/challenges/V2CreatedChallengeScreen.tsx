import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchKnowledgeByCode, fetchKnowledgeById } from '../../api/knowledgeApi';
import type { V2ConfigActivity } from '../../api/v2ChallengeApi';
import {
  V2Button,
  V2Card,
  V2ErrorState,
  V2LoadingState,
  V2Page,
  V2SectionHeader,
} from '../components/V2Primitives';
import {
  challengeTypeLabel,
  formatDayRange,
  loadBasisLabel,
  metricLabel,
  statusLabel,
  timezoneLabel,
} from './challengeCreationDraft';
import { useChallengeDetailV2, useV2Memberships } from './useChallengeCreation';
import { V2LoggingSection } from './V2LoggingSection';
import { V2ParticipationSection } from './V2ParticipationSection';

/**
 * S2b — created-Challenge context, extended by S3a with the governed
 * participation/access slice and by S3b with the governed
 * activity-logging slice.
 *
 * Everything shown comes from the persisted V2 read
 * (GET /v1/challenges/:id) plus neutral name resolution — there is no
 * mock-only success screen. S3a binds the existing join/withdraw seams
 * here; S3b binds the existing activity-application seam
 * (POST /v1/challenges/:id/activity) for joined participants on active
 * Challenges. Deliberately NOT progress dashboards (S3c) or
 * results (S3d).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ActivityName({ canonicalKey }: { canonicalKey: string }) {
  const query = useQuery({
    queryKey: ['v2-activity-name', canonicalKey],
    queryFn: () =>
      UUID_RE.test(canonicalKey)
        ? fetchKnowledgeById(canonicalKey)
        : fetchKnowledgeByCode(canonicalKey),
    enabled: !!canonicalKey,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  if (query.isLoading) return <span className="text-slate-400">Activity…</span>;
  return <span>{query.data?.name ?? 'Activity'}</span>;
}

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
        <ActivityName canonicalKey={activity.canonicalKey} />
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

  return (
    <V2Page>
      <V2SectionHeader
        eyebrow={`${challengeTypeLabel(challenge.challengeType)} · Hosted by ${groupName}`}
        title={challenge.title}
        description={`${statusLabel(challenge.status)} · ${formatDayRange(challenge.startDate, challenge.endDate)} · ${participationSentence}`}
      />

      <div className="space-y-4">
        <V2Card className="border-emerald-200 bg-emerald-50">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Created</p>
          <p className="mt-1 text-sm font-medium text-emerald-900">
            {participation?.status === 'active'
              ? 'You are taking part in this Challenge.'
              : 'This Challenge exists as persisted truth. Refreshing this page shows the same Challenge.'}
          </p>
        </V2Card>

        <V2Card>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Challenge type</dt>
              <dd className="text-sm font-bold text-slate-900">{challengeTypeLabel(challenge.challengeType)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Host Group</dt>
              <dd className="text-sm font-bold text-slate-900">{groupName}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</dt>
              <dd className="text-sm font-bold text-slate-900">{statusLabel(challenge.status)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Schedule</dt>
              <dd className="text-sm font-bold text-slate-900">
                {formatDayRange(challenge.startDate, challenge.endDate)}
              </dd>
              <dd className="text-xs text-slate-500">{timezoneLabel(challenge.timezone)}</dd>
            </div>
          </dl>
          {challenge.description && (
            <p className="mt-3 border-t border-slate-100 pt-3 text-sm leading-6 text-slate-600">
              {challenge.description}
            </p>
          )}
        </V2Card>

        <V2ParticipationSection detail={challenge} />

        <V2LoggingSection detail={challenge} />

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

        <div className="flex flex-wrap gap-2">
          <V2Button onClick={() => navigate('/v2/challenges')}>Back to Challenges</V2Button>
          <V2Button variant="secondary" onClick={() => navigate('/v2/challenges/new')}>
            Create another Challenge
          </V2Button>
        </div>
      </div>
    </V2Page>
  );
}
