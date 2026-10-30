import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivitiesStep, ChallengeTypeStep, NameAppearanceFields, WhatCountsStep, buildWizardActivity } from '.';
import type { ActivityOptionsResponse } from '../../../api/challengeCreationApi';
import type { WizardActivity } from '../challengeCreationDraft';

const h = vi.hoisted(() => ({ catalogue: vi.fn() }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('../../../lib/firebaseAuth', () => ({ auth: { currentUser: null } }));
vi.mock('../../../api/challengeCreationApi', async (original) => ({
  ...(await original<typeof import('../../../api/challengeCreationApi')>()), fetchComposerSelectableKnowledge: h.catalogue,
}));

const ITEMS = [
  { id: 'act-1', activityCode: 'FIT-1', name: 'Push-ups', kind: 'fitness', category: 'Strength', subcategory: '', imageUrl: '' },
  { id: 'act-2', activityCode: 'FIT-2', name: 'Plank', kind: 'fitness', category: 'Strength', subcategory: '', imageUrl: '' },
];
const OPTIONS: ActivityOptionsResponse = {
  knowledgeId: 'act-1', activityCode: 'FIT-1', kind: 'fitness', currentVersion: 3, primaryMetrics: ['repetitions'], secondaryMetrics: [],
  compatibleUnits: ['reps'], components: [], supportedLoadBases: [], unitsByMetric: { repetitions: ['reps'] },
};
const activity = (id = 'act-1', name = 'Push-ups'): WizardActivity => buildWizardActivity({ ...ITEMS[0], id, name } as never, OPTIONS, 'streak');

function Where() { const location = useLocation(); return <output data-testid="where">{location.pathname}|{JSON.stringify(location.state)}</output>; }

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><Where />{ui}</MemoryRouter></QueryClientProvider>);
}

type StepProps = Parameters<typeof ActivitiesStep<{ challengeType: 'streak'; activities: WizardActivity[] }>>[0];
const base = (over: Partial<StepProps> = {}): StepProps => ({
  state: { challengeType: 'streak', activities: [] }, preselectedIdentity: '', addToDraft: false, addingId: null, addError: '',
  onAdd: vi.fn(async () => null), onRemove: vi.fn(), onHandoffConsumed: vi.fn(), guideLinkState: { keep: 'draft' }, onGuideTrip: vi.fn(), ...over,
});

