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
  uid: 'member-1',
}));

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: h.uid } }) }));
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
  h.uid = 'member-1';
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

  it('rehydrates form state when the same Group is opened by another account', async () => {
    h.detail = { isLoading: false, data: group };
    const queryClient = new QueryClient();
    queryClient.setQueryData(v2GroupDetailKey('group-1', 'member-1'), group);
    const tree = (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <V2GroupSettingsScreen />
        </MemoryRouter>
      </QueryClientProvider>
    );
    const view = render(tree);
    const name = await screen.findByRole('textbox', { name: 'Name' });
    fireEvent.change(name, { target: { value: 'Member one unsaved edit' } });

    h.uid = 'member-2';
    queryClient.setQueryData(v2GroupDetailKey('group-1', 'member-2'), group);
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <V2GroupSettingsScreen />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect((screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value).toBe('Original Group'));
  });

  it('shows Cover photo saved after cover-only update, Done footer, and clarifies Save changes', async () => {
    h.detail = { isLoading: false, data: group };
    const queryClient = new QueryClient();
    queryClient.setQueryData(v2GroupDetailKey('group-1', 'member-1'), group);
    const NativeURL = URL;
    class URLWithPreview extends NativeURL {}
    Object.defineProperty(URLWithPreview, 'createObjectURL', { value: vi.fn(() => 'blob:cover-only') });
    Object.defineProperty(URLWithPreview, 'revokeObjectURL', { value: vi.fn() });
    vi.stubGlobal('URL', URLWithPreview);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <V2GroupSettingsScreen />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await userEvent.setup().upload(
      screen.getByLabelText('Choose group cover'),
      new File(['cover'], 'cover.png', { type: 'image/png' }),
    );

    await waitFor(() => expect(screen.getByText('Cover photo saved')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save changes' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/Cover photo uploads save immediately/i)).toBeTruthy();
  });

  it('allows retrying a failed cover upload and preserves unsaved description edits', async () => {
    h.detail = { isLoading: false, data: group };
    h.save.mockRejectedValueOnce(new Error('network_error')).mockResolvedValueOnce(savedCover);
    const queryClient = new QueryClient();
    queryClient.setQueryData(v2GroupDetailKey('group-1', 'member-1'), group);
    const NativeURL = URL;
    class URLWithPreview extends NativeURL {}
    Object.defineProperty(URLWithPreview, 'createObjectURL', { value: vi.fn(() => 'blob:retry-cover') });
    Object.defineProperty(URLWithPreview, 'revokeObjectURL', { value: vi.fn() });
    vi.stubGlobal('URL', URLWithPreview);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <V2GroupSettingsScreen />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const desc = screen.getByRole('textbox', { name: 'Description' });
    fireEvent.change(desc, { target: { value: 'Updated group description' } });
    expect(screen.getByRole('button', { name: 'Save changes' }).hasAttribute('disabled')).toBe(false);

    await userEvent.setup().upload(
      screen.getByLabelText('Choose group cover'),
      new File(['retry'], 'retry.png', { type: 'image/png' }),
    );

    await waitFor(() => expect(screen.getByText('Could not save the Group cover photo. Please try again.')).toBeTruthy());
    const retryBtn = screen.getByRole('button', { name: 'Retry' });
    fireEvent.click(retryBtn);

    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('Cover photo saved')).toBeTruthy());
    expect((screen.getByRole('textbox', { name: 'Description' }) as HTMLTextAreaElement).value).toBe('Updated group description');
    expect(screen.getByText(/Cancel discards unsaved Group detail edits only/i)).toBeTruthy();
  });

  it('shows Cover photo removed after durable removal', async () => {
    h.detail = { isLoading: false, data: group };
    const queryClient = new QueryClient();
    queryClient.setQueryData(v2GroupDetailKey('group-1', 'member-1'), group);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <V2GroupSettingsScreen />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove Photo' }));
    await waitFor(() => expect(h.remove).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('Cover photo removed')).toBeTruthy());
  });
});
