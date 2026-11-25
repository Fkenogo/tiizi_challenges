// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { V2GroupDetail } from '../../api/groupsApi';
import type { V2MediaImageProjection } from '../../api/mediaApi';

const h = vi.hoisted(() => ({
  detail: { isLoading: true, data: undefined as V2GroupDetail | undefined },
  save: vi.fn(),
  remove: vi.fn(),
  update: { mutate: vi.fn(), isPending: false, isError: false },
}));

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'member-1' } }) }));
vi.mock('../group/V2GroupScope', () => ({ useV2GroupId: () => 'group-1' }));
vi.mock('./useV2Groups', () => ({
  useV2GroupDetail: () => h.detail,
  useUpdateV2GroupSettings: () => h.update,
  useV2GroupOptions: () => ({ data: { focusAreas: [], goals: [], communityNorms: [] } }),
}));
vi.mock('./GroupInterestsPicker', () => ({ GroupInterestsPicker: () => null }));
vi.mock('../../api/mediaApi', () => ({ saveGroupCoverImage: h.save, removeGroupCoverImage: h.remove }));

import { V2GroupSettingsScreen } from './V2GroupSettingsScreen';
import { getLocalGroupCoverPreview, setLocalGroupCoverPreview } from './localGroupCoverPreviews';
import { v2GroupDetailKey } from './groupQueryKeys';

const group: V2GroupDetail = {
  id: 'group-1',
  name: 'Original Group',
  description: 'Original description',
  isPrivate: false,
  requireAdminApproval: false,
  allowMemberChallenges: true,
  memberCount: 1,
  steward: { memberId: 'member-1' },
  viewerMembership: { status: 'active', role: 'owner' },
  viewerRelationship: 'steward',
  createdAt: null,
  coverId: 'cover-1',
  coverImage: { status: 'ready', assetId: 'old-asset', url: 'https://r2.example.invalid/old.webp', contentType: 'image/webp', width: 100, height: 100 },
  tagline: 'Original tagline',
  location: '',
  focusTags: [],
  goalIds: [],
  goals: [],
  customGoal: null,
  communityNormIds: [],
  communityNorms: [],
  customCommunityNorm: null,
  rules: [],
};

const savedCover: V2MediaImageProjection = {
  status: 'ready', assetId: 'new-asset', url: 'https://r2.example.invalid/new.webp', contentType: 'image/webp', width: 100, height: 100,
};

beforeEach(() => {
  h.detail = { isLoading: true, data: undefined };
  h.save.mockReset().mockResolvedValue(savedCover);
  h.remove.mockReset().mockResolvedValue({ status: 'none' });
  h.update.mutate.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('V2GroupSettingsScreen media reliability', () => {
  it('keeps hook order stable and preserves unrelated form edits while reconciling a saved cover', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(v2GroupDetailKey('group-1', 'member-1'), group);
    const view = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <V2GroupSettingsScreen />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    h.detail = { isLoading: false, data: group };
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <V2GroupSettingsScreen />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const name = await screen.findByRole('textbox', { name: 'Name' });
    fireEvent.change(name, { target: { value: 'Unsaved Group name' } });

    const NativeURL = URL;
    class URLWithPreview extends NativeURL {}
    Object.defineProperty(URLWithPreview, 'createObjectURL', { value: vi.fn(() => 'blob:new-cover') });
    Object.defineProperty(URLWithPreview, 'revokeObjectURL', { value: vi.fn() });
    vi.stubGlobal('URL', URLWithPreview);
    setLocalGroupCoverPreview('group-1', new File(['draft'], 'draft.png', { type: 'image/png' }));

    await userEvent.setup().upload(
      screen.getByLabelText('Choose group cover'),
      new File(['replacement'], 'replacement.png', { type: 'image/png' }),
    );

    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      const cached = queryClient.getQueryData<V2GroupDetail>(v2GroupDetailKey('group-1', 'member-1'));
      expect(cached?.coverImage).toEqual(savedCover);
    });
    expect(getLocalGroupCoverPreview('group-1')).toBeNull();
    expect((screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value).toBe('Unsaved Group name');
  });
});
