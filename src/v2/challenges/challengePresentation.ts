import type { V2ChallengeEndState } from './challengeEndState';

/** Shared lifecycle badge tone for Challenge and Group summary rows. */
export function statusTone(endState: V2ChallengeEndState): string {
  return endState === 'live' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600';
}
