import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { V2Button, V2Chip, V2EmptyState, V2ErrorState, V2LoadingState, V2Page, V2SectionHeader } from '../components/V2Primitives';
import { useChallengeListV2 } from './useChallengeCreation';
import { useV2ChallengeDiscovery } from './useChallengeDiscovery';
import { createRefreshTracker, flattenDiscoveryPages } from './discoveryRelevance';
import { challengeTypeLabel, formatDayRange } from './challengeCreationDraft';
import { endStateFor, statusLabelForEndState } from './challengeEndState';
import { statusTone } from './challengePresentation';
import type { V2ChallengeSummary } from '../../api/v2ChallengeApi';
import type { V2DiscoverableChallenge } from '../../api/challengeDiscoveryApi';
import { challengeCoverGradient } from './challengeCovers';
import { V2ChallengeIntentBanner } from './V2ChallengeIntentBanner';
import { V2DiscoverChallengeRow } from './V2DiscoverChallengeRow';
import { filterChallengeDiscovery, type ChallengeDomainFilter, type ChallengeLifecycleFilter, type ChallengeTypeFilter } from './challengeDiscovery';
import { findChallenges, myJoinedChallenges } from './challengePageModel';

const INITIAL_RESULTS = 8;

/** Shared with Group Home hosted-Challenge rows. */
export { statusTone };

