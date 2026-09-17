import { useLocation, useNavigate } from 'react-router-dom';
import {
  V2Button,
  V2Card,
  V2EmptyState,
  V2ErrorState,
  V2LoadingState,
  V2Page,
  V2SectionHeader,
} from '../components/V2Primitives';
import { groupRoleLabel } from './groupDraft';
import { useV2Groups } from './useV2Groups';

/**
 * TIIZI S2-G — V2 Groups surface.
 *
 * The member's Groups, bound to the real read (`GET /v1/memberships/me`).
 * This is the minimum Group establishment prerequisite: it lists the Groups
 * the authenticated member actually belongs to and offers Create Group.
 * Discovery, roster, stewards, Charter, Council, moderation and all other
 * Group experience remain deferred to S4.
 *
 * Only member-facing information is shown (name, description, the member's
 * role). Internal identifiers, provider/legacy ids and state codes are never
 * rendered.
 */
export function V2GroupsScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const groups = useV2Groups();
  const memberships = groups.data?.memberships ?? [];
  const createdGroupName = (location.state as { createdGroupName?: string } | null)?.createdGroupName;

  return (
    <V2Page>
      <V2SectionHeader
        eyebrow="Groups"
        title="Your Groups"
        description="Your people, your pace. Groups are the friends, family, or colleagues you move with."
        action={
          memberships.length > 0 ? (
            <V2Button onClick={() => navigate('/v2/groups/new')}>Create Group</V2Button>
          ) : undefined
        }
      />

      {createdGroupName && groups.isSuccess && (
        <p
          role="status"
          className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"
        >
          {createdGroupName} is ready. You are its Accountable Steward.
        </p>
      )}

      {groups.isLoading && <V2LoadingState label="Loading your Groups…" />}

      {groups.isError && (
        <V2ErrorState
          title="We could not load your Groups"
          message="Something went wrong on the way. Please try again."
          onRetry={() => void groups.refetch()}
        />
      )}

      {groups.isSuccess && memberships.length === 0 && (
        <V2EmptyState
          title="You are not in a Group yet"
          message="A Group is where you and your people move together. Create one to start sharing Challenges, or join one you are invited to."
          action={<V2Button onClick={() => navigate('/v2/groups/new')}>Create a Group</V2Button>}
        />
      )}

      {groups.isSuccess && memberships.length > 0 && (
        <ul className="space-y-3">
          {memberships.map((membership) => (
            <li key={membership.groupId}>
              <V2Card>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-slate-900">{membership.group.name}</p>
                    {membership.group.description && (
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {membership.group.description}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                    {groupRoleLabel(membership.role)}
                  </span>
                </div>
              </V2Card>
            </li>
          ))}
        </ul>
      )}
    </V2Page>
  );
}
