import { useEffect, useState } from 'react';
import { useV2GroupDiscovery } from './useV2Groups';
import type { ApiMembership } from '../../api/membershipsApi';
import type { V2DiscoverableGroup, V2ViewerRelationship } from '../../api/groupsApi';
import { V2Button, V2ErrorState, V2LoadingState } from '../components/V2Primitives';
import { coverFor, coverGradientFor } from './groupCovers';
import { stewardBadgeFor } from './groupDraft';

type GroupSearchResult = {
  id: string;
  name: string;
  description: string;
  tagline: string;
  coverId: string | null;
  focusTags: string[];
  goals: string[];
  memberCount?: number;
  relationship: string;
};

const INITIAL_RESULT_COUNT = 12;

function matchesQuery(group: GroupSearchResult, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return false;
  return [group.name, group.description, group.tagline, ...group.focusTags, ...group.goals]
    .some((field) => field.toLocaleLowerCase().includes(needle));
}

function membershipResult(membership: ApiMembership): GroupSearchResult {
  const group = membership.group;
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    tagline: group.tagline ?? '',
    coverId: group.coverId ?? null,
    focusTags: group.focusTags ?? [],
    goals: group.goals ?? [],
    relationship: stewardBadgeFor(membership.role),
  };
}

function discoverableResult(group: V2DiscoverableGroup): GroupSearchResult {
  const relationship: Record<V2ViewerRelationship, string> = {
    steward: 'Accountable Steward',
    member: 'Member',
    pending: 'Pending',
    none: 'Discoverable · Not joined',
  };
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    tagline: group.tagline,
    coverId: group.coverId,
    focusTags: group.focusTags,
    goals: group.goals,
    memberCount: group.memberCount,
    relationship: relationship[group.viewerRelationship],
  };
}

export function V2GroupGlobalSearch({
  query,
  memberships,
  onOpen,
}: {
  query: string;
  memberships: ApiMembership[];
  onOpen: (groupId: string) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_RESULT_COUNT);
  useEffect(() => setVisibleCount(INITIAL_RESULT_COUNT), [query]);
  const discovery = useV2GroupDiscovery(query);
  const memberResults = memberships
    .map(membershipResult)
    .filter((group) => matchesQuery(group, query));
  const memberIds = new Set(memberResults.map((group) => group.id));
  // The server discovery contract returns only active, discoverable Groups;
  // private Groups are never added from this search source.
  const discoverableResults = (discovery.data?.pages.flatMap((page) => page.groups) ?? [])
    .map(discoverableResult)
    .filter((group) => !memberIds.has(group.id));
  const results = [...memberResults, ...discoverableResults];
  const canRevealLoaded = results.length > visibleCount;

  return (
    <section aria-label="Group search results" className="space-y-3">
      {discovery.isLoading && <V2LoadingState label="Searching Groups…" />}
      {discovery.isError && results.length === 0 && (
        <V2ErrorState
          title="Group search is unavailable"
          message="We could not search discoverable Groups. Please try again."
          onRetry={() => void discovery.refetch()}
        />
      )}
      {discovery.isError && results.length > 0 && (
        <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Showing Groups you belong to. Discoverable Group search is temporarily unavailable.
        </p>
      )}
      {!discovery.isLoading && !discovery.isError && results.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600">
          No Groups found. Try another name, Focus Area, or Goal.
        </p>
      )}
      <ul aria-label="Matching Groups" className="space-y-2">
        {results.slice(0, visibleCount).map((group) => (
          <li key={group.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white hover:border-slate-300">
            <button
              type="button"
              onClick={() => onOpen(group.id)}
              className="flex w-full min-w-0 items-center gap-3 p-3 text-left sm:gap-4"
              aria-label={`Open ${group.name}, ${group.relationship}`}
            >
              <span className={`h-12 w-12 shrink-0 rounded-lg bg-gradient-to-br ${coverGradientFor(coverFor(group.coverId, group.id))}`} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-slate-900">{group.name}</span>
                <span className="mt-0.5 block text-xs font-bold text-slate-600">{group.relationship}</span>
                {group.focusTags.length > 0 && <span className="mt-1 block truncate text-[11px] text-slate-500">{group.focusTags.slice(0, 2).join(' · ')}</span>}
                {group.goals.length > 0 && <span className="mt-0.5 block truncate text-[11px] text-slate-500">Goals: {group.goals.slice(0, 2).join(' · ')}</span>}
              </span>
              {typeof group.memberCount === 'number' && <span className="hidden shrink-0 text-xs text-slate-500 sm:inline">{group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}</span>}
              <span className="shrink-0 text-xs font-bold text-primary">Open</span>
            </button>
          </li>
        ))}
      </ul>
      {(canRevealLoaded || discovery.hasNextPage) && <div className="flex justify-center"><V2Button variant="secondary" disabled={discovery.isFetchingNextPage} onClick={() => { if (canRevealLoaded) setVisibleCount((current) => current + INITIAL_RESULT_COUNT); else void discovery.fetchNextPage(); }}>{discovery.isFetchingNextPage ? 'Loading…' : 'View more results'}</V2Button></div>}
    </section>
  );
}
