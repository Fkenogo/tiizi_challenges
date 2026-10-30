// Harness-only stand-in for hooks/useAuth: a fixed signed-in member, no Firebase.
export function useAuth() {
  return { user: { uid: 'harness-uid' } } as { user: { uid: string } };
}
