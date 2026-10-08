import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search } from 'lucide-react';
import { fetchKnowledgeById, fetchPublishedActivities, type ApiKnowledgeItem } from '../../api/knowledgeApi';
import { fetchComposerSelectableKnowledge } from '../../api/challengeCreationApi';
import { createChallengeWizardRouteState, restoreChallengeWizardRouteState } from '../challenges/challengeCreationDraft';
import { guideCategories, nextGuideSelection, resolveGuideCategory, type GuideDomain } from './activityGuideFilters';
import { useAuth } from '../../hooks/useAuth';
import { ActivityThumbnail } from '../components/ActivityThumbnail';
import {
  V2Button,
  V2Card,
  V2Chip,
  V2EmptyState,
  V2ErrorState,
  V2LoadingState,
  V2Page,
  V2SectionHeader,
} from '../components/V2Primitives';

const ACTIVITY_CODE = /^[A-Z]{3}-[A-Z]{3}-\d{3}$/;

const DOMAIN_OPTIONS: ReadonlyArray<{ value: Exclude<GuideDomain, ''>; label: string }> = [
  { value: 'fitness', label: 'Fitness' },
  { value: 'wellness', label: 'Wellness' },
];

function apiConfigured() {
  return typeof import.meta.env.VITE_TIIZI_API_BASE_URL === 'string'
    && import.meta.env.VITE_TIIZI_API_BASE_URL.trim().length > 0;
}

export function V2ActivityLibraryScreen() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [domain, setDomain] = useState<GuideDomain>('');
  const [category, setCategory] = useState('');
  const all = useQuery({
    queryKey: ['v2-activity-library', user?.uid],
    queryFn: () => fetchPublishedActivities(),
    enabled: !!user?.uid && apiConfigured(),
    staleTime: 60_000,
  });
  const categories = useMemo(() => guideCategories(all.data ?? [], domain), [all.data, domain]);
  // A category the selected domain does not offer can never filter the list
  // (no stale-category empty state): it resolves to All categories.
  const activeCategory = all.data ? resolveGuideCategory(category, categories) : category;
  const results = useQuery({
    queryKey: ['v2-activity-library-search', user?.uid, search, activeCategory, domain],
    queryFn: () => fetchPublishedActivities(search, activeCategory || undefined, domain || undefined),
    enabled: !!user?.uid && apiConfigured(),
    staleTime: 30_000,
  });
  const filtered = !!(search || activeCategory || domain);

  function toggleDomain(pressed: Exclude<GuideDomain, ''>) {
    const next = nextGuideSelection(all.data ?? [], { domain, category: activeCategory }, pressed);
    setDomain(next.domain);
    setCategory(next.category);
  }

  return (
    <V2Page wide>
      <div className="min-w-0 max-w-full overflow-x-clip">
      <V2SectionHeader
        eyebrow="Activity Guide"
        title="Explore activities"
        description="Browse activities with clear guidance on what they involve and how to record them."
      />
      <label className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <Search size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
        <span className="sr-only">Search activities</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search activities"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
      </label>

      {!all.isLoading && !all.isError && all.data && all.data.length > 0 ? (
        <div className="mb-3 flex min-w-0 max-w-full gap-2" role="group" aria-label="Activity domain">
          {DOMAIN_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => toggleDomain(option.value)}
              aria-pressed={domain === option.value}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${domain === option.value ? 'bg-primary text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
            >{option.label}</button>
          ))}
        </div>
      ) : null}

      {all.isLoading || results.isLoading ? <V2LoadingState label="Loading activities…" /> : null}
      {all.isError || results.isError ? (
        <V2ErrorState
          title="Activities could not load"
          message="Please check your connection and try again."
          onRetry={() => { void all.refetch(); void results.refetch(); }}
        />
      ) : null}

      {!all.isLoading && !all.isError && categories.length > 0 ? (
        // The rail scrolls INSIDE the member canvas: the wrapper is a width-bounded
        // (min-w-0 / max-w-full), clipping flex item, so the chip row can never size
        // or paint beyond the mobile column, whatever the viewport width.
        <div className="mb-5 min-w-0 max-w-full overflow-hidden">
          <div
            className="flex w-full min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Activity categories"
          >
            <button
              type="button"
              onClick={() => setCategory('')}
              aria-pressed={!activeCategory}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${!activeCategory ? 'bg-primary text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
            >All categories</button>
            {categories.map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => setCategory(value === activeCategory ? '' : value)}
                aria-pressed={activeCategory === value}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${activeCategory === value ? 'bg-primary text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
              >{value}</button>
            ))}
          </div>
        </div>
      ) : null}

      {results.isSuccess && results.data.length === 0 ? (
        <V2EmptyState
          title={filtered ? 'No matching activities' : 'The guide is getting ready'}
          message={filtered ? 'Try another search or category.' : 'Published activities will appear here when they are ready to share.'}
          action={filtered ? <V2Button variant="secondary" onClick={() => { setSearch(''); setCategory(''); setDomain(''); }}>Clear filters</V2Button> : undefined}
        />
      ) : null}

      {results.data && results.data.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100" aria-label="Activity results">
          {results.data.map((item) => <ActivityCard key={item.id} item={item} />)}
        </div>
      ) : null}
      </div>
    </V2Page>
  );
}

