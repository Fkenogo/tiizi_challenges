import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { V2Button, V2Chip, V2EmptyState, V2ErrorState, V2Field, V2LoadingState, V2Page, V2SectionHeader, V2TextInput } from '../components/V2Primitives';
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

  return (
    <V2Page wide>
      <V2SectionHeader
        eyebrow="Challenges"
        title="Challenges"
        description="Move together or race each other. Every Challenge belongs to a Group you are part of."
        action={createAction}
      />

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
        {joined.length > 0 && <ul className="space-y-2">
          {joined.map((challenge) => <MyChallengeRow key={challenge.challengeId} challenge={challenge} />)}
        </ul>}
      </section>

      <section aria-label="Find Challenges" className="mt-8 space-y-4">
        <div>
          <h2 className="text-base font-black text-slate-900">Find Challenges</h2>
          <p className="mt-0.5 text-xs text-slate-500">Search Challenges in your Groups and Groups open to discovery.</p>
        </div>
        <V2Field label="Search Challenges" hint="Search names, descriptions, Groups, Activities, type, or Fitness/Wellness categories.">
          <V2TextInput value={search} onChange={setSearch} placeholder="Search Challenges…" />
        </V2Field>
        <div className="space-y-3">
          <FilterRow label="Status" value={lifecycle} onChange={setLifecycle} options={[
            ['all', 'All'], ['active', 'Active / Ongoing'], ['upcoming', 'Scheduled / Upcoming'], ['completed', 'Completed'],
          ]} />
          <FilterRow label="Type" value={type} onChange={setType} options={[
            ['all', 'All'], ['collective', 'Together'], ['competitive', 'Race'], ['streak', 'Streak'],
          ]} />
          <FilterRow label="Domain" value={domain} onChange={setDomain} options={[
            ['all', 'All'], ['fitness', 'Fitness'], ['wellness', 'Wellness'],
          ]} />
        </div>
        {discovery.isError && !discovery.isFetchNextPageError && <V2ErrorState
          title="Challenge discovery is unavailable"
          message="We could not load more Challenges to find. Your joined Challenges above are not affected."
          onRetry={() => void discovery.refetch()}
        />}
        {ownRead.isSuccess && discovery.isSuccess && filtered.length === 0 && <V2EmptyState title="No matching Challenges" message="Try another search or change a filter." />}
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
  return <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
    <span className="w-16 shrink-0 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{label}</span>
    <div className="flex flex-wrap gap-1.5">{options.map(([key, text]) => <V2Chip key={key} selected={value === key} onClick={() => onChange(key)}>{text}</V2Chip>)}</div>
  </div>;
}
