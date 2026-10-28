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

interface StoredDraft {
  draft: WizardState;
  stepIndex: number;
  savedAt: number;
  inGuide: boolean;
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
    return { draft: restored.draft, stepIndex: restored.stepIndex, savedAt: parsed.savedAt, inGuide: parsed.inGuide === true };
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
  write(uid, { draft, stepIndex, savedAt: now, inGuide: options.inGuide ?? existing?.inGuide ?? false }, storage);
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

/** Recover the backed-up draft after a Guide trip, then disarm so it cannot resurrect later. */
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
