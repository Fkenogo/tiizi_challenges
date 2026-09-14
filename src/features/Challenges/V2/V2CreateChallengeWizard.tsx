/**
 * PF-05 V2 Challenge Creation Wizard.
 *
 * Founder-visible V2 creation flow: TYPE → BASICS → ACTIVITIES →
 * MEASUREMENT → REQUIREMENT → SCHEDULE → RULES → REVIEW → FINISH.
 *
 * - Single client-side draft model: PF-04 ChallengeComposerDraft shape
 *   (src/features/Challenges/V2/composerDraft.ts). No second schema.
 * - Stage gating mirrors PF-04 field coverage (UX only); semantic
 *   authority is the server: Review renders previewChallengeComposer
 *   output via POST /v1/challenge-definitions/preview, and Finish
 *   establishes through POST /v1/challenges. No local validator.
 * - Activity identity is the immutable UUID/Code (stored); display names
 *   are presentation only. Options (Metrics/Units/Components/bases) come
 *   from GET /v1/knowledge/:id/options — never hard-coded per-activity
 *   configuration.
 * - No V1 semantics: no name matching, no synthetic IDs, no points,
 *   frequency, donations, reset-on-miss control, Firebase writes, or V1
 *   Template services. No Template behavior (reserved disabled entry).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { BottomNav, Screen } from '../../../components/Layout';
import { isV2ChallengesEnabled } from '../../../api/v2ChallengeMode';
import {
  definitionToRouteBody,
  DURATION_MODE_DESCRIPTIONS,
  DURATION_MODE_LABELS,
  establishV2Challenge,
  fetchV2ActivityOptions,
  fetchV2PublishedActivities,
  loadBasisLabel,
  LOAD_BASIS_DESCRIPTIONS,
  previewV2Draft,
  resolveEstablishmentGroupId,
  type V2ActivityOptions,
  type V2NormalizedDefinition,
  type V2PreviewIssue,
  type V2PublishedActivity,
} from '../../../api/v2ChallengeCreationApi';
import {
  createEmptyDraft,
  missingForStage,
  WIZARD_STAGE_ORDER,
  type ComposerActivityDraft,
  type ComposerDraft,
  type WizardStage,
} from './composerDraft';

/** Governed Unit → Metric vocabulary mirror (grouping only; server validates). */
const UNIT_METRIC: Record<string, string> = {
  completion: 'completion',
  reps: 'repetitions',
  repetitions: 'repetitions',
  seconds: 'duration',
  minutes: 'duration',
  hours: 'duration',
  metres: 'distance',
  kilometres: 'distance',
  grams: 'weight',
  kilograms: 'weight',
  steps: 'quantity',
  millilitres: 'quantity',
  litres: 'quantity',
  servings: 'quantity',
  pages: 'quantity',
  acts: 'quantity',
  flights: 'quantity',
};

const TYPE_COPY: Record<string, { title: string; blurb: string }> = {
  collective: {
    title: 'Collective',
    blurb: 'Work together toward one shared goal.',
  },
  competitive: {
    title: 'Competitive',
    blurb: 'Race toward a target and compare finishing positions.',
  },
  streak: {
    title: 'Streak',
    blurb: 'Complete the required activity every day and keep the streak going.',
  },
};

function stageLabel(stage: WizardStage): string {
  return stage.charAt(0) + stage.slice(1).toLowerCase();
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[12px] font-bold text-red-600">{message}</p>;
}

