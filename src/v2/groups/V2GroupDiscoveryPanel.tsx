import { useState } from 'react';
import { ApiError } from '../../api/apiClient';
import { V2Button, V2Chip, V2EmptyState, V2ErrorState, V2LoadingState } from '../components/V2Primitives';
import { Link } from 'react-router-dom';
import { discoveryCaption, relevanceBadges } from '../challenges/discoveryRelevance';
import { useJoinGroup, useV2GroupDiscovery } from './useV2Groups';
import type { V2DiscoverableGroup } from '../../api/groupsApi';
import { V2GroupInvitePanel } from './V2GroupInvitePanel';
import { V2GroupPhotoCard } from './V2GroupPhotoCard';

export function V2GroupDiscoveryPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [ordering, setOrdering] = useState<'relevance' | 'general'>('relevance');
  const discovery = useV2GroupDiscovery('', ordering);
  const groups = discovery.data?.pages.flatMap((page) => page.groups) ?? [];
  const caption = discovery.isSuccess
    ? discoveryCaption(ordering, discovery.data.pages[0]?.ranking?.applied, groups, 'Groups')
    : null;
  return <section aria-label="Discover Groups" className="space-y-3">
    <div>
      <button type="button" aria-expanded={showInviteCode} onClick={() => setShowInviteCode((value) => !value)} className="min-h-10 rounded-lg px-2 text-sm font-bold text-primary hover:bg-orange-50">
        {showInviteCode ? 'Hide invite-code entry' : 'Have an invite code?'}
      </button>
      {showInviteCode && <div className="mt-2"><V2GroupInvitePanel onOpen={onOpen} /></div>}
    </div>
    <div role="group" aria-label="Order Groups" className="flex flex-wrap gap-1.5">
      <V2Chip selected={ordering === 'relevance'} onClick={() => setOrdering('relevance')}>Relevant to me</V2Chip>
      <V2Chip selected={ordering === 'general'} onClick={() => setOrdering('general')}>Browse all</V2Chip>
    </div>
    {caption && <p role="status" data-discovery-caption={caption.kind} className="text-xs text-slate-600">
      {caption.text}{caption.kind === 'no-preferences' && <> <Link to={{ pathname: '/v2/preferences', search: '?category=both&next=%2Fv2%2Fgroups%3Ftab%3Ddiscover' }} className="font-bold text-primary underline">Choose interests and goals</Link></>}
    </p>}
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
  const relationship = isMember ? (relation === 'steward' ? 'Accountable Steward' : 'Member') : isPending ? 'Request pending' : group.admissionMode === 'approval' ? 'Approval to join' : 'Open to join';
  return <V2GroupPhotoCard
    groupId={group.id}
    name={group.name}
    coverId={group.coverId}
    location={group.location}
    description={group.tagline || group.description}
    status={relationship}
    tags={group.focusTags}
    goals={group.goals}
    context={relevanceBadges(group.relevance)}
    memberCount={group.memberCount}
    onOpen={() => onOpen(group.id)}
    actionError={join.isError ? error : null}
    action={isMember ? <V2Button variant="secondary" onClick={() => onOpen(group.id)}>Enter Hub →</V2Button>
      : isPending ? <span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Pending</span>
        : <V2Button disabled={join.isPending} onClick={() => join.mutate()}>{join.isPending ? 'Joining…' : group.admissionMode === 'approval' ? 'Request to join' : 'Join Group'}</V2Button>}
  />;
}
