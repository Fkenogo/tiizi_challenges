import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ActivityThumbnail } from '../../components/ActivityThumbnail';
import {
  V2Chip,
  V2EmptyState,
  V2ErrorState,
  V2LoadingState,
  V2TextInput,
} from '../../components/V2Primitives';
import { allowsMultipleActivities } from '../challengeCreationDraft';
import { useComposerCatalogue } from '../useChallengeCreation';
import type { ApiKnowledgeItemLike } from './activityDraft';
import type { ActivitiesStepState } from './stepStates';

/** Only a plain primary click navigates in this tab; modified/middle clicks open elsewhere and must not arm recovery. */
function isPlainPrimaryClick(event: React.MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.defaultPrevented;
}

/**
 * Reusable Activity selection step. Generic over the caller's draft so the
 * caller keeps its own draft type; only `challengeType` and `activities` are read.
 */
export function ActivitiesStep<TDraft extends ActivitiesStepState>({
  state,
  preselectedIdentity,
  addToDraft,
  addingId,
  addError,
  onAdd,
  onRemove,
  onHandoffConsumed,
  guideLinkState,
  onGuideTrip,
  pick = false,
}: {
  state: TDraft;
  preselectedIdentity: string;
  addToDraft: boolean;
  addingId: string | null;
  addError: string;
  onAdd: (item: ApiKnowledgeItemLike) => Promise<TDraft | null>;
  onRemove: (activityId: string) => void;
  onHandoffConsumed: (updatedDraft?: TDraft | null) => void;
  /** Router state carried on Activity Guide links so the caller's draft survives the round trip. */
  guideLinkState?: unknown;
  onGuideTrip?: () => void;
  /**
   * In-place picking (Template authoring): rows add the Activity directly and the
   * Guide opens in a new tab, so the caller's unsaved work is never navigated away
   * from. Omitted/false = the member Wizard's Guide-trip behaviour, unchanged.
   */
  pick?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'fitness' | 'wellness'>('all');
  const preselectionHandled = useRef('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const catalogue = useComposerCatalogue(kindFilter === 'all' ? undefined : kindFilter, debounced);
  const multi = allowsMultipleActivities(state.challengeType);
  const selectedIds = new Set(state.activities.map((activity) => activity.activity));

  useEffect(() => {
    if (!preselectedIdentity || preselectionHandled.current === preselectedIdentity || !catalogue.data) return;
    const item = catalogue.data.find((candidate) =>
      candidate.id === preselectedIdentity || candidate.activityCode === preselectedIdentity);
    if (!item) return;
    preselectionHandled.current = preselectedIdentity;
    if (selectedIds.has(item.id)) {
      onHandoffConsumed();
      return;
    }
    // Handoffs are generated only by an explicit Activity detail CTA.
    // Opening a result from this list never supplies a handoff identity.
    if (addToDraft || preselectedIdentity) {
      void onAdd(item).then((updatedDraft) => onHandoffConsumed(updatedDraft));
    }
  }, [addToDraft, catalogue.data, onAdd, onHandoffConsumed, preselectedIdentity, state.activities]);

  return (
    <div className="space-y-4">
      {pick ? (
        <p className="text-sm leading-6 text-slate-600">
          Choose Activities from the governed catalogue. {multi
            ? 'A Streak can include more than one daily activity.'
            : 'Together and Race work best with a single activity.'}
        </p>
      ) : (
      <p className="text-sm leading-6 text-slate-600">
        Choose from the{' '}
        <Link
          to="/v2/guide"
          state={guideLinkState}
          onClick={(event) => { if (isPlainPrimaryClick(event)) onGuideTrip?.(); }}
          className="font-bold text-primary underline underline-offset-2"
        >
          Activity Guide
        </Link>
        .{' '}
        {multi
          ? 'A Streak can include more than one daily activity.'
          : 'Together and Race work best with a single activity.'}
      </p>
      )}

      {state.activities.length > 0 ? (
        <section aria-label="Selected activities" className="overflow-hidden rounded-2xl border border-orange-200 bg-white">
          <div className="border-b border-orange-100 bg-orange-50 px-3 py-2">
            <h2 className="text-sm font-extrabold text-slate-900">Selected activities</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {state.activities.map((activity) => (
              <li key={activity.activity} className="flex min-h-[60px] items-center gap-3 px-3 py-2.5">
                <ActivityThumbnail imageUrl={activity.imageUrl} size="selected" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-900">{activity.name}</span>
                  <span className="block truncate text-xs text-slate-500">{activity.kind === 'wellness' ? 'Wellness' : 'Fitness'}{activity.category ? ` · ${activity.category}` : ''}{activity.subcategory ? ` · ${activity.subcategory}` : ''}</span>
                </span>
                <button type="button" onClick={() => onRemove(activity.activity)} className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <V2TextInput value={search} onChange={setSearch} placeholder="Search activities…" />
        </div>
        {(['all', 'fitness', 'wellness'] as const).map((kind) => (
          <V2Chip key={kind} selected={kindFilter === kind} onClick={() => setKindFilter(kind)}>
            {kind === 'all' ? 'All' : kind === 'fitness' ? 'Fitness' : 'Wellness'}
          </V2Chip>
        ))}
      </div>

      {addingId ? <p role="status" className="text-sm font-semibold text-primary">Adding this Activity to your Challenge…</p> : null}
      {addError && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{addError}</p>}

      {catalogue.isLoading && <V2LoadingState label="Loading activities…" />}
      {catalogue.isError && (
        <V2ErrorState
          title="We could not load activities"
          message="Please try again."
          onRetry={() => void catalogue.refetch()}
        />
      )}
      {catalogue.isSuccess && catalogue.data.length === 0 && (
        <V2EmptyState
          title="No activities found"
          message="Try a different search or filter. Only activities available for new Challenges appear here."
        />
      )}
      {catalogue.isSuccess && catalogue.data.length > 0 && (
        <ul className="max-h-[min(48vh,420px)] divide-y divide-slate-100 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
          {catalogue.data.map((item) => {
            if (pick) {
              const chosen = selectedIds.has(item.id);
              return (
                <li key={item.id} className="flex min-h-[64px] items-center gap-3 px-3 py-2.5">
                  <ActivityThumbnail imageUrl={item.imageUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-900">{item.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">{item.kind === 'wellness' ? 'Wellness' : 'Fitness'} · {item.category}{item.subcategory ? ` · ${item.subcategory}` : ''}</span>
                  </span>
                  <a href={`/v2/guide/${encodeURIComponent(item.id)}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${item.name} in the Activity Guide (opens in a new tab)`} className="shrink-0 text-xs font-bold text-slate-600 underline underline-offset-2 hover:text-primary">View guide</a>
                  <button
                    type="button"
                    disabled={chosen || addingId !== null}
                    onClick={() => void onAdd(item)}
                    aria-label={chosen ? `${item.name} is already added` : `Add ${item.name}`}
                    className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    {chosen ? 'Added' : 'Add'}
                  </button>
                </li>
              );
            }
            return (
              <li key={item.id}>
              <Link
                to={`/v2/guide/${encodeURIComponent(item.id)}`}
                state={guideLinkState}
                onClick={(event) => { if (isPlainPrimaryClick(event)) onGuideTrip?.(); }}
                aria-label={`Open ${item.name}, ${item.kind === 'wellness' ? 'Wellness' : 'Fitness'}, ${item.category}${item.subcategory ? `, ${item.subcategory}` : ''}`}
                className="group flex min-h-[64px] items-center gap-3 px-3 py-2.5 outline-none transition-colors hover:bg-orange-50/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                <ActivityThumbnail imageUrl={item.imageUrl} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-900 group-hover:text-primary">{item.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">{item.kind === 'wellness' ? 'Wellness' : 'Fitness'} · {item.category}{item.subcategory ? ` · ${item.subcategory}` : ''}</span>
                </span>
                <span className="shrink-0 text-lg text-slate-300 group-hover:text-primary" aria-hidden="true">›</span>
              </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
