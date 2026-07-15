/** Maximum writes per Firestore batch — 50-write safety margin below the 500-write limit. */
export const MAX_WRITES_PER_BATCH = 450;

/** Splits an array into sequential chunks of at most `size` elements. */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
