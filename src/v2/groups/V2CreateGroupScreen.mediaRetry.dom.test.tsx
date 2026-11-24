// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { V2CreateGroupScreen } from './V2CreateGroupScreen';

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  saveGroupCoverImage: vi.fn(),
  removeGroupCoverImage: vi.fn(),
  navigate: vi.fn(),
}));

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
      <MemoryRouter>
        <V2CreateGroupScreen />
      </MemoryRouter>,
    );

    // Step 0: Name & description
    fireEvent.change(screen.getByLabelText(/Group name/i), { target: { value: 'Sunrise Club' } });
    fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: 'Morning runners' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 1: Purpose & cover
    const fileInput = screen.getByLabelText(/Choose group cover/i);
    const file = new File([new Uint8Array([1, 2, 3])], 'cover.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 2: Community & privacy -> Continue
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 3: Review -> Establish Group
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
  });
});
