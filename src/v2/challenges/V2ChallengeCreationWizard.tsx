import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  fetchActivityOptions,
  previewChallengeDefinition,
  type ActivityOptionsResponse,
  type ComposerChallengeType,
} from '../../api/challengeCreationApi';
import { ApiError } from '../../api/apiClient';
import type { ApiKnowledgeItem } from '../../api/knowledgeApi';
import {
  V2Button,
  V2Card,
  V2Chip,
  V2ChoiceCard,
  V2EmptyState,
  V2ErrorState,
  V2Field,
  V2LoadingState,
  V2Page,
  V2SectionHeader,
  V2Select,
  V2StepProgress,
  V2TextArea,
  V2TextInput,
} from '../components/V2Primitives';
import {
  CHALLENGE_TYPE_OPTIONS,
  DURATION_OPTIONS,
  TIMEZONE_OPTIONS,
  VISIBLE_STEPS,
  VISIBLE_STEP_META,
  allowsMultipleActivities,
  assessVisibleStep,
  challengeTypeLabel,
  createEstablishmentKey,
  createInitialWizardState,
  creationErrorMessage,
  deriveEndDate,
  formatDay,
  isWizardComplete,
  loadBasisLabel,
  mapPreviewIssues,
  metricLabel,
  requiredComponentIds,
  shouldActivateOnCreate,
  summarize,
  timezoneLabel,
  toComposerDraft,
  toEstablishmentBody,
  unitLabel,
  whatCountsExplanation,
  type MappedPreviewIssue,
  type WizardActivity,
  type WizardState,
} from './challengeCreationDraft';
import {
  useComposerCatalogue,
  useEstablishChallenge,
  useV2Memberships,
} from './useChallengeCreation';
import type { ApiMembership } from '../../api/membershipsApi';

/**
 * S2b — the six-step V2 Challenge Creation experience.
 *
 * Visible structure follows the adopted Experience Reference; the draft it
 * composes is the governed PF-04 Composer draft. All semantic validation and
 * establishment happen server-side — this component only decides whether a
 * step is filled in enough to move on.
 */

const QUERY_KEY_OPTIONS = (id: string) => ['v2-create-options', id] as const;

/** The minimum catalogue identity the picker needs to add an Activity. */
type ApiKnowledgeItemLike = Pick<ApiKnowledgeItem, 'id' | 'name' | 'kind'>;

function roleLabel(role: string): string {
  const normalised = role.toLowerCase();
  return normalised === 'owner' || normalised === 'admin' ? 'Steward' : 'Member';
}

function defaultTargetFor(type: ComposerChallengeType | null, metric: string): string {
  if (metric === 'completion') return '1';
  if (metric === 'distance') return type === 'collective' ? '500' : '5';
  if (metric === 'duration') return type === 'streak' ? '20' : '60';
  if (metric === 'repetitions') return '20';
  if (metric === 'quantity') return '2000';
  if (metric === 'weight') return '20';
  return '10';
}

function unitsForMetric(options: ActivityOptionsResponse, metric: string): string[] {
  const grouped = options.unitsByMetric[metric];
  if (grouped && grouped.length > 0) return grouped;
  return options.compatibleUnits;
}

function buildWizardActivity(
  item: ApiKnowledgeItemLike,
  options: ActivityOptionsResponse,
  type: ComposerChallengeType | null,
): WizardActivity {
  const metric = options.primaryMetrics[0] ?? options.secondaryMetrics[0] ?? '';
  const units = unitsForMetric(options, metric);
  const unit = units[0] ?? options.compatibleUnits[0] ?? '';
  return {
    activity: item.id,
    name: item.name,
    kind: item.kind,
    observedVersion: options.currentVersion,
    options,
    metric,
    unit,
    targetValue: defaultTargetFor(type, metric),
    durationMode: metric === 'duration' ? 'CONTINUOUS' : '',
    completionOccurrence: '',
    loadBasis: '',
  };
}

