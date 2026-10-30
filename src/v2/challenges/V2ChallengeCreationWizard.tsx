import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  fetchActivityOptions,
  previewChallengeDefinition,
  type ComposerChallengeType,
} from '../../api/challengeCreationApi';
import { ApiError } from '../../api/apiClient';
import { useAuth } from '../../hooks/useAuth';
import {
  clearChallengeDraft,
  clearOtherMembersChallengeDrafts,
  markChallengeGuideJourney,
  disarmChallengeDraft,
  peekChallengeDraft,
  saveChallengeDraft,
} from './challengeDraftSession';
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
  V2StepProgress,
  V2TextArea,
  V2TextInput,
} from '../components/V2Primitives';
import {
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
  mapPreviewIssues,
  restoreChallengeWizardRouteState,
  shouldActivateOnCreate,
  summarize,
  timezoneLabel,
  toComposerDraft,
  toEstablishmentBody,
  unitLabel,
  type MappedPreviewIssue,
  type WizardActivity,
  type WizardState,
} from './challengeCreationDraft';
import {
  useEstablishChallenge,
  useV2Memberships,
} from './useChallengeCreation';
import type { ApiMembership } from '../../api/membershipsApi';
import { coverFor, coverGradientFor } from '../groups/groupCovers';
import {
  ActivitiesStep,
  ChallengeTypeStep,
  NameAppearanceFields,
  PreviewStatus,
  ReviewCard,
  WhatCountsExplanation,
  WhatCountsStep,
  buildWizardActivity,
  type ApiKnowledgeItemLike,
} from './wizardSteps';
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

function roleLabel(role: string): string {
  const normalised = role.toLowerCase();
  return normalised === 'owner' || normalised === 'admin' ? 'Steward' : 'Member';
}

export function V2ChallengeCreationWizard() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const memberships = useV2Memberships();
  const establish = useEstablishChallenge();

  const { user } = useAuth();
  const uid = user?.uid ?? '';
  // Router history state is the primary draft carrier. If it was dropped on
  // the way back from the Activity Guide, the uid-scoped session backup
  // (armed only by an explicit Guide trip) recovers the same draft instead of
  // silently restarting at Step 1.
  const [recovered] = useState(() =>
    restoreChallengeWizardRouteState(location.state).draft ? null : peekChallengeDraft(uid),
  );
  const [state, setState] = useState<WizardState>(() =>
    restoreChallengeWizardRouteState(location.state).draft ?? recovered?.draft ?? createInitialWizardState(),
  );
  const [stepIndex, setStepIndex] = useState(() =>
    restoreChallengeWizardRouteState(location.state).draft
      ? restoreChallengeWizardRouteState(location.state).stepIndex
      : recovered?.stepIndex ?? restoreChallengeWizardRouteState(location.state).stepIndex);
  const leavingForGuide = useRef(false);
  const [previewState, setPreviewState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [previewIssues, setPreviewIssues] = useState<MappedPreviewIssue[] | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [creating, setCreating] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addError, setAddError] = useState('');
  const keyRef = useRef(createEstablishmentKey());
  const preselected = useRef(false);

  const currentStep = VISIBLE_STEPS[stepIndex];

  // Session backup of the draft (this tab, this member). Cleared on successful
  // establishment and when the wizard is left for anywhere but the Guide.
  useEffect(() => {
    clearOtherMembersChallengeDrafts(uid);
  }, [uid]);
  // Recovery is read-only during render; disarm here (idempotent) so the
  // backup cannot resurrect on a later, unrelated visit.
  useEffect(() => {
    if (recovered) disarmChallengeDraft(uid);
  }, [recovered, uid]);
  useEffect(() => {
    saveChallengeDraft(uid, state, stepIndex);
  }, [uid, state, stepIndex]);
  useEffect(() => () => {
    if (!leavingForGuide.current) clearChallengeDraft(uid);
  }, [uid]);
  function handleGuideTrip() {
    leavingForGuide.current = true;
    markChallengeGuideJourney(uid, state, stepIndex);
  }

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
      clearChallengeDraft(uid);
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
          stepIndex={stepIndex}
          onGuideTrip={handleGuideTrip}
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

