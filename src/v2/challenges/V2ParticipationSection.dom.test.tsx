import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { V2ChallengeDetail } from '../../api/v2ChallengeApi';

const h = vi.hoisted(() => ({
  join: vi.fn(),
  pending: false,
  success: false,
  variables: undefined as string | undefined,
}));

vi.mock('./useChallengeCreation', () => ({
  useJoinChallengeV2: () => ({
    mutateAsync: h.join,
    isPending: h.pending,
    isSuccess: h.success,
    variables: h.variables,
  }),
  useWithdrawChallengeV2: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { V2ParticipationSection } from './V2ParticipationSection';

function detail(overrides: Partial<V2ChallengeDetail> = {}): V2ChallengeDetail {
  return {
    challengeId: 'challenge-1',
    title: 'Reps Race',
    status: 'active',
    finalized: false,
    governingToday: '2026-11-19',
    endDate: '2026-12-05',
    myParticipation: null,
    ...overrides,
  } as V2ChallengeDetail;
}

function renderSection(challenge = detail()) {
  return render(<V2ParticipationSection detail={challenge} />);
}

afterEach(() => {
  cleanup();
  h.join.mockReset();
  h.join.mockResolvedValue({});
  h.pending = false;
  h.success = false;
  h.variables = undefined;
});

describe('Challenge Details participation joining', () => {
  it('opens member-width confirmation without making a join request', async () => {
    renderSection();

    await userEvent.click(screen.getByRole('button', { name: 'Join Challenge' }));

    expect(screen.getByRole('dialog', { name: 'Join Reps Race?' })).toBeTruthy();
    expect(screen.getByText(/this is your explicit choice/i)).toBeTruthy();
    expect(h.join).not.toHaveBeenCalled();
  });

  it.each(['Not now', 'Close'])('%s cancels without a join request', async (cancelLabel) => {
    renderSection();
    await userEvent.click(screen.getByRole('button', { name: 'Join Challenge' }));

    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: cancelLabel }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.join).not.toHaveBeenCalled();
  });

  it('shows success after canonical refetch without retaining an active participation card', async () => {
    let resolveJoin: (() => void) | undefined;
    h.join.mockImplementation(() => {
      h.pending = true;
      return new Promise<void>((resolve) => {
        resolveJoin = () => resolve();
      });
    });
    const view = renderSection();
    await userEvent.click(screen.getByRole('button', { name: 'Join Challenge' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Join Challenge' }));
    await waitFor(() => expect(h.join).toHaveBeenCalledTimes(1));

    h.success = true;
    h.variables = 'challenge-1';
    view.rerender(<V2ParticipationSection detail={detail({ myParticipation: { status: 'active' } as V2ChallengeDetail['myParticipation'] })} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Joining…' })).toBeTruthy();

    h.pending = false;
    resolveJoin?.();
    expect((await screen.findByRole('status')).textContent).toContain('You joined this Challenge.');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Taking part')).toBeNull();
    expect(screen.queryByRole('button', { name: /Join/ })).toBeNull();
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull(), { timeout: 5000, interval: 50 });
    expect(screen.queryByText('Taking part')).toBeNull();
  });

  it('requires a separate, reworded confirmation for Join again', async () => {
    renderSection(detail({ myParticipation: { status: 'withdrawn' } as V2ChallengeDetail['myParticipation'] }));

    await userEvent.click(screen.getByRole('button', { name: 'Join again' }));

    const dialog = screen.getByRole('dialog', { name: 'Join Reps Race again?' });
    expect(within(dialog).getByText(/You left this Challenge before/i)).toBeTruthy();
    expect(h.join).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Join again' }));

    await waitFor(() => expect(h.join).toHaveBeenCalledTimes(1));
    expect(h.join).toHaveBeenCalledWith('challenge-1');
  });

  it('keeps the confirmation available for retry after an authorized join failure', async () => {
    h.join.mockRejectedValueOnce(new Error('temporary network failure')).mockResolvedValueOnce({});
    renderSection();
    await userEvent.click(screen.getByRole('button', { name: 'Join Challenge' }));
    const dialog = screen.getByRole('dialog');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Join Challenge' }));
    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();

    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Join Challenge' }));

    await waitFor(() => expect(h.join).toHaveBeenCalledTimes(2));
    expect((await screen.findByRole('status')).textContent).toContain('You joined this Challenge.');
  });
  it('keeps the confirmation open and disables duplicate submission while joining', async () => {
    const view = renderSection();
    await userEvent.click(screen.getByRole('button', { name: 'Join Challenge' }));

    h.pending = true;
    view.rerender(<V2ParticipationSection detail={detail()} />);

    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Joining…' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect((within(dialog).getByRole('button', { name: 'Not now' }) as HTMLButtonElement).disabled).toBe(true);
    expect(h.join).not.toHaveBeenCalled();
  });


  it('does not offer duplicate joining or a persistent card to active participants', () => {
    renderSection(detail({ myParticipation: { status: 'active' } as V2ChallengeDetail['myParticipation'] }));

    expect(screen.queryByRole('button', { name: /Join/ })).toBeNull();
    expect(screen.queryByText('Taking part')).toBeNull();
  });

  it('does not render a participation card or joining action for finalized Challenges', () => {
    renderSection(detail({ status: 'ended', finalized: true }));

    expect(screen.queryByRole('button', { name: /Join/ })).toBeNull();
    expect(screen.queryByText('Taking part')).toBeNull();
    expect(screen.queryByText(/joining and leaving are closed/i)).toBeNull();
  });
});