beforeEach(() => { vi.stubEnv('VITE_TIIZI_API_BASE_URL', 'http://api.test'); h.catalogue.mockResolvedValue(ITEMS); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('ActivitiesStep — member Wizard behaviour (the default)', () => {
  it('links to the Guide with the draft carried in router state and records the trip on a plain click only', async () => {
    const props = base();
    wrap(<ActivitiesStep {...props} />);
    const row = await screen.findByRole('link', { name: /Open Push-ups/ });
    await userEvent.click(row);
    expect(props.onGuideTrip).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('where').textContent).toBe('/v2/guide/act-1|{"keep":"draft"}');
  });

  it('does not record a Guide trip for a modified click that opens elsewhere', async () => {
    const props = base();
    wrap(<ActivitiesStep {...props} />);
    const row = await screen.findByRole('link', { name: /Open Push-ups/ });
    const user = userEvent.setup();
    await user.keyboard('{Control>}');
    await user.click(row);
    await user.keyboard('{/Control}');
    expect(props.onGuideTrip).not.toHaveBeenCalled();
  });

  it('adds a handed-off Activity once, then reports the handoff consumed with the updated draft', async () => {
    const updated = { challengeType: 'streak' as const, activities: [activity()] };
    const props = base({ preselectedIdentity: 'FIT-1', addToDraft: true, onAdd: vi.fn(async () => updated) });
    wrap(<ActivitiesStep {...props} />);
    await waitFor(() => expect(props.onHandoffConsumed).toHaveBeenCalledWith(updated));
    expect(props.onAdd).toHaveBeenCalledTimes(1);
    expect((props.onAdd as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({ id: 'act-1' });
  });

  it('consumes a handoff for an Activity that is already selected without adding it again', async () => {
    const props = base({ preselectedIdentity: 'act-1', addToDraft: true, state: { challengeType: 'streak', activities: [activity()] } });
    wrap(<ActivitiesStep {...props} />);
    await waitFor(() => expect(props.onHandoffConsumed).toHaveBeenCalledTimes(1));
    expect(props.onAdd).not.toHaveBeenCalled();
  });

  it('lists selected Activities, removes by identity, and shows the add error and progress', async () => {
    const props = base({ state: { challengeType: 'streak', activities: [activity('act-2', 'Plank')] }, addError: 'We could not load that Activity.', addingId: 'act-1' });
    wrap(<ActivitiesStep {...props} />);
    const selected = await screen.findByRole('region', { name: 'Selected activities' });
    await userEvent.click(within(selected).getByRole('button', { name: 'Remove' }));
    expect(props.onRemove).toHaveBeenCalledWith('act-2');
    expect(screen.getByText('We could not load that Activity.')).toBeTruthy();
    expect(screen.getByText(/Adding this Activity/)).toBeTruthy();
  });

  it('states the single-activity rule for Together and Race', async () => {
    wrap(<ActivitiesStep {...base({ state: { challengeType: 'streak', activities: [] } })} />);
    expect(await screen.findByText(/more than one daily activity/)).toBeTruthy();
    cleanup();
    wrap(<ActivitiesStep {...base({ state: { challengeType: 'competitive' as never, activities: [] } })} />);
    expect(await screen.findByText(/single activity/)).toBeTruthy();
  });

  it('shows an honest state when the catalogue fails or is empty', async () => {
    h.catalogue.mockRejectedValue(new Error('down'));
    wrap(<ActivitiesStep {...base()} />);
    expect(await screen.findByText(/could not load activities/i)).toBeTruthy();
    cleanup();
    h.catalogue.mockResolvedValue([]);
    wrap(<ActivitiesStep {...base()} />);
    expect(await screen.findByText(/No activities found/)).toBeTruthy();
  });
});

describe('ActivitiesStep — in-place picking (Template authoring)', () => {
  it('adds in place, never navigates, and opens the Guide in a new tab', async () => {
    const props = base({ pick: true, guideLinkState: undefined, onGuideTrip: undefined });
    wrap(<ActivitiesStep {...props} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add Push-ups' }));
    expect((props.onAdd as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({ id: 'act-1' });
    expect(screen.getByTestId('where').textContent).toBe('/|null');
    const guide = screen.getByRole('link', { name: /View Push-ups in the Activity Guide/ });
    expect(guide.getAttribute('target')).toBe('_blank');
    expect(guide.getAttribute('rel')).toContain('noopener');
    expect(screen.queryByRole('link', { name: /^Open / })).toBeNull();
  });

  it('disables Add for an already-chosen Activity and while another is being added', async () => {
    wrap(<ActivitiesStep {...base({ pick: true, state: { challengeType: 'streak', activities: [activity()] }, addingId: 'act-2' })} />);
    expect((await screen.findByRole('button', { name: 'Push-ups is already added' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Add Plank' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('other extracted steps', () => {
  it('ChallengeTypeStep reports the selected type', async () => {
    const onSelect = vi.fn();
    wrap(<ChallengeTypeStep selected={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /Streak/ }));
    expect(onSelect).toHaveBeenCalledWith('streak');
  });

  it('NameAppearanceFields reports title, description and cover as patches', async () => {
    const onUpdate = vi.fn();
    wrap(<NameAppearanceFields state={{ title: '', description: '', coverId: null }} onUpdate={onUpdate} intro={<p>intro</p>} />);
    await userEvent.type(screen.getByLabelText('Challenge title'), 'A');
    expect(onUpdate).toHaveBeenCalledWith({ title: 'A' });
    await userEvent.click(screen.getAllByRole('button', { pressed: false })[0]);
    expect(onUpdate).toHaveBeenLastCalledWith({ coverId: 'challenge-1' });
  });

  it('WhatCountsStep reports edits and removal for the right row', async () => {
    const onUpdateActivity = vi.fn(); const onRemove = vi.fn();
    wrap(<WhatCountsStep state={{ challengeType: 'streak', activities: [activity('act-1'), activity('act-2', 'Plank')] }} onUpdateActivity={onUpdateActivity} onRemove={onRemove} />);
    const targets = screen.getAllByLabelText(/Daily requirement/);
    await userEvent.type(targets[1], '5');
    expect(onUpdateActivity).toHaveBeenCalledWith(1, expect.objectContaining({ targetValue: expect.stringContaining('5') }));
    await userEvent.click(screen.getAllByRole('button', { name: /Remove/ })[0]);
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it('WhatCountsStep with no Activities points back to the previous step', () => {
    wrap(<WhatCountsStep state={{ challengeType: 'streak', activities: [] }} onUpdateActivity={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText(/No activities chosen yet/)).toBeTruthy();
  });
});
