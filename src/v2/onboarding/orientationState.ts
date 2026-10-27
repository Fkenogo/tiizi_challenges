/**
 * TIIZI — V2 Experience Recovery 001: orientation seen-state.
 *
 * The orientation slides are informational. Whether a member has seen them is
 * a per-device convenience, so it lives in `localStorage` keyed by member uid
 * (never shared between accounts on one device) and is NOT a backend model.
 * Storage can be unavailable or throw (private windows, blocked site data), so
 * every access is guarded and a module-level session set prevents any redirect
 * loop when storage cannot persist.
 */

export const ORIENTATION_VERSION = 'v1';

export interface OrientationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const sessionSeen = new Set<string>();

export function orientationSeenKey(uid: string): string {
  return `tiizi.v2.orientation.${ORIENTATION_VERSION}.seen:${uid}`;
}

function browserStorage(): OrientationStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function hasSeenOrientation(
  uid: string,
  storage: OrientationStorage | null = browserStorage(),
): boolean {
  if (sessionSeen.has(uid)) return true;
  try {
    return storage?.getItem(orientationSeenKey(uid)) === '1';
  } catch {
    return false;
  }
}

export function markOrientationSeen(
  uid: string,
  storage: OrientationStorage | null = browserStorage(),
): void {
  sessionSeen.add(uid);
  try {
    storage?.setItem(orientationSeenKey(uid), '1');
  } catch {
    // Session set above still prevents a loop; persistence is best effort.
  }
}

/** Test seam only: clears the in-memory session flags. */
export function resetOrientationSessionForTests(): void {
  sessionSeen.clear();
}

export type FirstRunDecision = 'wait' | 'show-orientation' | 'show-today';

export interface FirstRunInput {
  seen: boolean;
  groupsStatus: 'loading' | 'error' | 'ready';
  groupCount: number;
}

/**
 * First-run offer rule. Orientation is offered only to a member who has not
 * seen it AND belongs to no Group. Anyone with an established journey (any
 * Group membership) and anyone whose Groups cannot be read is never
 * interrupted — the rule fails open to Today.
 */
export function firstRunDecision(input: FirstRunInput): FirstRunDecision {
  if (input.groupsStatus === 'loading') return 'wait';
  if (input.groupsStatus === 'error') return 'show-today';
  if (input.seen) return 'show-today';
  if (input.groupCount > 0) return 'show-today';
  return 'show-orientation';
}
