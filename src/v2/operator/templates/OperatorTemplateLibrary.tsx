import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchOperatorTemplate,
  fetchOperatorTemplatePage,
  fetchTemplateMemberReadiness,
  fetchTemplateAdoption,
  publishTemplateVersion,
  retireTemplate,
  reviseTemplate,
  type OperatorTemplateDetail,
  type OperatorTemplateSummary,
  type OperatorTemplateVersion,
  type TemplateAdoptionRow,
} from '../../../api/operatorTemplatesApi';
import { ApiError } from '../../../api/apiError';
import { useTemplateCapabilities } from './useTemplateCapabilities';
import { GROUP_FOCUS_AREA_LABELS } from '../../groups/groupFocusAreas';
import { V2Card, V2EmptyState, V2LoadingState, V2Page, V2SectionHeader } from '../../components/V2Primitives';
import {
  EMPTY_FILTERS,
  LIFECYCLE_LABELS,
  TYPE_LABELS,
  activitySettings,
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
 * TIIZI-FER-P5T-2-S2/5B — Operator Template Library. Slice 5B adds author-only
 * revise and retire/discard actions plus a read-only needs-revision indicator.
 *
 * Reads the P5T-1 endpoints only. Authorization is the backend's: a Template
 * author OR a Console reader may read. This page deliberately does NOT call
 * the Console overview, so a failed overview request can never block an
 * otherwise authorized Template author. Publish remains in the draft editor;
 * all write authority stays on the existing API.
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
  const capabilities = useTemplateCapabilities();
  const canAuthor = capabilities.data?.canAuthor === true;
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
        description="Challenge Template Library: every Template and version, with how often each has been adopted."
        action={canAuthor ? <Link to="/v2/operator/templates/new" className="inline-block rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white">New Template</Link> : undefined}
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
          <TemplateDetailPanel key={selectedId} templateId={selectedId} canAuthor={canAuthor} />
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

function TemplateDetailPanel({ templateId, canAuthor }: { templateId: string; canAuthor: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
  const memberReadiness = useQuery({
    queryKey: ['operator-templates', 'member-readiness', templateId],
    queryFn: () => fetchTemplateMemberReadiness(templateId),
    enabled: !!templateId && detail.data?.lifecycle === 'published' && detail.data.latestPublishedVersion !== null,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
  const [pickedVersion, setPickedVersion] = useState<number | null>(null);
  const [accessRevoked, setAccessRevoked] = useState(false);
  const [actionBusy, setActionBusy] = useState<'revise' | 'retire' | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [retireOpen, setRetireOpen] = useState(false);
  const [retireReason, setRetireReason] = useState('');
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
  const openDraft = data.versions.find((version) => version.state === 'draft');
  const authorControls = canAuthor && !accessRevoked;
  const isUnpublishedDraft = data.lifecycle === 'draft' && data.latestPublishedVersion === null;
  const retireLabel = isUnpublishedDraft ? 'Discard this unpublished Template' : 'Retire Template';

  const handleRevise = async () => {
    setActionBusy('revise'); setActionMessage(''); setActionError('');
    try {
      const result = await reviseTemplate(data.templateId);
      await queryClient.invalidateQueries({ queryKey: ['operator-templates'] });
      navigate(`/v2/operator/templates/${encodeURIComponent(result.templateId)}/edit`);
    } catch (error) {
      const failure = error as { status?: number; code?: string; message?: string };
      if (failure.status === 403 || (error instanceof ApiError && error.status === 403)) {
        setAccessRevoked(true);
        void queryClient.invalidateQueries({ queryKey: ['operator-templates', 'capabilities'] });
        setActionError('Template authoring access was removed. This panel is now read-only.');
        return;
      }
      const refreshed = await detail.refetch();
      const currentDraft = refreshed.data?.versions.find((version) => version.state === 'draft');
      if (currentDraft) {
        setActionMessage('A draft is already open. Opening it now.');
        navigate(`/v2/operator/templates/${encodeURIComponent(data.templateId)}/edit`);
        return;
      }
      if (failure.code === 'template_not_published' || failure.code === 'template_retired') {
        setActionMessage('This Template can no longer be revised. Its current state has been refreshed.');
      } else if (failure.status === 503 || failure.status === 0 || failure.code === 'api_unreachable') {
        setActionError('The revision result could not be confirmed. The Template was refreshed; check its state before trying again.');
      } else {
        setActionError(failure.message || 'The Template could not be revised. Retry after checking its current state.');
      }
    } finally {
      setActionBusy(null);
    }
  };

  const confirmRetire = async () => {
    setActionBusy('retire'); setActionError(''); setActionMessage('');
    try {
      await retireTemplate(data.templateId, retireReason.trim() ? retireReason : undefined);
      await queryClient.invalidateQueries({ queryKey: ['operator-templates'] });
      await detail.refetch();
      setRetireOpen(false); setRetireReason(''); setActionMessage('Template retired. Existing Challenges are unchanged.');
    } catch (error) {
      const failure = error as { status?: number; code?: string; message?: string };
      const refreshed = await detail.refetch();
      if (refreshed.data?.lifecycle === 'retired') {
        await queryClient.invalidateQueries({ queryKey: ['operator-templates'] });
        setRetireOpen(false); setRetireReason(''); setActionMessage('Template retired. Existing Challenges are unchanged.');
        return;
      }
      if (failure.status === 403) {
        setAccessRevoked(true);
        void queryClient.invalidateQueries({ queryKey: ['operator-templates', 'capabilities'] });
        setActionError('Template authoring access was removed. The Template was refreshed and this panel is now read-only.');
      } else if (failure.status === 503 || failure.status === 0 || failure.code === 'api_unreachable') {
        setActionError('The retirement result could not be confirmed. The Template was refreshed; check its state before trying again.');
      } else {
        setActionError(failure.message || 'The Template could not be retired. Its current state has been refreshed.');
      }
    } finally {
      setActionBusy(null);
    }
  };

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
        <Link to={`/v2/operator/templates/${encodeURIComponent(data.templateId)}/preview`} className="mr-2 mt-3 inline-block rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700">Preview</Link>
        {canAuthor && shown?.state === 'draft' && data.lifecycle !== 'retired' && (
          <Link to={`/v2/operator/templates/${encodeURIComponent(data.templateId)}/edit`} className="mt-3 inline-block rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white">Edit draft</Link>
        )}
        {authorControls && data.lifecycle === 'published' && !openDraft && (
          <button type="button" onClick={() => void handleRevise()} disabled={actionBusy !== null} className="ml-2 mt-3 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
            {actionBusy === 'revise' ? 'Opening draft…' : 'Revise'}
          </button>
        )}
        {authorControls && openDraft && data.lifecycle !== 'retired' && data.lifecycle === 'published' && (
          <Link to={`/v2/operator/templates/${encodeURIComponent(data.templateId)}/edit`} className="ml-2 mt-3 inline-block rounded-lg border border-primary bg-white px-3 py-2 text-xs font-bold text-primary">Open draft</Link>
        )}
        {authorControls && data.lifecycle !== 'retired' && (
          <button type="button" onClick={() => { setRetireOpen(true); setRetireReason(''); setActionError(''); }} disabled={actionBusy !== null} className="ml-2 mt-3 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-800 disabled:opacity-50">
            {retireLabel}
          </button>
        )}
        {actionMessage ? <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">{actionMessage}</p> : null}
        {actionError && !retireOpen ? <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">{actionError}</p> : null}
        {data.lifecycle === 'published' && data.latestPublishedVersion !== null && (
          <div className="mt-3" aria-live="polite">
            {memberReadiness.isPending ? <p role="status" className="text-xs text-slate-500">Checking member availability…</p> : null}
            {memberReadiness.data?.adoptable === false ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">Needs revision · {memberReadiness.data.unavailableReason || 'NOT_ADOPTABLE'}</p> : null}
            {memberReadiness.isError && (memberReadiness.error as ApiError)?.status !== 404 ? <p role="status" className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">Readiness indicator unavailable. Other Library actions are still available.</p> : null}
          </div>
        )}
        {retireOpen ? (
          <div role="dialog" aria-modal="true" aria-labelledby="retire-template-title" aria-describedby="retire-template-description" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
            <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
              <h3 id="retire-template-title" className="text-lg font-black text-slate-900">{retireLabel}?</h3>
              <p id="retire-template-description" className="mt-2 text-sm leading-6 text-slate-700">Retirement is permanent. This Template will no longer be offered to members. Existing Challenges will not change.</p>
              {openDraft && data.latestPublishedVersion !== null ? <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">The open draft will remain, but it can no longer be saved or published after retirement.</p> : null}
              <label htmlFor="retire-template-reason" className="mt-4 block text-sm font-bold text-slate-800">Reason <span className="font-normal text-slate-500">(optional)</span></label>
              <textarea id="retire-template-reason" value={retireReason} onChange={(event) => setRetireReason(event.target.value)} disabled={!authorControls} maxLength={500} rows={3} placeholder="Add a reason if useful" className={`${inputClass} mt-1 w-full resize-y disabled:bg-slate-100`} />
              <p className="mt-1 text-right text-xs text-slate-500">{retireReason.length}/500</p>
              {actionError ? <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">{actionError}</p> : null}
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setRetireOpen(false)} disabled={actionBusy === 'retire'} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">Cancel</button>
                {authorControls ? <button type="button" onClick={() => void confirmRetire()} disabled={actionBusy === 'retire'} className="rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{actionBusy === 'retire' ? 'Retiring…' : retireLabel}</button> : null}
              </div>
            </section>
          </div>
        ) : null}
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
                    {activitySettings(activity).map((line) => <span key={line} className="block text-[11px] text-slate-500">{line}</span>)}
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
