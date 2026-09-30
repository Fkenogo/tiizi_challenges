import { useDeferredValue, useState } from 'react';
import { ApiError } from '../../api/apiClient';
import { V2Button, V2EmptyState, V2ErrorState, V2LoadingState, V2TextInput } from '../components/V2Primitives';
import { useJoinGroup, useV2GroupDiscovery } from './useV2Groups';
import type { V2DiscoverableGroup } from '../../api/groupsApi';
import { coverFor, coverGradientFor } from './groupCovers';
import { V2GroupInvitePanel } from './V2GroupInvitePanel';

export function V2GroupDiscoveryPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [showInviteCode, setShowInviteCode] = useState(false);
  const discovery = useV2GroupDiscovery(useDeferredValue(query));
  const groups = discovery.data?.pages.flatMap((page) => page.groups) ?? [];
  return <section aria-label="Discover Groups" className="space-y-3">
    <div>
      <label className="mb-1 block text-sm font-bold text-slate-800">Search Groups<V2TextInput value={query} onChange={setQuery} placeholder="Name, purpose, or focus" maxLength={100} /></label>
      <p className="mt-1 text-xs text-slate-500">Searches Group names, descriptions, taglines, focus areas, and goals.</p>
    </div>
    <div>
      <button type="button" aria-expanded={showInviteCode} onClick={() => setShowInviteCode((value) => !value)} className="min-h-10 rounded-lg px-2 text-sm font-bold text-primary hover:bg-orange-50">
        {showInviteCode ? 'Hide invite-code entry' : 'Have an invite code?'}
      </button>
      {showInviteCode && <div className="mt-2"><V2GroupInvitePanel onOpen={onOpen} /></div>}
    </div>
    {discovery.isLoading && <V2LoadingState label="Finding Groups…" />}
    {discovery.isError && <V2ErrorState title="Discovery is unavailable" message="We could not load Groups. Please try again." onRetry={() => void discovery.refetch()} />}
    {discovery.isSuccess && groups.length === 0 && <V2EmptyState title="No Groups found" message="Try another search, or come back as more Groups become discoverable." />}
    <ul aria-label="Discoverable Groups" className="space-y-2">{groups.map((group) => <DiscoverRow key={group.id} group={group} onOpen={onOpen} />)}</ul>
    {discovery.hasNextPage && <div className="flex justify-center"><V2Button variant="secondary" disabled={discovery.isFetchingNextPage} onClick={() => void discovery.fetchNextPage()}>{discovery.isFetchingNextPage ? 'Loading…' : 'View more Groups'}</V2Button></div>}
  </section>;
}

function DiscoverRow({ group, onOpen }: { group: V2DiscoverableGroup; onOpen: (id: string) => void }) {
  const join = useJoinGroup(group.id);
  const relation = join.isSuccess ? join.data.status : group.viewerRelationship;
  const isMember = relation === 'active' || relation === 'member' || relation === 'steward';
  const isPending = relation === 'pending';
  const error = join.isError && join.error instanceof ApiError && join.error.status === 503 ? 'Tiizi is unavailable. Please try again.' : 'We could not update your membership.';
  return <li className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:gap-4">
    <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-4" onClick={() => onOpen(group.id)} aria-label={`View ${group.name}`}>
      <span className={`h-16 w-16 shrink-0 rounded-lg bg-gradient-to-br ${coverGradientFor(coverFor(group.coverId, group.id))}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-black text-slate-900">{group.name}</span>
        <span className="mt-0.5 block truncate text-xs text-slate-600">{group.tagline || group.description || 'Tiizi Group'}</span>
        {group.focusTags.length > 0 && <span className="mt-1.5 flex flex-wrap gap-1">{group.focusTags.slice(0, 3).map((tag) => <span key={tag} className="max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{tag}</span>)}</span>}
        {group.goals.length > 0 && <span className="mt-1 block truncate text-[11px] text-slate-500">Goals: {group.goals.slice(0, 2).join(' · ')}</span>}
        <span className="mt-1 block text-xs text-slate-500">{group.memberCount} {group.memberCount === 1 ? 'member' : 'members'} · {group.admissionMode === 'approval' ? 'Request to join' : 'Open to join'}</span>
      </span>
    </button>
    <div className="shrink-0">
      {isMember ? <V2Button variant="secondary" onClick={() => onOpen(group.id)}>Open</V2Button>
        : isPending ? <span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Pending</span>
          : <V2Button disabled={join.isPending} onClick={() => join.mutate()}>{join.isPending ? 'Joining…' : group.admissionMode === 'approval' ? 'Request' : 'Join'}</V2Button>}
      {join.isError && <p role="alert" className="mt-1 max-w-28 text-[10px] text-red-700">{error}</p>}
    </div>
  </li>;
}
