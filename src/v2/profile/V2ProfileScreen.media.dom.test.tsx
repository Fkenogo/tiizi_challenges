// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { V2ProfileScreen } from './V2ProfileScreen';

const h = vi.hoisted(() => ({
  uid: 'member-a',
  applyProfileImage: vi.fn(),
  saveOwnProfileImage: vi.fn(),
  removeOwnProfileImage: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: h.uid, email: `${h.uid}@example.com` } }),
}));

vi.mock('./useV2Profile', () => ({
  useV2Profile: () => ({
    profile: {
      memberId: h.uid,
      displayName: 'Test Member',
      profileImage: {
        status: 'ready',
        assetId: 'asset-initial',
        url: 'https://signed/initial.webp',
        contentType: 'image/webp',
        width: 512,
        height: 512,
      },
      groups: { items: [], totalCount: 0, nextCursor: null },
      challenges: { items: [], historyCount: 0, nextCursor: null },
    },
    isLoading: false,
    error: null,
    isSaving: false,
    saveDisplayName: vi.fn(),
    applyProfileImage: h.applyProfileImage,
    reload: vi.fn(),
    loadMoreGroups: vi.fn(),
    loadMoreChallenges: vi.fn(),
    isLoadingGroups: false,
    isLoadingChallenges: false,
    pageError: null,
  }),
}));

vi.mock('./useV2SignOut', () => ({
  useV2SignOut: () => ({ signOut: vi.fn() }),
}));

vi.mock('../../api/mediaApi', () => ({
  saveOwnProfileImage: h.saveOwnProfileImage,
  removeOwnProfileImage: h.removeOwnProfileImage,
}));

vi.mock('../preferences/ProfilePreferencesSection', () => ({
  ProfilePreferencesSection: () => null,
}));

vi.mock('../support/V2SupportTiiziCard', () => ({
  V2SupportTiiziCard: () => null,
}));

beforeEach(() => {
  h.uid = 'member-a';
  h.applyProfileImage.mockReset();
  h.saveOwnProfileImage.mockReset();
  h.removeOwnProfileImage.mockReset();
  vi.stubGlobal('URL', {
    createObjectURL: () => 'blob:mock-profile',
    revokeObjectURL: () => {},
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('V2ProfileScreen media retry identity & concurrency', () => {
  it('A selected -> upload fails -> B selected -> B persists with a new upload identity', async () => {
    const fileA = new File([new Uint8Array([1, 2])], 'a.png', { type: 'image/png' });
    const fileB = new File([new Uint8Array([3, 4])], 'b.png', { type: 'image/png' });
    const bProjection = {
      status: 'ready' as const,
      assetId: 'asset-b',
      url: 'https://signed/b.webp',
      contentType: 'image/webp',
      width: 512,
      height: 512,
    };
    h.saveOwnProfileImage
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(bProjection);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <V2ProfileScreen />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const input = screen.getByLabelText('Choose profile photo');
    fireEvent.change(input, { target: { files: [fileA] } });

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Could not save your profile photo');
    });

    fireEvent.change(input, { target: { files: [fileB] } });

    await waitFor(() => {
      expect(h.applyProfileImage).toHaveBeenCalledWith(bProjection);
    });

    const keyA = h.saveOwnProfileImage.mock.calls[0]?.[1]?.idempotencyKey;
    const keyB = h.saveOwnProfileImage.mock.calls[1]?.[1]?.idempotencyKey;
    expect(keyA).toBeTruthy();
    expect(keyB).toBeTruthy();
    expect(keyB).not.toBe(keyA);
  });

  it('ignores stale upload completion after account switch and blocks overlapping remove while saving', async () => {
    let resolveUpload!: (value: unknown) => void;
    h.saveOwnProfileImage.mockImplementation(
      () => new Promise((resolve) => { resolveUpload = resolve; }),
    );

    const { rerender } = render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <V2ProfileScreen />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const input = screen.getByLabelText('Choose profile photo') as HTMLInputElement;
    const fileA = new File([new Uint8Array([1, 2])], 'a.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [fileA] } });

    expect(input.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    expect(h.removeOwnProfileImage).not.toHaveBeenCalled();

    h.uid = 'member-b';
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <V2ProfileScreen />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    resolveUpload({
      status: 'ready',
      assetId: 'asset-stale',
      url: 'https://signed/stale.webp',
      contentType: 'image/webp',
      width: 512,
      height: 512,
    });

    await waitFor(() => {
      expect((screen.getByLabelText('Choose profile photo') as HTMLInputElement).disabled).toBe(false);
    });
    expect(h.applyProfileImage).not.toHaveBeenCalled();
  });
});
