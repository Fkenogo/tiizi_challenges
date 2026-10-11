import { normalizeV2DisplayName } from './v2DisplayName';

/**
 * MC-1 — V2-only, in-memory, UID-keyed hand-off of the just-entered sign-up
 * name to the first member bootstrap.
 *
 * Why: Firebase `updateProfile` is best effort and can fail; the entered name
 * must still reach the first PostgreSQL insert (insert-only, so a NULL first
 * bootstrap could never be corrected). This is transient transport, NOT
 * profile storage: memory only (no localStorage / sessionStorage), keyed by
 * Firebase UID so it cannot cross identities, consumed by
 * V2MemberBootstrapGate, and cleared after a successful bootstrap or sign-out.
 * A page reload before bootstrap drops it; the Firebase displayName (when
 * `updateProfile` succeeded) is then the fallback.
 */
export interface SignUpNameHandoff {
  set(uid: string, enteredName: string): void;
  /** The retained name for exactly this UID, or null. */
  peek(uid: string): string | null;
  clear(uid: string): void;
  clearAll(): void;
}

export function createSignUpNameHandoff(): SignUpNameHandoff {
  const names = new Map<string, string>();
  return {
    set(uid, enteredName) {
      const name = normalizeV2DisplayName(enteredName);
      if (uid && name) names.set(uid, name);
    },
    peek: (uid) => names.get(uid) ?? null,
    clear: (uid) => { names.delete(uid); },
    clearAll: () => { names.clear(); },
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
