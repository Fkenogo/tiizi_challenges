import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchOperatorTemplate,
  fetchOperatorTemplatePage,
  fetchTemplateAdoption,
  type OperatorTemplateDetail,
  type OperatorTemplateSummary,
  type OperatorTemplateVersion,
  type TemplateAdoptionRow,
} from '../../../api/operatorTemplatesApi';
import { GROUP_FOCUS_AREA_LABELS } from '../../groups/groupFocusAreas';
import { V2Card, V2EmptyState, V2LoadingState, V2Page, V2SectionHeader } from '../../components/V2Primitives';
import {
  EMPTY_FILTERS,
  LIFECYCLE_LABELS,
  TYPE_LABELS,
  classifyLibraryError,
  flattenPages,
  formatWhen,
  hasActiveFilters,
  lifecycleLabel,
  pageAdvice,
  shortId,
  typeLabel,
  type LibraryFailure,
  type LibraryFilters,
  type TemplateLifecycleFilter,
  type TemplateTypeFilter,
} from './templateLibraryModel';

/**
 * TIIZI-FER-P5T-2-S2 — read-only Operator Template Library (desktop-first).
 *
 * Reads the P5T-1 endpoints only. Authorization is the backend's: a Template
 * author OR a Console reader may read. This page deliberately does NOT call
 * the Console overview, so a failed overview request can never block an
 * otherwise authorized Template author. There are no create/edit/publish/
 * revise/retire controls: those arrive in later slices.
 */

const inputClass = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100';

function lifecycleClass(lifecycle: string | null | undefined): string {
  const tone = lifecycle === 'published' ? 'bg-emerald-100 text-emerald-800'
    : lifecycle === 'retired' ? 'bg-slate-200 text-slate-700'
      : 'bg-amber-100 text-amber-800';
  return `inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${tone}`;
}

function FailureNotice({ failure, onRetry, retryLabel = 'Retry' }: { failure: LibraryFailure; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div role="alert" data-failure={failure.kind} className="rounded-2xl border border-red-200 bg-red-50 p-5">
      <p className="text-sm font-black text-red-800">{failure.title}</p>
      <p className="mt-1 text-sm text-red-800">{failure.message}</p>
      {onRetry && failure.kind !== 'denied' && failure.kind !== 'signin' && (
        <button type="button" onClick={onRetry} className="mt-3 rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white">{retryLabel}</button>
      )}
    </div>
  );
}

