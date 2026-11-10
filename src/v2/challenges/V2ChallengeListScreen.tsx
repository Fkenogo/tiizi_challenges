import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { V2Button, V2EmptyState, V2ErrorState, V2LoadingState, V2Page, V2SectionHeader } from '../components/V2Primitives';
import { useChallengeListV2 } from './useChallengeCreation';
import { useV2ChallengeDiscovery } from './useChallengeDiscovery';
import { createRefreshTracker, flattenDiscoveryPages } from './discoveryRelevance';
import { formatDayRange } from './challengeCreationDraft';
import { endStateFor, statusLabelForEndState } from './challengeEndState';
import { statusTone } from './challengePresentation';
import type { V2ChallengeSummary } from '../../api/v2ChallengeApi';
import type { V2DiscoverableChallenge } from '../../api/challengeDiscoveryApi';
import { V2ChallengeIntentBanner } from './V2ChallengeIntentBanner';
import { V2DiscoverChallengeRow } from './V2DiscoverChallengeRow';
import { FindChallengeProgress, MyChallengeProgress, V2ChallengeCard } from './V2ChallengeCard';
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
  const [openMenu, setOpenMenu] = useState<'status' | 'type' | 'domain' | null>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const [myExpanded, setMyExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_RESULTS);
  useEffect(() => setVisibleCount(INITIAL_RESULTS), [search, lifecycle, type, domain]);

  const createAction = (
    <div className="flex flex-col items-end gap-1">
      <V2Button onClick={() => navigate('/v2/challenges/start')}>Create Challenge</V2Button>
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
  useEffect(() => {
    if (!openMenu) return;
    const close = (event: PointerEvent) => { if (!filtersRef.current?.contains(event.target as Node)) setOpenMenu(null); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [openMenu]);

  return (
    <V2Page wide>
      <V2SectionHeader
        eyebrow="Challenges"
        title="Challenges"
        description="Move together or race each other. Every Challenge belongs to a Group you are part of."
        action={createAction}
      />

      <section aria-label="Challenge search and filters" className="sticky top-14 z-20 -mx-4 mb-4 border-y border-slate-200 bg-white/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="relative">
          <label htmlFor="challenge-search" className="sr-only">Search Challenges</label>
          <svg aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input id="challenge-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Challenges…" className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-16 text-sm font-medium text-slate-900 outline-none focus-visible:border-primary focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/30" />
          {search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-sm font-bold text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Clear</button>}
        </div>
        <p className="mt-1.5 px-0.5 text-[10px] text-slate-500">Search names, descriptions, Groups, Activities, type, or Fitness/Wellness categories.</p>
        <div ref={filtersRef} className="mt-2.5 grid grid-cols-3 gap-2">
          <FilterDropdown id="status" label="Status" align="left" open={openMenu === 'status'} onOpenChange={(next) => setOpenMenu(next ? 'status' : null)} value={lifecycle} onChange={setLifecycle} options={[
            { value: 'all', label: 'All Statuses', short: 'All' },
            { value: 'active', label: 'Active', dot: 'bg-emerald-500' },
            { value: 'upcoming', label: 'Upcoming', dot: 'bg-sky-500' },
            { value: 'completed', label: 'Complete', dot: 'bg-slate-400' },
          ]} />
          <FilterDropdown id="type" label="Type" align="left" open={openMenu === 'type'} onOpenChange={(next) => setOpenMenu(next ? 'type' : null)} value={type} onChange={setType} options={[
            { value: 'all', label: 'All Types', short: 'All' },
            { value: 'collective', label: 'Together' },
            { value: 'competitive', label: 'Race' },
            { value: 'streak', label: 'Streak' },
          ]} />
          <FilterDropdown id="domain" label="Domain" align="right" open={openMenu === 'domain'} onOpenChange={(next) => setOpenMenu(next ? 'domain' : null)} value={domain} onChange={setDomain} options={[
            { value: 'all', label: 'All Domains', short: 'All' },
            { value: 'fitness', label: 'Fitness' },
            { value: 'wellness', label: 'Wellness' },
          ]} />
        </div>
        {filterCount > 0 && <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]" aria-label="Applied filters">
          <span className="flex items-center gap-1.5 text-slate-500"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />Filters active</span>
          <button type="button" onClick={clearFilters} className="min-h-8 rounded-lg px-2 font-bold text-primary underline underline-offset-2 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Reset all</button>
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
  return <V2ChallengeCard
    challenge={challenge}
    surface="my"
    statusLabel={statusLabelForEndState(challenge.status, endState)}
    statusTone={statusTone(endState)}
    groupLine={`${challenge.groupName ?? 'Group Challenge'} · ${formatDayRange(challenge.startDate, challenge.endDate)}`}
    progress={<MyChallengeProgress challenge={challenge} />}
    actions={<>
      {canLog && <V2Button onClick={() => navigate(`/v2/challenges/${challenge.challengeId}`, { state: { openLogActivity: true } })}>Log Activity</V2Button>}
      <V2Button variant="secondary" onClick={() => navigate(`/v2/challenges/${challenge.challengeId}`)}>View Challenge</V2Button>
    </>}
  />;
}

function FindChallengeRow({ challenge }: { challenge: V2ChallengeSummary }) {
  const navigate = useNavigate();
  const endState = endStateFor(challenge);
  return <V2ChallengeCard
    challenge={challenge}
    surface="find"
    statusLabel={statusLabelForEndState(challenge.status, endState)}
    statusTone={statusTone(endState)}
    groupLine={`${challenge.groupName ?? 'Group Challenge'} · ${formatDayRange(challenge.startDate, challenge.endDate)}`}
    progress={<FindChallengeProgress challenge={challenge} />}
    actions={<V2Button variant="secondary" onClick={() => navigate(`/v2/challenges/${challenge.challengeId}`)}>View Challenge</V2Button>}
  />;
}

interface FilterOption<T extends string> { value: T; label: string; short?: string; dot?: string }

function FilterDropdown<T extends string>({ id, label, align, open, onOpenChange, value, onChange, options }: {
  id: string;
  label: string;
  align: 'left' | 'right';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<FilterOption<T>>;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];
  const active = value !== options[0].value;
  const menuId = `challenge-filter-${id}-menu`;

  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
    (items?.[options.findIndex((option) => option.value === value)] ?? items?.[0])?.focus();
  }, [open]);

  const choose = (next: T) => { onChange(next); onOpenChange(false); triggerRef.current?.focus(); };
  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') { event.preventDefault(); onOpenChange(false); triggerRef.current?.focus(); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); items[(index + 1) % items.length]?.focus(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); items[(index - 1 + items.length) % items.length]?.focus(); }
    else if (event.key === 'Home') { event.preventDefault(); items[0]?.focus(); }
    else if (event.key === 'End') { event.preventDefault(); items[items.length - 1]?.focus(); }
    else if (event.key === 'Tab') onOpenChange(false);
  };

  return <div className="relative min-w-0">
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      aria-label={`${label}: ${selected.label}`}
      onClick={() => onOpenChange(!open)}
      onKeyDown={(event) => { if (event.key === 'ArrowDown' && !open) { event.preventDefault(); onOpenChange(true); } }}
      className={`flex min-h-11 w-full items-center justify-between rounded-xl border px-2.5 py-2 text-left transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? 'border-primary/50 bg-orange-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'} ${open ? 'ring-2 ring-primary' : ''}`}
    >
      <span className="min-w-0 truncate pr-1">
        <span className="block text-[9px] font-bold uppercase leading-none tracking-wider text-slate-500">{label}</span>
        <span className={`mt-0.5 block truncate text-xs font-bold ${active ? 'text-primary' : 'text-slate-800'}`}>{selected.short ?? selected.label}</span>
      </span>
      <svg aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
    </button>
    {open && <div
      ref={menuRef}
      id={menuId}
      role="listbox"
      aria-label={label}
      onKeyDown={onMenuKeyDown}
      className={`absolute top-full z-50 mt-1.5 w-44 max-w-[calc(100vw-2rem)] space-y-0.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl ${align === 'right' ? 'right-0' : 'left-0'}`}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return <button
          key={option.value}
          type="button"
          role="option"
          aria-selected={isSelected}
          onClick={() => choose(option.value)}
          className={`flex min-h-10 w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isSelected ? 'bg-orange-50' : ''}`}
        >
          <span className="flex items-center gap-1.5">{option.dot && <span aria-hidden="true" className={`h-2 w-2 rounded-full ${option.dot}`} />}{option.label}</span>
          {isSelected && <span aria-hidden="true" className="text-sm font-bold text-primary">✓</span>}
        </button>;
      })}
    </div>}
  </div>;
}
