import { updateProfile, type User } from 'firebase/auth';
import { v2SignUpNameHandoff } from './signUpNameHandoff';
import { normalizeV2DisplayName } from './v2DisplayName';

/**
 * MC-1 — V2-ONLY carrier for the member-entered sign-up name.
 *
 * Called by V2SignUpPage after the Firebase account exists and before the
 * member enters the authenticated V2 shell.
 *  1. Retains the exact normalised name in the in-memory, UID-keyed hand-off
 *     so the first bootstrap receives it even if step 2 fails.
 *  2. Best-effort `updateProfile` so Google/restored/future sessions can also
 *     see the name on the Firebase user.
 * Nothing is derived from email. Lives in V2 so the shared AuthContext (also
 * used by archived Product V1) is not changed.
 */
export async function persistV2SignUpName(user: User, enteredName: string): Promise<void> {
  const displayName = normalizeV2DisplayName(enteredName);
  if (!displayName) return;
  v2SignUpNameHandoff.set(user.uid, displayName);
  try {
    await updateProfile(user, { displayName });
  } catch {
    // Best effort: the hand-off above still carries the name to bootstrap.
  }
}
