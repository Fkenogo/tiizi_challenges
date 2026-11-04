import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { id: string; name: string; kind: 'fitness' | 'wellness'; category: string; subcategory: string };
const rows: Row[] = [
  { id: 'a1', name: 'Push-Up', kind: 'fitness', category: 'Strength', subcategory: 'Push' },
  { id: 'a2', name: 'Squat', kind: 'fitness', category: 'Strength', subcategory: 'Squat' },
  { id: 'a3', name: 'Easy Run', kind: 'fitness', category: 'Cardio & Conditioning', subcategory: 'Locomotion' },
  { id: 'a4', name: 'Sleep Routine', kind: 'wellness', category: 'Sleep & Rest', subcategory: 'Sleep' },
  { id: 'a5', name: 'Mindful Minute', kind: 'wellness', category: 'Mind & Emotional Wellbeing', subcategory: 'Mindfulness' },
];
const h = vi.hoisted(() => ({ calls: [] as unknown[][] }));

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('../../api/challengeCreationApi', () => ({ fetchComposerSelectableKnowledge: vi.fn() }));
vi.mock('../challenges/challengeDraftSession', () => ({ releaseAbandonedChallengeDraft: vi.fn() }));
vi.mock('../../api/knowledgeApi', () => ({
  fetchKnowledgeById: vi.fn(),
  fetchPublishedActivities: vi.fn(async (search?: string, category?: string, kind?: string) => {
    h.calls.push([search, category, kind]);
    return rows.filter((r) => (!kind || r.kind === kind) && (!category || r.category === category)
      && (!search || `${r.name} ${r.category} ${r.subcategory}`.toLowerCase().includes(search.toLowerCase())));
  }),
}));

import { V2ActivityLibraryScreen } from './ActivityLibraryScreen';

