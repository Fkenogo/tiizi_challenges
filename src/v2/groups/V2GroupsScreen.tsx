import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  V2Button,
  V2EmptyState,
  V2ErrorState,
  V2LoadingState,
  V2Page,
  V2SectionHeader,
} from '../components/V2Primitives';
import type { ApiMembership } from '../../api/membershipsApi';
import { coverFor, coverGradientFor } from './groupCovers';
import { stewardBadgeFor } from './groupDraft';
import { groupsViewFor, V2_GROUPS_NEW_PATH } from './groupsView';
import { useV2GroupChallenges, useV2GroupDetail, useV2Groups } from './useV2Groups';
import { V2GroupDiscoveryPanel } from './V2GroupDiscoveryPanel';
import { V2GroupInvitePanel } from './V2GroupInvitePanel';

/**
 * TIIZI S4a CORR-001 — V2 Groups surface (My Groups).
 *
 * Group cards let a member understand each community quickly, composed
 * strictly from canonical truth: cover (catalogue or deterministic
 * fallback), name, location context, tagline (description when no tagline),
 * focus chips, viewer relationship, live member count and active
 * hosted-Challenge count from the governed reads (shared cache families
 * with Group Home — loading reads show no count rather than a fabricated
 * zero), and a clear entry affordance.
 *
 * Discovery, search, invites, roster, stewards, Charter, Council,
 * moderation and all other Group experience remain later S4 slices —
 * nothing here fabricates them. Internal identifiers, provider/legacy ids
 * and state codes are never rendered.
 */
export function V2GroupsScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'mine' | 'discover' | 'code'>('mine');
  const groups = useV2Groups();
  const view = groupsViewFor({
    isLoading: groups.isLoading,
    isError: groups.isError,
    isSuccess: groups.isSuccess,
    memberships: groups.data?.memberships ?? [],
  });
  const memberships = groups.data?.memberships ?? [];

  return (
    <V2Page>
      <V2SectionHeader
        eyebrow="Groups"
        title={tab === 'mine' ? 'Your Groups' : tab === 'discover' ? 'Discover Groups' : 'Join with code'}
        description={tab === 'mine'
          ? 'Your people, your pace. Groups are the friends, family, or colleagues you move with.'
          : tab === 'discover'
            ? 'Find an active, discoverable Group that fits what you want to do together.'
            : 'Preview a Group from its shared invite code, then choose whether to join.'}
        action={
          memberships.length > 0 ? (
            <V2Button onClick={() => navigate(V2_GROUPS_NEW_PATH)}>Create Group</V2Button>
          ) : undefined
        }
      />

      <nav aria-label="Groups" className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-slate-200/70 p-1">
        {([['mine', 'My Groups'], ['discover', 'Discover'], ['code', 'Join with code']] as const).map(([key, label]) => (
          <button key={key} type="button" aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)} className={`min-h-11 rounded-lg px-2 py-2 text-xs font-bold sm:text-sm ${tab === key ? 'bg-white text-primary shadow-sm' : 'text-slate-600'}`}>{label}</button>
        ))}
      </nav>

      {tab === 'discover' && <V2GroupDiscoveryPanel onOpen={(id) => navigate(`/v2/groups/${id}`)} />}
      {tab === 'code' && <V2GroupInvitePanel onOpen={(id) => navigate(`/v2/groups/${id}`)} />}

      {tab === 'mine' && groups.isLoading && <V2LoadingState label="Loading your Groups…" />}

      {tab === 'mine' && view.kind === 'error' && (
        <V2ErrorState
          title="We could not load your Groups"
          message="Something went wrong on the way. Please try again."
          onRetry={() => void groups.refetch()}
        />
      )}

      {tab === 'mine' && view.kind === 'empty' && (
        <V2EmptyState
          title={groups.data?.pendingMemberships?.length ? 'Your requests are being reviewed' : 'You are not in a Group yet'}
          message={groups.data?.pendingMemberships?.length
            ? 'Your pending Group requests will appear below. The Accountable Steward will review each one.'
            : 'A Group is where you and your people move together. Create one to start sharing Challenges, or discover a Group to join.'}
          action={<V2Button onClick={() => navigate(V2_GROUPS_NEW_PATH)}>Create a Group</V2Button>}
        />
      )}

      {tab === 'mine' && view.kind === 'list' && (
        <ul className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2">
          {view.memberships.map((membership) => (
            <V2GroupCard
              key={membership.groupId}
              membership={membership}
              onOpen={() => navigate(`/v2/groups/${membership.groupId}`)}
            />
          ))}
        </ul>
      )}

      {tab === 'mine' && (groups.data?.pendingMemberships?.length ?? 0) > 0 && (
        <section aria-label="Pending Group requests" className="mt-6 space-y-2">
          <h2 className="text-base font-black text-slate-900">Pending requests</h2>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">{groups.data!.pendingMemberships!.map((application) => <li key={application.groupId} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4"><div className="min-w-0"><p className="truncate font-bold text-slate-900">{application.group.name}</p><p className="mt-1 text-xs text-amber-800">Waiting for Steward approval</p></div><V2Button variant="secondary" onClick={() => navigate(`/v2/groups/${application.groupId}`)}>Pending</V2Button></li>)}</ul>
        </section>
      )}
    </V2Page>
  );
}

