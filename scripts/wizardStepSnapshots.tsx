/**
 * TIIZI-FER-P5T-2-S1 — behaviour-preservation harness for the member Challenge
 * Wizard. Renders every reusable step (as composed by the member Wizard) over
 * fixed Together / Race / Streak states, and exercises the pure draft
 * functions, producing a deterministic snapshot map. The committed golden was
 * generated from the pre-extraction Wizard; the extraction must reproduce it
 * byte for byte.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import type { ActivityOptionsResponse } from '../src/api/challengeCreationApi';
import {
  StepActivities,
  StepChallengeDetails,
  StepHowItWorks,
  StepReview,
  StepSchedule,
  StepWhatCounts,
} from '../src/v2/challenges/V2ChallengeCreationWizard';
import {
  VISIBLE_STEPS,
  assessVisibleStep,
  isWizardComplete,
  createChallengeWizardRouteState,
  mapPreviewIssues,
  summarize,
  toComposerDraft,
  toEstablishmentBody,
  type WizardActivity,
  type WizardState,
} from '../src/v2/challenges/challengeCreationDraft';

const NOOP = () => undefined;

function options(overrides: Partial<ActivityOptionsResponse> = {}): ActivityOptionsResponse {
  return {
    knowledgeId: 'a0000000-0000-4000-8000-000000000001',
    activityCode: 'FIT-TST-001',
    kind: 'fitness',
    currentVersion: 3,
    primaryMetrics: ['repetitions'],
    secondaryMetrics: ['completion'],
    compatibleUnits: ['reps', 'minutes', 'kilometres'],
    components: [],
    supportedLoadBases: [],
    unitsByMetric: { repetitions: ['reps'], completion: ['completion'], duration: ['minutes'], distance: ['kilometres'] },
    ...overrides,
  };
}

function activity(overrides: Partial<WizardActivity> = {}): WizardActivity {
  return {
    activity: 'a0000000-0000-4000-8000-000000000001',
    activityCode: 'FIT-TST-001',
    name: 'Push-Up',
    kind: 'fitness',
    category: 'Strength',
    subcategory: 'Push',
    imageUrl: null,
    observedVersion: 3,
    options: options(),
    metric: 'repetitions',
    unit: 'reps',
    targetValue: '100',
    durationMode: '',
    completionOccurrence: '',
    loadBasis: '',
    ...overrides,
  };
}

function base(overrides: Partial<WizardState>): WizardState {
  return {
    challengeType: null,
    groupId: '11111111-1111-4111-8111-111111111111',
    groupName: 'Harness Group',
    title: '',
    description: '',
    coverId: null,
    supportTiiziEnabled: false,
    socialCauseEnabled: false,
    socialCauseTitle: '',
    socialCauseDescription: '',
    socialCausePurpose: '',
    socialCauseBeneficiary: '',
    socialCauseDestination: '',
    activities: [],
    startDate: '2026-11-02',
    endDate: '2026-11-15',
    scheduleMode: 'preset',
    durationDays: 14,
    timezone: 'Africa/Nairobi',
    creatorJoins: false,
    ...overrides,
  };
}

const walkOptions = options({
  knowledgeId: 'a0000000-0000-4000-8000-000000000002', activityCode: 'FIT-TST-002',
  primaryMetrics: ['distance'], secondaryMetrics: [], compatibleUnits: ['kilometres'], unitsByMetric: { distance: ['kilometres'] },
});
const holdOptions = options({
  knowledgeId: 'a0000000-0000-4000-8000-000000000003', activityCode: 'FIT-TST-003',
  primaryMetrics: ['duration', 'weight', 'completion'], secondaryMetrics: [], compatibleUnits: ['minutes', 'kilograms', 'completion'],
  supportedLoadBases: ['TOTAL_LOAD', 'PER_SIDE'],
  components: [{ componentId: 'LEFT', displayName: 'Left side', relationship: 'ALL_REQUIRED' }, { componentId: 'RIGHT', displayName: 'Right side', relationship: 'ALL_REQUIRED' }],
  unitsByMetric: { duration: ['minutes'], weight: ['kilograms'], completion: ['completion'] },
});

export const STATES: Record<string, WizardState> = {
  empty: base({ groupId: null, groupName: null }),
  together: base({
    challengeType: 'collective', title: 'Walk Together', description: 'Every kilometre counts.', coverId: 'challenge-3',
    activities: [activity({ activity: 'a0000000-0000-4000-8000-000000000002', activityCode: 'FIT-TST-002', name: 'Community Walk', options: walkOptions, metric: 'distance', unit: 'kilometres', targetValue: '500' })],
  }),
  race: base({
    challengeType: 'competitive', title: 'Hundred Rep Race', coverId: 'challenge-1',
    activities: [activity()],
  }),
  streak: base({
    challengeType: 'streak', title: 'Seven Day Streak', description: 'A daily minute.', coverId: 'challenge-2', durationDays: 7, endDate: '2026-11-08',
    creatorJoins: true, supportTiiziEnabled: true,
    activities: [
      activity({ activity: 'a0000000-0000-4000-8000-000000000003', activityCode: 'FIT-TST-003', name: 'Side Hold', options: holdOptions, metric: 'duration', unit: 'minutes', targetValue: '20', durationMode: 'CONTINUOUS' }),
      activity({ activity: 'a0000000-0000-4000-8000-000000000004', name: 'Breathing', kind: 'wellness', category: 'Mind', subcategory: '', options: holdOptions, metric: 'completion', unit: 'completion', targetValue: '1', completionOccurrence: 'one guided breathing session' }),
      activity({ activity: 'a0000000-0000-4000-8000-000000000005', name: 'Carry', options: holdOptions, metric: 'weight', unit: 'kilograms', targetValue: '20', loadBasis: 'TOTAL_LOAD' }),
    ],
  }),
  withCause: base({
    challengeType: 'competitive', title: 'Cause Race', socialCauseEnabled: true, socialCauseTitle: 'Clean Water', socialCauseDescription: 'Wells',
    socialCausePurpose: 'Fund wells', socialCauseBeneficiary: 'Village Trust', socialCauseDestination: 'ref-123', supportTiiziEnabled: true,
    activities: [activity()],
  }),
};

const CATALOGUE = [
  { id: 'a0000000-0000-4000-8000-000000000001', activityCode: 'FIT-TST-001', name: 'Push-Up', kind: 'fitness', category: 'Strength', subcategory: 'Push', imageUrl: null },
  { id: 'a0000000-0000-4000-8000-000000000004', activityCode: 'WEL-TST-004', name: 'Breathing', kind: 'wellness', category: 'Mind', subcategory: '', imageUrl: null },
];

function wrap(element: ReactElement, seedCatalogue = false): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (seedCatalogue) client.setQueryData(['v2-create-catalogue', 'all', ''], CATALOGUE);
  return renderToStaticMarkup(
    <MemoryRouter><QueryClientProvider client={client}>{element}</QueryClientProvider></MemoryRouter>,
  );
}

/** Depth-first walk of an element tree WITHOUT expanding components: collects props bags. */
function propsBags(node: ReactNode, into: Array<Record<string, unknown>> = []): Array<Record<string, unknown>> {
  if (Array.isArray(node)) { node.forEach((child) => propsBags(child, into)); return into; }
  if (!isValidElement(node)) return into;
  const props = { ...(node.props as Record<string, unknown>), __native: typeof node.type === 'string' };
  into.push(props);
  propsBags(props.children as ReactNode, into);
  return into;
}

