import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { fetchActivityOptions } from '../../../api/challengeCreationApi';
import { fetchKnowledgeById } from '../../../api/knowledgeApi';
import type { MemberChallengeTemplate } from '../../../api/challengeTemplatesApi';
import { V2Button, V2Card, V2EmptyState, V2ErrorState, V2LoadingState, V2Page, V2SectionHeader } from '../../components/V2Primitives';
import { challengeTypeLabel, challengeTypeOption, createChallengeWizardRouteState } from '../challengeCreationDraft';
import { challengeCoverGradient } from '../challengeCovers';
import {
  TEMPLATE_ADOPTION_START_STEP,
  domainsOf,
  filterTemplates,
  templateToWizardState,
  type ResolvedTemplateActivity,
  type TemplateActivityLookup,
  type TemplateDomain,
  type TemplateFilterState,
} from './templateAdoption';
import { durationPhrase, measuredAs, permittedDurations, targetPhrase, targetScope } from './templatePresentation';
import { templateKeys, useMemberTemplate, useMemberTemplates, useTemplateActivityNames } from './useTemplateCatalogue';

/**
 * TIIZI-V2-TEMPLATE-UX-003 — member Template selection (UX preview).
 *
 *  /v2/challenges/start            choose: Start from scratch | Use a template
 *  /v2/challenges/templates        member Template Library
 *  /v2/challenges/templates/:id    Template preview
 *
 * Choosing a Template only PRE-FILLS the existing seven-step wizard. It never
 * creates a Challenge, never validates anything and never counts an adoption.
 */

type Names = ReturnType<typeof useTemplateActivityNames>;

/** Pass-through of Group-Home style hints (e.g. `groupId`) so the entry point change loses nothing. */
function usePassThroughState(): Record<string, unknown> {
  const { state } = useLocation();
  return state && typeof state === 'object' ? (state as Record<string, unknown>) : {};
}

const Chevron = () => (
  <span className="flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full bg-slate-50 text-slate-400" aria-hidden>
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
  </span>
);

/** Visual redesign per Founder reference (TEMPLATE-UX-004): stacked full-card options, template first. */
export function V2ChallengeStartScreen() {
  const navigate = useNavigate();
  const carried = usePassThroughState();
  return (
    <V2Page>
      <V2SectionHeader eyebrow="Create a Challenge" title="How would you like to start?" description="Build it yourself, or begin from a ready-made Template you can still change." />
      <div className="space-y-4">
        <button type="button" data-start-option="template" onClick={() => navigate('/v2/challenges/templates', { state: carried })}
          className="relative block w-full overflow-hidden rounded-3xl border-2 border-primary/30 bg-white p-5 text-left shadow-sm transition hover:border-primary hover:shadow-md active:scale-[0.99]">
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-orange-500 to-amber-400" aria-hidden />
          <span className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-primary" aria-hidden>
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </span>
            <span className="min-w-0 flex-1 pr-1">
              <span className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-base font-extrabold leading-snug text-slate-900">Use a template</span>
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-primary">Fastest</span>
              </span>
              <span className="block text-xs leading-relaxed text-slate-600">Start from a ready-made Challenge. Choose your hosting Group and customize the available settings.</span>
            </span>
            <Chevron />
          </span>
        </button>
        <button type="button" data-start-option="scratch" onClick={() => navigate('/v2/challenges/new', { state: carried })}
          className="relative block w-full overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md active:scale-[0.99]">
          <span className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700" aria-hidden>
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            </span>
            <span className="min-w-0 flex-1 pr-1">
              <span className="mb-1 block text-base font-extrabold leading-snug text-slate-900">Start from scratch</span>
              <span className="block text-xs leading-relaxed text-slate-600">Choose the type, Activities and goals yourself, step by step.</span>
            </span>
            <Chevron />
          </span>
        </button>
      </div>
      <p className="pt-6 text-center text-[11px] text-slate-400">You can preview, edit and review everything in the next steps before anything is created.</p>
    </V2Page>
  );
}