export function OperatorTemplateLibrary() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [activityInput, setActivityInput] = useState('');
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<string>('');

  // Free-text inputs (search, Activity) are debounced so a partial value never fires a request per keystroke;
  // the other filters are discrete selections and apply immediately.
  useEffect(() => {
    const timer = setTimeout(() => setFilters((prev) => {
      const q = searchInput.trim();
      const activity = activityInput.trim();
      return prev.q === q && prev.activity === activity ? prev : { ...prev, q, activity };
    }), 300);
    return () => clearTimeout(timer);
  }, [searchInput, activityInput]);

  const listKey = useMemo(() => ['operator-templates', 'list', filters] as const, [filters]);
  const list = useInfiniteQuery({
    queryKey: listKey,
    queryFn: ({ pageParam }) => fetchOperatorTemplatePage(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 10_000,
    retry: false,
  });

  const pages = useMemo(
    () => (list.data?.pages ?? []).map((page) => ({ items: page.templates, nextCursor: page.nextCursor })),
    [list.data],
  );
  const rows = useMemo(() => flattenPages(pages, (row: OperatorTemplateSummary) => row.templateId), [pages]);
  const advice = pageAdvice(pages, list.isFetchingNextPage);

  // A page can carry a cursor yet be empty: keep following it (bounded), never stop on emptiness alone.
  const advancing = useRef(false);
  useEffect(() => {
    if (advice !== 'advance' || advancing.current || list.isError) return;
    advancing.current = true;
    void list.fetchNextPage().finally(() => { advancing.current = false; });
  }, [advice, list]);

  const failure = list.isError ? classifyLibraryError(list.error) : null;
  const filtered = hasActiveFilters(filters);
  const reloadFromStart = () => { void queryClient.resetQueries({ queryKey: ['operator-templates', 'list'] }); };
  const clearFilters = () => { setSearchInput(''); setActivityInput(''); setFilters(EMPTY_FILTERS); };
  const setFilter = <K extends keyof LibraryFilters>(key: K, value: LibraryFilters[K]) => setFilters((prev) => ({ ...prev, [key]: value }));

  const selectedId = rows.some((row) => row.templateId === selected) ? selected : rows[0]?.templateId ?? '';

  return (
    <V2Page wide>
      <V2SectionHeader
        eyebrow="Tiizi Platform Operator"
        title="Templates"
        description="Read-only Challenge Template Library: every Template and version, with how often each has been adopted."
      />

      <div className="mb-3 flex flex-wrap gap-2" role="search" aria-label="Template search and filters">
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search title, summary or description…"
          aria-label="Search Templates"
          className={`${inputClass} min-w-[220px] flex-1`}
        />
        <select aria-label="Challenge type" value={filters.type} onChange={(event) => setFilter('type', event.target.value as TemplateTypeFilter)} className={inputClass}>
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select aria-label="Lifecycle" value={filters.lifecycle} onChange={(event) => setFilter('lifecycle', event.target.value as TemplateLifecycleFilter)} className={inputClass}>
          <option value="">All lifecycles</option>
          {Object.entries(LIFECYCLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select aria-label="Interest tag" value={filters.tag} onChange={(event) => setFilter('tag', event.target.value)} className={inputClass}>
          <option value="">All tags</option>
          {GROUP_FOCUS_AREA_LABELS.map((label) => <option key={label} value={label}>{label}</option>)}
        </select>
        <input
          value={activityInput}
          onChange={(event) => setActivityInput(event.target.value)}
          placeholder="Activity Code or ID"
          aria-label="Filter by Activity Code or ID"
          className={`${inputClass} w-[190px]`}
        />
        {filtered && <button type="button" onClick={clearFilters} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700">Clear filters</button>}
      </div>

      {list.isPending && !failure && <V2LoadingState label="Loading Templates…" />}
      {failure && rows.length === 0 && (
        <FailureNotice failure={failure} onRetry={failure.kind === 'cursor' ? reloadFromStart : () => void list.refetch()} retryLabel={failure.kind === 'cursor' ? 'Reload from the first page' : 'Retry'} />
      )}
      {list.isSuccess && rows.length === 0 && advice === 'done' && (
        filtered
          ? <V2EmptyState title="No Templates match" message="No Template matches this search and these filters. Adjust or clear them to see more." action={<button type="button" onClick={clearFilters} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold">Clear filters</button>} />
          : <V2EmptyState title="No Templates yet" message="No Challenge Template has been created. Templates appear here once an authorized Template author starts one." />
      )}

      {rows.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(380px,0.65fr)]">
          <V2Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs" aria-label="Templates">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-2 pr-3">Template</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Lifecycle</th>
                    <th className="py-2 pr-3">Published</th><th className="py-2 pr-3">Draft</th><th className="py-2 pr-3">Duration</th><th className="py-2 pr-3">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.templateId} className={`border-b border-slate-100 align-top ${row.templateId === selectedId ? 'bg-orange-50' : ''}`}>
                      <td className="py-2 pr-3">
                        <button type="button" onClick={() => setSelected(row.templateId)} aria-pressed={row.templateId === selectedId} className="text-left">
                          <span className="block font-bold text-slate-900">{row.title || 'Untitled draft'}</span>
                          <span className="block max-w-[320px] truncate text-slate-500">{row.summary || 'No summary yet'}</span>
                        </button>
                      </td>
                      <td className="py-2 pr-3">{typeLabel(row.challengeType)}</td>
                      <td className="py-2 pr-3"><span className={lifecycleClass(row.lifecycle)}>{lifecycleLabel(row.lifecycle)}</span></td>
                      <td className="py-2 pr-3">{row.latestPublishedVersion ? `v${row.latestPublishedVersion}` : '—'}</td>
                      <td className="py-2 pr-3">{row.openDraftVersion ? `v${row.openDraftVersion}` : '—'}</td>
                      <td className="py-2 pr-3">{row.durationDays ? `${row.durationDays} days` : '—'}</td>
                      <td className="py-2 pr-3">{row.focusTags.length ? row.focusTags.join(', ') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500" aria-live="polite">
              <span>{rows.length} loaded{advice === 'done' ? ' · end of list' : ''}</span>
              {(advice === 'ask' || advice === 'wait' || advice === 'advance') && (
                <button type="button" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-bold text-slate-700 disabled:opacity-60">
                  {list.isFetchingNextPage ? 'Loading…' : advice === 'ask' && rows.length === 0 ? 'Keep looking' : 'Load more'}
                </button>
              )}
              {failure && rows.length > 0 && (
                <span className="flex items-center gap-2 text-red-700">
                  {failure.title}.
                  <button type="button" onClick={failure.kind === 'cursor' ? reloadFromStart : list.isFetchNextPageError ? () => void list.fetchNextPage() : () => void list.refetch()} className="font-bold underline">
                    {failure.kind === 'cursor' ? 'Reload from the first page' : 'Retry'}
                  </button>
                </span>
              )}
            </div>
          </V2Card>
          <TemplateDetailPanel key={selectedId} templateId={selectedId} />
        </div>
      )}

      {rows.length === 0 && advice !== 'done' && !failure && !list.isPending && (
        <div className="flex items-center gap-3 text-xs text-slate-500" role="status">
          <span>Searching further…</span>
          {advice === 'ask' && <button type="button" onClick={() => void list.fetchNextPage()} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-bold text-slate-700">Keep looking</button>}
        </div>
      )}
    </V2Page>
  );
}

function TemplateDetailPanel({ templateId }: { templateId: string }) {
  const detail = useQuery({
    queryKey: ['operator-templates', 'detail', templateId],
    queryFn: () => fetchOperatorTemplate(templateId),
    enabled: !!templateId,
    retry: false,
    staleTime: 10_000,
  });
  const adoption = useQuery({
    queryKey: ['operator-templates', 'adoption', templateId],
    queryFn: () => fetchTemplateAdoption(templateId),
    enabled: !!templateId,
    retry: false,
    staleTime: 10_000,
  });
  const [pickedVersion, setPickedVersion] = useState<number | null>(null);
  useEffect(() => setPickedVersion(null), [templateId]);

  if (!templateId) return null;
  if (detail.isError) return <FailureNotice failure={classifyLibraryError(detail.error)} onRetry={() => void detail.refetch()} />;
  // isPending (not isLoading): a paused/offline query is pending with no data and must not fall through.
  if (!detail.data) return <V2Card><V2LoadingState label="Loading Template…" /></V2Card>;
  const data: OperatorTemplateDetail = detail.data;
  const versions = [...data.versions].reverse();
  const shown: OperatorTemplateVersion = versions.find((version) => version.version === pickedVersion) ?? versions[0];
  const counts = new Map<number, number>((adoption.data ?? []).map((row: TemplateAdoptionRow) => [row.version, row.adoptions]));
  const content = shown?.content;
  const composer = content?.composer;

  return (
    <V2Card className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto">
      <div aria-label="Template detail">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-black text-slate-900">{composer?.title || 'Untitled draft'}</h2>
            <p className="mt-0.5 text-xs text-slate-500" title={data.templateId}>Template {shortId(data.templateId)} · created {formatWhen(data.createdAt)} by {shortId(data.createdByMemberId)}</p>
          </div>
          <span className={lifecycleClass(data.lifecycle)}>{lifecycleLabel(data.lifecycle)}</span>
        </div>
        {data.lifecycle === 'retired' && (
          <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
            Retired {formatWhen(data.retiredAt)} by {shortId(data.retiredByMemberId)}{data.retiredReason ? ` — ${data.retiredReason}` : ''}. Retired Templates are no longer offered to members; existing Challenges are unaffected.
          </p>
        )}

        <h3 className="mt-4 text-sm font-black">Versions &amp; adoption</h3>
        <p className="text-[11px] text-slate-500">Adoptions are Challenges successfully established from a published version.</p>
        {adoption.isError && <p className="mt-1 text-xs text-red-700">Adoption counts could not be loaded. <button type="button" className="font-bold underline" onClick={() => void adoption.refetch()}>Retry</button></p>}
        <table className="mt-2 w-full text-left text-xs" aria-label="Versions">
          <thead><tr className="border-b text-slate-500"><th className="py-1.5 pr-2">Version</th><th className="py-1.5 pr-2">State</th><th className="py-1.5 pr-2">Authored by</th><th className="py-1.5 pr-2">Published</th><th className="py-1.5 pr-2 text-right">Adoptions</th></tr></thead>
          <tbody>
            {versions.map((version) => (
              <tr key={version.version} className={`border-b border-slate-100 ${version.version === shown.version ? 'bg-orange-50' : ''}`}>
                <td className="py-1.5 pr-2"><button type="button" aria-pressed={version.version === shown.version} onClick={() => setPickedVersion(version.version)} className="font-bold text-primary">v{version.version}</button></td>
                <td className="py-1.5 pr-2">{version.state === 'published' ? 'Published' : 'Draft'}</td>
                <td className="py-1.5 pr-2" title={version.authoredByMemberId}>{shortId(version.authoredByMemberId)}</td>
                <td className="py-1.5 pr-2">{version.publishedAt ? `${formatWhen(version.publishedAt)} by ${shortId(version.publishedByMemberId)}` : '—'}</td>
                <td className="py-1.5 pr-2 text-right font-bold">{version.state !== 'published' ? '—' : adoption.isLoading ? '…' : adoption.isError ? '—' : (counts.get(version.version) ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {shown && (
          <section className="mt-4" aria-label={`Version ${shown.version} content`}>
            <h3 className="text-sm font-black">Version {shown.version} configuration</h3>
            <dl className="mt-2 grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-slate-500">Summary</dt><dd>{content.summary || '—'}</dd>
              <dt className="text-slate-500">Description</dt><dd>{composer?.description || '—'}</dd>
              <dt className="text-slate-500">Type</dt><dd>{typeLabel(composer?.challengeType)}</dd>
              <dt className="text-slate-500">Duration</dt><dd>{content.durationDays ? `${content.durationDays} days` : '—'}{content.durationPresetDays?.length ? ` (presets: ${content.durationPresetDays.join(', ')})` : ''}</dd>
              <dt className="text-slate-500">Background</dt><dd>{content.coverId ?? '—'}</dd>
              <dt className="text-slate-500">Tags</dt><dd>{content.focusTags.length ? content.focusTags.join(', ') : '—'}</dd>
              {composer?.goalValue !== undefined && (<><dt className="text-slate-500">Shared goal</dt><dd>{composer.goalValue} {composer.goalUnit ?? ''}</dd></>)}
              {composer?.requiredConsecutiveDays !== undefined && (<><dt className="text-slate-500">Streak days</dt><dd>{composer.requiredConsecutiveDays}</dd></>)}
            </dl>
            <h4 className="mt-3 text-xs font-black uppercase tracking-wide text-slate-500">Activities</h4>
            {composer && composer.activities.length > 0 ? (
              <ul className="mt-1 divide-y divide-slate-100 text-xs">
                {composer.activities.map((activity, index) => (
                  <li key={`${activity.activity}-${index}`} className="py-1.5">
                    <span className="font-bold" title={activity.activity}>{activity.activity.length > 14 ? shortId(activity.activity) : activity.activity}</span>
                    {activity.observedVersion ? <span className="text-slate-500"> · v{activity.observedVersion}</span> : null}
                    <span className="text-slate-600"> · {activity.targetValue ?? '—'} {activity.unit ?? ''}{activity.metric ? ` (${activity.metric})` : ''}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-1 text-xs text-slate-500">No Activities configured yet.</p>}
          </section>
        )}
      </div>
    </V2Card>
  );
}
