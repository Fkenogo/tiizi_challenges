import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  fetchActivityOptions,
  previewChallengeDefinition,
  type ActivityOptionsResponse,
  type ComposerChallengeType,
} from '../../api/challengeCreationApi';
import { ApiError } from '../../api/apiClient';
import type { ApiKnowledgeItem } from '../../api/knowledgeApi';
import { ActivityThumbnail } from '../components/ActivityThumbnail';
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
  VISIBLE_STEPS,
  VISIBLE_STEP_META,
  allowsMultipleActivities,
  assessVisibleStep,
  challengeTypeLabel,
  createChallengeWizardRouteState,
  createEstablishmentKey,
  createInitialWizardState,
  creationErrorMessage,
  deriveEndDate,
  inclusiveDurationDays,
  formatDay,
  isWizardComplete,
  loadBasisLabel,
  mapPreviewIssues,
  metricLabel,
  requiredComponentIds,
  restoreChallengeWizardRouteState,
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
import { coverFor, coverGradientFor } from '../groups/groupCovers';
import { CHALLENGE_COVER_IDS, challengeCoverGradient, challengeCoverLabel } from './challengeCovers';

/**
 * S2b — the seven-step V2 Challenge Creation experience.
 *
 * Visible structure follows the adopted Experience Reference; the draft it
 * composes is the governed PF-04 Composer draft. All semantic validation and
 * establishment happen server-side — this component only decides whether a
 * step is filled in enough to move on.
 */

const QUERY_KEY_OPTIONS = (id: string) => ['v2-create-options', id] as const;