function V2GroupCard({ membership, onOpen }: { membership: ApiMembership; onOpen: () => void }) {
  const group = membership.group;
  const coverId = coverFor(group.coverId ?? null, group.id);
  const tagline = group.tagline?.trim() || group.description;
  const focusTags = (group.focusTags ?? []).slice(0, 3);
  const isSteward = membership.role.trim().toLowerCase() === 'owner';
  // Governed reads (cached per Group, shared with Group Home): live member
  // count from the canonical detail, active Challenge count from the
  // governed group scope. Loading or failed reads show no count rather
  // than a fabricated zero.
  const detail = useV2GroupDetail(group.id);
  const hosted = useV2GroupChallenges(group.id);
  const memberCount =
    typeof detail.data?.memberCount === 'number' ? detail.data.memberCount : null;
  const activeCount = hosted.data
    ? hosted.data.challenges.filter((challenge) => challenge.status === 'active').length
    : null;

  return (
    <li className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors hover:border-slate-300">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left"
        aria-label={`Open ${group.name}`}
      >
        <span className={`relative block h-28 w-full bg-gradient-to-br ${coverGradientFor(coverId)}`}>
          <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
          {group.location?.trim() && (
            <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white">
              {group.location.trim()}
            </span>
          )}
          {isSteward && (
            <span className="absolute right-3 top-3 rounded-md bg-amber-200/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900">
              Steward
            </span>
          )}
          <span className="absolute bottom-2.5 left-3 right-3 truncate text-base font-black tracking-tight text-white">
            {group.name}
          </span>
        </span>
        <span className="block p-4">
          {tagline && (
            <span className="block truncate text-sm text-slate-600">“{tagline}”</span>
          )}
          {focusTags.length > 0 && (
            <span className="mt-2 flex flex-wrap gap-1.5">
              {focusTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600"
                >
                  #{tag}
                </span>
              ))}
            </span>
          )}
          <span className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
            <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 font-bold text-slate-500">
              <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] uppercase tracking-wide text-primary">
                {stewardBadgeFor(membership.role)}
              </span>
              {memberCount !== null && (
                <span className="tabular-nums">
                  {memberCount} {memberCount === 1 ? 'member' : 'members'}
                </span>
              )}
              {activeCount !== null && (
                <span className="tabular-nums">
                  {activeCount} {activeCount === 1 ? 'active Challenge' : 'active Challenges'}
                </span>
              )}
            </span>
            <span className="font-bold text-primary">Enter →</span>
          </span>
        </span>
      </button>
    </li>
  );
}
