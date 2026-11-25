import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { V2ChallengeCard } from './V2ChallengeCard';
import { V2ChallengeCover } from './V2ChallengeCover';
import { setLocalChallengeCoverPreview, removeLocalChallengeCoverPreview } from './localChallengeCoverPreviews';

describe('V2ChallengeCover', () => {
  afterEach(() => {
    cleanup();
    removeLocalChallengeCoverPreview('challenge-shared');
    removeLocalChallengeCoverPreview('challenge-other');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('resolves the same local photo by Challenge ID and isolates other Challenges', async () => {
    const sharedFile = new File(['fictional preview'], 'shared.jpg', { type: 'image/jpeg' });
    const otherFile = new File(['other'], 'other.jpg', { type: 'image/jpeg' });
    setLocalChallengeCoverPreview('challenge-shared', sharedFile);
    setLocalChallengeCoverPreview('challenge-other', otherFile);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((file: File) => `blob:${file.name}`),
      revokeObjectURL: vi.fn(),
    });

    render(
      <>
        <V2ChallengeCover challengeId="challenge-shared" title="Shared" heightClass="h-20" />
        <V2ChallengeCover challengeId="challenge-shared" title="Shared" heightClass="h-20" />
        <V2ChallengeCover challengeId="challenge-other" title="Other" heightClass="h-20" />
        <V2ChallengeCover challengeId="challenge-missing" title="Missing" heightClass="h-20" />
      </>,
    );

    await waitFor(() => expect(screen.getAllByRole('img', { name: 'Shared cover photo' })).toHaveLength(2));
    expect(screen.getAllByRole('img', { name: 'Shared cover photo' }).map((image) => image.getAttribute('src')))
      .toEqual(['blob:shared.jpg', 'blob:shared.jpg']);
    expect(screen.getByRole('img', { name: 'Other cover photo' }).getAttribute('src')).toBe('blob:other.jpg');
    expect(screen.queryByRole('img', { name: 'Missing cover photo' })).toBeNull();
    expect(screen.getByLabelText('Missing has no cover photo')).toBeTruthy();
  });

  it('never hides a ready persisted cover behind a stale tab-local File', () => {
    const selected = new File(['stale local preview'], 'stale.jpg', { type: 'image/jpeg' });
    setLocalChallengeCoverPreview('challenge-shared', selected);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:stale'),
      revokeObjectURL: vi.fn(),
    });
    const { container } = render(
      <V2ChallengeCover
        challengeId="challenge-shared"
        title="Persisted Challenge"
        coverImage={{ status: 'ready', assetId: 'asset-1', url: 'https://r2.example.invalid/challenge.webp', contentType: 'image/webp', width: 100, height: 100 }}
        heightClass="h-20"
      />,
    );

    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://r2.example.invalid/challenge.webp');
    expect(container.querySelector('[data-challenge-cover-id="challenge-shared"]')?.getAttribute('data-local-cover')).toBe('false');
  });

  it('hides the "No cover photo" badge on V2ChallengeCard when persisted R2 coverImage is ready', () => {
    render(
      <ul>
        <V2ChallengeCard
          challenge={{
            challengeId: 'challenge-r2',
            groupId: 'group-1',
            groupName: 'Morning Club',
            title: 'Persisted Cover Challenge',
            description: 'Has R2 cover',
            challengeType: 'collective',
            status: 'active',
            finalized: false,
            startDate: '2026-11-24',
            endDate: '2026-12-01',
            timezone: 'UTC',
            governingToday: '2026-11-24',
            currentConfigVersion: 1,
            activities: [],
            goalValue: 10,
            goalUnit: 'km',
            collectiveTotal: 0,
            collectiveGoalReached: false,
            completionsCount: 0,
            coverId: null,
            coverImage: {
              status: 'ready',
              assetId: 'asset-1',
              url: 'https://r2.example.invalid/cover.webp',
              contentType: 'image/webp',
              width: 100,
              height: 100,
            },
            myParticipation: null,
          }}
          surface="my"
          statusLabel="Active"
          statusTone="bg-emerald-100 text-emerald-950"
          groupLine="Morning Club"
          progress={<span>Progress</span>}
          actions={<button type="button">Open</button>}
        />
      </ul>,
    );

    const img = screen.getByRole('img', { name: 'Persisted Cover Challenge cover photo' });
    expect(img.getAttribute('src')).toBe('https://r2.example.invalid/cover.webp');
    expect(screen.queryByText('No cover photo')).toBeNull();
  });
});
