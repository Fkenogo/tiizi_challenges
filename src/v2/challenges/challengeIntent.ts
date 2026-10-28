/**
 * TIIZI-FER-P2-001 — the Challenge a member was exploring when they asked to
 * join its hosting Group.
 *
 * Return context ONLY: it never joins anything, never grants access, and is
 * checked against server state before it is offered. One intent per member,
 * stored per uid so an account switch never shows another member's context,
 * and best-effort (storage may be unavailable).
 */
export interface ChallengeIntent {
  challengeId: string;
  title: string;
  groupId: string;
  groupName: string;
}

const KEY_PREFIX = 'tiizi.v2.challengeIntent.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function keyFor(uid: string): string {
  return `${KEY_PREFIX}${uid}`;
}

export function parseChallengeIntent(raw: string | null): ChallengeIntent | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ChallengeIntent>;
    if (typeof value.challengeId !== 'string' || !UUID.test(value.challengeId)) return null;
    if (typeof value.groupId !== 'string' || !UUID.test(value.groupId)) return null;
    if (typeof value.title !== 'string' || typeof value.groupName !== 'string') return null;
    return {
      challengeId: value.challengeId,
      title: value.title.slice(0, 200),
      groupId: value.groupId,
      groupName: value.groupName.slice(0, 200),
    };
  } catch {
    return null;
  }
}

export function readChallengeIntent(uid: string | undefined): ChallengeIntent | null {
  if (!uid) return null;
  try {
    return parseChallengeIntent(window.localStorage.getItem(keyFor(uid)));
  } catch {
    return null;
  }
}

export function saveChallengeIntent(uid: string | undefined, intent: ChallengeIntent): void {
  if (!uid) return;
  try {
    window.localStorage.setItem(keyFor(uid), JSON.stringify(intent));
  } catch {
    /* best effort */
  }
}

export function clearChallengeIntent(uid: string | undefined): void {
  if (!uid) return;
  try {
    window.localStorage.removeItem(keyFor(uid));
  } catch {
    /* best effort */
  }
}
