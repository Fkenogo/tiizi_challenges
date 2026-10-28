import {
  createChallengeWizardRouteState,
  restoreChallengeWizardRouteState,
  type WizardState,
} from './challengeCreationDraft';

/**
 * Session-scoped safety net for the in-progress Challenge draft (TIIZI-FER-P0-001).
 *
 * Router history state is the primary carrier of the draft while the member
 * visits the Activity Guide. This module only backs it up so the draft is not
 * silently lost if that state is dropped (for example a Guide page opened
 * without wizard state). It is deliberately small:
 *   - `sessionStorage` only (this tab; no Firestore, no backend draft API);
 *   - keyed by the signed-in member uid, so one account never reads another's draft;
 *   - recovered ONLY after an explicit trip to the Guide (`inGuide`), then
 *     disarmed, so an old draft never resurrects on an unrelated visit;
 *   - expires, and is cleared on establishment or when the wizard is left.
 */

export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length: number;
  key(index: number): string | null;
}

const PREFIX = 'tiizi.v2.challengeDraft.v1:';
export const CHALLENGE_DRAFT_TTL_MS = 6 * 60 * 60 * 1000;
/** An armed (Guide-trip) backup is honoured only briefly; a full page load or closed tab must not leave it resurrectable. */
export const CHALLENGE_GUIDE_ARM_WINDOW_MS = 30 * 60 * 1000;

interface StoredDraft {
  draft: WizardState;
  stepIndex: number;
  savedAt: number;
  inGuide: boolean;
  armedAt: number;
}

function browserStorage(): DraftStorage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

const keyFor = (uid: string) => `${PREFIX}${uid}`;

function read(uid: string, storage: DraftStorage | null, now: number): StoredDraft | null {
  if (!uid || !storage) return null;
  try {
    const raw = storage.getItem(keyFor(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDraft>;
    if (typeof parsed.savedAt !== 'number' || now - parsed.savedAt > CHALLENGE_DRAFT_TTL_MS) {
      storage.removeItem(keyFor(uid));
      return null;
    }
    // Re-use the wizard's own snapshot validation; malformed data is dropped.
    const restored = restoreChallengeWizardRouteState(
      createChallengeWizardRouteState(parsed.draft as WizardState, parsed.stepIndex ?? 0),
    );
    if (!restored.draft) {
      storage.removeItem(keyFor(uid));
      return null;
    }
    const armedAt = typeof parsed.armedAt === 'number' ? parsed.armedAt : 0;
    // An arm older than the window is treated as disarmed.
    const inGuide = parsed.inGuide === true && now - armedAt <= CHALLENGE_GUIDE_ARM_WINDOW_MS;
    return { draft: restored.draft, stepIndex: restored.stepIndex, savedAt: parsed.savedAt, inGuide, armedAt };
  } catch {
    return null;
  }
}

function write(uid: string, value: StoredDraft, storage: DraftStorage | null): void {
  if (!uid || !storage) return;
  try {
    storage.setItem(keyFor(uid), JSON.stringify(value));
  } catch {
    // Storage may be full or blocked; the draft still lives in router state.
  }
}

/** Back up the current draft. Keeps an existing Guide-trip flag unless `inGuide` is given. */
export function saveChallengeDraft(
  uid: string,
  draft: WizardState,
  stepIndex: number,
  options: { inGuide?: boolean; storage?: DraftStorage | null; now?: number } = {},
): void {
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const now = options.now ?? Date.now();
  const existing = read(uid, storage, now);
  const inGuide = options.inGuide ?? existing?.inGuide ?? false;
  const armedAt = options.inGuide === true ? now : existing?.armedAt ?? 0;
  write(uid, { draft, stepIndex, savedAt: now, inGuide, armedAt }, storage);
}

/** Arm recovery: the member is leaving the wizard for the Activity Guide. */
export function markChallengeGuideJourney(
  uid: string,
  draft: WizardState,
  stepIndex: number,
  options: { storage?: DraftStorage | null; now?: number } = {},
): void {
  saveChallengeDraft(uid, draft, stepIndex, { ...options, inGuide: true });
}

/**
 * Read (never mutate) the draft armed by a Guide trip. Safe to call during
 * render: React may invoke state initializers more than once (StrictMode,
 * discarded renders), so recovery itself must have no side effects.
 */
export function peekChallengeDraft(
  uid: string,
  options: { storage?: DraftStorage | null; now?: number } = {},
): { draft: WizardState; stepIndex: number } | null {
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const stored = read(uid, storage, options.now ?? Date.now());
  return stored && stored.inGuide ? { draft: stored.draft, stepIndex: stored.stepIndex } : null;
}

/** Disarm after the wizard has consumed the recovered draft (call from an effect; idempotent). */
export function disarmChallengeDraft(
  uid: string,
  options: { storage?: DraftStorage | null; now?: number } = {},
): void {
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const stored = read(uid, storage, options.now ?? Date.now());
  if (stored?.inGuide) write(uid, { ...stored, inGuide: false }, storage);
}

/**
 * Called when an Activity Guide screen unmounts: if the member went anywhere
 * other than the Guide or the wizard, the Guide trip was abandoned, so the
 * armed backup must not survive to resurrect on a later fresh visit.
 */
export function releaseAbandonedChallengeDraft(
  uid: string,
  pathname: string,
  options: { storage?: DraftStorage | null } = {},
): void {
  if (/^\/v2\/(guide|challenges\/new)(\/|\?|$)/.test(pathname)) return;
  clearChallengeDraft(uid, options);
}

/** Recover the backed-up draft after a Guide trip, then disarm (non-render callers/tests). */
export function recoverChallengeDraft(
  uid: string,
  options: { storage?: DraftStorage | null; now?: number } = {},
): { draft: WizardState; stepIndex: number } | null {
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const now = options.now ?? Date.now();
  const stored = read(uid, storage, now);
  if (!stored || !stored.inGuide) return null;
  write(uid, { ...stored, inGuide: false }, storage);
  return { draft: stored.draft, stepIndex: stored.stepIndex };
}

/** Remove this member's draft (established, or deliberately abandoned). */
export function clearChallengeDraft(uid: string, options: { storage?: DraftStorage | null } = {}): void {
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  if (!uid || !storage) return;
  try {
    storage.removeItem(keyFor(uid));
  } catch {
    // ignore
  }
}

/** Remove drafts left by any other account in this tab session (account switch hygiene). */
export function clearOtherMembersChallengeDrafts(uid: string, options: { storage?: DraftStorage | null } = {}): void {
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  if (!storage) return;
  try {
    const stale: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key && key.startsWith(PREFIX) && key !== keyFor(uid)) stale.push(key);
    }
    stale.forEach((key) => storage.removeItem(key));
  } catch {
    // ignore
  }
}
