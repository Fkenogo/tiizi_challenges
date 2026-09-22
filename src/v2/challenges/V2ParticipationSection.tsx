import { useState } from 'react';
import type { V2ChallengeDetail } from '../../api/v2ChallengeApi';
import { mapV2ApiError } from '../../services/v2ActivityPayload';
import { V2Button, V2Card, V2Sheet } from '../components/V2Primitives';
import { participationViewFor } from './participationView';
import { useJoinChallengeV2, useWithdrawChallengeV2 } from './useChallengeCreation';

/**
 * S3a — Challenge participation/access section.
 *
 * Binds the existing governed participation seams
 * (`POST /v1/challenges/:id/join`, `POST /v1/challenges/:id/withdraw`)
 * to the V2 Challenge detail. All state shown comes from the
 * authoritative read (`detail.myParticipation`); the component never
 * infers participation from unrelated fields and never manufactures
 * canonical state — the post-action refetch (via the shared
 * invalidation contract) determines final truth, which also survives
 * refresh.
 *
 * States:
 * - ended/finalized → read-only (no CTA; governed denial shown honestly);
 * - active episode → JOINED + bounded Withdraw confirmation;
 * - no episode, or withdrawn/removed episode → NOT JOINED + Join
 *   (rejoin uses the same join seam; no special rejoin semantics).
 */
export { participationViewFor, type S3aParticipationView } from './participationView';

/**
 * CORR-003 — confirmed Leave Challenge dialog.
 *
 * Opened ONLY from the hero's secondary "Leave Challenge" action. Reuses
 * the existing governed withdraw path (`useWithdrawChallengeV2` →
 * `POST /v1/challenges/:id/withdraw`) with the same refetch-only truth
 * contract — no second endpoint, no client-manufactured membership state.
 * The first selection opens this confirmation; only explicit confirmation
 * executes the leave. Cancellation performs no mutation. After a confirmed
 * leave the canonical refetch re-derives the view (withdrawn episode →
 * not-joined → the existing "Join again" card).
 */
export function V2LeaveChallengeDialog({
  detail,
  open,
  onClose,
}: {
  detail: V2ChallengeDetail;
  open: boolean;
  onClose: () => void;
}) {
  const withdraw = useWithdrawChallengeV2();
  const [notice, setNotice] = useState<{ message: string; code?: string } | null>(null);

  const handleConfirm = async () => {
    setNotice(null);
    try {
      await withdraw.mutateAsync(detail.challengeId);
      onClose();
    } catch (error) {
      const mapped = mapV2ApiError(error);
      setNotice({ message: mapped.message, code: mapped.code });
    }
  };

  return (
    <V2Sheet open={open} onClose={onClose} title="Leave this Challenge?">
      <p className="text-sm leading-6 text-slate-600">
        Leaving ends your current participation in “{detail.title}”.
        Your Challenge history will be kept.
      </p>
      {notice && (
        <div
          role="alert"
          className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
        >
          <p>{notice.message}</p>
          {notice.code && (
            <p className="mt-0.5 font-mono text-[11px] opacity-70">Code: {notice.code}</p>
          )}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <V2Button variant="secondary" onClick={onClose} disabled={withdraw.isPending}>
          Stay in Challenge
        </V2Button>
        <V2Button onClick={() => void handleConfirm()} disabled={withdraw.isPending}>
          {withdraw.isPending ? 'Leaving…' : 'Leave Challenge'}
        </V2Button>
      </div>
    </V2Sheet>
  );
}

export function V2ParticipationSection({ detail }: { detail: V2ChallengeDetail }) {
  const join = useJoinChallengeV2();
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string; code?: string } | null>(null);

  const view = participationViewFor(detail);

  // CORR-003: active participants get no permanent card — the hero owns
  // the secondary Leave action with confirmation disclosure
  // (`V2LeaveChallengeDialog`). Join / rejoin / read-only states below are
  // unchanged canonical truth.
  if (view.kind === 'joined') return null;

  // CORR-002: a FINALIZED Challenge's sealed results already carry the
  // participant-facing outcome, so the separate "Taking part" card adds no
  // useful result information and is removed. The underlying participation
  // authority is untouched: participationViewFor still reports finalized as
  // read-only, and logging/leave remain unavailable via the end-state gates.
  if (view.kind === 'read-only' && view.reason === 'finalized') return null;

  const busy = join.isPending;

  const handleJoin = async () => {
    setNotice(null);
    try {
      await join.mutateAsync(detail.challengeId);
      setNotice({ tone: 'success', message: 'You joined this Challenge.' });
    } catch (error) {
      const mapped = mapV2ApiError(error);
      setNotice({ tone: 'error', message: mapped.message, code: mapped.code });
    }
  };

  return (
    <V2Card>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        Taking part
      </p>

      {view.kind === 'read-only' && (
        <div className="mt-2">
          <p className="text-sm font-black text-slate-900">
            {detail.myParticipation?.status === 'active'
              ? 'You took part in this Challenge.'
              : 'You are not taking part in this Challenge.'}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            This Challenge has ended, so joining and leaving are closed.
          </p>
        </div>
      )}

      {view.kind === 'not-joined' && (
        <div className="mt-2">
          <p className="text-sm font-black text-slate-900">
            {view.previouslyEnded ? 'You are not taking part right now.' : 'You are not taking part yet.'}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {view.previouslyEnded
              ? 'You left this Challenge before. You can join again where the Challenge still allows it.'
              : 'Join to take part. Only current members of the hosting group can join.'}
          </p>
          <div className="mt-3">
            <V2Button onClick={() => void handleJoin()} disabled={busy}>
              {join.isPending ? 'Joining…' : view.previouslyEnded ? 'Join again' : 'Join Challenge'}
            </V2Button>
          </div>
        </div>
      )}

      {notice && (
        <div
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`mt-3 rounded-xl px-3 py-2 text-sm font-medium ${
            notice.tone === 'error' ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-900'
          }`}
        >
          <p>{notice.message}</p>
          {notice.code && (
            <p className="mt-0.5 font-mono text-[11px] opacity-70">Code: {notice.code}</p>
          )}
        </div>
      )}
    </V2Card>
  );
}