function mount() {
  vi.stubEnv('VITE_TIIZI_API_BASE_URL', 'http://api.test');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><V2ActivityLibraryScreen /></MemoryRouter></QueryClientProvider>);
}
const names = () => within(screen.getByLabelText('Activity results')).getAllByRole('link').map((l) => l.querySelector('span span')?.textContent);
const control = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label}: `) });

beforeEach(() => { h.calls.length = 0; });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe('Activity Guide Category / Subcategory dropdown filters', () => {
  it('shows every Activity by default with two compact controls and no horizontal rail', async () => {
    mount();
    await waitFor(() => expect(names()).toHaveLength(5));
    expect(control('Category').getAttribute('aria-label')).toBe('Category: All Categories');
    expect(control('Subcategory').getAttribute('aria-label')).toBe('Subcategory: All Subcategories');
    expect(screen.queryByText('Filters active')).toBeNull();
    expect(screen.queryByRole('button', { name: 'All categories' })).toBeNull();
    expect(document.querySelector('.overflow-x-auto')).toBeNull();
  });

  it('Category lists All/Fitness/Wellness; selecting filters, closes the menu and shows indicator', async () => {
    mount();
    await waitFor(() => expect(names()).toHaveLength(5));
    const user = userEvent.setup();
    await user.click(control('Category'));
    expect(within(screen.getByRole('listbox', { name: 'Category' })).getAllByRole('option').map((o) => o.textContent)).toEqual(['All Categories✓', 'Fitness', 'Wellness']);
    await user.click(screen.getByRole('option', { name: 'Fitness' }));
    expect(screen.queryByRole('listbox')).toBeNull();
    await waitFor(() => expect(names()).toEqual(['Push-Up', 'Squat', 'Easy Run']));
    expect(control('Category').getAttribute('aria-label')).toBe('Category: Fitness');
    expect(screen.getByText('Filters active')).toBeTruthy();
    await user.click(control('Category'));
    await user.click(screen.getByRole('option', { name: 'Wellness' }));
    await waitFor(() => expect(names()).toEqual(['Sleep Routine', 'Mindful Minute']));
  });

  it('Subcategory is grouped by Fitness/Wellness for All and limited to the selected Category', async () => {
    mount();
    await waitFor(() => expect(names()).toHaveLength(5));
    const user = userEvent.setup();
    await user.click(control('Subcategory'));
    const menu = screen.getByRole('listbox', { name: 'Subcategory' });
    expect(within(menu).getByRole('group', { name: 'Fitness Subcategories' })).toBeTruthy();
    expect(within(menu).getByRole('group', { name: 'Wellness Subcategories' })).toBeTruthy();
    expect(within(within(menu).getByRole('group', { name: 'Fitness Subcategories' })).getAllByRole('option').map((o) => o.textContent)).toEqual(['Cardio & Conditioning', 'Strength']);
    await user.keyboard('{Escape}');
    await user.click(control('Category'));
    await user.click(screen.getByRole('option', { name: 'Wellness' }));
    await user.click(control('Subcategory'));
    const wellness = screen.getByRole('listbox', { name: 'Subcategory' });
    expect(within(wellness).queryByRole('group', { name: 'Fitness Subcategories' })).toBeNull();
    expect(within(wellness).getAllByRole('option').map((o) => o.textContent)).toEqual(['All Subcategories✓', 'Mind & Emotional Wellbeing', 'Sleep & Rest']);
  });

  it('selecting a subcategory syncs its parent Category; changing Category clears an incompatible subcategory', async () => {
    mount();
    await waitFor(() => expect(names()).toHaveLength(5));
    const user = userEvent.setup();
    await user.click(control('Subcategory'));
    await user.click(screen.getByRole('option', { name: 'Sleep & Rest' }));
    await waitFor(() => expect(names()).toEqual(['Sleep Routine']));
    expect(control('Category').getAttribute('aria-label')).toBe('Category: Wellness');
    expect(control('Subcategory').getAttribute('aria-label')).toBe('Subcategory: Sleep & Rest');
    await user.click(control('Category'));
    await user.click(screen.getByRole('option', { name: 'Fitness' }));
    expect(control('Subcategory').getAttribute('aria-label')).toBe('Subcategory: All Subcategories');
    await waitFor(() => expect(names()).toEqual(['Push-Up', 'Squat', 'Easy Run']));
    await user.click(control('Subcategory'));
    await user.click(screen.getByRole('option', { name: 'Strength' }));
    await waitFor(() => expect(names()).toEqual(['Push-Up', 'Squat']));
    await user.click(control('Category'));
    await user.click(screen.getByRole('option', { name: 'All Categories' }));
    expect(control('Subcategory').getAttribute('aria-label')).toBe('Subcategory: Strength');
    await waitFor(() => expect(names()).toEqual(['Push-Up', 'Squat']));
  });

  it('search combines with both filters; Reset all clears filters but keeps the query; empty state clears everything', async () => {
    mount();
    await waitFor(() => expect(names()).toHaveLength(5));
    const user = userEvent.setup();
    await user.type(screen.getByRole('searchbox', { name: 'Search activities' }), 'push');
    await waitFor(() => expect(names()).toEqual(['Push-Up']));
    await user.click(control('Subcategory'));
    await user.click(screen.getByRole('option', { name: 'Strength' }));
    await waitFor(() => expect(names()).toEqual(['Push-Up']));
    await user.click(control('Category'));
    await user.click(screen.getByRole('option', { name: 'Wellness' }));
    await waitFor(() => expect(screen.getByText('No matching activities')).toBeTruthy());
    await user.click(screen.getByRole('button', { name: 'Reset all' }));
    expect(control('Category').getAttribute('aria-label')).toBe('Category: All Categories');
    expect(control('Subcategory').getAttribute('aria-label')).toBe('Subcategory: All Subcategories');
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('push');
    await waitFor(() => expect(names()).toEqual(['Push-Up']));
    await user.type(screen.getByRole('searchbox'), 'zzz');
    await waitFor(() => expect(screen.getByText('No matching activities')).toBeTruthy());
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('');
    await waitFor(() => expect(names()).toHaveLength(5));
  });

  it('keeps one menu open, closes on outside press and Escape, and supports the keyboard', async () => {
    mount();
    await waitFor(() => expect(names()).toHaveLength(5));
    const user = userEvent.setup();
    await user.click(control('Category'));
    await user.click(control('Subcategory'));
    expect(screen.getAllByRole('listbox')).toHaveLength(1);
    expect(screen.getByRole('listbox', { name: 'Subcategory' })).toBeTruthy();
    await user.click(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
    control('Category').focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(control('Category'));
    await waitFor(() => expect(names()).toEqual(['Push-Up', 'Squat', 'Easy Run']));
    await user.keyboard('{Enter}{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(control('Category'));
  });
});
