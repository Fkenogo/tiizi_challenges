// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { V2Profile } from '../../api/profileApi';
import type { V2MediaImageProjection } from '../../api/mediaApi';

const h = vi.hoisted(() => ({
  fetchProfile: vi.fn(),
  updateName: vi.fn(),
  user: { uid: 'member-1', email: 'member@example.test' } as { uid: string; email: string } | null,
}));

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('../../api/profileApi', () => ({
  fetchV2Profile: h.fetchProfile,
  updateV2DisplayName: h.updateName,
}));

import { useV2Profile } from './useV2Profile';

const oldImage: V2MediaImageProjection = {
  status: 'ready', assetId: 'old-asset', url: 'https://r2.example.invalid/old.webp', contentType: 'image/webp', width: 256, height: 256,
};
const newImage: V2MediaImageProjection = {
  status: 'ready', assetId: 'new-asset', url: 'https://r2.example.invalid/new.webp', contentType: 'image/webp', width: 256, height: 256,
};
const profile: V2Profile = {
  memberId: 'member-1',
  displayName: 'Old Name',
  profileImage: oldImage,
  groups: { count: 0, items: [], nextCursor: null },
  challenges: { activeCount: 0, historyCount: 0, totalCount: 0, items: [], nextCursor: null },
};

function Harness() {
  const value = useV2Profile();
  return (
    <>
      <output aria-label="Name">{value.profile?.displayName ?? 'Loading'}</output>
      <output aria-label="Image">{value.profile?.profileImage.status === 'ready' ? value.profile.profileImage.assetId : 'none'}</output>
      <button type="button" onClick={() => void value.saveDisplayName('New Name')}>Save name</button>
      <button type="button" onClick={() => value.applyProfileImage(newImage)}>Apply photo</button>
    </>
  );
}

beforeEach(() => {
  h.user = { uid: 'member-1', email: 'member@example.test' };
  h.fetchProfile.mockReset().mockResolvedValue(profile);
  h.updateName.mockReset();
});

afterEach(cleanup);

describe('useV2Profile concurrent identity writes', () => {
  it('does not discard a name save when a photo update completes first', async () => {
    let resolveName!: (value: V2Profile) => void;
    h.updateName.mockImplementation(() => new Promise<V2Profile>((resolve) => { resolveName = resolve; }));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Harness />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByLabelText('Name').textContent).toBe('Old Name'));
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply photo' }));
    await waitFor(() => expect(screen.getByLabelText('Image').textContent).toBe('new-asset'));

    await act(async () => resolveName({ ...profile, displayName: 'New Name' }));
    await waitFor(() => expect(screen.getByLabelText('Name').textContent).toBe('New Name'));
    expect(screen.getByLabelText('Image').textContent).toBe('new-asset');
  });
});
