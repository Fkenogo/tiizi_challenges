import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { V2ChallengeSummary } from '../../api/v2ChallengeApi';
import { V2ChallengeCard } from './V2ChallengeCard';
import { removeLocalChallengeCoverPreview, setLocalChallengeCoverPreview } from './localChallengeCoverPreviews';

const challenge = (challengeId: string): V2ChallengeSummary => ({
  challengeId, title: `Challenge ${challengeId}`, description: '', challengeType: 'collective', status: 'active',
  startDate: '2026-01-01', endDate: '2026-12-31', timezone: 'UTC', governingToday: '2026-11-03', finalized: false,
  currentConfigVersion: 1, goalValue: null, goalUnit: null, collectiveTotal: 0, collectiveGoalReached: false,
  completionsCount: 0, groupId: 'group-1', groupName: 'Local Group', activities: [], myParticipation: null,
});

afterEach(() => {
  cleanup();
  removeLocalChallengeCoverPreview('photo-owner');
  vi.unstubAllGlobals();
});

describe('V2ChallengeCard local cover previews', () => {
  it('shows a locally selected photo only on the Challenge with its matching preview identity', async () => {
    const file = new File(['fictional local cover'], 'local-cover.png', { type: 'image/png' });
    setLocalChallengeCoverPreview('photo-owner', file);
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:local-cover'), revokeObjectURL: vi.fn() });

    render(
      <ul>
        <V2ChallengeCard challenge={challenge('photo-owner')} surface="my" statusLabel="Running" statusTone="" groupLine="Local Group" progress={<p>Preview progress</p>} actions={<button>View Challenge</button>} />
        <V2ChallengeCard challenge={challenge('other-challenge')} surface="find" statusLabel="Running" statusTone="" groupLine="Local Group" progress={<p>Preview progress</p>} actions={<button>View Challenge</button>} />
      </ul>,
    );

    expect((await screen.findByRole('img', { name: 'Challenge photo-owner cover photo' })).getAttribute('src')).toBe('blob:local-cover');
    expect(screen.getByText('Local photo preview · not saved to the Challenge')).toBeTruthy();
    expect(screen.getByText('No cover photo')).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Challenge other-challenge cover photo' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'View Challenge' })).toHaveLength(2);
  });

  it('keeps Challenge title and group line readable and unobstructed without cover photo', () => {
    render(
      <V2ChallengeCard
        challenge={challenge('uncovered-challenge')}
        surface="explore"
        statusLabel="Upcoming"
        statusTone="bg-slate-100 text-slate-800"
        groupLine="Kilimanjaro Runners"
        progress={<p>Progress placeholder</p>}
        actions={<button>Join</button>}
      />,
    );

    const titleHeading = screen.getByRole('heading', { level: 3, name: 'Challenge uncovered-challenge' });
    expect(titleHeading).toBeTruthy();
    expect(screen.getByText('Kilimanjaro Runners')).toBeTruthy();

    const placeholderBadge = screen.getByText('No cover photo');
    expect(placeholderBadge).toBeTruthy();
    // The placeholder container is positioned at top-11/top-12, completely separate from the bottom title container
    const placeholderContainer = placeholderBadge.closest('.absolute');
    expect(placeholderContainer?.className).toContain('top-11');
    expect(placeholderContainer?.className).not.toContain('bottom-3');
    const titleContainer = titleHeading.closest('.absolute');
    expect(titleContainer?.className).toContain('bottom-3');
    expect(titleContainer?.className).not.toContain('top-11');
  });
});
