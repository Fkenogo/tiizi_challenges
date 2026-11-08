import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { V2ChallengeCover } from './V2ChallengeCover';
import { setLocalChallengeCoverPreview, removeLocalChallengeCoverPreview } from './localChallengeCoverPreviews';

describe('V2ChallengeCover', () => {
  afterEach(() => {
    cleanup();
    removeLocalChallengeCoverPreview('challenge-shared');
    removeLocalChallengeCoverPreview('challenge-other');
    vi.restoreAllMocks();
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
});
