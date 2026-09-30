import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { V2Button, V2EmptyState, V2ErrorState, V2LoadingState, V2Page, V2SectionHeader, V2TextInput } from '../components/V2Primitives';
import type { ApiMembership } from '../../api/membershipsApi';
import { coverFor, coverGradientFor } from './groupCovers';
import { stewardBadgeFor } from './groupDraft';
import { groupsViewFor, V2_GROUPS_NEW_PATH } from './groupsView';
import { useV2GroupChallenges, useV2GroupDetail, useV2Groups } from './useV2Groups';
import { V2GroupDiscoveryPanel } from './V2GroupDiscoveryPanel';
import { V2GroupGlobalSearch } from './V2GroupGlobalSearch';

const INITIAL_GROUP_COUNT = 6;

export function V2GroupsScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'mine' | 'discover'>('mine');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllGroups, setShowAllGroups] = useState(false);
  const groups = useV2Groups();
  const memberships = groups.data?.memberships ?? [];
  const view = groupsViewFor({
    isLoading: groups.isLoading,
    isError: groups.isError,
    isSuccess: groups.isSuccess,
    memberships,
  });
  const visibleMemberships = showAllGroups ? memberships : memberships.slice(0, INITIAL_GROUP_COUNT);

  return (
    <V2Page>
      <V2SectionHeader
        eyebrow="Groups"
        title={tab === 'mine' ? 'Your Groups' : 'Discover Groups'}
        description={tab === 'mine'
          ? 'Your people, your pace. Groups are the friends, family, or colleagues you move with.'
          : 'Find an active, discoverable Group that fits what you want to do together.'}
        action={<V2Button onClick={() => navigate(V2_GROUPS_NEW_PATH)}>Create Group</V2Button>}
      />

      <div className="mb-4">
        <label className="mb-1 block text-sm font-bold text-slate-800" htmlFor="groups-global-search">Search all Groups</label>
        <div className="flex items-center gap-2">
          <V2TextInput id="groups-global-search" value={searchQuery} onChange={setSearchQuery} placeholder="Name, purpose, Focus Area, or Goal" maxLength={100} />
          {searchQuery.length > 0 && <button type="button" onClick={() => setSearchQuery('')} className="min-h-11 shrink-0 rounded-lg px-2 text-xs font-bold text-primary" aria-label="Clear Group search">Clear</button>}
        </div>
      </div>

      {searchQuery.trim().length > 0 ? (
        <>
          <nav aria-label="Groups browse modes" className="mb-3 flex justify-end">
            <button type="button" onClick={() => setSearchQuery('')} className="min-h-10 rounded-lg px-2 text-xs font-bold text-primary">Return to {tab === 'mine' ? 'My Groups' : 'Discover'}</button>
          </nav>
          {groups.isLoading && <V2LoadingState label="Searching your Groups…" />}
          {groups.isError && <p role="status" className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Your Groups are unavailable. Search results will include discoverable Groups only.</p>}
          <V2GroupGlobalSearch query={searchQuery} memberships={memberships} onOpen={(id) => navigate(`/v2/groups/${id}`)} />
        </>
      ) : (
        <>
      <nav aria-label="Groups" className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1">
        {([['mine', 'My Groups'], ['discover', 'Discover']] as const).map(([key, label]) => (
          <button key={key} type="button" aria-current={tab === key ? 'page' : undefined} onClick={() => { setTab(key); setShowAllGroups(false); }} className={`min-h-11 rounded-lg px-3 py-2 text-sm font-bold ${tab === key ? 'bg-white text-primary shadow-sm' : 'text-slate-600'}`}>{label}</button>
        ))}
      </nav>

      {tab === 'discover' && <V2GroupDiscoveryPanel onOpen={(id) => navigate(`/v2/groups/${id}`)} />}
      {tab === 'mine' && groups.isLoading && <V2LoadingState label="Loading your Groups…" />}
      {tab === 'mine' && view.kind === 'error' && <V2ErrorState title="We could not load your Groups" message="Something went wrong on the way. Please try again." onRetry={() => void groups.refetch()} />}
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
        <>
          <ul aria-label="Your Groups" className="space-y-2">
            {visibleMemberships.map((membership) => <V2GroupRow key={membership.groupId} membership={membership} onOpen={() => navigate(`/v2/groups/${membership.groupId}`)} />)}
          </ul>
          {memberships.length > INITIAL_GROUP_COUNT && (
            <div className="mt-3 flex justify-center">
              <V2Button variant="secondary" onClick={() => setShowAllGroups((value) => !value)}>
                {showAllGroups ? 'Show fewer Groups' : `View more Groups (${memberships.length - INITIAL_GROUP_COUNT} more)`}
              </V2Button>
            </div>
          )}
        </>
      )}
      {tab === 'mine' && (groups.data?.pendingMemberships?.length ?? 0) > 0 && (
        <section aria-label="Pending Group requests" className="mt-6 space-y-2">
          <h2 className="text-base font-black text-slate-900">Pending requests</h2>
          <ul className="space-y-2">{groups.data!.pendingMemberships!.map((application) => <li key={application.groupId} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3"><div className="min-w-0"><p className="truncate font-bold text-slate-900">{application.group.name}</p><p className="mt-1 text-xs text-amber-800">Waiting for Steward approval</p></div><V2Button variant="secondary" onClick={() => navigate(`/v2/groups/${application.groupId}`)}>Pending</V2Button></li>)}</ul>
        </section>
      )}
        </>
      )}
    </V2Page>
  );
}

function V2GroupRow({ membership, onOpen }: { membership: ApiMembership; onOpen: () => void }) {
  const group = membership.group;
  const coverId = coverFor(group.coverId ?? null, group.id);
  const detail = useV2GroupDetail(group.id);
  const hosted = useV2GroupChallenges(group.id);
  const focusTags = (group.focusTags ?? []).slice(0, 3);
  const activeCount = hosted.data?.challenges.filter((challenge) => challenge.status === 'active').length;
  return (
    <li className="overflow-hidden rounded-xl border border-slate-200 bg-white hover:border-slate-300">
      <button type="button" onClick={onOpen} className="flex w-full min-w-0 items-center gap-3 p-3 text-left sm:gap-4" aria-label={`Open ${group.name}`}>
        <span className={`h-16 w-16 shrink-0 rounded-lg bg-gradient-to-br ${coverGradientFor(coverId)}`} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-black text-slate-900">{group.name}</span>
          <span className="mt-0.5 block text-xs font-semibold text-slate-500">{stewardBadgeFor(membership.role)}</span>
          {focusTags.length > 0 && <span className="mt-1.5 flex flex-wrap gap-1">{focusTags.map((tag) => <span key={tag} className="max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{tag}</span>)}</span>}
          <span className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
            {typeof detail.data?.memberCount === 'number' && <span>{detail.data.memberCount} {detail.data.memberCount === 1 ? 'member' : 'members'}</span>}
            {activeCount !== undefined && <span>{activeCount} active {activeCount === 1 ? 'Challenge' : 'Challenges'}</span>}
          </span>
        </span>
        <span className="shrink-0 text-xs font-bold text-primary">Open</span>
      </button>
    </li>
  );
}
