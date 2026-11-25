// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { V2ChallengeCoverEditor } from './V2ChallengeCoverEditor';
import { v2ChallengeDetailKey } from './challengeQueryKeys';
import type { V2ChallengeDetail } from '../../api/v2ChallengeApi';

const h = vi.hoisted(() => ({
  uid: 'steward-1',
  saveChallengeCoverImage: vi.fn(),
  removeChallengeCoverImage: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: h.uid } }) }));
vi.mock('../../api/mediaApi', () => ({
  saveChallengeCoverImage: h.saveChallengeCoverImage,
  removeChallengeCoverImage: h.removeChallengeCoverImage,
}));

function makeDetail(overrides: Partial<V2ChallengeDetail> = {}): V2ChallengeDetail {
  return {
    challengeId: 'challenge-1',
    groupId: 'group-1',
    groupName: 'Runners',
    title: 'Morning Miles',
    description: 'Daily run',
    status: 'active',
    challengeType: 'collective',
    cadence: 'daily',
    startAt: '2026-11-01T00:00:00Z',
    endAt: '2026-11-30T00:00:00Z',
    coverId: null,
    coverImage: {
      status: 'ready',
      assetId: 'asset-old',
      url: 'https://signed/old.webp',
      contentType: 'image/webp',
      width: 960,
      height: 540,
    },
    activities: [],
    participation: {
      joined: true,
      canJoin: false,
      canLeave: true,
      canLog: true,
      viewerRole: 'steward',
    },
    ...overrides,
  } as V2ChallengeDetail;
}

beforeEach(() => {
  h.uid = 'steward-1';
  h.saveChallengeCoverImage.mockReset();
  h.removeChallengeCoverImage.mockReset();
  vi.stubGlobal('URL', {
    createObjectURL: () => 'blob:mock-challenge-cover',
    revokeObjectURL: () => {},
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('V2ChallengeCoverEditor media reliability & concurrency', () => {
  it('A selected -> upload fails -> B selected -> B persists with a new upload identity', async () => {
    const fileA = new File([new Uint8Array([1, 2])], 'a.png', { type: 'image/png' });
    const fileB = new File([new Uint8Array([3, 4])], 'b.png', { type: 'image/png' });
    h.saveChallengeCoverImage
      .mockRejectedValueOnce(new Error('upload failed'))
      .mockResolvedValueOnce({
        status: 'ready',
        assetId: 'asset-b',
        url: 'https://signed/b.webp',
        contentType: 'image/webp',
        width: 960,
        height: 540,
      });

    const queryClient = new QueryClient();
    queryClient.setQueryData(v2ChallengeDetailKey('challenge-1', 'steward-1'), makeDetail());

    render(
      <QueryClientProvider client={queryClient}>
        <V2ChallengeCoverEditor detail={makeDetail()} />
      </QueryClientProvider>,
    );

    const input = screen.getByLabelText('Choose challenge cover');
    fireEvent.change(input, { target: { files: [fileA] } });

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Could not save the Challenge cover photo');
    });

    fireEvent.change(input, { target: { files: [fileB] } });

    await waitFor(() => {
      expect(screen.getByText('Challenge cover updated.')).toBeTruthy();
    });

    expect(h.saveChallengeCoverImage).toHaveBeenCalledTimes(2);
    const keyA = h.saveChallengeCoverImage.mock.calls[0]?.[2]?.idempotencyKey;
    const keyB = h.saveChallengeCoverImage.mock.calls[1]?.[2]?.idempotencyKey;
    expect(keyA).toBeTruthy();
    expect(keyB).toBeTruthy();
    expect(keyB).not.toBe(keyA);
    const cached = queryClient.getQueryData<V2ChallengeDetail>(v2ChallengeDetailKey('challenge-1', 'steward-1'));
    expect(cached?.coverImage).toMatchObject({ status: 'ready', assetId: 'asset-b' });
  });

  it('disables hidden input while saving and blocks overlapping remove/upload or stale account-switch completion', async () => {
    let resolveUpload!: (value: unknown) => void;
    h.saveChallengeCoverImage.mockImplementation(
      () => new Promise((resolve) => { resolveUpload = resolve; }),
    );

    const queryClient = new QueryClient();
    const detail = makeDetail();
    queryClient.setQueryData(v2ChallengeDetailKey('challenge-1', 'steward-1'), detail);
    queryClient.setQueryData(v2ChallengeDetailKey('challenge-1', 'steward-2'), detail);

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <V2ChallengeCoverEditor detail={detail} />
      </QueryClientProvider>,
    );

    const input = screen.getByLabelText('Choose challenge cover') as HTMLInputElement;
    const fileA = new File([new Uint8Array([1, 2])], 'a.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [fileA] } });

    expect(input.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Photo' }));
    expect(h.removeChallengeCoverImage).not.toHaveBeenCalled();

    // Switch account while upload is in flight
    h.uid = 'steward-2';
    rerender(
      <QueryClientProvider client={queryClient}>
        <V2ChallengeCoverEditor detail={detail} />
      </QueryClientProvider>,
    );

    resolveUpload({
      status: 'ready',
      assetId: 'asset-stale',
      url: 'https://signed/stale.webp',
      contentType: 'image/webp',
      width: 960,
      height: 540,
    });

    await waitFor(() => {
      expect((screen.getByLabelText('Choose challenge cover') as HTMLInputElement).disabled).toBe(false);
    });

    const steward2Cache = queryClient.getQueryData<V2ChallengeDetail>(v2ChallengeDetailKey('challenge-1', 'steward-2'));
    expect(steward2Cache?.coverImage).toMatchObject({ assetId: 'asset-old' });
    expect(screen.queryByText('Challenge cover updated.')).toBeNull();
  });
});