/** The minimum catalogue identity the picker needs to add an Activity. */
type ApiKnowledgeItemLike = Pick<ApiKnowledgeItem, 'id' | 'activityCode' | 'name' | 'kind' | 'category' | 'subcategory' | 'imageUrl'>;

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
    activityCode: item.activityCode,
    name: item.name,
    kind: item.kind,
    category: item.category,
    subcategory: item.subcategory,
    imageUrl: item.imageUrl,
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
  const location = useLocation();
  const queryClient = useQueryClient();
  const memberships = useV2Memberships();
  const establish = useEstablishChallenge();

  const [state, setState] = useState<WizardState>(() =>
    restoreChallengeWizardRouteState(location.state).draft ?? createInitialWizardState(),
  );
  const [stepIndex, setStepIndex] = useState(() => restoreChallengeWizardRouteState(location.state).stepIndex);
  const [previewState, setPreviewState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [previewIssues, setPreviewIssues] = useState<MappedPreviewIssue[] | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [creating, setCreating] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addError, setAddError] = useState('');
  const keyRef = useRef(createEstablishmentKey());
  const preselected = useRef(false);

  const currentStep = VISIBLE_STEPS[stepIndex];

  // Keep the current draft on the wizard's history entry. The detail screen
  // can then be opened as a normal route, and browser Back restores this exact
  // Step 3 draft without treating inspection as an Activity selection.
  useEffect(() => {
    const restored = restoreChallengeWizardRouteState(location.state);
    if (restored.stepIndex === stepIndex && restored.draft
      && JSON.stringify(restored.draft) === JSON.stringify(state)) return;
    navigate(location.pathname, {
      replace: true,
      state: createChallengeWizardRouteState(state, stepIndex, restored.routeState),
    });
  }, [location.pathname, location.state, navigate, state, stepIndex]);

  // Preselect a Group: an explicit Group Home handoff wins when it names a
  // real membership, otherwise a single membership is still a real choice.
  // Selection only — establishment still validates host + permission
  // server-side through the governed Challenge authority.
  useEffect(() => {
    if (preselected.current) return;
    const list = memberships.data?.memberships.filter((membership) => membership.group.allowMemberChallenges !== false
      || ['owner', 'admin', 'steward'].includes(membership.role.toLowerCase())) ?? [];
    const hinted = (location.state as { groupId?: unknown } | null)?.groupId;
    const hintedMatch =
      typeof hinted === 'string' ? list.find((membership) => membership.groupId === hinted) : undefined;
    const pick = hintedMatch ?? (list.length === 1 ? list[0] : undefined);
    if (pick) {
      preselected.current = true;
      setState((prev) => ({
        ...prev,
        groupId: pick.groupId,
        groupName: pick.group.name,
      }));
    }
  }, [memberships.data, location.state]);

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

  async function handleAddActivity(item: ApiKnowledgeItemLike): Promise<WizardState | null> {
    setAddError('');
    const existingIndex = state.activities.findIndex((activity) => activity.activity === item.id);
    if (existingIndex >= 0) return state;
    setAddingId(item.id);
    try {
      const options = await queryClient.fetchQuery({
        queryKey: QUERY_KEY_OPTIONS(item.id),
        queryFn: () => fetchActivityOptions(item.id),
        staleTime: 5 * 60 * 1000,
      });
      const next = buildWizardActivity(item, options, state.challengeType);
      const activities = allowsMultipleActivities(state.challengeType)
        ? [...state.activities.filter((activity) => activity.activity !== item.id), next]
        : [...state.activities.filter((activity) => activity.activity !== item.id), next].slice(-1);
      const updatedDraft = { ...state, activities };
      setState(updatedDraft);
      return updatedDraft;
    } catch {
      setAddError('We could not load that Activity. Please choose another.');
      return null;
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
        />
      )}

      {currentStep === 'CHALLENGE_DETAILS' && <StepChallengeDetails state={state} onUpdate={update} />}

      {currentStep === 'WHAT_ARE_WE_DOING' && (
        <StepActivities
          state={state}
          preselectedIdentity={restoreChallengeWizardRouteState(location.state).routeState.activityId
            ?? restoreChallengeWizardRouteState(location.state).routeState.activityCode
            ?? ''}
          addToDraft={restoreChallengeWizardRouteState(location.state).routeState.addToDraft === true}
          addingId={addingId}
          addError={addError}
          onAdd={handleAddActivity}
          onRemove={(activityId) => update({ activities: state.activities.filter((activity) => activity.activity !== activityId) })}
          onHandoffConsumed={(updatedDraft) => {
            const { activityId: _activityId, activityCode: _activityCode, addToDraft: _addToDraft, ...extras } = restoreChallengeWizardRouteState(location.state).routeState;
            navigate(location.pathname, {
              replace: true,
              state: createChallengeWizardRouteState(updatedDraft ?? state, stepIndex, extras),
            });
          }}
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
}: {
  memberships: ReturnType<typeof useV2Memberships>;
  state: WizardState;
  onSelectGroup: (membership: ApiMembership) => void;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
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
  const eligible = list.filter((membership) => membership.group.allowMemberChallenges !== false
    || ['owner', 'admin', 'steward'].includes(membership.role.toLowerCase()));
  const filtered = eligible.filter((membership) =>
    `${membership.group.name} ${membership.group.description}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  if (eligible.length === 0) {
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
        <V2Field label="Search Groups">
          <V2TextInput value={search} onChange={setSearch} placeholder="Find a Group you can host in…" />
        </V2Field>
        {search.trim() !== '' && <ul aria-label="Matching host Groups" className="mt-3 space-y-2">
          {filtered.map((membership) => (
            <li key={membership.groupId}>
              <button type="button" aria-pressed={state.groupId === membership.groupId}
                onClick={() => onSelectGroup(membership)}
                className={`flex min-h-[84px] w-full items-center gap-3 rounded-xl border p-3 text-left ${state.groupId === membership.groupId ? 'border-orange-400 bg-orange-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <span className={`h-14 w-14 shrink-0 rounded-lg bg-gradient-to-br ${coverGradientFor(coverFor(membership.group.coverId, membership.groupId))}`} aria-hidden="true" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold text-slate-900">{membership.group.name}</span><span className="block truncate text-xs text-slate-500">{roleLabel(membership.role)}</span>
                  {(membership.group.focusTags ?? []).length > 0 && <span className="mt-1 flex flex-wrap gap-1">{(membership.group.focusTags ?? []).slice(0, 3).map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{tag}</span>)}</span>}
                  {(membership.group.goals ?? []).length > 0 && <span className="mt-1 block truncate text-[11px] text-slate-500">Goals: {(membership.group.goals ?? []).slice(0, 2).join(' · ')}</span>}
                </span>
                <span className="shrink-0 text-xs font-bold text-primary">{state.groupId === membership.groupId ? 'Selected' : 'Select'}</span>
              </button>
            </li>
          ))}
        </ul>}
        {search.trim() === '' && <p className="mt-3 text-sm text-slate-500">Search by Group name to see Groups you can host in.</p>}
        {search.trim() !== '' && filtered.length === 0 && <p className="mt-3 text-sm text-slate-500">No host Groups match that search.</p>}
        {state.groupId && <p className="mt-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-bold text-slate-800">Selected Group: {state.groupName}. Search again to change your selection.</p>}
      </div>
    </div>
  );
}

