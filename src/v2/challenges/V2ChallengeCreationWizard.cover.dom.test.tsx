import { StrictMode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepHosting, StepReview } from './V2ChallengeCreationWizard';
import { createInitialWizardState } from './challengeCreationDraft';
import { removeLocalGroupCoverPreview, setLocalGroupCoverPreview } from '../groups/localGroupCoverPreviews';
import { useLocalImagePreview } from '../media/useLocalImagePreview';

function ReviewHarness({ initialFile }: { initialFile: File }) {
  const preview = useLocalImagePreview(initialFile);
  const base = createInitialWizardState();
  return (
    <StepReview
      state={{
        ...base,
        groupId: 'group-with-cover',
        groupName: 'Twende fit',
        title: 'Push-Up Challenge',
      }}
      previewState="valid"
      previewIssues={null}
      onUpdate={vi.fn()}
      coverPhoto={preview}
      onEditStep={vi.fn()}
    />
  );
}

describe('Challenge creation cover UX regressions', () => {
  afterEach(() => {
    cleanup();
    removeLocalGroupCoverPreview('group-with-cover');
    removeLocalGroupCoverPreview('group-no-cover');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders actual Group cover in the hosting Group selector and neutral fallback when absent', async () => {
    const NativeURL = URL;
    class URLMock extends NativeURL {}
    Object.defineProperty(URLMock, 'createObjectURL', {
      value: vi.fn().mockReturnValue('blob:twende-fit-cover'),
    });
    Object.defineProperty(URLMock, 'revokeObjectURL', { value: vi.fn() });
    vi.stubGlobal('URL', URLMock);

    const coverFile = new File(['group-cover'], 'twende.jpg', { type: 'image/jpeg' });
    setLocalGroupCoverPreview('group-with-cover', coverFile);

    const onSelectGroup = vi.fn();
    const base = createInitialWizardState();
    render(
      <MemoryRouter>
        <StepHosting
          memberships={{
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
            data: {
              memberId: 'm1',
              pendingMemberships: [],
              memberships: [
                {
                  groupId: 'group-with-cover',
                  role: 'owner',
                  status: 'active',
                  joinedAt: '2026-11-24T00:00:00Z',
                  group: { id: 'group-with-cover', name: 'Twende fit', description: 'Run club', isPrivate: false, coverId: 'cover-1', allowMemberChallenges: true },
                },
                {
                  groupId: 'group-no-cover',
                  role: 'member',
                  status: 'active',
                  joinedAt: '2026-11-24T00:00:00Z',
                  group: { id: 'group-no-cover', name: 'Plain Group', description: 'No cover', isPrivate: false, coverId: null, allowMemberChallenges: true },
                },
              ],
            },
          } as never}
          state={{ ...base, groupId: 'group-with-cover', groupName: 'Twende fit' }}
          onSelectGroup={onSelectGroup}
        />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('textbox', { name: 'Search Groups' }));

    const img = screen.getByRole('img', { name: 'Twende fit cover photo' });
    expect(img.getAttribute('src')).toBe('blob:twende-fit-cover');
    expect(screen.queryByRole('img', { name: 'Plain Group cover photo' })).toBeNull();
    expect(screen.getByLabelText('Plain Group has no cover photo')).toBeTruthy();

    const plainCoverEl = document.querySelector('[data-group-cover-id="group-no-cover"]');
    expect(plainCoverEl?.className).toContain('bg-slate-200');
    expect(plainCoverEl?.className).not.toContain('bg-gradient-to-br');

    await userEvent.click(screen.getByRole('button', { name: /Plain Group/i }));
    expect(onSelectGroup).toHaveBeenCalledTimes(1);
  });

  it('displays the uploaded Challenge cover on Step 7 Review under React StrictMode', () => {
    const NativeURL = URL;
    class URLMock extends NativeURL {}
    const revoked: string[] = [];
    Object.defineProperty(URLMock, 'createObjectURL', {
      value: vi.fn().mockReturnValueOnce('blob:review-1').mockReturnValueOnce('blob:review-2'),
    });
    Object.defineProperty(URLMock, 'revokeObjectURL', {
      value: vi.fn((u: string) => revoked.push(u)),
    });
    vi.stubGlobal('URL', URLMock);

    const file = new File(['challenge-cover'], 'challenge.jpg', { type: 'image/jpeg' });
    render(
      <StrictMode>
        <ReviewHarness initialFile={file} />
      </StrictMode>,
    );

    const img = screen.getByRole('img', { name: 'Challenge cover local preview' });
    expect(img.getAttribute('src')).toBe('blob:review-2');
    expect(revoked).toContain('blob:review-1');
    expect(revoked).not.toContain('blob:review-2');
    expect(screen.getByText('JPG, PNG or WebP · Preview only. This photo will be saved when you create the Challenge.')).toBeTruthy();
  });
});