export default function V2CreateChallengeWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('groupId') ?? '';
  const enabled = isV2ChallengesEnabled();

  const [entered, setEntered] = useState(false);
  const [draft, setDraft] = useState<ComposerDraft>(() => createEmptyDraft());
  const [stage, setStage] = useState<WizardStage>('TYPE');
  const [catalogue, setCatalogue] = useState<V2PublishedActivity[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // Options are cached by canonical Knowledge UUID (single entry per
  // Activity); Composer immutable identities (UUID or Code) map onto the
  // canonical key, so coded Activities never create competing cache keys.
  const [optionsCache, setOptionsCache] = useState<Record<string, V2ActivityOptions>>({});
  const [identityToUuid, setIdentityToUuid] = useState<Record<string, string>>({});
  const [previewState, setPreviewState] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ok'; definition: V2NormalizedDefinition }
    | { status: 'invalid'; issues: V2PreviewIssue[] }
  >({ status: 'idle' });
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  // Tiizi Group UUID for establishment (translated from Group UI context
  // through the identity bridge — never a Firestore id downstream).
  const [establishmentGroupId, setEstablishmentGroupId] = useState<string | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEstablishmentGroupId(null);
    setGroupError(null);
    if (!groupId) return;
    resolveEstablishmentGroupId(groupId).then(
      (resolved) => {
        if (!cancelled) setEstablishmentGroupId(resolved);
      },
      (error: unknown) => {
        if (!cancelled) {
          setGroupError(error instanceof Error ? error.message : 'Group could not be resolved.');
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const updateDraft = useCallback((patch: Partial<ComposerDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setPreviewState({ status: 'idle' });
  }, []);

  const updateActivity = useCallback(
    (index: number, patch: Partial<ComposerActivityDraft>) => {
      setDraft((prev) => ({
        ...prev,
        activities: prev.activities.map((activity, position) =>
          position === index ? { ...activity, ...patch } : activity,
        ),
      }));
      setPreviewState({ status: 'idle' });
    },
    [],
  );

  const loadCatalogue = useCallback(
    async (query: string) => {
      setCatalogueLoading(true);
      setCatalogueError(null);
      try {
        const items = await fetchV2PublishedActivities(query || undefined);
        setCatalogue(items);
      } catch (error) {
        setCatalogueError(error instanceof Error ? error.message : 'Could not load activities.');
      } finally {
        setCatalogueLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (entered && stage === 'ACTIVITIES' && catalogue.length === 0 && !catalogueLoading) {
      void loadCatalogue('');
    }
  }, [entered, stage, catalogue.length, catalogueLoading, loadCatalogue]);

  // One canonical identity strategy end to end: the options seam accepts
  // the Composer immutable identity (UUID or Code) and answers with the
  // canonical UUID, which becomes the single cache key.
  const ensureOptions = useCallback(async (identity: string): Promise<V2ActivityOptions | null> => {
    const known = identityToUuid[identity];
    const cached = optionsCache[known ?? identity];
    if (cached) return cached;
    try {
      const options = await fetchV2ActivityOptions(identity);
      setOptionsCache((prev) => ({ ...prev, [options.knowledgeId]: options }));
      setIdentityToUuid((prev) => ({ ...prev, [identity]: options.knowledgeId }));
      return options;
    } catch {
      return null;
    }
  }, [optionsCache, identityToUuid]);

  const optionsFor = useCallback(
    (identity: string): V2ActivityOptions | undefined =>
      optionsCache[identityToUuid[identity] ?? identity],
    [optionsCache, identityToUuid],
  );

  const selectActivity = useCallback(
    async (item: V2PublishedActivity) => {
      const options = await ensureOptions(item.id);
      if (!options) {
        setCatalogueError(`Could not load configuration for ${item.name}.`);
        return;
      }
      setDraft((prev) => ({
        ...prev,
        activities: [
          ...prev.activities,
          {
            activity: item.activityCode ?? item.id,
            observedVersion: options.currentVersion,
            kind: item.kind,
            displayName: item.name,
            position: prev.activities.length,
            ...(options.components.length > 0
              ? { componentIds: options.components.map((c) => c.componentId) }
              : {}),
          },
        ],
      }));
    },
    [ensureOptions],
  );

  const runPreview = useCallback(async () => {
    setPreviewState({ status: 'loading' });
    try {
      const result = await previewV2Draft(draft);
      if (result.ok) {
        setPreviewState({ status: 'ok', definition: result.definition });
      } else {
        setPreviewState({ status: 'invalid', issues: result.issues });
      }
    } catch (error) {
      setPreviewState({
        status: 'invalid',
        issues: [{ code: 'PREVIEW_UNREACHABLE', message: error instanceof Error ? error.message : 'Preview failed.' }],
      });
    }
  }, [draft]);

  useEffect(() => {
    if (stage === 'REVIEW' && previewState.status === 'idle') {
      void runPreview();
    }
  }, [stage, previewState.status, runPreview]);

  const refreshActivity = useCallback(
    async (index: number) => {
      const entry = draft.activities[index];
      if (!entry) return;
      // Explicit refresh through the same identity seam (Code or UUID):
      // options stay available under the canonical cache key.
      const options = await fetchV2ActivityOptions(entry.activity);
      setOptionsCache((prev) => ({ ...prev, [options.knowledgeId]: options }));
      setIdentityToUuid((prev) => ({ ...prev, [entry.activity]: options.knowledgeId }));
      updateActivity(index, { observedVersion: options.currentVersion });
    },
    [draft.activities, updateActivity],
  );

  const finish = useCallback(async () => {
    if (previewState.status !== 'ok' || finishing) return;
    if (!establishmentGroupId) {
      setFinishError(
        groupError ?? 'Group context is still resolving. Wait a moment and try again.',
      );
      return;
    }
    setFinishing(true);
    setFinishError(null);
    try {
      const response = await establishV2Challenge(
        definitionToRouteBody(previewState.definition, establishmentGroupId),
      );
      navigate(`/app/challenge/v2/${response.challengeId}`);
    } catch (error) {
      setFinishError(error instanceof Error ? error.message : 'Establishment failed.');
    } finally {
      setFinishing(false);
    }
  }, [previewState, finishing, establishmentGroupId, groupError, navigate]);

  const stageIndex = useMemo(() => WIZARD_STAGE_ORDER.indexOf(stage), [stage]);
  const blocking = useMemo(() => missingForStage(draft, stage), [draft, stage]);

  if (!enabled) {
    return (
      <Screen noPadding noBottomPadding className="st-page">
        <div className="st-frame st-bottom-safe pb-[108px]">
          <main className="st-form-max mt-10 text-center">
            <p className="text-[15px] font-bold text-slate-900">V2 Challenge creation is not enabled.</p>
            <button className="st-btn-primary mt-6" onClick={() => navigate('/app/challenges/v2')}>
              Back to V2 Challenges
            </button>
          </main>
        </div>
        <BottomNav active="home" />
      </Screen>
    );
  }

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[108px]">
        <div className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 pb-3">
          <header className="st-form-max flex items-center justify-between">
            <button
              aria-label="Back"
              className="h-10 w-10 flex items-center justify-center"
              onClick={() => navigate('/app/challenges/v2')}
            >
              <ArrowLeft size={22} className="text-slate-900" />
            </button>
            <h1 className="st-page-title">New V2 Challenge</h1>
            <span className="w-10" />
          </header>
          {entered && (
            <div className="st-form-max mt-2 flex items-center gap-1" aria-label="Wizard progress">
              {WIZARD_STAGE_ORDER.filter((s) => s !== 'FINISH').map((s) => (
                <span
                  key={s}
                  title={stageLabel(s)}
                  className={`h-1.5 flex-1 rounded-full ${
                    WIZARD_STAGE_ORDER.indexOf(s) <= stageIndex ? 'bg-primary' : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <main className="st-form-max mt-5 space-y-4">
          {groupError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3" role="alert">
              <p className="text-[13px] font-bold text-red-700">{groupError}</p>
            </div>
          )}
          {!entered && (
            <section aria-label="Start options" className="space-y-3">
              <h2 className="text-[17px] font-black text-slate-900">How do you want to start?</h2>
              <button className="st-card w-full p-4 text-left" onClick={() => setEntered(true)}>
                <p className="text-[15px] font-bold text-slate-900">Start from scratch</p>
                <p className="text-[13px] text-slate-500">Build a new Challenge step by step.</p>
              </button>
              <button
                className="st-card w-full p-4 text-left opacity-60"
                disabled
                aria-disabled="true"
                title="Coming next"
              >
                <p className="text-[15px] font-bold text-slate-900">
                  Use a Template <span className="text-[11px] font-black uppercase text-slate-400">Coming next</span>
                </p>
                <p className="text-[13px] text-slate-500">
                  Templates will pre-fill this same Wizard in a later release.
                </p>
              </button>
            </section>
          )}

          {entered && stage === 'TYPE' && (
            <section aria-label="Challenge type" className="space-y-3">
              <h2 className="text-[17px] font-black text-slate-900">What kind of Challenge?</h2>
              {(['collective', 'competitive', 'streak'] as const).map((type) => (
                <button
                  key={type}
                  className={`st-card w-full p-4 text-left ${
                    draft.challengeType === type ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => updateDraft({ challengeType: type })}
                >
                  <p className="text-[15px] font-bold text-slate-900">{TYPE_COPY[type].title}</p>
                  <p className="text-[13px] text-slate-500">{TYPE_COPY[type].blurb}</p>
                </button>
              ))}
            </section>
          )}

          {entered && stage === 'BASICS' && (
            <section aria-label="Basics" className="space-y-3">
              <h2 className="text-[17px] font-black text-slate-900">Name your Challenge</h2>
              <label className="block">
                <span className="text-[13px] font-bold text-slate-700">Challenge name</span>
                <input
                  aria-label="Challenge name"
                  className="st-input mt-1 w-full"
                  value={draft.title ?? ''}
                  maxLength={200}
                  onChange={(event) => updateDraft({ title: event.target.value })}
                  placeholder="e.g. October Plank Club"
                />
              </label>
              <label className="block">
                <span className="text-[13px] font-bold text-slate-700">Description <span className="font-normal text-slate-400">(optional)</span></span>
                <textarea
                  aria-label="Description"
                  className="st-input mt-1 w-full"
                  value={draft.description ?? ''}
                  maxLength={2000}
                  onChange={(event) => updateDraft({ description: event.target.value })}
                  placeholder="What is this Challenge about?"
                />
              </label>
              <label className="block">
                <span className="text-[13px] font-bold text-slate-700">Instructions <span className="font-normal text-slate-400">(optional)</span></span>
                <textarea
                  aria-label="Instructions"
                  className="st-input mt-1 w-full"
                  value={draft.instructions ?? ''}
                  maxLength={2000}
                  onChange={(event) => updateDraft({ instructions: event.target.value })}
                  placeholder="Anything participants should know."
                />
              </label>
            </section>
          )}

          {entered && stage === 'ACTIVITIES' && (
            <section aria-label="Activities" className="space-y-3">
              <h2 className="text-[17px] font-black text-slate-900">Choose an Activity</h2>
              {draft.activities.map((activity, index) => (
                <div key={`${activity.activity}-${index}`} className="st-card p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-bold text-slate-900">
                      {activity.displayName ?? activity.activity}
                    </p>
                    <p className="text-[12px] text-slate-500">
                      {activity.kind} · v{activity.observedVersion}
                    </p>
                  </div>
                  <button
                    className="text-[13px] font-bold text-red-600"
                    onClick={() => setDraft((prev) => ({
                      ...prev,
                      activities: prev.activities.filter((_, position) => position !== index),
                    }))}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <label className="block">
                <span className="text-[13px] font-bold text-slate-700">Search canonical Activities</span>
                <div className="mt-1 flex gap-2">
                  <input
                    aria-label="Search activities"
                    className="st-input flex-1"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="e.g. Side Plank"
                  />
                  <button className="st-btn-secondary" onClick={() => void loadCatalogue(search)}>
                    Search
                  </button>
                </div>
              </label>
              {catalogueLoading && <p className="text-[14px] text-slate-500">Loading activities…</p>}
              <FieldError message={catalogueError ?? undefined} />
              <div className="space-y-2">
                {catalogue.map((item) => (
                  <button
                    key={item.id}
                    className="st-card w-full p-4 text-left"
                    onClick={() => void selectActivity(item)}
                  >
                    <p className="text-[15px] font-bold text-slate-900">{item.name}</p>
                    <p className="text-[12px] text-slate-500">
                      {item.kind} · {item.category}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {entered && stage === 'MEASUREMENT' && (
            <section aria-label="Measurement" className="space-y-4">
              <h2 className="text-[17px] font-black text-slate-900">How is it measured?</h2>
              {draft.activities.map((activity, index) => (
                <MeasurementCard
                  key={`${activity.activity}-${index}`}
                  activity={activity}
                  options={optionsFor(activity.activity)}
                  onLoadOptions={() => void ensureOptions(activity.activity)}
                  onChange={(patch) => updateActivity(index, patch)}
                />
              ))}
            </section>
          )}

          {entered && stage === 'REQUIREMENT' && (
            <section aria-label="Requirement" className="space-y-4">
              <h2 className="text-[17px] font-black text-slate-900">What is the target?</h2>
              {draft.activities.map((activity, index) => (
                <div key={`${activity.activity}-${index}`} className="st-card p-4 space-y-3">
                  <p className="text-[15px] font-bold text-slate-900">
                    {activity.displayName ?? activity.activity}
                  </p>
                  <label className="block">
                    <span className="text-[13px] font-bold text-slate-700">
                      Target ({activity.unit ?? 'unit'})
                    </span>
                    <input
                      aria-label={`Target for ${activity.displayName ?? activity.activity}`}
                      type="number"
                      min={0}
                      step="any"
                      className="st-input mt-1 w-full"
                      value={activity.targetValue ?? ''}
                      onChange={(event) => updateActivity(index, {
                        targetValue: event.target.value === '' ? undefined : Number(event.target.value),
                      })}
                    />
                  </label>
                  {activity.metric === 'duration' && (
                    <fieldset>
                      <legend className="text-[13px] font-bold text-slate-700">Duration mode</legend>
                      {(['CONTINUOUS', 'ACCUMULATED'] as const).map((mode) => (
                        <label key={mode} className="mt-1 flex items-start gap-2">
                          <input
                            type="radio"
                            name={`duration-${index}`}
                            checked={activity.durationMode === mode}
                            onChange={() => updateActivity(index, { durationMode: mode })}
                          />
                          <span>
                            <span className="text-[14px] font-bold text-slate-900">
                              {DURATION_MODE_LABELS[mode]}
                            </span>
                            <span className="block text-[12px] text-slate-500">
                              {DURATION_MODE_DESCRIPTIONS[mode]}
                            </span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  )}
                  {activity.metric === 'completion' && (
                    <label className="block">
                      <span className="text-[13px] font-bold text-slate-700">
                        What counts as complete?
                      </span>
                      <input
                        aria-label="Completion occurrence"
                        className="st-input mt-1 w-full"
                        value={activity.completionOccurrence ?? ''}
                        maxLength={500}
                        onChange={(event) => updateActivity(index, {
                          completionOccurrence: event.target.value,
                        })}
                        placeholder="e.g. Complete one full guided session"
                      />
                    </label>
                  )}
                </div>
              ))}
            </section>
          )}

          {entered && stage === 'SCHEDULE' && (
            <section aria-label="Schedule" className="space-y-3">
              <h2 className="text-[17px] font-black text-slate-900">When does it run?</h2>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[13px] font-bold text-slate-700">Start date</span>
                  <input
                    aria-label="Start date"
                    type="date"
                    className="st-input mt-1 w-full"
                    value={draft.startDate ?? ''}
                    onChange={(event) => updateDraft({ startDate: event.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-[13px] font-bold text-slate-700">End date</span>
                  <input
                    aria-label="End date"
                    type="date"
                    className="st-input mt-1 w-full"
                    value={draft.endDate ?? ''}
                    onChange={(event) => updateDraft({ endDate: event.target.value })}
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-[13px] font-bold text-slate-700">
                  Timezone {draft.challengeType === 'streak' ? '' : <span className="font-normal text-slate-400">(optional, UTC otherwise)</span>}
                </span>
                <input
                  aria-label="Timezone"
                  className="st-input mt-1 w-full"
                  value={draft.timezone ?? ''}
                  onChange={(event) => updateDraft({ timezone: event.target.value })}
                  placeholder="e.g. Africa/Nairobi"
                />
              </label>
              {draft.challengeType === 'streak' && (
                <p className="text-[12px] text-slate-500">
                  The Challenge timezone determines when each day starts and ends.
                </p>
              )}
              <details className="st-card p-4">
                <summary className="text-[14px] font-bold text-slate-900">
                  Time conditions <span className="font-normal text-slate-400">(optional)</span>
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[12px] font-bold text-slate-700">At</span>
                    <input
                      aria-label="At time"
                      type="time"
                      className="st-input mt-1 w-full"
                      value={draft.temporalConditions?.at ?? ''}
                      onChange={(event) => updateDraft({
                        temporalConditions: {
                          ...draft.temporalConditions,
                          at: event.target.value || undefined,
                        },
                      })}
                    />
                  </label>
                  <label className="block">
                    <span className="text-[12px] font-bold text-slate-700">Before</span>
                    <input
                      aria-label="Before time"
                      type="time"
                      className="st-input mt-1 w-full"
                      value={draft.temporalConditions?.before ?? ''}
                      onChange={(event) => updateDraft({
                        temporalConditions: {
                          ...draft.temporalConditions,
                          before: event.target.value || undefined,
                        },
                      })}
                    />
                  </label>
                  <label className="block">
                    <span className="text-[12px] font-bold text-slate-700">After</span>
                    <input
                      aria-label="After time"
                      type="time"
                      className="st-input mt-1 w-full"
                      value={draft.temporalConditions?.after ?? ''}
                      onChange={(event) => updateDraft({
                        temporalConditions: {
                          ...draft.temporalConditions,
                          after: event.target.value || undefined,
                        },
                      })}
                    />
                  </label>
                </div>
              </details>
            </section>
          )}

          {entered && stage === 'RULES' && (
            <section aria-label="Rules" className="space-y-3">
              <h2 className="text-[17px] font-black text-slate-900">Challenge rules</h2>
              {draft.challengeType === 'collective' && (
                <>
                  <label className="block">
                    <span className="text-[13px] font-bold text-slate-700">Shared goal value</span>
                    <input
                      aria-label="Goal value"
                      type="number"
                      min={0}
                      step="any"
                      className="st-input mt-1 w-full"
                      value={draft.goalValue ?? ''}
                      onChange={(event) => updateDraft({
                        goalValue: event.target.value === '' ? undefined : Number(event.target.value),
                      })}
                    />
                  </label>
                  <label className="block">
                    <span className="text-[13px] font-bold text-slate-700">Goal unit</span>
                    <input
                      aria-label="Goal unit"
                      className="st-input mt-1 w-full"
                      value={draft.goalUnit ?? ''}
                      onChange={(event) => updateDraft({ goalUnit: event.target.value })}
                      placeholder="Must match the activity unit"
                    />
                  </label>
                  <p className="text-[12px] text-slate-500">
                    Everyone contributes toward the shared goal. Totals past 100% count, and
                    reaching the goal may finish the Challenge early.
                  </p>
                </>
              )}
              {draft.challengeType === 'competitive' && (
                <div className="st-card p-4">
                  <p className="text-[14px] text-slate-700">
                    Positions follow finishing order with standard competition ranking. One
                    finisher never ends the Challenge — the window governs closure.
                  </p>
                </div>
              )}
              {draft.challengeType === 'streak' && (
                <>
                  <label className="block">
                    <span className="text-[13px] font-bold text-slate-700">Required days</span>
                    <input
                      aria-label="Required days"
                      type="number"
                      min={1}
                      step={1}
                      className="st-input mt-1 w-full"
                      value={draft.requiredConsecutiveDays ?? ''}
                      onChange={(event) => updateDraft({
                        requiredConsecutiveDays: event.target.value === ''
                          ? undefined
                          : Math.floor(Number(event.target.value)),
                      })}
                    />
                  </label>
                  <div className="st-card p-4">
                    <p className="text-[14px] text-slate-700">
                      Daily only: every daily requirement must be done. A missed day resets
                      the current streak. There is no Streak leaderboard.
                    </p>
                  </div>
                </>
              )}
            </section>
          )}

          {entered && stage === 'REVIEW' && (
            <section aria-label="Review" className="space-y-3">
              <h2 className="text-[17px] font-black text-slate-900">Review</h2>
              {previewState.status === 'loading' && (
                <p className="text-[14px] text-slate-500">Checking your Challenge…</p>
              )}
              {previewState.status === 'ok' && (
                <ReviewCard
                  definition={previewState.definition}
                  onEdit={(target) => setStage(target)}
                  onFinish={finish}
                  finishing={finishing}
                  finishError={finishError}
                />
              )}
              {previewState.status === 'invalid' && (
                <div className="space-y-2">
                  {previewState.issues.map((issue, position) => (
                    <div key={position} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-[13px] font-bold text-amber-800">{issue.code}</p>
                      <p className="text-[13px] text-amber-700">{issue.message}</p>
                      {issue.code === 'STALE_ACTIVITY' && issue.activityIndex !== undefined && (
                        <button
                          className="mt-2 text-[13px] font-bold text-amber-800 underline"
                          onClick={() => void refreshActivity(issue.activityIndex as number)}
                        >
                          Refresh activity to current version
                        </button>
                      )}
                      {issue.stage && (issue.stage as string) !== 'REVIEW' && (
                        <button
                          className="mt-2 ml-3 text-[13px] font-bold text-amber-800 underline"
                          onClick={() => setStage(issue.stage as WizardStage)}
                        >
                          Edit {stageLabel(issue.stage as WizardStage)}
                        </button>
                      )}
                    </div>
                  ))}
                  <button className="st-btn-secondary" onClick={() => void runPreview()}>
                    Check again
                  </button>
                </div>
              )}
            </section>
          )}

          {entered && stage === 'REVIEW' && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                className="st-btn-secondary flex items-center gap-1"
                onClick={() => setStage('RULES')}
              >
                <ChevronLeft size={16} /> Back
              </button>
            </div>
          )}
          {entered && stage !== 'REVIEW' && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                className="st-btn-secondary flex items-center gap-1"
                onClick={() => setStage(WIZARD_STAGE_ORDER[Math.max(0, stageIndex - 1)])}
                disabled={stageIndex === 0}
              >
                <ChevronLeft size={16} /> Back
              </button>
              <button
                className="st-btn-primary flex items-center gap-1"
                disabled={blocking.length > 0}
                title={blocking.length > 0 ? `Missing: ${blocking.join(', ')}` : undefined}
                onClick={() => setStage(WIZARD_STAGE_ORDER[Math.min(WIZARD_STAGE_ORDER.length - 1, stageIndex + 1)])}
              >
                Continue <ChevronRight size={16} />
              </button>
            </div>
          )}
          {entered && stage !== 'REVIEW' && blocking.length > 0 && (
            <p className="text-[12px] text-slate-500">Complete this step to continue: {blocking.join(', ')}</p>
          )}
        </main>
      </div>
      <BottomNav active="home" />
    </Screen>
  );
}

function MeasurementCard({
  activity,
  options,
  onLoadOptions,
  onChange,
}: {
  activity: ComposerActivityDraft;
  options: V2ActivityOptions | undefined;
  onLoadOptions: () => void;
  onChange: (patch: Partial<ComposerActivityDraft>) => void;
}) {
  useEffect(() => {
    if (!options) onLoadOptions();
  }, [options, onLoadOptions]);
  const metrics = useMemo(
    () => (options ? [...options.primaryMetrics, ...options.secondaryMetrics] : []),
    [options],
  );
  const unitsForMetric = useMemo(
    () => (options && activity.metric
      ? options.compatibleUnits.filter((unit) => (UNIT_METRIC[unit] ?? '') === activity.metric)
      : (options?.compatibleUnits ?? [])),
    [options, activity.metric],
  );
  return (
    <div className="st-card p-4 space-y-3">
      <p className="text-[15px] font-bold text-slate-900">{activity.displayName ?? activity.activity}</p>
      {!options && <p className="text-[13px] text-slate-500">Loading valid options…</p>}
      {options && (
        <>
          <label className="block">
            <span className="text-[13px] font-bold text-slate-700">Metric</span>
            <select
              aria-label={`Metric for ${activity.displayName ?? activity.activity}`}
              className="st-input mt-1 w-full"
              value={activity.metric ?? ''}
              onChange={(event) => onChange({
                metric: event.target.value || undefined,
                unit: undefined,
                loadBasis: undefined,
                durationMode: undefined,
                completionOccurrence: undefined,
              })}
            >
              <option value="">Choose a metric</option>
              {metrics.map((metric) => (
                <option key={metric} value={metric}>{metric}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[13px] font-bold text-slate-700">Unit</span>
            <select
              aria-label={`Unit for ${activity.displayName ?? activity.activity}`}
              className="st-input mt-1 w-full"
              value={activity.unit ?? ''}
              onChange={(event) => onChange({ unit: event.target.value || undefined })}
            >
              <option value="">Choose a unit</option>
              {unitsForMetric.map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </label>
          {options.components.length > 0 && (
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-[13px] font-bold text-slate-700">Required parts (all must be done)</p>
              <ul className="mt-1 space-y-1">
                {options.components.map((component) => (
                  <li key={component.componentId} className="text-[13px] text-slate-600">
                    <Check size={13} className="mr-1 inline text-primary" />
                    {component.displayName}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[12px] text-slate-500">
                Your target applies to each part separately — sides are never added together.
              </p>
            </div>
          )}
          {activity.metric === 'weight' && (
            <fieldset>
              <legend className="text-[13px] font-bold text-slate-700">How is the weight reported?</legend>
              {options.supportedLoadBases.map((basis) => (
                <label key={basis} className="mt-1 flex items-start gap-2">
                  <input
                    type="radio"
                    name={`basis-${activity.activity}`}
                    checked={activity.loadBasis === basis}
                    onChange={() => onChange({ loadBasis: basis })}
                  />
                  <span>
                    <span className="text-[14px] font-bold text-slate-900">
                      {loadBasisLabel(basis)}
                    </span>
                    <span className="block text-[12px] text-slate-500">
                      {LOAD_BASIS_DESCRIPTIONS[basis] ?? ''}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
        </>
      )}
    </div>
  );
}

function ReviewCard({
  definition,
  onEdit,
  onFinish,
  finishing,
  finishError,
}: {
  definition: import('../../../api/v2ChallengeCreationApi').V2NormalizedDefinition;
  onEdit: (stage: WizardStage) => void;
  onFinish: () => void;
  finishing: boolean;
  finishError: string | null;
}) {
  return (
    <div className="st-card space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-primary">
            {definition.challengeType}
          </p>
          <p className="text-[16px] font-black text-slate-900">{definition.title}</p>
          {definition.description && (
            <p className="text-[13px] text-slate-500">{definition.description}</p>
          )}
        </div>
        <button className="text-[13px] font-bold text-primary" onClick={() => onEdit('BASICS')}>
          Edit
        </button>
      </div>
      {definition.activities.map((activity) => (
        <div key={activity.canonicalKey} className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-[14px] font-bold text-slate-900">
            {activity.targetValue} {activity.unit} · {activity.metric}
          </p>
          <p className="text-[12px] text-slate-500">
            {activity.activityCode ?? activity.knowledgeId} · v{activity.knowledgeVersion}
          </p>
          {activity.requiredComponents.length > 0 && (
            <p className="text-[12px] text-slate-500">
              Each of {activity.requiredComponents.join(' + ')} · all required
            </p>
          )}
          {activity.loadReportingBasis && (
            <p className="text-[12px] text-slate-500">{loadBasisLabel(activity.loadReportingBasis)}</p>
          )}
          {activity.durationMode && (
            <p className="text-[12px] text-slate-500">
              {activity.durationMode === 'CONTINUOUS' ? 'Continuous' : 'Accumulated'}
            </p>
          )}
          {activity.completionOccurrence && (
            <p className="text-[12px] text-slate-500">{activity.completionOccurrence}</p>
          )}
        </div>
      ))}
      <p className="text-[12px] text-slate-500">
        {definition.window.startDate} → {definition.window.endDate} · {definition.window.timezone}
      </p>
      <div className="flex items-center gap-2 pt-1">
        <button className="st-btn-secondary" onClick={() => onEdit(earliestEditableStage())}>
          Edit Challenge
        </button>
        <button className="st-btn-primary" disabled={finishing} onClick={onFinish}>
          {finishing ? 'Creating…' : 'Finish & Create Challenge'}
        </button>
      </div>
      <FieldError message={finishError ?? undefined} />
    </div>
  );
}

function earliestEditableStage(): WizardStage {
  return 'TYPE';
}
