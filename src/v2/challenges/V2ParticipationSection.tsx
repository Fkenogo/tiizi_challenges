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

export function V2ParticipationSection({ detail }: { detail: V2ChallengeDetail }) {
  const join = useJoinChallengeV2();
  const withdraw = useWithdrawChallengeV2();
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string; code?: string } | null>(null);

  const view = participationViewFor(detail);
  const busy = join.isPending || withdraw.isPending;

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

  const handleWithdraw = async () => {
    setNotice(null);
    try {
      await withdraw.mutateAsync(detail.challengeId);
      setConfirmWithdraw(false);
      setNotice({ tone: 'success', message: 'You left this Challenge. Your history is kept.' });
    } catch (error) {
      const mapped = mapV2ApiError(error);
      setConfirmWithdraw(false);
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
              : detail.myParticipation
                ? 'You are not taking part in this Challenge.'
                : 'You are not taking part in this Challenge.'}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {view.reason === 'finalized'
              ? 'Results for this Challenge are sealed, so joining and leaving are closed.'
              : 'This Challenge has ended, so joining and leaving are closed.'}
          </p>
        </div>
      )}

      {view.kind === 'joined' && (
        <div className="mt-2">
          <p className="text-sm font-black text-slate-900">You are taking part in this Challenge.</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Leaving ends your current participation. Your history is kept.
          </p>
          <div className="mt-3">
            <V2Button variant="secondary" onClick={() => setConfirmWithdraw(true)} disabled={busy}>
              {withdraw.isPending ? 'Leaving…' : 'Leave Challenge'}
            </V2Button>
          </div>
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

      <V2Sheet open={confirmWithdraw} onClose={() => setConfirmWithdraw(false)} title="Leave this Challenge?">
        <p className="text-sm leading-6 text-slate-600">
          Leaving ends your current participation in “{detail.title}”. Your history is kept and
          nothing else changes.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <V2Button variant="secondary" onClick={() => setConfirmWithdraw(false)} disabled={withdraw.isPending}>
            Keep taking part
          </V2Button>
          <V2Button onClick={() => void handleWithdraw()} disabled={withdraw.isPending}>
            {withdraw.isPending ? 'Leaving…' : 'Leave Challenge'}
          </V2Button>
        </div>
      </V2Sheet>
    </V2Card>
  );
}
