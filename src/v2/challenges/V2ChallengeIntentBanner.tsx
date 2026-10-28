import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { V2ChallengeSummary } from '../../api/v2ChallengeApi';
import { useAuth } from '../../hooks/useAuth';
import { V2Button } from '../components/V2Primitives';
import { clearChallengeIntent, readChallengeIntent } from './challengeIntent';

/**
 * TIIZI-FER-P2-001 — return to the Challenge the member was exploring.
 *
 * Offered only when the server now lists that Challenge in the member's OWN
 * list (so they are an eligible Group member). The Challenge Join itself is
 * still a separate, explicit action on its detail screen.
 */
export function V2ChallengeIntentBanner({ ownChallenges }: { ownChallenges: V2ChallengeSummary[] | undefined }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const uid = user?.uid;
  // Read on every render: the intent is saved by the Explore list on the same
  // screen AFTER this component mounted. `dismissals` only forces a re-read.
  const [, setDismissals] = useState(0);
  const intent = readChallengeIntent(uid);

  if (!intent || !ownChallenges) return null;
  const available = ownChallenges.find((challenge) => challenge.challengeId === intent.challengeId);
  if (!available) return null;
  // Already taking part (joined by another path): the return context is spent.
  if (available.myParticipation) {
    clearChallengeIntent(uid);
    return null;
  }

  const dismiss = () => {
    clearChallengeIntent(uid);
    setDismissals((count) => count + 1);
  };
  return (
    <section aria-label="Continue to your Challenge" className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
      <p role="status" className="text-sm font-black text-emerald-900">You&apos;re in {intent.groupName}.</p>
      <p className="mt-0.5 text-xs text-emerald-900/80">
        Continue to “{available.title}”. Taking part is your choice — you join the Challenge on its page.
      </p>
      <div className="mt-2 flex gap-2">
        <V2Button onClick={() => { clearChallengeIntent(uid); navigate(`/v2/challenges/${available.challengeId}`); }}>Continue to Challenge</V2Button>
        <V2Button variant="secondary" onClick={dismiss}>Not now</V2Button>
      </div>
    </section>
  );
}
