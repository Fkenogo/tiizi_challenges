import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePreferencesSection } from './ProfilePreferencesSection';

const mocks = vi.hoisted(() => ({ preferences: null as any, mutate: vi.fn() }));

vi.mock('./usePreferences', () => ({
  useV2Preferences: () => ({ data: mocks.preferences, isLoading: false, isError: false, refetch: vi.fn() }),
  useSaveV2Preferences: () => ({ mutate: mocks.mutate, isPending: false }),
}));

const interests = [
  { id: 'strength', label: 'Strength', domain: 'Fitness' },
  { id: 'cardio', label: 'Cardio', domain: 'Fitness' },
  { id: 'mobility', label: 'Mobility', domain: 'Fitness' },
  { id: 'balance', label: 'Balance', domain: 'Fitness' },
  { id: 'sports', label: 'Sports', domain: 'Fitness' },
  { id: 'sleep', label: 'Sleep', domain: 'Wellness' },
];
const goals = [
  { id: 'build-strength', label: 'Build strength' },
  { id: 'endurance', label: 'Improve endurance' },
  { id: 'sleep-well', label: 'Improve sleep' },
  { id: 'stress', label: 'Manage stress' },
];

function renderSection() {
  return render(<ProfilePreferencesSection uid="member-1" />);
}

describe('Profile preference summaries and editors', () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.preferences = {
      interestIds: ['strength', 'cardio', 'mobility', 'balance', 'sports'],
      goalIds: ['build-strength', 'endurance', 'sleep-well'],
      interestsDecided: true,
      goalsDecided: true,
      limits: { interests: 5, goals: 3 },
      vocabulary: { interests, goals },
    };
    mocks.mutate.mockReset();
    mocks.mutate.mockImplementation((change, callbacks) => {
      Object.assign(mocks.preferences, change);
      callbacks?.onSuccess?.(mocks.preferences);
    });
  });

  it('keeps the profile compact and opens the Interests picker with the existing limit and selections', () => {
    renderSection();

    expect(screen.getByText(/5 selected ·/)).toBeTruthy();
    expect(screen.getByText(/3 selected ·/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sleep' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Edit interests' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit interests' });
    expect(within(dialog).getByText(/5 of 5 interests chosen/)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Strength' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(dialog).getByRole('button', { name: 'Sleep' }).hasAttribute('disabled')).toBe(true);
  });

  it('cancels draft changes without applying them and seeds the next edit from saved values', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Edit interests' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit interests' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Strength' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.preferences.interestIds).toContain('strength');
    fireEvent.click(screen.getByRole('button', { name: 'Edit interests' }));
    expect(within(screen.getByRole('dialog', { name: 'Edit interests' })).getByRole('button', { name: 'Strength' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('saves only the edited category and returns to the updated compact summary', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Edit interests' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit interests' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cardio' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sleep' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(mocks.mutate).toHaveBeenCalledWith({ interestIds: ['strength', 'mobility', 'balance', 'sports', 'sleep'] }, expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(/5 selected · Strength, Mobility/)).toBeTruthy();
    expect(mocks.preferences.goalIds).toEqual(['build-strength', 'endurance', 'sleep-well']);
  });

  it('closes without recording a preference decision when Save has no changes', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Edit interests' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Edit interests' })).getByRole('button', { name: 'Save' }));

    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(/5 selected ·/)).toBeTruthy();
  });

  it('opens Goals with current selections and preserves its three-item maximum', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Edit goals' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit goals' });
    expect(within(dialog).getByText(/3 of 3 goals chosen/)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Build strength' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(dialog).getByRole('button', { name: 'Manage stress' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Build strength' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Manage stress' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(mocks.mutate).toHaveBeenCalledWith({ goalIds: ['endurance', 'sleep-well', 'stress'] }, expect.any(Object));
    expect(screen.getByText(/3 selected · Improve endurance/)).toBeTruthy();
  });
});
