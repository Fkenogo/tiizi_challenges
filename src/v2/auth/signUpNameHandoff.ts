import { normalizeV2DisplayName } from './v2DisplayName';

/**
 * MC-1 — V2-only, UID-keyed, reload-safe hand-off of the just-entered sign-up
 * name to the first member bootstrap.
 *
 * Why: Firebase `updateProfile` is best effort and can fail; the entered name
 * must still reach the first PostgreSQL insert (insert-only, so a NULL first
 * bootstrap could never be corrected). This is NON-CANONICAL transient
 * transport, NOT profile storage:
 *  - holds only `{ uid, name }` (the normalised sign-up name);
 *  - lives in `sessionStorage` (tab-session lifetime, so it survives a reload
 *    but not a new browser session) with an in-memory mirror if storage is
 *    unavailable; NEVER localStorage;
 *  - is returned only for the matching authenticated uid;
 *  - is cleared after that uid's successful bootstrap and on V2 sign-out;
 *  - corrupt or unusable stored values are dropped and never sent.
 */
export interface SignUpNameHandoff {
  set(uid: string, enteredName: string): void;
  /** The retained name for exactly this UID, or null. */
  peek(uid: string): string | null;
  clear(uid: string): void;
  clearAll(): void;
}

/** Minimal storage surface (sessionStorage-compatible) so tests can inject one. */
export interface HandoffStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SIGN_UP_NAME_HANDOFF_KEY = 'tiizi.v2.signUpNameHandoff';

function browserSessionStorage(): HandoffStorage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function createSignUpNameHandoff(
  storage: HandoffStorage | null = browserSessionStorage(),
): SignUpNameHandoff {
  const memory = new Map<string, string>();

  const readStored = (): { uid: string; name: string } | null => {
    if (!storage) return null;
    try {
      const raw = storage.getItem(SIGN_UP_NAME_HANDOFF_KEY);
      if (raw === null) return null;
      const parsed = JSON.parse(raw) as unknown;
      const record = parsed as { uid?: unknown; name?: unknown } | null;
      const name = typeof record?.name === 'string' ? normalizeV2DisplayName(record.name) : null;
      if (typeof record?.uid !== 'string' || !record.uid || !name) throw new Error('corrupt');
      return { uid: record.uid, name };
    } catch {
      // Corrupt or unusable: fail closed, drop it, never send it.
      try { storage.removeItem(SIGN_UP_NAME_HANDOFF_KEY); } catch { /* ignore */ }
      return null;
    }
  };

  const removeStored = () => {
    try { storage?.removeItem(SIGN_UP_NAME_HANDOFF_KEY); } catch { /* ignore */ }
  };

  return {
    set(uid, enteredName) {
      const name = normalizeV2DisplayName(enteredName);
      if (!uid || !name) return;
      memory.clear();
      memory.set(uid, name);
      try { storage?.setItem(SIGN_UP_NAME_HANDOFF_KEY, JSON.stringify({ uid, name })); } catch { /* memory mirror still holds it */ }
    },
    peek(uid) {
      if (!uid) return null;
      const inMemory = memory.get(uid);
      if (inMemory) return inMemory;
      const stored = readStored();
      return stored && stored.uid === uid ? stored.name : null;
    },
    clear(uid) {
      memory.delete(uid);
      const stored = readStored();
      if (stored && stored.uid === uid) removeStored();
    },
    clearAll() {
      memory.clear();
      removeStored();
    },
  };
}

export const v2SignUpNameHandoff = createSignUpNameHandoff();

/**
 * First-create name precedence for THIS uid: (1) the sign-up hand-off,
 * (2) the Firebase user's valid real displayName, (3) none. Never email.
 */
export function resolveBootstrapDisplayName(
  handoff: SignUpNameHandoff,
  uid: string,
  firebaseDisplayName: string | null | undefined,
): string | null {
  return handoff.peek(uid) ?? normalizeV2DisplayName(firebaseDisplayName);
}