export function V2ChallengeListScreen() {
  const navigate = useNavigate();
  const ownRead = useChallengeListV2();
  const discovery = useV2ChallengeDiscovery();
  const refreshTracker = useRef(createRefreshTracker());
  const discoveryUpdatedAt = refreshTracker.current.observe(discovery.dataUpdatedAt, discovery.isFetchingNextPage);
  const discoveryRows = flattenDiscoveryPages(discovery.data?.pages);
  const ownRows = ownRead.data?.challenges ?? [];
  const joined = myJoinedChallenges(ownRows);
  const candidates = findChallenges(ownRows, discoveryRows);
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState<ChallengeLifecycleFilter>('all');
  const [type, setType] = useState<ChallengeTypeFilter>('all');
  const [domain, setDomain] = useState<ChallengeDomainFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [myExpanded, setMyExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_RESULTS);
  useEffect(() => setVisibleCount(INITIAL_RESULTS), [search, lifecycle, type, domain]);

  const createAction = (
    <div className="flex flex-col items-end gap-1">
      <V2Button onClick={() => navigate('/v2/challenges/new')}>Create Challenge</V2Button>
      <button
        type="button"
        onClick={() => navigate('/v2/guide')}
        className="text-[11px] font-bold text-slate-500 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-slate-900"
      >
        View Activity Guide
      </button>
    </div>
  );

  const filtered = filterChallengeDiscovery(candidates, { search, lifecycle, type, domain });
  const visible = filtered.slice(0, visibleCount);
  const filterCount = Number(lifecycle !== 'all') + Number(type !== 'all') + Number(domain !== 'all');
  const visibleJoined = myExpanded ? joined : joined.slice(0, 2);
  const remainingJoined = Math.max(0, joined.length - 2);
  const clearFilters = () => { setLifecycle('all'); setType('all'); setDomain('all'); };
  const activeFilters: Array<{ label: string; value: string; clear: () => void }> = [];
  if (lifecycle !== 'all') activeFilters.push({ label: 'Status', value: ({ active: 'Active / Ongoing', upcoming: 'Scheduled / Upcoming', completed: 'Completed' } as const)[lifecycle], clear: () => setLifecycle('all') });
  if (type !== 'all') activeFilters.push({ label: 'Challenge Type', value: ({ collective: 'Together', competitive: 'Race', streak: 'Streak' } as const)[type], clear: () => setType('all') });
  if (domain !== 'all') activeFilters.push({ label: 'Domain', value: domain === 'fitness' ? 'Fitness' : 'Wellness', clear: () => setDomain('all') });

  return (
    <V2Page wide>
      <V2SectionHeader
        eyebrow="Challenges"
        title="Challenges"
        description="Move together or race each other. Every Challenge belongs to a Group you are part of."
        action={createAction}
      />

      <section aria-label="Challenge search and filters" className="sticky top-14 z-20 -mx-4 mb-4 border-y border-slate-200 bg-slate-50/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <label htmlFor="challenge-search" className="sr-only">Search Challenges</label>
            <input id="challenge-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Challenges…" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm text-slate-900 outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30" />
            {search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-sm font-bold text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Clear</button>}
          </div>
          <button type="button" aria-label={filterCount ? `Filters, ${filterCount} active` : 'Filters'} aria-expanded={filtersOpen} aria-controls="challenge-filter-panel" onClick={() => setFiltersOpen(true)} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <span>Filters</span>{filterCount > 0 && <span aria-hidden="true" className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] text-white">{filterCount}</span>}
          </button>
        </div>
        {filtersOpen && <div id="challenge-filter-panel" role="region" aria-label="Challenge filters" className="mt-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="space-y-3">
            <FilterRow label="Status" value={lifecycle} onChange={setLifecycle} options={[
              ['all', 'All'], ['active', 'Active / Ongoing'], ['upcoming', 'Scheduled / Upcoming'], ['completed', 'Completed'],
            ]} />
            <FilterRow label="Challenge Type" value={type} onChange={setType} options={[
              ['all', 'All'], ['collective', 'Together'], ['competitive', 'Race'], ['streak', 'Streak'],
            ]} />
            <FilterRow label="Domain" value={domain} onChange={setDomain} options={[
              ['all', 'All'], ['fitness', 'Fitness'], ['wellness', 'Wellness'],
            ]} />
          </div>
          <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={clearFilters} disabled={!filterCount} className="min-h-10 rounded-lg px-3 text-sm font-bold text-slate-600 underline underline-offset-2 hover:text-slate-900 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Clear All</button>
            <V2Button className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" onClick={() => setFiltersOpen(false)}>Done</V2Button>
          </div>
        </div>}
        {activeFilters.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Applied filters">
          {activeFilters.map((filter) => <span key={filter.label} className="inline-flex items-center gap-1 rounded-full bg-orange-50 py-1 pl-2.5 pr-1 text-xs font-bold text-slate-700">
            {filter.label}: {filter.value}<button type="button" aria-label={`Remove ${filter.label} filter: ${filter.value}`} onClick={filter.clear} className="flex h-6 w-6 items-center justify-center rounded-full text-slate-600 hover:bg-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">×</button>
          </span>)}
          {!filtersOpen && <button type="button" onClick={clearFilters} className="min-h-8 rounded-lg px-2 text-xs font-bold text-slate-500 underline underline-offset-2 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Clear All</button>}
        </div>}
      </section>

      <V2ChallengeIntentBanner ownChallenges={ownRows} />

      <section aria-label="My Challenges" className="mt-5 space-y-3">
        <h2 className="text-base font-black text-slate-900">My Challenges</h2>
        {ownRead.isLoading && <V2LoadingState label="Loading your Challenges…" />}
        {ownRead.isError && <V2ErrorState
          title="We could not load your Challenges"
          message="Please try again. If this keeps happening, check your connection and try once more."
          onRetry={() => void ownRead.refetch()}
        />}
        {ownRead.isSuccess && joined.length === 0 && <V2EmptyState
          compact
          title="You have not joined a Challenge yet"
          message="Find a Challenge below, or start one with a Group you belong to."
        />}
        {joined.length > 0 && <>
          <ul className="space-y-2">
            {visibleJoined.map((challenge) => <MyChallengeRow key={challenge.challengeId} challenge={challenge} />)}
          </ul>
          {remainingJoined > 0 && <button type="button" aria-expanded={myExpanded} onClick={() => setMyExpanded((expanded) => !expanded)} className="min-h-10 rounded-lg px-2 text-sm font-bold text-primary underline underline-offset-2 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            {myExpanded ? 'Show Less' : `View More (${remainingJoined})`}
          </button>}
        </>}
      </section>

      <section aria-label="Find Challenges" className="mt-6 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <div>
          <h2 className="text-base font-black text-slate-900">Find Challenges</h2>
          <p className="mt-0.5 text-xs text-slate-500">Search Challenges in your Groups and Groups open to discovery.</p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-slate-500" aria-live="polite">{filtered.length} found</span>
        </div>
        {discovery.isError && !discovery.isFetchNextPageError && <V2ErrorState
          title="Challenge discovery is unavailable"
          message="We could not load more Challenges to find. Your joined Challenges above are not affected."
          onRetry={() => void discovery.refetch()}
        />}
        {ownRead.isSuccess && discovery.isSuccess && filtered.length === 0 && <V2EmptyState title="No matching Challenges" message="Try another search or change a filter." action={<V2Button variant="secondary" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" onClick={() => { setSearch(''); clearFilters(); }}>Clear search and filters</V2Button>} />}
        {visible.length > 0 && <ul aria-label="Challenge results" className="space-y-2">
          {visible.map((challenge) => isDiscoverable(challenge)
            ? <V2DiscoverChallengeRow key={challenge.challengeId} challenge={challenge} discoveryUpdatedAt={discoveryUpdatedAt} />
            : <FindChallengeRow key={challenge.challengeId} challenge={challenge} />)}
        </ul>}
        {filtered.length > visible.length && <div className="flex justify-center"><V2Button variant="secondary" onClick={() => setVisibleCount((count) => count + INITIAL_RESULTS)}>View more Challenges</V2Button></div>}
        {discovery.isFetchNextPageError && <V2ErrorState title="We could not load more Challenges" message="Please try again." onRetry={() => void discovery.fetchNextPage()} />}
        {discovery.hasNextPage && !discovery.isFetchNextPageError && <div className="flex justify-center pt-1">
          <V2Button variant="secondary" className="min-h-11" disabled={discovery.isFetchingNextPage} onClick={() => void discovery.fetchNextPage()}>
            {discovery.isFetchingNextPage ? 'Loading…' : 'Load more Challenges'}
          </V2Button>
        </div>}
        {ownRead.isSuccess && discovery.isSuccess && candidates.length === 0 && <V2EmptyState title="No Challenges to find yet" message="When your Groups or Groups open to discovery host Challenges, they will appear here." />}
      </section>
    </V2Page>
  );
}

function isDiscoverable(challenge: V2ChallengeSummary): challenge is V2DiscoverableChallenge {
  return 'host' in challenge;
}

function MyChallengeRow({ challenge }: { challenge: V2ChallengeSummary }) {
  const navigate = useNavigate();
  const endState = endStateFor(challenge);
  const canLog = challenge.status === 'active' && endState === 'live' && challenge.activities.length > 0;
  const progress = challenge.myParticipation?.progress;
  const progressText = progress
    ? `${progress.logsAccepted} activities logged · ${progress.totalPoints} points${challenge.challengeType === 'streak' ? ` · ${progress.currentStreak}-day streak` : ''}`
    : 'Progress is not available yet.';
  return <li className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4" data-my-challenge={challenge.challengeId}>
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-primary">{challengeTypeLabel(challenge.challengeType)}</span>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone(endState)}`}>{statusLabelForEndState(challenge.status, endState)}</span>
    </div>
    <h3 className="mt-1 text-sm font-black text-slate-900">{challenge.title}</h3>
    <p className="mt-0.5 text-xs text-slate-500">{challenge.groupName ?? 'Group Challenge'} · {formatDayRange(challenge.startDate, challenge.endDate)}</p>
    <p className="mt-1 text-xs font-semibold text-slate-600" aria-label="Challenge progress">{progressText}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      {canLog && <V2Button onClick={() => navigate(`/v2/challenges/${challenge.challengeId}`, { state: { openLogActivity: true } })}>Log Activity</V2Button>}
      <V2Button variant="secondary" onClick={() => navigate(`/v2/challenges/${challenge.challengeId}`)}>View Challenge</V2Button>
    </div>
  </li>;
}

function FindChallengeRow({ challenge }: { challenge: V2ChallengeSummary }) {
  const navigate = useNavigate();
  const endState = endStateFor(challenge);
  return <li className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4" data-find-challenge={challenge.challengeId}>
    <div className="flex items-center gap-3">
      <span className={`h-14 w-14 shrink-0 rounded-xl bg-gradient-to-br ${challengeCoverGradient(challenge.coverId)} ${challenge.coverId ? '' : 'flex items-center justify-center text-xs font-black uppercase text-white/80'}`} aria-hidden="true">{challenge.coverId ? '' : challengeTypeLabel(challenge.challengeType).slice(0, 1)}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-primary">{challengeTypeLabel(challenge.challengeType)}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone(endState)}`}>{statusLabelForEndState(challenge.status, endState)}</span>
        </div>
        <h3 className="mt-1 truncate text-sm font-black text-slate-900">{challenge.title}</h3>
        <p className="mt-0.5 truncate text-xs text-slate-500">{challenge.groupName ?? 'Group Challenge'} · {challenge.activities.map((activity) => `${activity.name} · ${activity.domain === 'wellness' ? 'Wellness' : 'Fitness'}`).join(' / ')}</p>
        <p className="mt-0.5 text-xs font-semibold text-slate-500">{formatDayRange(challenge.startDate, challenge.endDate)}</p>
      </div>
    </div>
    <div className="mt-3"><V2Button variant="secondary" onClick={() => navigate(`/v2/challenges/${challenge.challengeId}`)}>View Challenge</V2Button></div>
  </li>;
}

function FilterRow<T extends string>({ label, value, onChange, options }: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<readonly [T, string]>;
}) {
  return <div role="group" aria-label={label} className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
    <span className="w-28 shrink-0 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{label}</span>
    <div className="flex flex-wrap gap-1.5">{options.map(([key, text]) => <V2Chip key={key} selected={value === key} onClick={() => onChange(key)} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">{text}</V2Chip>)}</div>
  </div>;
}
