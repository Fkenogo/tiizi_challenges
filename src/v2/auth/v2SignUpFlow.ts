import type { SignUpNameHandoff } from './signUpNameHandoff';
import { normalizeV2DisplayName } from './v2DisplayName';

/**
 * MC-1 — V2-only email/password sign-up sequencing (no Firebase import so it
 * is unit-testable with injected dependencies).
 *
 * Order matters: the entered name is recorded in the UID-keyed hand-off the
 * instant Firebase returns the created user, BEFORE any fallible follow-up
 * (profile update, legacy caches, navigation). Nothing here uses the shared
 * AuthContext.signup (which also performs a fallible legacy localStorage
 * profile write and serves archived Product V1). Nothing is derived from email.
 */
export interface V2SignUpDeps<U extends { uid: string }> {
  createUser(email: string, password: string): Promise<U>;
  updateProfile(user: U, displayName: string): Promise<void>;
  handoff: SignUpNameHandoff;
}

export class InvalidSignUpNameError extends Error {
  constructor() {
    super('A valid name is required to sign up.');
  }
}

export async function runV2EmailSignUp<U extends { uid: string }>(
  deps: V2SignUpDeps<U>,
  enteredName: string,
  email: string,
  password: string,
): Promise<U> {
  const displayName = normalizeV2DisplayName(enteredName);
  if (!displayName) throw new InvalidSignUpNameError(); // before any account is created
  const user = await deps.createUser(email, password);
  deps.handoff.set(user.uid, displayName); // 1. record first
  try {
    await deps.updateProfile(user, displayName); // 2. best effort
  } catch {
    // The hand-off already carries the name to the first bootstrap.
  }
  return user;
}

/**
 * Sign out first; clear the hand-off (and run `afterSignOut`, e.g. clearing the
 * signed-out member's own browser-stored context) ONLY if sign-out succeeded.
 */
export async function signOutThenClearHandoff(
  logout: () => Promise<void>,
  handoff: SignUpNameHandoff,
  afterSignOut?: () => void,
): Promise<void> {
  await logout(); // a rejection propagates and the hand-off is retained
  handoff.clearAll();
  afterSignOut?.();
}