function StepChallengeDetails({ state, onUpdate }: { state: WizardState; onUpdate: (patch: Partial<WizardState>) => void }) {
  return <div className="space-y-4">
    <p className="text-sm leading-6 text-slate-600">Give the Challenge a clear name and a short description for your Group.</p>
    <V2Field label="Challenge title"><V2TextInput value={state.title} onChange={(title) => onUpdate({ title })} placeholder="e.g. Sunrise walking streak" /></V2Field>
    <V2Field label="Description" hint="Optional. Explain what this Challenge means to your Group."><V2TextArea value={state.description} onChange={(description) => onUpdate({ description })} placeholder="Add a short description…" /></V2Field>
    <fieldset><legend className="mb-2 text-sm font-bold text-slate-900">Challenge cover</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{CHALLENGE_COVER_IDS.map((cover) => <button key={cover} type="button" aria-pressed={state.coverId === cover} onClick={() => onUpdate({ coverId: cover })} className={`overflow-hidden rounded-xl border text-left ${state.coverId === cover ? 'border-orange-500 ring-2 ring-orange-300' : 'border-slate-200'}`}><span className={`block h-16 bg-gradient-to-br ${challengeCoverGradient(cover)}`} /><span className="block px-2 py-1.5 text-xs font-bold">{challengeCoverLabel(cover)}</span></button>)}</div></fieldset>
    <section className="rounded-2xl border border-slate-200 p-4"><h3 className="text-sm font-black">Optional support</h3><label className="mt-3 flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={state.socialCauseEnabled} onChange={(event) => onUpdate({ socialCauseEnabled: event.target.checked })} />Support a Cause</label>
      {state.socialCauseEnabled && <div className="mt-2 grid gap-3 rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-600">A Platform Operator must approve this Cause before the Challenge can go live. Tiizi does not hold Cause funds.</p><V2Field label="Cause title"><V2TextInput value={state.socialCauseTitle} onChange={(socialCauseTitle) => onUpdate({ socialCauseTitle })} /></V2Field><V2Field label="Description"><V2TextArea value={state.socialCauseDescription} onChange={(socialCauseDescription) => onUpdate({ socialCauseDescription })} /></V2Field><V2Field label="Purpose"><V2TextInput value={state.socialCausePurpose} onChange={(socialCausePurpose) => onUpdate({ socialCausePurpose })} /></V2Field><V2Field label="Beneficiary"><V2TextInput value={state.socialCauseBeneficiary} onChange={(socialCauseBeneficiary) => onUpdate({ socialCauseBeneficiary })} /></V2Field><V2Field label="External payment destination reference" hint="This destination belongs to the beneficiary."><V2TextInput value={state.socialCauseDestination} onChange={(socialCauseDestination) => onUpdate({ socialCauseDestination })} /></V2Field></div>}
      <label className="mt-3 flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={state.supportTiiziEnabled} onChange={(event) => onUpdate({ supportTiiziEnabled: event.target.checked })} />Support Tiizi</label>{state.supportTiiziEnabled && <p className="ml-7 text-xs text-slate-600">Voluntary support for Tiizi. Participation never depends on financial support. The platform controls its payment destination.</p>}
    </section>
  </div>;
}