function ActivityCard({ item }: { item: ApiKnowledgeItem }) {
  const domain = item.kind === 'wellness' ? 'Wellness' : 'Fitness';
  return (
    <Link
      to={`/v2/guide/${encodeURIComponent(item.id)}`}
      aria-label={`Open ${item.name}, ${domain}, ${item.category}${item.subcategory ? `, ${item.subcategory}` : ''}`}
      className="group flex min-h-[68px] items-center gap-3 px-3 py-2.5 outline-none transition-colors hover:bg-orange-50/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:gap-4 sm:px-4"
    >
      <ActivityThumbnail imageUrl={item.imageUrl} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold leading-5 text-slate-900 group-hover:text-primary sm:text-[15px]">{item.name}</span>
        <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[11px] font-medium leading-4 text-slate-500 sm:text-xs">
          <span>{domain}</span>
          <span aria-hidden="true">·</span>
          <span>{item.category}</span>
          {item.subcategory ? <><span aria-hidden="true">·</span><span>{item.subcategory}</span></> : null}
        </span>
      </span>
      <span className="shrink-0 text-lg leading-none text-slate-300 transition-colors group-hover:text-primary" aria-hidden="true">›</span>
    </Link>
  );
}

function displayText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const text = record.text ?? record.instruction ?? record.step ?? record.name;
    if (typeof text === 'string') return text;
  }
  return '';
}

