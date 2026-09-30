/** Governed Challenge background catalogue. IDs are persisted; artwork is rendered locally. */
export const CHALLENGE_COVER_IDS = ['challenge-1', 'challenge-2', 'challenge-3', 'challenge-4', 'challenge-5', 'challenge-6', 'challenge-7', 'challenge-8'] as const;
export type ChallengeCoverId = (typeof CHALLENGE_COVER_IDS)[number];
const GRADIENTS: Record<ChallengeCoverId, string> = {
  'challenge-1': 'from-orange-600 via-amber-500 to-yellow-400',
  'challenge-2': 'from-emerald-700 via-green-600 to-lime-400',
  'challenge-3': 'from-sky-700 via-blue-600 to-indigo-400',
  'challenge-4': 'from-violet-700 via-purple-600 to-fuchsia-400',
  'challenge-5': 'from-rose-700 via-red-600 to-orange-400',
  'challenge-6': 'from-teal-700 via-cyan-600 to-sky-400',
  'challenge-7': 'from-pink-700 via-rose-500 to-orange-300',
  'challenge-8': 'from-slate-900 via-slate-700 to-slate-500',
};
export function isChallengeCoverId(value: unknown): value is ChallengeCoverId {
  return typeof value === 'string' && (CHALLENGE_COVER_IDS as readonly string[]).includes(value);
}
export function challengeCoverGradient(value: unknown): string {
  return isChallengeCoverId(value) ? GRADIENTS[value] : 'from-slate-800 via-slate-700 to-slate-600';
}
export function challengeCoverLabel(value: ChallengeCoverId): string {
  return `Background ${Number(value.slice(-1))}`;
}
