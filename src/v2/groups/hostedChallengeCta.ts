import type { V2ChallengeSummary } from '../../api/v2ChallengeApi';
import { challengeLoggingOpen } from '../challenges/challengeEndState';

/**
 * Navigation CTA label (Join is a separate inline mutation). "Log activity"
 * only while the canonical gates (served `active` + live end state) allow
 * logging — participation alone never offers it. "View results" only for a
 * finalized Challenge; ended-but-unfinalized reads as plain "View" so final
 * results are never implied while they are still being confirmed.
 */
export function hostedChallengeCtaLabel(challenge: V2ChallengeSummary): 'Log activity' | 'View results' | 'View' {
  if (challenge.myParticipation?.status === 'active' && challengeLoggingOpen(challenge)) return 'Log activity';
  return challenge.finalized ? 'View results' : 'View';
}
