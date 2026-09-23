import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/apiClient';
import type { V2GroupDetail } from '../../api/groupsApi';
import {
  V2Button,
  V2Card,
  V2EmptyState,
  V2ErrorState,
  V2LoadingState,
  V2Page,
} from '../components/V2Primitives';
import { useV2GroupId } from '../group/V2GroupScope';
import { challengeTypeLabel, formatDayRange, timezoneLabel } from '../challenges/challengeCreationDraft';
import { endStateFor, statusLabelForEndState } from '../challenges/challengeEndState';
import { participationLabel, statusTone } from '../challenges/V2ChallengeListScreen';
import { groupRoleLabel } from './groupDraft';
import { groupHomeErrorStatus, groupHomeViewFor, viewerMayCreateChallenge } from './groupHomeView';
import { useJoinGroup, useV2GroupChallenges, useV2GroupDetail } from './useV2Groups';

/**
 * TIIZI S4a — Group Home (`/v2/groups/:groupId`).
 *
 * The persisted Group, bound to the canonical read (`GET /v1/groups/:groupId`)
 * plus the governed hosted-Challenge scope (`GET /v1/challenges?groupId=`).
 * Presents only truth that exists: identity, description, the viewer's
 * server-derived relationship, the singular Accountable Steward, the live
 * member count, governed community configuration, and hosted Challenges.
 *
 * Reference composition (Group Detail, Challenges tab) without prototype
 * semantics: no Feed, no Leaderboard, no plural Admins, no presence, no
 * media, no invented social behaviour. Internal identifiers, provider ids,
 * raw backend field names and state codes are never rendered.
 */

function relationshipBadge(detail: V2GroupDetail): { text: string; className: string } {
  switch (detail.viewerRelationship) {
    case 'steward':
      return { text: 'Accountable Steward · you', className: 'bg-orange-50 text-primary' };
    case 'member':
      return {
        text: groupRoleLabel(detail.viewerMembership?.role ?? 'member'),
        className: 'bg-orange-50 text-primary',
      };
    case 'pending':
      return { text: 'Join request pending', className: 'bg-slate-100 text-slate-600' };
    case 'none':
      return { text: 'Not a member', className: 'bg-slate-100 text-slate-600' };
  }
}

/** Member-worded community configuration (never raw backend field names). */
function settingsRows(detail: V2GroupDetail): Array<{ label: string; value: string; hint: string }> {
  if (detail.requireAdminApproval === null || detail.allowMemberChallenges === null) return [];
  return [
    {
      label: 'Discoverability',
      value: detail.isPrivate ? 'Private' : 'Discoverable',
      hint: detail.isPrivate
        ? 'Only invited people can find and join this Group.'
        : 'Anyone on Tiizi can find this Group.',
    },
    {
      label: 'Joining',
      value: detail.requireAdminApproval ? 'Approval to join' : 'Direct join',
      hint: detail.requireAdminApproval
        ? 'New members join after steward approval.'
        : 'New members join right away.',
    },
    {
      label: 'Challenge creation',
      value: detail.allowMemberChallenges ? 'Members can create' : 'Steward creates',
      hint: detail.allowMemberChallenges
        ? 'Any member can host a Challenge here.'
        : 'Only the Accountable Steward hosts new Challenges.',
    },
  ];
}