export function StepHowItWorks({
  selected,
  onSelect,
}: {
  selected: ComposerChallengeType | null;
  onSelect: (type: ComposerChallengeType) => void;
}) {
  return (
    <ChallengeTypeStep
      selected={selected}
      onSelect={onSelect}
      footer={
        <p className="text-xs text-slate-500">
          Templates are not available yet — you are setting this Challenge up from scratch.
        </p>
      }
    />
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
  // P5: eligible Groups show as soon as the search field is focused, then refine as the member types.
  const [listOpen, setListOpen] = useState(false);
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
          <V2TextInput value={search} onChange={(value) => { setSearch(value); setListOpen(true); }} onFocus={() => setListOpen(true)} placeholder="Find a Group you can host in…" />
        </V2Field>
        {(listOpen || search.trim() !== '') && <ul aria-label="Matching host Groups" className="mt-3 space-y-2">
          {filtered.map((membership) => (
            <li key={membership.groupId}>
              <button type="button" aria-pressed={state.groupId === membership.groupId}
                onClick={() => { onSelectGroup(membership); setListOpen(false); setSearch(''); }}
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
        {!listOpen && search.trim() === '' && <p className="mt-3 text-sm text-slate-500">Select the search box to see the Groups you can host in.</p>}
        {(listOpen || search.trim() !== '') && filtered.length === 0 && <p className="mt-3 text-sm text-slate-500">No host Groups match that search.</p>}
        {state.groupId && <p className="mt-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-bold text-slate-800">Selected Group: {state.groupName}. Select the search box to change your selection.</p>}
      </div>
    </div>
  );
}

export function StepChallengeDetails({ state, onUpdate }: { state: WizardState; onUpdate: (patch: Partial<WizardState>) => void }) {
  return <div className="space-y-4">
    <NameAppearanceFields
      state={state}
      onUpdate={onUpdate}
      intro={<p className="text-sm leading-6 text-slate-600">Give the Challenge a clear name and a short description for your Group.</p>}
    />
    <section className="rounded-2xl border border-slate-200 p-4"><h3 className="text-sm font-black">Optional support</h3><p className="mt-1 text-xs text-slate-600">Support a Cause is for a cause this Challenge raises support for. Support Tiizi is separate: voluntary support for the Tiizi platform itself.</p><label className="mt-3 flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={state.socialCauseEnabled} onChange={(event) => onUpdate({ socialCauseEnabled: event.target.checked })} />Support a Cause</label>
      {state.socialCauseEnabled && <div className="mt-2 grid gap-3 rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-600">A Platform Operator must approve this Cause before the Challenge can go live. Tiizi does not hold Cause funds.</p><V2Field label="Cause title"><V2TextInput value={state.socialCauseTitle} onChange={(socialCauseTitle) => onUpdate({ socialCauseTitle })} /></V2Field><V2Field label="Description"><V2TextArea value={state.socialCauseDescription} onChange={(socialCauseDescription) => onUpdate({ socialCauseDescription })} /></V2Field><V2Field label="Purpose"><V2TextInput value={state.socialCausePurpose} onChange={(socialCausePurpose) => onUpdate({ socialCausePurpose })} /></V2Field><V2Field label="Beneficiary"><V2TextInput value={state.socialCauseBeneficiary} onChange={(socialCauseBeneficiary) => onUpdate({ socialCauseBeneficiary })} /></V2Field><V2Field label="External payment destination reference" hint="This destination belongs to the beneficiary."><V2TextInput value={state.socialCauseDestination} onChange={(socialCauseDestination) => onUpdate({ socialCauseDestination })} /></V2Field></div>}
      <label className="mt-3 flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={state.supportTiiziEnabled} onChange={(event) => onUpdate({ supportTiiziEnabled: event.target.checked })} />Support Tiizi</label>{state.supportTiiziEnabled && <p className="ml-7 text-xs text-slate-600">Voluntary support for Tiizi. Participation never depends on financial support. The platform controls its payment destination.</p>}
    </section>
  </div>;
}

export function StepActivities({
  state,
  preselectedIdentity,
  addToDraft,
  addingId,
  addError,
  onAdd,
  onRemove,
  onHandoffConsumed,
  stepIndex,
  onGuideTrip,
}: {
  state: WizardState;
  preselectedIdentity: string;
  addToDraft: boolean;
  addingId: string | null;
  addError: string;
  onAdd: (item: ApiKnowledgeItemLike) => Promise<WizardState | null>;
  onRemove: (activityId: string) => void;
  onHandoffConsumed: (updatedDraft?: WizardState | null) => void;
  stepIndex: number;
  onGuideTrip: () => void;
}) {
  return (
    <ActivitiesStep
      state={state}
      preselectedIdentity={preselectedIdentity}
      addToDraft={addToDraft}
      addingId={addingId}
      addError={addError}
      onAdd={onAdd}
      onRemove={onRemove}
      onHandoffConsumed={onHandoffConsumed}
      guideLinkState={createChallengeWizardRouteState(state, stepIndex, { fromChallengeDraft: true })}
      onGuideTrip={onGuideTrip}
    />
  );
}

export function StepWhatCounts({
  state,
  onUpdateActivity,
  onRemove,
}: {
  state: WizardState;
  onUpdateActivity: (index: number, patch: Partial<WizardActivity>) => void;
  onRemove: (index: number) => void;
}) {
  return <WhatCountsStep state={state} onUpdateActivity={onUpdateActivity} onRemove={onRemove} />;
}

export function StepSchedule({
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

export function StepReview({
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
        <div className={`mb-3 h-28 rounded-xl bg-gradient-to-br ${challengeCoverGradient(state.coverId)}`} aria-label={`Challenge background preview: ${state.coverId ? challengeCoverLabel(state.coverId as typeof CHALLENGE_COVER_IDS[number]) : 'default'}`} />
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

      <WhatCountsExplanation challengeType={state.challengeType} />

      <PreviewStatus state={previewState} issues={previewIssues} onEditStep={onEditStep} />
    </div>
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