const SimulatedBadge = () => (
  <p data-simulated-publication className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
    Local preview: these Templates are simulated as published. Nothing here has been published or validated by the real service.
  </p>
);

function TemplateMeta({ template, names }: { template: MemberChallengeTemplate; names: Names }) {
  return (
    <>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
        <span className="rounded-full bg-orange-50 px-2 py-0.5 text-primary">{challengeTypeLabel(template.challengeType as never)}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{durationPhrase(template)}</span>
        {template.focusTags.map((tag) => <span key={tag} className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">{tag}</span>)}
      </div>
      <ul className="mt-2 space-y-0.5 text-xs text-slate-700">
        {template.composer.activities.map((a) => (
          <li key={a.activity}>{names[a.activity]?.name ?? 'Activity'} · {targetPhrase(a)}</li>
        ))}
      </ul>
    </>
  );
}

const DOMAIN_LABEL: Record<TemplateDomain, string> = { fitness: 'Fitness', wellness: 'Wellness' };
const TYPE_ORDER = ['streak', 'collective', 'competitive'] as const;
const typeBadge = (type: string) => (type === 'competitive' ? 'bg-orange-100 text-orange-900' : 'bg-amber-100 text-amber-900');

function FilterSelect({ label, value, onChange, options, testId }: { label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]>; testId: string }) {
  const active = value !== 'all';
  return (
    <label className={`relative flex min-h-[44px] items-center justify-between rounded-xl border px-3 py-1.5 ${active ? 'border-primary/50 bg-orange-50' : 'border-slate-200 bg-slate-50'}`}>
      <span className="min-w-0 pr-5">
        <span className="block text-[9px] font-bold uppercase leading-none tracking-wider text-slate-400">{label}</span>
        <span className={`mt-0.5 block truncate text-xs font-bold ${active ? 'text-primary' : 'text-slate-800'}`}>{options.find(([v]) => v === value)?.[1]}</span>
      </span>
      <svg className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      <select data-filter={testId} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </label>
  );
}

/**
 * The app's global `#root { overflow-x: hidden }` turns #root into a scroll container, which stops
 * `position: sticky` from sticking to the viewport. While the library is mounted, clip instead of
 * hide (same visual effect, no scroll container) and restore on leave. Scoped; global CSS is untouched.
 */
function useStickyFriendlyRoot() {
  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return undefined;
    const previous = root.style.overflowX;
    root.style.overflowX = 'clip';
    return () => { root.style.overflowX = previous; };
  }, []);
}