function JoinCta({ groupId }: { groupId: string }) {
  const join = useJoinGroup(groupId);
  const errorMessage =
    join.isError && join.error instanceof ApiError && join.error.status === 503
      ? 'We could not reach Tiizi just now. Please try again in a moment.'
      : 'We could not join this Group just now. Please try again.';
  return (
    <div className="mt-3">
      <V2Button onClick={() => join.mutate()} disabled={join.isPending}>
        {join.isPending ? 'Joining…' : 'Join Group'}
      </V2Button>
      {join.isError && (
        <p role="alert" className="mt-2 text-xs font-bold text-red-600">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

export function V2GroupHomeScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const groupId = useV2GroupId();
  const detail = useV2GroupDetail(groupId);
  const hosted = useV2GroupChallenges(groupId);
  const createdGroupName = (location.state as { createdGroupName?: string } | null)?.createdGroupName;

  const view = groupHomeViewFor({
    isLoading: detail.isLoading,
    isError: detail.isError,
    isSuccess: detail.isSuccess,
    errorStatus: groupHomeErrorStatus(detail.error),
    detail: detail.data,
  });

  return (
    <V2Page>
      <p className="mb-2 text-sm font-bold">
        <Link to="/v2/groups" className="text-slate-500 hover:text-slate-800">
          ← Back to Groups
        </Link>
      </p>

      {view.kind === 'loading' && <V2LoadingState label="Loading this Group…" />}

      {view.kind === 'error' && (
        <V2ErrorState
          title="We could not load this Group"
          message="Something went wrong on the way. Please try again."
          onRetry={() => void detail.refetch()}
        />
      )}

      {view.kind === 'notFound' && (
        <V2EmptyState
          title="We could not find this Group"
          message="It may have been removed, or you may not have access to it."
          action={<V2Button onClick={() => navigate('/v2/groups')}>Back to Groups</V2Button>}
        />
      )}

      {view.kind === 'home' && (
        <GroupHomeBody
          detail={view.detail}
          createdGroupName={createdGroupName}
          hostedState={hosted}
          onOpenChallenge={(challengeId) => navigate(`/v2/challenges/${challengeId}`)}
          onCreateChallenge={() =>
            navigate('/v2/challenges/new', { state: { groupId: view.detail.id } })
          }
        />
      )}
    </V2Page>
  );
}

function GroupHomeBody({
  detail,
  createdGroupName,
  hostedState,
  onOpenChallenge,
  onCreateChallenge,
}: {
  detail: V2GroupDetail;
  createdGroupName: string | undefined;
  hostedState: ReturnType<typeof useV2GroupChallenges>;
  onOpenChallenge: (challengeId: string) => void;
  onCreateChallenge: () => void;
}) {
  const badge = relationshipBadge(detail);
  const settings = settingsRows(detail);
  const canCreate = viewerMayCreateChallenge(detail);
  const challenges = hostedState.data?.challenges ?? [];

  return (
    <div className="space-y-4">
      {createdGroupName && (
        <p
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"
        >
          {createdGroupName} is ready. You are its Accountable Steward.
        </p>
      )}

      <V2Card>
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Group</p>
        <h1 className="mt-0.5 text-xl font-black tracking-tight text-slate-900">{detail.name}</h1>
        {detail.description && (
          <p className="mt-1 text-sm leading-6 text-slate-600">{detail.description}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${badge.className}`}
          >
            {badge.text}
          </span>
          {typeof detail.memberCount === 'number' && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
              {detail.memberCount} {detail.memberCount === 1 ? 'member' : 'members'}
            </span>
          )}
        </div>
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
          <span className="font-bold text-slate-700">Accountable Steward</span>
          {detail.viewerRelationship === 'steward'
            ? ' — that’s you. One accountable steward keeps this Group running.'
            : detail.steward
              ? ' — one accountable steward keeps this Group running.'
              : ' — stewardship is held under Tiizi governance.'}
        </p>
      </V2Card>

      {settings.length > 0 && (
        <V2Card>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Community setup
          </p>
          <dl className="mt-2 space-y-3">
            {settings.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-3">
                <div>
                  <dt className="text-sm font-black text-slate-900">{row.label}</dt>
                  <dd className="text-xs leading-5 text-slate-500">{row.hint}</dd>
                </div>
                <dd className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </V2Card>
      )}

      {detail.viewerRelationship === 'none' && !detail.isPrivate && <JoinCta groupId={detail.id} />}

      {detail.viewerRelationship === 'pending' && (
        <V2Card>
          <p className="text-sm font-bold text-slate-800">Your request to join is pending approval.</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            The steward will review it. You will see the full Group once approved.
          </p>
        </V2Card>
      )}

      <section aria-label="Hosted Challenges">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-base font-black text-slate-900">Hosted Challenges</h2>
          {canCreate && challenges.length > 0 && (
            <V2Button variant="secondary" onClick={onCreateChallenge}>
              Create Challenge
            </V2Button>
          )}
        </div>

        {hostedState.isLoading && <V2LoadingState label="Loading hosted Challenges…" />}

        {hostedState.isError && (
          <V2ErrorState
            title="We could not load hosted Challenges"
            message="The Group itself loaded fine — only its Challenges failed. Please try again."
            onRetry={() => void hostedState.refetch()}
          />
        )}

        {hostedState.isSuccess && challenges.length === 0 && (
          <V2EmptyState
            title="No Challenges here yet"
            message={
              canCreate
                ? 'Host the first Challenge for this Group. Members join explicitly — never automatically.'
                : 'When this Group hosts Challenges, they will appear here.'
            }
            action={
              canCreate ? <V2Button onClick={onCreateChallenge}>Create a Challenge</V2Button> : undefined
            }
          />
        )}

        {hostedState.isSuccess && challenges.length > 0 && (
          <ul className="space-y-3">
            {challenges.map((challenge) => {
              const participation = participationLabel(challenge);
              const endState = endStateFor(challenge);
              return (
                <li key={challenge.challengeId}>
                  <button
                    type="button"
                    onClick={() => onOpenChallenge(challenge.challengeId)}
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
                    </div>
                    <p className="mt-2 text-base font-black text-slate-900">{challenge.title}</p>
                    {challenge.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{challenge.description}</p>
                    )}
                    <p className="mt-2 text-xs font-bold text-slate-500">
                      {formatDayRange(challenge.startDate, challenge.endDate)} ·{' '}
                      {timezoneLabel(challenge.timezone)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
