/**
 * Competitive finishing positions — governed V2 result model (P1-1).
 *
 * Initial V2 Competitive is a race to a configured target. Finishing position
 * is Derived Truth calculated from the underlying records:
 *
 * - Position is determined by governed target-completion order (earlier = higher).
 * - Two or more Participants with the same governed completion point share the
 *   same finishing position (standard competition ranking: 1, 2, 2, 4 — the
 *   next position after a shared 2nd is 4th, per Stage F K.8).
 * - NO artificial points-based tie-breaker is applied.
 * - Participants who do not reach the target receive NO finishing position;
 *   their actual progress is still shown, never labelled failed.
 *
 * The governed completion point is the membership `completedAt` record written
 * by CompetitiveEngine when cumulative progress reaches the target. Completers
 * without a parseable completion point (legacy records) are ordered after all
 * timestamped completers and share one position — they are indistinguishable
 * from each other, so per K.8 logic they share rather than being invented apart.
 *
 * See: docs/programme/STAGE-F-TIIZI-V2-PRODUCT-DEFINITION-DRAFT.md — §K.
 */

export interface FinisherRow {
  userId: string;
  status?: string;
  completedAt?: unknown;
}

/**
 * Normalizes a completion record to epoch millis.
 * Accepts Date, epoch millis, ISO strings, and Firestore Timestamps
 * ({ toMillis() } / { toDate() } / { seconds, nanoseconds }).
 * Returns null when no governed completion point can be read.
 */
export function completionTimeMillis(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (typeof v.toMillis === 'function') {
      const t = Number((v.toMillis as () => unknown)());
      return Number.isFinite(t) ? t : null;
    }
    if (typeof v.toDate === 'function') {
      const d = (v.toDate as () => unknown)();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : null;
    }
    if (typeof v.seconds === 'number') {
      const nanos = typeof v.nanoseconds === 'number' ? v.nanoseconds : 0;
      return v.seconds * 1000 + Math.floor(nanos / 1e6);
    }
  }
  return null;
}

/**
 * Assigns governed finishing positions (standard competition ranking).
 * Returns a map of userId → 1-based position for completers only.
 * Non-completers are absent from the map: they receive NO position.
 */
export function assignFinishingPositions<T extends FinisherRow>(rows: T[]): Map<string, number> {
  const completers = rows.filter((r) => r.status === 'completed');
  const timed = completers
    .map((r) => ({ row: r, at: completionTimeMillis(r.completedAt) }))
    .sort((a, b) => {
      // Timestamped completers first (earliest first); missing-point
      // completers last, ordered deterministically for display only.
      if (a.at == null && b.at == null) return a.row.userId < b.row.userId ? -1 : 1;
      if (a.at == null) return 1;
      if (b.at == null) return -1;
      if (a.at !== b.at) return a.at - b.at;
      return a.row.userId < b.row.userId ? -1 : 1;
    });

  const positions = new Map<string, number>();
  let lastTime: number | null | undefined;
  let lastPosition = 0;
  timed.forEach((entry, index) => {
    // A new (later) completion point starts a new position at index + 1 —
    // positions are skipped after ties (1, 2, 2, 4). Missing-point entries
    // start their own shared position after all timestamped completers,
    // since they are indistinguishable from each other.
    if (index === 0) {
      lastPosition = 1;
      lastTime = entry.at ?? null;
    } else if (entry.at != null && entry.at !== lastTime) {
      lastPosition = index + 1;
      lastTime = entry.at;
    } else if (entry.at == null && lastTime !== null) {
      lastPosition = index + 1;
      lastTime = null;
    }
    // else: same governed point (or same missing group) → share lastPosition.
    positions.set(entry.row.userId, lastPosition);
  });
  return positions;
}

/**
 * Display ordering for a competitive board: completers first by governed
 * position, then non-completers in their existing (live progress) order.
 * Ties keep input order — position is shared, so display order within a tie
 * carries no meaning. Pure and unit-tested; screens must use this instead of
 * ad-hoc inline sorts.
 */
export function orderCompetitiveDisplay<T extends { userId: string }>(
  rows: T[],
  positions: Map<string, number>,
): T[] {
  const buckets = new Map<number, T[]>();
  const rest: T[] = [];
  for (const row of rows) {
    const position = positions.get(row.userId);
    if (position == null) {
      rest.push(row);
    } else {
      const bucket = buckets.get(position) ?? [];
      bucket.push(row);
      buckets.set(position, bucket);
    }
  }
  const ordered: T[] = [];
  [...buckets.keys()].sort((a, b) => a - b).forEach((key) => {
    ordered.push(...(buckets.get(key) ?? []));
  });
  ordered.push(...rest);
  return ordered;
}

/** Ordinal label for a 1-based position: 1st, 2nd, 3rd, 4th, … */
export function ordinal(position: number): string {
  const mod100 = position % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${position}th`;
  switch (position % 10) {
    case 1: return `${position}st`;
    case 2: return `${position}nd`;
    case 3: return `${position}rd`;
    default: return `${position}th`;
  }
}