export function V2ChallengeTemplateLibrary() {
  useStickyFriendlyRoot();
  const navigate = useNavigate();
  const carried = usePassThroughState();
  const query = useMemberTemplates();
  const templates = query.data ?? [];
  const names = useTemplateActivityNames(templates);
  const lookup: TemplateActivityLookup = Object.fromEntries(Object.entries(names).map(([id, n]) => [id, { name: n.name, kind: n.kind }]));
  const [filter, setFilter] = useState<TemplateFilterState>({ search: '', type: 'all', interest: 'all', domain: 'all' });
  const shown = filterTemplates(templates, filter, lookup);
  const domainOptions: Array<[string, string]> = [['all', 'All'], ...(['fitness', 'wellness'] as const).filter((d) => templates.some((t) => domainsOf(t, lookup).includes(d))).map((d): [string, string] => [d, DOMAIN_LABEL[d]])];
  const typeOptions: Array<[string, string]> = [['all', 'All'], ...TYPE_ORDER.filter((t) => templates.some((x) => x.challengeType === t)).map((t): [string, string] => [t, challengeTypeLabel(t)])];
  const filtersActive = filter.search.trim() !== '' || filter.type !== 'all' || (filter.domain ?? 'all') !== 'all';
  const reset = () => setFilter({ search: '', type: 'all', interest: 'all', domain: 'all' });
  const criteria = [
    filter.domain && filter.domain !== 'all' ? `Domain: ${DOMAIN_LABEL[filter.domain]}` : '',
    filter.type !== 'all' ? `Type: ${challengeTypeLabel(filter.type)}` : '',
    filter.search.trim() ? `“${filter.search.trim()}”` : '',
  ].filter(Boolean).join(' · ');

  return (
    <V2Page>
      <V2SectionHeader eyebrow="Create a Challenge" title="Choose a template" description="Pick a starting point. Next you will choose a hosting Group and can change anything." />
      <div className="mb-3"><SimulatedBadge /></div>
      {query.isLoading && <V2LoadingState label="Loading templates…" />}
      {query.isError && <V2ErrorState title="We couldn’t load templates" message="Please try again." onRetry={() => void query.refetch()} />}
      {query.isSuccess && (
        <>
          <div data-template-filters className="sticky top-[57px] z-20 -mx-4 border-b border-slate-100 bg-slate-50/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="relative">
              <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="search" data-template-search value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })} placeholder="Search templates, activities, or interests…" aria-label="Search templates"
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-xs font-medium focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 [&::-webkit-search-cancel-button]:hidden" />
              {filter.search && (
                <button type="button" data-clear-search aria-label="Clear search" onClick={() => setFilter({ ...filter, search: '' })} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-slate-400 hover:text-slate-600">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                </button>
              )}
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <FilterSelect label="Domain" testId="domain" value={filter.domain ?? 'all'} onChange={(v) => setFilter({ ...filter, domain: v as TemplateFilterState['domain'] })} options={domainOptions} />
              <FilterSelect label="Type" testId="type" value={filter.type} onChange={(v) => setFilter({ ...filter, type: v as TemplateFilterState['type'] })} options={typeOptions} />
            </div>
            {filtersActive && (
              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
                <span className="truncate font-medium text-slate-500" data-active-criteria>{criteria}</span>
                <button type="button" data-reset-filters onClick={reset} className="shrink-0 pl-2 font-bold text-primary underline">Reset all</button>
              </div>
            )}
          </div>
          {templates.length > 0 && (
            <div className="flex items-center justify-between pb-1 pt-3 text-xs text-slate-500">
              <span data-result-count>Showing {shown.length} of {templates.length} templates</span>
              <span className="text-[10px] text-slate-400">Tap preview to inspect</span>
            </div>
          )}
          {templates.length === 0 ? (
            <V2EmptyState title="No templates available" message="There are no templates to start from right now. You can still start from scratch." action={<V2Button onClick={() => navigate('/v2/challenges/new', { state: carried })}>Start from scratch</V2Button>} />
          ) : shown.length === 0 ? (
            <div data-template-empty className="px-4 py-12 text-center">
              <h2 className="text-sm font-bold text-slate-800">No templates match</h2>
              <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500">Try clearing your search or choosing a different Domain or Type.</p>
              <button type="button" data-empty-reset onClick={reset} className="mt-4 min-h-[44px] rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white">Reset all filters</button>
            </div>
          ) : (
            <ul className="space-y-4 pt-2" data-template-list>
              {shown.map((template) => (
                <li key={template.templateId}>
                  <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md" data-template-card={template.title}>
                    <div className={`h-1.5 bg-gradient-to-r ${challengeCoverGradient(template.coverId)}`} aria-hidden />
                    <div className="space-y-3 p-4">
                      <div>
                        <h2 className="text-base font-extrabold leading-snug text-slate-900">{template.title}</h2>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">{template.summary}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${typeBadge(template.challengeType)}`}>{challengeTypeLabel(template.challengeType as never)}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">{durationPhrase(template)}</span>
                        {template.focusTags.map((tag) => <span key={tag} className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">{tag}</span>)}
                      </div>
                      <p className="text-[11px] font-medium text-slate-400">
                        {template.composer.activities.map((a) => `${names[a.activity]?.name ?? 'Activity'} · ${targetPhrase(a)}`).join(' · ')}
                      </p>
                      <button type="button" onClick={() => navigate(`/v2/challenges/templates/${template.templateId}`, { state: carried })}
                        className="min-h-[44px] rounded-xl border border-slate-200 px-4 py-1.5 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 active:scale-95">Preview</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <div className="mt-5 text-center">
        <button type="button" className="min-h-[44px] text-xs font-semibold text-slate-500 underline decoration-slate-300" onClick={() => navigate('/v2/challenges/start', { state: carried })}>Back to start options</button>
      </div>
    </V2Page>
  );
}

export function V2ChallengeTemplatePreview() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const carried = usePassThroughState();
  const query = useMemberTemplate(templateId);
  const template = query.data;
  const names = useTemplateActivityNames(template ? [template] : []);
  const [adopting, setAdopting] = useState(false);
  const [error, setError] = useState('');

  async function useTemplate(t: MemberChallengeTemplate) {
    setError('');
    setAdopting(true);
    try {
      const resolved: Record<string, ResolvedTemplateActivity> = {};
      for (const entry of t.composer.activities) {
        const [item, options] = await Promise.all([
          queryClient.fetchQuery({ queryKey: templateKeys.knowledge(entry.activity), queryFn: () => fetchKnowledgeById(entry.activity), staleTime: 5 * 60_000 }),
          queryClient.fetchQuery({ queryKey: ['v2-create-options', entry.activity], queryFn: () => fetchActivityOptions(entry.activity), staleTime: 5 * 60_000 }),
        ]);
        resolved[entry.activity] = { item, options };
      }
      const draft = templateToWizardState(t, resolved);
      navigate('/v2/challenges/new', { state: createChallengeWizardRouteState(draft, TEMPLATE_ADOPTION_START_STEP, carried) });
    } catch {
      setError('We could not load this template’s Activities. Please try again or start from scratch.');
      setAdopting(false);
    }
  }

  if (query.isLoading) return <V2Page><V2LoadingState label="Loading template…" /></V2Page>;
  if (query.isError || !template) {
    return <V2Page><V2ErrorState title="This template is not available" message="It may have been withdrawn. Choose another template or start from scratch." onRetry={() => navigate('/v2/challenges/templates', { state: carried })} /></V2Page>;
  }
  const option = challengeTypeOption(template.challengeType as never);
  return (
    <V2Page>
      <div className={`h-24 rounded-2xl bg-gradient-to-r ${challengeCoverGradient(template.coverId)}`} aria-hidden />
      <p className="mt-4 text-xs font-bold uppercase tracking-widest text-slate-500">Template preview</p>
      <h1 className="mt-1 text-2xl font-black text-slate-900" data-template-title>{template.title}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-700">{template.summary}</p>
      {template.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{template.description}</p>}
      <div className="mt-3"><TemplateMeta template={template} names={names} /></div>
      <V2Card className="mt-4">
        <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1.5 text-xs">
          <dt className="text-slate-500">Challenge type</dt><dd>{option?.label ?? 'Challenge'} — {option?.sub}</dd>
          <dt className="text-slate-500">Starts with</dt><dd>{durationPhrase(template)}</dd>
          <dt className="text-slate-500">Other lengths</dt><dd>{permittedDurations(template)}</dd>
          {template.composer.activities.map((a, i) => (
            <div key={a.activity} className="contents">
              <dt className="text-slate-500">{template.composer.activities.length > 1 ? `Activity ${i + 1}` : 'Activity'}</dt>
              <dd>
                <span className="font-bold">{names[a.activity]?.name ?? 'Activity'}</span>
                {names[a.activity]?.category ? ` · ${names[a.activity].category}` : ''}<br />
                {measuredAs(a)}: {targetPhrase(a)} {targetScope(template.challengeType)}
              </dd>
            </div>
          ))}
        </dl>
      </V2Card>
      <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        Using a template fills in the Challenge for you. Nothing is created yet: you will choose a hosting Group, can change the name, goals, length and dates, and review everything first.
      </p>
      <div className="mt-3"><SimulatedBadge /></div>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <V2Button onClick={() => void useTemplate(template)} disabled={adopting}>{adopting ? 'Preparing…' : 'Use this template'}</V2Button>
        <V2Button variant="secondary" onClick={() => navigate('/v2/challenges/templates', { state: carried })}>Back to templates</V2Button>
      </div>
    </V2Page>
  );
}
