import { updateProfile, type User } from 'firebase/auth';
import { normalizeV2DisplayName } from './v2DisplayName';

/**
 * MC-1 — V2-ONLY carrier for the member-entered sign-up name.
 *
 * Called by V2SignUpPage after the Firebase account exists and before the
 * member enters the authenticated V2 shell. Writes the exact entered
 * (trimmed) name to the Firebase user so the V2 member bootstrap can send it
 * for first-create persistence. Best effort: on failure or an unusable name
 * the Firebase name stays absent and the governed completion gate applies.
 * Nothing is derived from email. Lives in V2 so the shared AuthContext (also
 * used by archived Product V1) is not changed.
 */
export async function persistV2SignUpName(user: User, enteredName: string): Promise<void> {
  const displayName = normalizeV2DisplayName(enteredName);
  if (!displayName) return;
  try {
    await updateProfile(user, { displayName });
  } catch {
    // Best effort by decision: canonical name remains absent.
  }
}