function GuideSection({ title, show, children }: { title: string; show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return <section className="border-t border-slate-100 py-4"><h2 className="text-sm font-extrabold text-slate-900">{title}</h2><div className="mt-2 text-sm leading-6 text-slate-700">{children}</div></section>;
}

export function V2ActivityGuideDetailScreen() {
  const { user } = useAuth();
  const { activityId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const challengeContext = restoreChallengeWizardRouteState(location.state);
  const inChallengeDraft = challengeContext.routeState.fromChallengeDraft === true && !!challengeContext.draft;
  const activity = useQuery({
    queryKey: ['v2-activity-guide-detail', user?.uid, activityId],
    queryFn: () => fetchKnowledgeById(activityId),
    enabled: !!user?.uid && apiConfigured() && !!activityId,
  });
  const composer = useQuery({
    queryKey: ['v2-activity-guide-composer-selectable', user?.uid],
    queryFn: () => fetchComposerSelectableKnowledge(),
    enabled: !!user?.uid && apiConfigured() && activity.isSuccess
      && activity.data.lifecycle === 'published'
      && !!activity.data.activityCode && ACTIVITY_CODE.test(activity.data.activityCode),
    staleTime: 30_000,
  });
  const item = activity.data;
  // Direct identity reads intentionally preserve historical resolution. Only
  // the published canonical member-facing projection is rendered here.
  const memberVisible = !!item && item.lifecycle === 'published'
    && !!item.activityCode && ACTIVITY_CODE.test(item.activityCode);
  const composerSelectable = !!item && !!composer.data?.some((candidate) => candidate.id === item.id);
  const alreadySelected = !!item && !!challengeContext.draft?.activities.some((activity) => activity.activity === item.id);

  function returnToChallenge(addActivity?: ApiKnowledgeItem) {
    if (!challengeContext.draft) return;
    navigate('/v2/challenges/new', {
      replace: true,
      state: createChallengeWizardRouteState(
        challengeContext.draft,
        challengeContext.stepIndex,
        {
          fromChallengeDraft: true,
          ...(addActivity ? {
            activityId: addActivity.id,
            activityCode: addActivity.activityCode ?? undefined,
            addToDraft: true,
          } : {}),
        },
      ),
    });
  }

  if (activity.isLoading) return <V2Page><V2LoadingState label="Loading activity guide…" /></V2Page>;
  if (activity.isError) {
    return <V2Page><V2ErrorState title="Activity could not load" message="Please check your connection and try again." onRetry={() => { void activity.refetch(); }} /></V2Page>;
  }
  if (!item || !memberVisible) {
    return <V2Page><V2EmptyState title="Activity not available" message="This activity could not be found in the guide." action={<V2Button variant="secondary" onClick={() => navigate('/v2/guide')}>Back to activities</V2Button>} /></V2Page>;
  }

  const protocols = (item.protocolSteps ?? []).map(displayText).filter(Boolean);
  const measures = [item.metricUnit, ...(item.primaryMetrics ?? []), ...(item.secondaryMetrics ?? [])].filter(Boolean);
  return (
    <V2Page>
      {inChallengeDraft ? (
        <button type="button" onClick={() => returnToChallenge()} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <ArrowLeft size={16} /> Back to this Challenge
        </button>
      ) : (
        <Link to="/v2/guide" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900"><ArrowLeft size={16} /> All activities</Link>
      )}
      <V2SectionHeader eyebrow={`${item.category}${item.subcategory ? ` · ${item.subcategory}` : ''}`} title={item.name} description={item.description || undefined} />
      <V2Card className="mb-4">
        <GuideSection title="How to do it" show={!!(item.setup || item.execution || protocols.length)}>
          {item.setup ? <p><strong>Set up:</strong> {item.setup}</p> : null}
          {item.execution ? <p className="mt-2">{item.execution}</p> : null}
          {protocols.length ? <ol className="mt-2 list-decimal space-y-1 pl-5">{protocols.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol> : null}
        </GuideSection>
        <GuideSection title="Measurement" show={!!(item.measurementGuidance || item.unitSemantics || measures.length || item.compatibleUnits?.length)}>
          {item.measurementGuidance ? <p>{item.measurementGuidance}</p> : null}
          {item.unitSemantics ? <p className="mt-2">{item.unitSemantics}</p> : null}
          {measures.length ? <p className="mt-2"><strong>Metrics:</strong> {measures.join(', ')}</p> : null}
          {item.compatibleUnits?.length ? <p className="mt-1"><strong>Units:</strong> {item.compatibleUnits.join(', ')}</p> : null}
        </GuideSection>
        <GuideSection title="Technique" show={!!(item.techniqueReference || item.formCues?.length || item.commonMistakes?.length)}>
          {item.techniqueReference ? <p>{item.techniqueReference}</p> : null}
          {item.formCues?.length ? <List items={item.formCues} label="Form cues" /> : null}
          {item.commonMistakes?.length ? <List items={item.commonMistakes} label="Common mistakes" /> : null}
        </GuideSection>
        <GuideSection title="Equipment and environment" show={!!(item.equipment || item.environment)}>
          {item.equipment ? <p><strong>Equipment:</strong> {item.equipment}</p> : null}
          {item.environment ? <p className="mt-2"><strong>Environment:</strong> {item.environment}</p> : null}
        </GuideSection>
        <GuideSection title="Safety and caution" show={!!(item.safetyNotes?.length || item.avoidanceCondition)}>
          {item.safetyNotes?.length ? <List items={item.safetyNotes} /> : null}
          {item.avoidanceCondition ? <p>{item.avoidanceCondition}</p> : null}
        </GuideSection>
        <GuideSection title="Adaptation" show={!!item.adaptation}>{item.adaptation}</GuideSection>
        <GuideSection title="Completion meaning" show={!!item.completionMeaning}>{item.completionMeaning}</GuideSection>
        <GuideSection title="Session framing" show={!!item.sessionFraming}>{item.sessionFraming}</GuideSection>
      </V2Card>
      {inChallengeDraft ? alreadySelected ? (
        <div className="space-y-2">
          <V2Button disabled>Already selected</V2Button>
          <V2Button variant="secondary" onClick={() => returnToChallenge()}>Back to this Challenge</V2Button>
        </div>
      ) : (
        <V2Button onClick={() => returnToChallenge(item)}>Add to this Challenge</V2Button>
      ) : null}
      {!inChallengeDraft && composer.isError ? <V2ErrorState title="Challenge availability could not be checked" message="Try again before using this activity in a Challenge." onRetry={() => { void composer.refetch(); }} /> : null}
      {!inChallengeDraft && composerSelectable ? (
        <V2Button onClick={() => navigate('/v2/challenges/new', { state: { activityId: item.id, activityCode: item.activityCode } })}>Use in Challenge</V2Button>
      ) : null}
      {!inChallengeDraft && !composerSelectable ? (
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-xl bg-slate-200 px-4 py-3 text-sm font-bold text-slate-500"
          title={composer.isLoading ? 'Checking Challenge availability' : 'This activity is not currently available in Challenge creation'}
        >
          {composer.isLoading ? 'Checking Challenge availability…' : 'Not available for Challenges'}
        </button>
      ) : null}
    </V2Page>
  );
}

function List({ items, label }: { items: string[]; label?: string }) {
  return <div className={label ? 'mt-2' : ''}>{label ? <p className="font-semibold">{label}</p> : null}<ul className="mt-1 list-disc space-y-1 pl-5">{items.filter(Boolean).map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></div>;
}
