const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'The email or password is incorrect. Check your details and try again.',
  'auth/user-not-found': 'No Tiizi account exists for that email address.',
  'auth/wrong-password': 'The email or password is incorrect. Check your details and try again.',
  'auth/email-already-in-use': 'An account already exists for that email. Log in instead.',
  'auth/weak-password': 'Use a stronger password with at least 6 characters.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled. Contact Tiizi support for help.',
  'auth/too-many-requests': 'Too many sign-in attempts. Wait a little while, then try again.',
  'auth/network-request-failed': 'Network connection failed. Check your connection and try again.',
  'auth/unauthorized-domain': 'This domain is not authorized for Firebase sign-in.',
  'auth/redirect-cancelled-by-user': 'Google sign-in was cancelled before it completed.',
  'auth/redirect-operation-pending': 'Google sign-in is already in progress. Finish it or try again.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled before it completed.',
  'auth/cancelled-popup-request': 'Another sign-in attempt is already in progress.',
  'auth/missing-email': 'Enter your email address to receive a reset link.',
  'auth/expired-action-code': 'The password reset link has expired. Request a new one.',
  'auth/invalid-action-code': 'The password reset link is invalid or has already been used.',
};

export function getFirebaseAuthErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : 'auth/unknown';
  }
  return 'auth/unknown';
}

export function normalizeFirebaseAuthError(error: unknown): string {
  const code = getFirebaseAuthErrorCode(error);
  if (import.meta.env.DEV) {
    console.warn('Firebase auth error:', code, error);
  }
  return AUTH_ERROR_MESSAGES[code] ?? 'Could not sign in. Check your credentials and try again.';
}
