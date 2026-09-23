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
        title="Your Groups"
        description="Your people, your pace. Groups are the friends, family, or colleagues you move with."
        action={
          memberships.length > 0 ? (
            <V2Button onClick={() => navigate(V2_GROUPS_NEW_PATH)}>Create Group</V2Button>
          ) : undefined
        }
      />

      {groups.isLoading && <V2LoadingState label="Loading your Groups…" />}

      {view.kind === 'error' && (
        <V2ErrorState
          title="We could not load your Groups"
          message="Something went wrong on the way. Please try again."
          onRetry={() => void groups.refetch()}
        />
      )}

      {view.kind === 'empty' && (
        <V2EmptyState
          title="You are not in a Group yet"
          message="A Group is where you and your people move together. Create one to start sharing Challenges, or join one you are invited to."
          action={<V2Button onClick={() => navigate(V2_GROUPS_NEW_PATH)}>Create a Group</V2Button>}
        />
      )}

      {view.kind === 'list' && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {view.memberships.map((membership) => (
            <V2GroupCard
              key={membership.groupId}
              membership={membership}
              onOpen={() => navigate(`/v2/groups/${membership.groupId}`)}
            />
          ))}
        </ul>
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