/**
 * Invoke every change/click handler a hook-free step exposes and record the
 * patches it emits: captures the step's state-transition logic.
 */
function interactions(render: (calls: unknown[]) => ReactNode): unknown[] {
  const calls: unknown[] = [];
  const tree = render(calls);
  const seeds: unknown[] = ['alpha', 'duration', 'completion', 'weight', 'minutes', '7'];
  for (const props of propsBags(tree)) {
    if (typeof props.onChange === 'function') {
      for (const seed of seeds) {
        calls.push({ on: 'change', seed });
        (props.onChange as (v: unknown) => void)(props.__native ? { target: { checked: seed === 'alpha', value: seed } } : seed);
      }
    }
    if (typeof props.onClick === 'function') { calls.push({ on: 'click' }); (props.onClick as () => void)(); }
  }
  return calls;
}

function outcome(fn: () => unknown): unknown {
  try { return fn(); } catch (error) { return { throws: (error as Error).message }; }
}

export function buildSnapshots(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, state] of Object.entries(STATES)) {
    out[`draft/${name}/composer`] = outcome(() => toComposerDraft(state));
    out[`draft/${name}/establish`] = outcome(() => toEstablishmentBody(state, { activate: false, joinCreator: state.creatorJoins, idempotencyKey: 'harness-key' }));
    out[`draft/${name}/complete`] = isWizardComplete(state);
    out[`draft/${name}/summary`] = outcome(() => summarize(state));
    out[`draft/${name}/assess`] = VISIBLE_STEPS.map((step) => assessVisibleStep(state, step));
    out[`step/${name}/how`] = wrap(<StepHowItWorks selected={state.challengeType} onSelect={NOOP} />);
    out[`step/${name}/details`] = wrap(<StepChallengeDetails state={state} onUpdate={NOOP} />);
    out[`step/${name}/counts`] = wrap(<StepWhatCounts state={state} onUpdateActivity={NOOP} onRemove={NOOP} />);
    out[`step/${name}/schedule`] = wrap(<StepSchedule state={state} onUpdate={NOOP} />);
    out[`step/${name}/activities`] = wrap(
      <StepActivities state={state} preselectedIdentity="" addToDraft={false} addingId={null} addError="" onAdd={async () => null}
        onRemove={NOOP} onHandoffConsumed={NOOP} stepIndex={3} onGuideTrip={NOOP} />, true);
    for (const preview of ['idle', 'checking', 'valid', 'invalid'] as const) {
      const issues = preview === 'invalid'
        ? mapPreviewIssues([{ code: 'PF03_SEMANTIC', message: 'challenge-definition: [invalid_window] endDate must be on or after startDate' }])
        : null;
      out[`step/${name}/review/${preview}`] = wrap(
        <StepReview state={state} previewState={preview} previewIssues={issues} onUpdate={NOOP} onEditStep={NOOP} />);
    }
  }
  for (const name of ['together', 'race', 'streak', 'withCause']) {
    const state = STATES[name];
    out[`interact/${name}/how`] = interactions((calls) =>
      StepHowItWorks({ selected: state.challengeType, onSelect: (type) => calls.push({ select: type }) }));
    out[`interact/${name}/details`] = interactions((calls) =>
      StepChallengeDetails({ state, onUpdate: (patch) => calls.push({ patch }) }));
    out[`interact/${name}/counts`] = interactions((calls) =>
      StepWhatCounts({
        state,
        onUpdateActivity: (index, patch) => calls.push({ activity: index, patch }),
        onRemove: (index) => calls.push({ remove: index }),
      }));
    out[`route/${name}`] = createChallengeWizardRouteState(state, 3, { fromChallengeDraft: true });
  }
  out['step/activities/loading-and-handoff'] = wrap(
    <StepActivities state={STATES.race} preselectedIdentity="FIT-TST-001" addToDraft addingId="a0000000-0000-4000-8000-000000000001" addError="We could not load that Activity. Please choose another."
      onAdd={async () => null} onRemove={NOOP} onHandoffConsumed={NOOP} stepIndex={3} onGuideTrip={NOOP} />);
  return out;
}
