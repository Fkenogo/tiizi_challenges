/**
 * Browser-tab-only Group cover photos for the Founder Preview.
 * Files are keyed by the canonical Group id and never enter API or database
 * records. A page reload clears the map.
 */
const previews = new Map<string, File>();

export function setLocalGroupCoverPreview(groupId: string, file: File): void {
  if (groupId) previews.set(groupId, file);
}

export function getLocalGroupCoverPreview(groupId: string): File | null {
  return previews.get(groupId) ?? null;
}

export function removeLocalGroupCoverPreview(groupId: string): void {
  previews.delete(groupId);
}
