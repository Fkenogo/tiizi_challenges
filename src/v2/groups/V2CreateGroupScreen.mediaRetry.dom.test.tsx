// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { V2CreateGroupScreen } from './V2CreateGroupScreen';

const h = vi.hoisted(() => ({
  uid: 'member-1',
  mutateAsync: vi.fn(),
  saveGroupCoverImage: vi.fn(),
  removeGroupCoverImage: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: h.uid } }) }));
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => h.navigate };
});

vi.mock('./useV2Groups', () => ({
  useCreateGroup: () => ({
    mutateAsync: h.mutateAsync,
    isPending: false,
    isError: false,
    error: null,
  }),
  useV2GroupOptions: () => ({
    data: { focusAreas: [], goals: [], communityNorms: [] },
  }),
}));

vi.mock('../../api/mediaApi', () => ({
  saveGroupCoverImage: h.saveGroupCoverImage,
  removeGroupCoverImage: h.removeGroupCoverImage,
}));

beforeEach(() => {
  h.uid = 'member-1';
  h.mutateAsync.mockReset();
  h.saveGroupCoverImage.mockReset();
  h.removeGroupCoverImage.mockReset();
  h.navigate.mockReset();
  vi.stubGlobal('URL', {
    createObjectURL: () => 'blob:mock-cover',
    revokeObjectURL: () => {},
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('V2CreateGroupScreen cover upload failure & retry', () => {
  it('preserves created Group without duplicating creation when cover upload fails, and allows retry', async () => {
    h.mutateAsync.mockResolvedValue({ id: 'grp-123', name: 'Sunrise Club' });
    h.saveGroupCoverImage
      .mockRejectedValueOnce(new Error('R2 timeout'))
      .mockResolvedValueOnce({ status: 'ready', assetId: 'a1', url: 'https://signed/a1', contentType: 'image/webp', width: 960, height: 540 });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <V2CreateGroupScreen />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Step 0: Name & description
    fireEvent.change(screen.getByLabelText(/Group name/i), { target: { value: 'Sunrise Club' } });
    fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: 'Morning runners' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 1: Purpose & cover
    expect(screen.getByText('JPG, PNG or WebP · Preview only. This photo will be saved when you create the Group.')).toBeTruthy();
    const fileInput = screen.getByLabelText(/Choose group cover/i);
    const file = new File([new Uint8Array([1, 2, 3])], 'cover.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 2: Community & privacy -> Continue
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 3: Our culture -> Continue
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 4: Review -> Establish Group
    fireEvent.click(screen.getByRole('button', { name: 'Establish Group' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Your Group was created, but the cover photo could not be saved');
    });
    expect(h.mutateAsync).toHaveBeenCalledTimes(1);
    expect(h.saveGroupCoverImage).toHaveBeenCalledTimes(1);
    expect(h.navigate).not.toHaveBeenCalled();

    // Retry Cover Upload must NOT call mutateAsync again
    const retryButtons = screen.getAllByRole('button', { name: 'Retry Cover Upload' });
    fireEvent.click(retryButtons[0]);

    await waitFor(() => {
      expect(h.navigate).toHaveBeenCalledWith('/v2/groups/grp-123', expect.objectContaining({ replace: true }));
    });
    expect(h.mutateAsync).toHaveBeenCalledTimes(1);
    expect(h.saveGroupCoverImage).toHaveBeenCalledTimes(2);
    const firstKey = h.saveGroupCoverImage.mock.calls[0]?.[2]?.idempotencyKey;
    const retryKey = h.saveGroupCoverImage.mock.calls[1]?.[2]?.idempotencyKey;
    expect(firstKey).toBeTruthy();
    expect(retryKey).toBe(firstKey);
  });

  it('A selected -> upload fails -> B selected -> retry -> B persists with a new upload identity and single Group', async () => {
    h.mutateAsync.mockResolvedValue({ id: 'grp-456', name: 'River Runners' });
    const fileA = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' });
    const fileB = new File([new Uint8Array([4, 5, 6])], 'b.png', { type: 'image/png' });
    h.saveGroupCoverImage
      .mockRejectedValueOnce(new Error('R2 timeout'))
      .mockResolvedValueOnce({ status: 'ready', assetId: 'asset-b', url: 'https://signed/b', contentType: 'image/webp', width: 960, height: 540 });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <V2CreateGroupScreen />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText(/Group name/i), { target: { value: 'River Runners' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    fireEvent.change(screen.getByLabelText(/Choose group cover/i), { target: { files: [fileA] } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Establish Group' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Your Group was created, but the cover photo could not be saved');
    });
    expect(h.mutateAsync).toHaveBeenCalledTimes(1);
    expect(h.saveGroupCoverImage).toHaveBeenCalledTimes(1);

    // Select File B in the recovery picker and retry
    fireEvent.change(screen.getByLabelText(/Choose group cover/i), { target: { files: [fileB] } });
    const retryButtons = screen.getAllByRole('button', { name: 'Retry Cover Upload' });
    fireEvent.click(retryButtons[0]);

    await waitFor(() => {
      expect(h.navigate).toHaveBeenCalledWith('/v2/groups/grp-456', expect.objectContaining({ replace: true }));
    });
    expect(h.mutateAsync).toHaveBeenCalledTimes(1);
    expect(h.saveGroupCoverImage).toHaveBeenCalledTimes(2);
    expect(h.saveGroupCoverImage.mock.calls[0]?.[1]).toBe(fileA);
    expect(h.saveGroupCoverImage.mock.calls[1]?.[1]).toBe(fileB);
    const keyA = h.saveGroupCoverImage.mock.calls[0]?.[2]?.idempotencyKey;
    const keyB = h.saveGroupCoverImage.mock.calls[1]?.[2]?.idempotencyKey;
    expect(keyA).toBeTruthy();
    expect(keyB).toBeTruthy();
    expect(keyB).not.toBe(keyA);
  });

  it('prevents duplicate Group creation when Establish Group is clicked twice rapidly', async () => {
    let resolveCreate!: (value: { id: string; name: string }) => void;
    h.mutateAsync.mockImplementation(
      () => new Promise((resolve) => { resolveCreate = resolve; }),
    );

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <V2CreateGroupScreen />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText(/Group name/i), { target: { value: 'Rapid Club' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const submitButton = screen.getByRole('button', { name: 'Establish Group' });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    expect(h.mutateAsync).toHaveBeenCalledTimes(1);
    resolveCreate({ id: 'grp-rapid', name: 'Rapid Club' });
    await waitFor(() => {
      expect(h.navigate).toHaveBeenCalledWith('/v2/groups/grp-rapid', expect.objectContaining({ replace: true }));
    });
  });

  it('clears the previous user selected cover photo when the account switches', async () => {
    const queryClient = new QueryClient();
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <V2CreateGroupScreen />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText(/Group name/i), { target: { value: 'Account A Group' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const fileA = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/Choose group cover/i), { target: { files: [fileA] } });
    expect(screen.getByRole('img', { name: 'Group cover local preview' })).toBeTruthy();

    h.uid = 'member-2';
    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <V2CreateGroupScreen />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByRole('img', { name: 'Group cover local preview' })).toBeNull();
    });
  });
});