function StepActivities({
  state,
  preselectedIdentity,
  addToDraft,
  addingId,
  addError,
  onAdd,
  onRemove,
  onHandoffConsumed,
}: {
  state: WizardState;
  preselectedIdentity: string;
  addToDraft: boolean;
  addingId: string | null;
  addError: string;
  onAdd: (item: ApiKnowledgeItemLike) => Promise<WizardState | null>;
  onRemove: (activityId: string) => void;
  onHandoffConsumed: (updatedDraft?: WizardState | null) => void;
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
      <p className="text-sm leading-6 text-slate-600">
        Choose from the{' '}
        <Link to="/v2/guide" className="font-bold text-primary underline underline-offset-2">
          Activity Guide
        </Link>
        .{' '}
        {multi
          ? 'A Streak can include more than one daily activity.'
          : 'Together and Race work best with a single activity.'}
      </p>

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
            return (
              <li key={item.id}>
              <Link
                to={`/v2/guide/${encodeURIComponent(item.id)}`}
                state={createChallengeWizardRouteState(state, VISIBLE_STEPS.indexOf('WHAT_ARE_WE_DOING'), { fromChallengeDraft: true })}
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
    type === 'collective' ? 'Shared goal'
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
  const duration = inclusiveDurationDays(state.startDate, state.endDate);
  const updateStartDate = (startDate: string) => {
    const endDate = state.scheduleMode === 'preset' ? deriveEndDate(startDate, state.durationDays) : state.endDate;
    onUpdate({ startDate, endDate, ...(state.scheduleMode === 'custom' ? { durationDays: inclusiveDurationDays(startDate, endDate) ?? 0 } : {}) });
  };
  const updateEndDate = (endDate: string) => onUpdate({ endDate, durationDays: inclusiveDurationDays(state.startDate, endDate) ?? 0 });
  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-slate-600">
        Choose when the Challenge starts. Use a preset duration or set both dates.
      </p>
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-600">Duration</p>
        <div className="flex flex-wrap gap-2">
          {DURATION_OPTIONS.map((days) => (
            <V2Chip key={days} selected={state.scheduleMode === 'preset' && state.durationDays === days} onClick={() => onUpdate({ scheduleMode: 'preset', durationDays: days, endDate: deriveEndDate(state.startDate, days) })}>
              {days} days
            </V2Chip>
          ))}
          <V2Chip selected={state.scheduleMode === 'custom'} onClick={() => onUpdate({ scheduleMode: 'custom', durationDays: inclusiveDurationDays(state.startDate, state.endDate) ?? state.durationDays })}>Custom</V2Chip>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label="Start date">
          <V2TextInput type="date" value={state.startDate} onChange={updateStartDate} />
        </V2Field>
        {state.scheduleMode === 'custom' && <V2Field label="End date"><V2TextInput type="date" min={state.startDate} value={state.endDate} onChange={updateEndDate} /></V2Field>}
      </div>
      <V2Card className="bg-slate-50">
        <p className="text-sm font-bold text-slate-900">
          {duration !== null
            ? `Runs ${formatDay(state.startDate)} → ${formatDay(state.endDate)}`
            : 'Choose a start date'}
        </p>
        <p className="mt-1 text-xs text-slate-600">
          {duration !== null ? `${duration} inclusive days · Dates use your local time (${timezoneLabel(state.timezone)}).` : 'Choose an end date on or after the start date.'}
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
  const endDate = state.endDate;
  return (
    <div className="space-y-4">
      <V2Card className="bg-slate-900 text-white">
        <div className={`mb-3 h-28 rounded-xl bg-gradient-to-br ${challengeCoverGradient(state.coverId)}`} aria-label={`Challenge cover preview: ${state.coverId ? challengeCoverLabel(state.coverId as typeof CHALLENGE_COVER_IDS[number]) : 'default'}`} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold">{challengeTypeLabel(state.challengeType)}</span>
          <span className="text-[11px] font-bold text-white/70">{state.durationDays} days</span>
        </div>
        <p className="mt-2 text-lg font-black">{state.title || 'Your Challenge'}</p>
        {state.description && <p className="mt-1 text-sm text-white/80">{state.description}</p>}
        <p className="mt-3 text-xs font-bold text-white/60">
          Host Group: {state.groupName ?? '—'}
        </p>
      </V2Card>
      <V2Card><p className="text-sm font-black">Optional support</p><p className="mt-2 text-sm">Support a Cause: {state.socialCauseEnabled ? `Enabled — ${state.socialCauseTitle} · beneficiary: ${state.socialCauseBeneficiary}` : 'Off'}</p>{state.socialCauseEnabled && <p className="mt-1 text-xs text-amber-800">A Platform Operator must approve the Cause before this Challenge can go live.</p>}<p className="mt-1 text-sm">Support Tiizi: {state.supportTiiziEnabled ? 'Enabled' : 'Off'}</p><p className="mt-1 text-xs text-slate-600">Participation is never conditional on financial support.</p><button type="button" className="mt-2 text-xs font-bold text-primary" onClick={() => onEditStep('CHALLENGE_DETAILS')}>Edit support options</button></V2Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <ReviewCard label="Host Group" value={state.groupName ?? '—'} onEdit={() => onEditStep('WHO_IS_HOSTING')} />
        <ReviewCard label="Type" value={`${challengeTypeLabel(state.challengeType)} Challenge`} onEdit={() => onEditStep('HOW_IT_WORKS')} />
        <ReviewCard
          label="Activities"
          value={state.activities.map((activity) => activity.name).join(', ') || '—'}
          onEdit={() => onEditStep('WHAT_ARE_WE_DOING')}
        />
        <ReviewCard
          label="Schedule"
          value={`${formatDay(state.startDate)} – ${formatDay(endDate)} · ${state.durationDays} days`}
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
          {whatCountsExplanation(state.challengeType).map((line) => (
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
