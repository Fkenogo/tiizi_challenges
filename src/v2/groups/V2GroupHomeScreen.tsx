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
import { coverFor, coverGradientFor } from './groupCovers';
import { stewardBadgeFor } from './groupDraft';
import { groupHomeErrorStatus, groupHomeViewFor, viewerMayCreateChallenge } from './groupHomeView';
import { useJoinGroup, useV2GroupChallenges, useV2GroupDetail, useV2Groups } from './useV2Groups';
import { V2HostedChallengeCard } from './V2HostedChallengeCard';

/**
 * TIIZI S4a CORR-001 — Group Home (`/v2/groups/:groupId`).
 *
 * Assembled as a member experience, not an administration record. The Home
 * answers first: what community is this (hero: cover, name, tagline,
 * location, count, relationship, steward, contextual CTA), who is here and
 * what is happening (hosted Challenges with S3-bound snapshots), what can
 * I do (Launch/Join/Log affordances). Configuration lives in the secondary
 * About surface — a regular member never lands on a settings-dominated page.
 *
 * Bound to the canonical read (`GET /v1/groups/:groupId`) plus the governed
 * hosted-Challenge scope (`GET /v1/challenges?groupId=`). Reference
 * composition (GroupDetailView hero + tabs spirit) without prototype
 * semantics: singular steward, no Feed, no Leaderboard, no plural Admins,
 * no presence, no media fabrication, no invented social behaviour.
 * Internal identifiers, provider ids, raw backend field names and state
 * codes are never rendered.
 */

function relationshipBadge(detail: V2GroupDetail): { text: string; className: string } {
  switch (detail.viewerRelationship) {
    case 'steward':
      return { text: 'Accountable Steward · you', className: 'bg-orange-50 text-primary' };
    case 'member':
      return {
        text: stewardBadgeFor(detail.viewerMembership?.role ?? 'member'),
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
  const coverId = coverFor(detail.coverId, detail.id);
  const tagline = detail.tagline.trim() || detail.description;
  const focusTags = detail.focusTags.slice(0, 4);
  const norms = detail.rules ?? [];
  const memberships = useV2Groups();
  const viewerMemberId = memberships.data?.memberId ?? null;
  const viewerIsGroupMember =
    detail.viewerRelationship === 'member' || detail.viewerRelationship === 'steward';

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

      {/* Hero: what community is this, who is here, what can I do. */}
      <section aria-label="Group overview" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className={`relative h-40 bg-gradient-to-br sm:h-52 ${coverGradientFor(coverId)}`}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          {detail.location.trim() && (
            <span className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold text-white">
              {detail.location.trim()}
            </span>
          )}
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">
              Tiizi Community
            </p>
            <h1 className="mt-0.5 text-2xl font-black tracking-tight sm:text-3xl">{detail.name}</h1>
            {tagline && <p className="mt-1 max-w-2xl text-sm font-medium text-white/90">“{tagline}”</p>}
          </div>
        </div>
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${badge.className}`}>
              {badge.text}
            </span>
            {typeof detail.memberCount === 'number' && (
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                {detail.memberCount} {detail.memberCount === 1 ? 'member' : 'members'}
              </span>
            )}
            <span className="text-xs text-slate-500">
              <span className="font-bold text-slate-700">Accountable Steward</span>
              {detail.viewerRelationship === 'steward' ? ' — that’s you.' : ' keeps this Group running.'}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {detail.viewerRelationship === 'none' && !detail.isPrivate && <JoinCta groupId={detail.id} />}
            {canCreate && (
              <V2Button onClick={onCreateChallenge}>Launch Challenge</V2Button>
            )}
          </div>
        </div>
        <p className="border-b border-amber-200/60 bg-amber-50/70 px-4 py-2 text-xs leading-5 text-amber-950">
          <strong>Good to know:</strong> being in {detail.name} doesn’t automatically join you
          to its Challenges — you choose which ones to join.
        </p>
      </section>

      {detail.viewerRelationship === 'pending' && (
        <V2Card>
          <p className="text-sm font-bold text-slate-800">Your request to join is pending approval.</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            The steward will review it. You will see the full Group once approved.
          </p>
        </V2Card>
      )}

      {/* Hosted Challenges: what is happening here. */}
      <section aria-label="Hosted Challenges">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-base font-black text-slate-900">
            Hosted Challenges{challenges.length > 0 ? ` (${challenges.length})` : ''}
          </h2>
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
                ? `Host the first Challenge for ${detail.name}. Members join explicitly — never automatically.`
                : `When ${detail.name} hosts Challenges, they will appear here, hosted by this Group.`
            }
            action={
              canCreate ? <V2Button onClick={onCreateChallenge}>Create the first Challenge</V2Button> : undefined
            }
          />
        )}

        {hostedState.isSuccess && challenges.length > 0 && (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {challenges.map((challenge) => (
              <V2HostedChallengeCard
                key={challenge.challengeId}
                challenge={challenge}
                groupName={detail.name}
                viewerMemberId={viewerMemberId}
                viewerIsGroupMember={viewerIsGroupMember}
                onOpen={onOpenChallenge}
              />
            ))}
          </ul>
        )}
      </section>

      {/* About: purpose, norms, stewardship, configuration (secondary). */}
      <section aria-label="About this Group">
        <V2Card>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            About this Group
          </p>
          {detail.description && (
            <div className="mt-2">
              <h3 className="text-sm font-black text-slate-900">Community purpose</h3>
              <p className="mt-0.5 text-sm leading-6 text-slate-600">{detail.description}</p>
            </div>
          )}
          {focusTags.length > 0 && (
            <div className="mt-3">
              <h3 className="text-sm font-black text-slate-900">Focus</h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {focusTags.map((tag) => (
                  <span key={tag} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          {norms.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <h3 className="text-sm font-black text-slate-900">Community norms</h3>
              <ul className="mt-1.5 space-y-1.5">
                {norms.map((rule, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm leading-6 text-slate-600">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-3 border-t border-slate-100 pt-3">
            <h3 className="text-sm font-black text-slate-900">Stewardship</h3>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">
              One Accountable Steward keeps this Group running
              {detail.viewerRelationship === 'steward' ? ' — that’s you.' : '.'} This Group
              operates under Tiizi Platform governance.
            </p>
          </div>
          {settings.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <h3 className="text-sm font-black text-slate-900">Group setup</h3>
              <dl className="mt-2 space-y-2.5">
                {settings.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-3">
                    <div>
                      <dt className="text-xs font-black text-slate-800">{row.label}</dt>
                      <dd className="text-[11px] leading-4 text-slate-500">{row.hint}</dd>
                    </div>
                    <dd className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </V2Card>
      </section>
    </div>
  );
}
