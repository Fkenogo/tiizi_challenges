/**
 * Tab-memory-only Challenge cover files for Founder Preview cards.
 * These File objects are keyed by the server-created Challenge id and never
 * leave this browser module. A page reload clears the map.
 */
const previews = new Map<string, File>();

export function setLocalChallengeCoverPreview(challengeId: string, file: File): void {
  if (challengeId) previews.set(challengeId, file);
}

export function getLocalChallengeCoverPreview(challengeId: string): File | null {
  return previews.get(challengeId) ?? null;
}

export function removeLocalChallengeCoverPreview(challengeId: string): void {
  previews.delete(challengeId);
}