export function V2ChallengeCreationWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const memberships = useV2Memberships();
  const establish = useEstablishChallenge();

  const [state, setState] = useState<WizardState>(() => createInitialWizardState());
  const [stepIndex, setStepIndex] = useState(0);
  const [previewState, setPreviewState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [previewIssues, setPreviewIssues] = useState<MappedPreviewIssue[] | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [creating, setCreating] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addError, setAddError] = useState('');
  const keyRef = useRef(createEstablishmentKey());
  const preselected = useRef(false);

  const currentStep = VISIBLE_STEPS[stepIndex];

  // Preselect a Group when the member has exactly one — still a real choice.
  useEffect(() => {
    if (preselected.current) return;
    const list = memberships.data?.memberships ?? [];
    if (list.length === 1) {
      preselected.current = true;
      setState((prev) => ({
        ...prev,
        groupId: list[0].groupId,
        groupName: list[0].group.name,
      }));
    }
  }, [memberships.data]);

  function update(patch: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...patch }));
  }

  function goToStep(index: number) {
    setStepIndex(Math.max(0, Math.min(VISIBLE_STEPS.length - 1, index)));
  }

  const assessment = assessVisibleStep(state, currentStep);
  const draftJson = useMemo(() => JSON.stringify(toComposerDraft(state)), [state]);

  // Server preview/validation runs only at Review, on the current draft.
  useEffect(() => {
    if (currentStep !== 'REVIEW_AND_CREATE') return;
    if (!isWizardComplete(state)) {
      setPreviewState('idle');
      setPreviewIssues(null);
      return;
    }
    let cancelled = false;
    setPreviewState('checking');
    previewChallengeDefinition(toComposerDraft(state))
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setPreviewState('valid');
          setPreviewIssues(null);
        } else {
          setPreviewState('invalid');
          setPreviewIssues(mapPreviewIssues(result.issues));
        }
      })
      .catch(() => {
        if (cancelled) return;
        setPreviewState('invalid');
        setPreviewIssues([
          {
            step: 'REVIEW_AND_CREATE',
            code: 'preview_failed',
            friendly: 'We could not validate this Challenge just now. Please try again.',
            raw: '',
          },
        ]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, draftJson]);

  async function handleAddActivity(item: ApiKnowledgeItemLike) {
    setAddError('');
    const existingIndex = state.activities.findIndex((activity) => activity.activity === item.id);
    if (existingIndex >= 0 && !allowsMultipleActivities(state.challengeType)) {
      update({ activities: state.activities.filter((activity) => activity.activity !== item.id) });
      return;
    }
    if (existingIndex >= 0) return;
    setAddingId(item.id);
    try {
      const options = await queryClient.fetchQuery({
        queryKey: QUERY_KEY_OPTIONS(item.id),
        queryFn: () => fetchActivityOptions(item.id),
        staleTime: 5 * 60 * 1000,
      });
      const next = buildWizardActivity(item, options, state.challengeType);
      setState((prev) => {
        const activities = allowsMultipleActivities(prev.challengeType)
          ? [...prev.activities.filter((activity) => activity.activity !== item.id), next]
          : [...prev.activities.filter((activity) => activity.activity !== item.id), next].slice(-1);
        return { ...prev, activities };
      });
    } catch {
      setAddError('We could not load that Activity. Please choose another.');
    } finally {
      setAddingId(null);
    }
  }

  async function handleCreate() {
    setSubmitError('');
    setCreating(true);
    try {
      const preview = await previewChallengeDefinition(toComposerDraft(state));
      if (!preview.ok) {
        setPreviewState('invalid');
        setPreviewIssues(mapPreviewIssues(preview.issues));
        setCreating(false);
        return;
      }
      const established = await establish.mutateAsync(
        toEstablishmentBody(state, {
          activate: shouldActivateOnCreate(state),
          joinCreator: state.creatorJoins,
          idempotencyKey: keyRef.current,
        }),
      );
      navigate(`/v2/challenges/${established.challengeId}`, { replace: true });
    } catch (error) {
      setSubmitError(creationErrorMessage(error instanceof ApiError ? error.code : null));
      setCreating(false);
    }
  }

  const stepItems = VISIBLE_STEPS.map((step) => ({ id: step, label: VISIBLE_STEP_META[step].eyebrow }));

  return (
    <V2Page>
      <V2SectionHeader
        eyebrow={`Step ${stepIndex + 1} of ${VISIBLE_STEPS.length}`}
        title="Create a Challenge"
        description={VISIBLE_STEP_META[currentStep].title}
      />

      <div className="mb-4">
        <V2StepProgress
          steps={stepItems}
          current={stepIndex}
          onSelect={(index) => {
            // Backward navigation only — a step cannot be skipped forward.
            if (index < stepIndex) goToStep(index);
          }}
        />
      </div>

      {state.challengeType && state.activities.length > 0 && (
        <V2Card className="mb-4 border-orange-200 bg-orange-50">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Your Challenge so far</p>
          <p className="mt-1 text-sm italic text-slate-700">{summarize(state)}</p>
        </V2Card>
      )}

      {currentStep === 'HOW_IT_WORKS' && (
        <StepHowItWorks
          selected={state.challengeType}
          onSelect={(type) => {
            const keepFirst = allowsMultipleActivities(type) ? state.activities : state.activities.slice(0, 1);
            update({ challengeType: type, activities: keepFirst });
          }}
        />
      )}

      {currentStep === 'WHO_IS_HOSTING' && (
        <StepHosting
          memberships={memberships}
          state={state}
          onSelectGroup={(membership) =>
            update({ groupId: membership.groupId, groupName: membership.group.name })
          }
          onTitle={(title) => update({ title })}
          onDescription={(description) => update({ description })}
        />
      )}

      {currentStep === 'WHAT_ARE_WE_DOING' && (
        <StepActivities
          state={state}
          addingId={addingId}
          addError={addError}
          onToggle={handleAddActivity}
        />
      )}

      {currentStep === 'WHAT_COUNTS' && (
        <StepWhatCounts
          state={state}
          onUpdateActivity={(index, patch) =>
            update({
              activities: state.activities.map((activity, position) =>
                position === index ? { ...activity, ...patch } : activity,
              ),
            })
          }
          onRemove={(index) =>
            update({ activities: state.activities.filter((_activity, position) => position !== index) })
          }
        />
      )}

      {currentStep === 'WHEN_DOES_IT_RUN' && (
        <StepSchedule state={state} onUpdate={update} />
      )}

      {currentStep === 'REVIEW_AND_CREATE' && (
        <StepReview
          state={state}
          previewState={previewState}
          previewIssues={previewIssues}
          onUpdate={update}
          onEditStep={(step) => goToStep(VISIBLE_STEPS.indexOf(step))}
        />
      )}

      {!assessment.complete && currentStep !== 'REVIEW_AND_CREATE' && (
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
          Complete this step to continue.
        </p>
      )}

      {currentStep === 'REVIEW_AND_CREATE' && submitError && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
          {submitError}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <V2Button variant="secondary" onClick={() => goToStep(stepIndex - 1)} disabled={stepIndex === 0}>
          Back
        </V2Button>
        {currentStep !== 'REVIEW_AND_CREATE' ? (
          <V2Button onClick={() => goToStep(stepIndex + 1)} disabled={!assessment.complete}>
            Continue
          </V2Button>
        ) : (
          <V2Button
            variant="success"
            onClick={() => void handleCreate()}
            disabled={creating || !isWizardComplete(state) || previewState !== 'valid'}
          >
            {creating ? 'Creating…' : 'Create Challenge'}
          </V2Button>
        )}
      </div>
    </V2Page>
  );
}

function StepHowItWorks({
  selected,
  onSelect,
}: {
  selected: ComposerChallengeType | null;
  onSelect: (type: ComposerChallengeType) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-slate-600">
        Each type counts progress differently — pick the one that fits how you want this Challenge to work.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {CHALLENGE_TYPE_OPTIONS.map((option) => (
          <V2ChoiceCard
            key={option.value}
            selected={selected === option.value}
            onClick={() => onSelect(option.value)}
            title={option.label}
            subtitle={option.sub}
            description={option.blurb}
            badge={option.badge}
          />
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Templates are not available yet — you are setting this Challenge up from scratch.
      </p>
    </div>
  );
}

function StepHosting({
  memberships,
  state,
  onSelectGroup,
  onTitle,
  onDescription,
}: {
  memberships: ReturnType<typeof useV2Memberships>;
  state: WizardState;
  onSelectGroup: (membership: ApiMembership) => void;
  onTitle: (title: string) => void;
  onDescription: (description: string) => void;
}) {
  const navigate = useNavigate();
  if (memberships.isLoading) return <V2LoadingState label="Loading your Groups…" />;
  if (memberships.isError) {
    return (
      <V2ErrorState
        title="We could not load your Groups"
        message="Please try again."
        onRetry={() => void memberships.refetch()}
      />
    );
  }
  const list = memberships.data?.memberships ?? [];
  if (list.length === 0) {
    return (
      <V2EmptyState
        title="A Challenge belongs to a Group"
        message="Challenges are always hosted inside a Group you are part of. You are not in a Group yet — create one to get started hosting Challenges."
        action={
          <V2Button variant="secondary" onClick={() => navigate('/v2/groups/new')}>
            Create a Group
          </V2Button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-slate-600">
        Challenges are hosted inside a Group. Choose the Group that will host this Challenge.
      </p>
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-600">Host Group</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((membership) => (
            <V2ChoiceCard
              key={membership.groupId}
              selected={state.groupId === membership.groupId}
              onClick={() => onSelectGroup(membership)}
              title={membership.group.name}
              subtitle={roleLabel(membership.role)}
              description={membership.group.description || undefined}
            />
          ))}
        </div>
      </div>
      <V2Field label="Challenge title">
        <V2TextInput
          value={state.title}
          onChange={onTitle}
          placeholder="e.g. Sunrise 500 km community walk"
        />
      </V2Field>
      <V2Field label="Description" hint="Tell the Group why this Challenge matters and how everyone contributes.">
        <V2TextArea
          value={state.description}
          onChange={onDescription}
          placeholder="Share what this Challenge means to your Group…"
        />
      </V2Field>
    </div>
  );
}

function StepActivities({
  state,
  addingId,
  addError,
  onToggle,
}: {
  state: WizardState;
  addingId: string | null;
  addError: string;
  onToggle: (item: ApiKnowledgeItemLike) => void;
}) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'fitness' | 'wellness'>('all');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const catalogue = useComposerCatalogue(kindFilter === 'all' ? undefined : kindFilter, debounced);
  const multi = allowsMultipleActivities(state.challengeType);
  const selectedIds = new Set(state.activities.map((activity) => activity.activity));

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-slate-600">
        Choose from the activity guide.{' '}
        {multi
          ? 'A Streak can include more than one daily activity.'
          : 'Together and Race work best with a single activity.'}
      </p>

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
        <div className="grid max-h-[380px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {catalogue.data.map((item) => {
            const selected = selectedIds.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggle({ id: item.id, name: item.name, kind: item.kind })}
                aria-pressed={selected}
                disabled={addingId === item.id}
                className={`rounded-2xl border p-3 text-left transition-colors ${
                  selected ? 'border-primary bg-orange-50' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.category}
                      {item.subcategory ? ` · ${item.subcategory}` : ''}
                    </p>
                  </div>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                      selected ? 'bg-primary text-white' : 'border border-slate-300 text-transparent'
                    }`}
                    aria-hidden
                  >
                    ✓
                  </span>
                </div>
                {item.description && (
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{item.description}</p>
                )}
                {addingId === item.id && <p className="mt-1 text-xs font-bold text-primary">Loading options…</p>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StepWhatCounts({
  state,
  onUpdateActivity,
  onRemove,
}: {
  state: WizardState;
  onUpdateActivity: (index: number, patch: Partial<WizardActivity>) => void;
  onRemove: (index: number) => void;
}) {
  if (state.activities.length === 0) {
    return (
      <V2EmptyState
        title="No activities chosen yet"
        message="Go back to the previous step and choose at least one activity."
      />
    );
  }
  const type = state.challengeType;
  const targetLabel =
    type === 'collective' ? 'Shared goal each contribution adds to'
      : type === 'streak' ? 'Daily requirement'
        : 'Target to reach';

  return (
    <div className="space-y-4">
      {state.activities.map((activity, index) => {
        const metricOptions = [
          ...activity.options.primaryMetrics,
          ...activity.options.secondaryMetrics,
        ].map((metric) => ({ value: metric, label: metricLabel(metric) }));
        const unitOptions = unitsForMetric(activity.options, activity.metric).map((unit) => ({
          value: unit,
          label: unitLabel(unit),
        }));
        const components = requiredComponentIds(activity.options);
        return (
          <V2Card key={activity.activity}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-black text-slate-900">{activity.name}</p>
                <p className="text-xs text-slate-500">
                  {activity.kind === 'wellness' ? 'Wellness' : 'Fitness'} · {metricLabel(activity.metric)}
                </p>
              </div>
              {state.activities.length > 1 && (
                <V2Button variant="ghost" onClick={() => onRemove(index)}>
                  Remove
                </V2Button>
              )}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <V2Field label="How it is measured">
                <V2Select
                  value={activity.metric}
                  options={metricOptions}
                  onChange={(metric) => {
                    const units = unitsForMetric(activity.options, metric);
                    onUpdateActivity(index, {
                      metric,
                      unit: units[0] ?? '',
                      durationMode: metric === 'duration' ? activity.durationMode || 'CONTINUOUS' : '',
                      completionOccurrence: metric === 'completion' ? activity.completionOccurrence : '',
                      loadBasis: metric === 'weight' ? activity.loadBasis : '',
                      targetValue: defaultTargetFor(state.challengeType, metric),
                    });
                  }}
                />
              </V2Field>
              <V2Field label="Unit">
                <V2Select
                  value={activity.unit}
                  options={unitOptions}
                  onChange={(unit) => onUpdateActivity(index, { unit })}
                />
              </V2Field>
              <V2Field label={targetLabel}>
                <V2TextInput
                  type="number"
                  min="0"
                  value={activity.targetValue}
                  onChange={(targetValue) => onUpdateActivity(index, { targetValue })}
                />
              </V2Field>
            </div>

            {activity.metric === 'duration' && (
              <div className="mt-3">
                <V2Field label="How the time counts" hint="Choose whether the time must be done all at once or can add up.">
                  <V2Select
                    value={activity.durationMode || 'CONTINUOUS'}
                    options={[
                      { value: 'CONTINUOUS', label: 'All at once' },
                      { value: 'ACCUMULATED', label: 'Added up across the day' },
                    ]}
                    onChange={(durationMode) => onUpdateActivity(index, { durationMode })}
                  />
                </V2Field>
              </div>
            )}

            {activity.metric === 'completion' && (
              <div className="mt-3">
                <V2Field label="What must be completed?" hint="Say exactly what counts as done for this activity.">
                  <V2TextInput
                    value={activity.completionOccurrence}
                    onChange={(completionOccurrence) => onUpdateActivity(index, { completionOccurrence })}
                    placeholder="e.g. one full guided breathing session"
                  />
                </V2Field>
              </div>
            )}

            {activity.metric === 'weight' && (
              <div className="mt-3">
                <V2Field label="How the weight is reported">
                  <V2Select
                    value={activity.loadBasis}
                    options={[
                      { value: '', label: 'Choose how the weight is reported' },
                      ...activity.options.supportedLoadBases.map((basis) => ({
                        value: basis,
                        label: loadBasisLabel(basis),
                      })),
                    ]}
                    onChange={(loadBasis) => onUpdateActivity(index, { loadBasis })}
                  />
                </V2Field>
              </div>
            )}

            {components.length > 0 && (
              <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                This activity has required parts that must each meet the target:{' '}
                {activity.options.components.map((component) => component.displayName).join(', ')}.
              </p>
            )}
          </V2Card>
        );
      })}
    </div>
  );
}

function StepSchedule({
  state,
  onUpdate,
}: {
  state: WizardState;
  onUpdate: (patch: Partial<WizardState>) => void;
}) {
  const endDate = deriveEndDate(state.startDate, state.durationDays);
  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-slate-600">
        Pick a start date, how long it runs, and the time it follows.
      </p>
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-600">Duration</p>
        <div className="flex flex-wrap gap-2">
          {DURATION_OPTIONS.map((days) => (
            <V2Chip key={days} selected={state.durationDays === days} onClick={() => onUpdate({ durationDays: days })}>
              {days} days
            </V2Chip>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label="Start date">
          <V2TextInput type="date" value={state.startDate} onChange={(startDate) => onUpdate({ startDate })} />
        </V2Field>
        <V2Field label="Time setting" hint="Daily requirements reset when the day ends in this time.">
          <V2Select
            value={state.timezone}
            options={TIMEZONE_OPTIONS}
            onChange={(timezone) => onUpdate({ timezone })}
          />
        </V2Field>
      </div>
      <V2Card className="bg-slate-50">
        <p className="text-sm font-bold text-slate-900">
          {state.startDate && /^\d{4}-\d{2}-\d{2}$/.test(state.startDate)
            ? `Runs ${formatDay(state.startDate)} → ${formatDay(endDate)}`
            : 'Choose a start date'}
        </p>
        <p className="mt-1 text-xs text-slate-600">
          {state.durationDays} days, following {timezoneLabel(state.timezone)}.
        </p>
      </V2Card>
    </div>
  );
}

function StepReview({
  state,
  previewState,
  previewIssues,
  onUpdate,
  onEditStep,
}: {
  state: WizardState;
  previewState: 'idle' | 'checking' | 'valid' | 'invalid';
  previewIssues: MappedPreviewIssue[] | null;
  onUpdate: (patch: Partial<WizardState>) => void;
  onEditStep: (step: (typeof VISIBLE_STEPS)[number]) => void;
}) {
  const endDate = deriveEndDate(state.startDate, state.durationDays);
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-slate-600">{summarize(state)}</p>

      <V2Card className="bg-slate-900 text-white">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold">
            {challengeTypeLabel(state.challengeType)}
          </span>
          <span className="text-[11px] font-bold text-white/70">{state.durationDays} days</span>
        </div>
        <p className="mt-2 text-lg font-black">{state.title || 'Your Challenge'}</p>
        <p className="mt-1 text-sm text-white/80">{summarize(state)}</p>
        <p className="mt-3 text-xs font-bold text-white/60">
          Host Group: {state.groupName ?? '—'} · {timezoneLabel(state.timezone)}
        </p>
      </V2Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <ReviewCard label="Host Group" value={state.groupName ?? '—'} onEdit={() => onEditStep('WHO_IS_HOSTING')} />
        <ReviewCard label="Type" value={`${challengeTypeLabel(state.challengeType)} Challenge`} onEdit={() => onEditStep('HOW_IT_WORKS')} />
        <ReviewCard
          label="Activities"
          value={state.activities.map((activity) => activity.name).join(', ') || '—'}
          onEdit={() => onEditStep('WHAT_ARE_WE_DOING')}
        />
        <ReviewCard
          label="Schedule & time"
          value={`${state.durationDays} days · starts ${formatDay(state.startDate)} (ends ${formatDay(endDate)})`}
          onEdit={() => onEditStep('WHEN_DOES_IT_RUN')}
        />
        <ReviewCard
          label="What counts"
          value={state.activities
            .map((activity) => `${activity.targetValue} ${unitLabel(activity.unit)} of ${activity.name}`)
            .join(' · ')}
          onEdit={() => onEditStep('WHAT_COUNTS')}
        />
      </div>

      <CreatorParticipation state={state} onUpdate={onUpdate} />

      <V2Card>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">What counts</p>
        <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-600">
          {whatCountsExplanation(state.challengeType, state.timezone).map((line) => (
            <li key={line}>• {line}</li>
          ))}
        </ul>
      </V2Card>

      <PreviewStatus state={previewState} issues={previewIssues} onEditStep={onEditStep} />
    </div>
  );
}

function ReviewCard({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <V2Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-0.5 text-sm font-bold text-slate-900">{value}</p>
        </div>
        <button type="button" onClick={onEdit} className="text-xs font-bold text-primary hover:underline">
          Edit
        </button>
      </div>
    </V2Card>
  );
}

function CreatorParticipation({
  state,
  onUpdate,
}: {
  state: WizardState;
  onUpdate: (patch: Partial<WizardState>) => void;
}) {
  return (
    <V2Card className="border-amber-200 bg-amber-50">
      <p className="text-sm font-black text-amber-900">Will you take part in this Challenge?</p>
      <p className="mt-1 text-xs leading-5 text-amber-800">
        Being in the Group does not join you automatically, and creating a Challenge does not join you either.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <V2ChoiceCard
          selected={state.creatorJoins}
          onClick={() => onUpdate({ creatorJoins: true })}
          title="Join this Challenge"
          description="You take part as a participant, just like the other members."
        />
        <V2ChoiceCard
          selected={!state.creatorJoins}
          onClick={() => onUpdate({ creatorJoins: false })}
          title="Not now"
          description="You stay the organiser only. You can join later."
        />
      </div>
    </V2Card>
  );
}

function PreviewStatus({
  state,
  issues,
  onEditStep,
}: {
  state: 'idle' | 'checking' | 'valid' | 'invalid';
  issues: MappedPreviewIssue[] | null;
  onEditStep: (step: (typeof VISIBLE_STEPS)[number]) => void;
}) {
  if (state === 'checking') {
    return (
      <V2Card className="bg-slate-50">
        <p className="text-sm font-bold text-slate-600">Checking your Challenge…</p>
      </V2Card>
    );
  }
  if (state === 'valid') {
    return (
      <V2Card className="border-emerald-200 bg-emerald-50">
        <p className="text-sm font-bold text-emerald-800">
          Everything checks out. You can create this Challenge.
        </p>
      </V2Card>
    );
  }
  if (state === 'invalid' && issues && issues.length > 0) {
    return (
      <V2Card className="border-red-200 bg-red-50">
        <p className="text-sm font-black text-red-800">Let us fix these before creating</p>
        <ul className="mt-2 space-y-2">
          {issues.map((issue, index) => (
            <li key={`${issue.code}-${index}`} className="text-sm leading-6 text-red-800">
              <span>{issue.friendly}</span>{' '}
              <button
                type="button"
                onClick={() => onEditStep(issue.step)}
                className="font-bold underline"
              >
                Go to step
              </button>
            </li>
          ))}
        </ul>
      </V2Card>
    );
  }
  return null;
}
