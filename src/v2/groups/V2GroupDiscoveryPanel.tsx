import { useDeferredValue, useState } from 'react';
import { ApiError } from '../../api/apiClient';
import { V2Button, V2EmptyState, V2ErrorState, V2LoadingState, V2TextInput } from '../components/V2Primitives';
import { useJoinGroup, useV2GroupDiscovery } from './useV2Groups';
import type { V2DiscoverableGroup } from '../../api/groupsApi';
import { coverFor, coverGradientFor } from './groupCovers';

export function V2GroupDiscoveryPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const discovery = useV2GroupDiscovery(useDeferredValue(query));
  const groups = discovery.data?.pages.flatMap((page) => page.groups) ?? [];
  return <section aria-label="Discover Groups" className="space-y-3">
    <div><label htmlFor="group-search" className="mb-1 block text-sm font-bold text-slate-800">Search Groups</label><V2TextInput value={query} onChange={setQuery} placeholder="Name, purpose, or focus" maxLength={100} /><p className="mt-1 text-xs text-slate-500">Searches Group names, descriptions, taglines, and focus tags.</p></div>
    {discovery.isLoading && <V2LoadingState label="Finding Groups…" />}
    {discovery.isError && <V2ErrorState title="Discovery is unavailable" message="We could not load Groups. Please try again." onRetry={() => void discovery.refetch()} />}
    {discovery.isSuccess && groups.length === 0 && <V2EmptyState title="No Groups found" message="Try another search, or come back as more Groups become discoverable." />}
    <ul className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2">{groups.map((group) => <DiscoverCard key={group.id} group={group} onOpen={onOpen} />)}</ul>
    {discovery.hasNextPage && <div className="flex justify-center"><V2Button variant="secondary" disabled={discovery.isFetchingNextPage} onClick={() => void discovery.fetchNextPage()}>{discovery.isFetchingNextPage ? 'Loading…' : 'Load more Groups'}</V2Button></div>}
  </section>;
}

function DiscoverCard({ group, onOpen }: { group: V2DiscoverableGroup; onOpen: (id: string) => void }) {
  const join = useJoinGroup(group.id);
  const relation = join.isSuccess ? join.data.status : group.viewerRelationship;
  const isMember = relation === 'active' || relation === 'member' || relation === 'steward';
  const isPending = relation === 'pending';
  const error = join.isError && join.error instanceof ApiError && join.error.status === 503 ? 'Tiizi is unavailable. Please try again.' : 'We could not update your membership.';
  return <li className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <button type="button" className="block w-full text-left" onClick={() => onOpen(group.id)} aria-label={`View ${group.name}`}>
      <span className={`relative block h-24 bg-gradient-to-br ${coverGradientFor(coverFor(group.coverId, group.id))}`}><span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />{group.location && <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white">{group.location}</span>}<span className="absolute bottom-2 left-3 right-3 truncate text-lg font-black text-white">{group.name}</span></span>
    </button>
    <div className="p-4">{(group.tagline || group.description) && <p className="line-clamp-2 text-sm text-slate-600">{group.tagline || group.description}</p>}{group.focusTags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{group.focusTags.slice(0, 4).map((tag) => <span key={tag} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">#{tag}</span>)}</div>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-500">{group.admissionMode === 'approval' ? 'Request to join' : 'Open to join'} · {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}</p>{isMember ? <V2Button variant="secondary" onClick={() => onOpen(group.id)}>Joined · Open</V2Button> : isPending ? <span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Pending</span> : <V2Button disabled={join.isPending} onClick={() => join.mutate()}>{join.isPending ? 'Joining…' : group.admissionMode === 'approval' ? 'Request to Join' : 'Join'}</V2Button>}</div>{join.isError && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  </li>;
}
