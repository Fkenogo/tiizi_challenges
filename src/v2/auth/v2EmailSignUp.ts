import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../../lib/firebaseAuth';
import { v2SignUpNameHandoff } from './signUpNameHandoff';
import { runV2EmailSignUp } from './v2SignUpFlow';

/**
 * MC-1 — V2-only email/password sign-up. Creates the Firebase account directly
 * (not via the shared AuthContext.signup), records the name hand-off first,
 * then best-effort updates the Firebase displayName. AuthContext state follows
 * Firebase's normal onAuthStateChanged.
 */
export function v2EmailSignUp(enteredName: string, email: string, password: string) {
  return runV2EmailSignUp(
    {
      createUser: async (e, p) => (await createUserWithEmailAndPassword(auth, e, p)).user,
      updateProfile: (user, displayName) => updateProfile(user, { displayName }),
      handoff: v2SignUpNameHandoff,
    },
    enteredName,
    email,
    password,
  );
}
