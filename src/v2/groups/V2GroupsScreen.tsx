import { useNavigate } from 'react-router-dom';
import {
  V2Button,
  V2EmptyState,
  V2ErrorState,
  V2LoadingState,
  V2Page,
  V2SectionHeader,
} from '../components/V2Primitives';
import { groupRoleLabel } from './groupDraft';
import { groupsViewFor, V2_GROUPS_NEW_PATH } from './groupsView';
import { useV2Groups } from './useV2Groups';

/**
 * TIIZI S4a — V2 Groups surface (evolved from the S2-G prerequisite surface).
 *
 * My Groups: the member's Groups bound to the real read
 * (`GET /v1/memberships/me`), each card navigating into its persisted Group
 * Home (`/v2/groups/:groupId`). Create Group starts the governed creation
 * journey. Discovery, invites, roster, stewards, Charter, Council,
 * moderation and all other Group experience remain later S4 slices —
 * nothing here fabricates them.
 *
 * Only member-facing information is shown (name, description, the member's
 * role). Internal identifiers, provider/legacy ids and state codes are never
 * rendered.
 */
export function V2GroupsScreen() {
  const navigate = useNavigate();
  const groups = useV2Groups();
  const view = groupsViewFor({
    isLoading: groups.isLoading,
    isError: groups.isError,
    isSuccess: groups.isSuccess,
    memberships: groups.data?.memberships,
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
        <ul className="space-y-3">
          {view.memberships.map((membership) => (
            <li key={membership.groupId}>
              <button
                type="button"
                onClick={() => navigate(`/v2/groups/${membership.groupId}`)}
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-slate-300"
                aria-label={`Open ${membership.group.name}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-slate-900">{membership.group.name}</p>
                    {membership.group.description && (
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                        {membership.group.description}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                    {groupRoleLabel(membership.role)}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </V2Page>
  );
}
