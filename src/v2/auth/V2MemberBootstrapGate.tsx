import { useCallback, useEffect, useState } from 'react';
import { LoadingSpinner } from '../../components/Mobile';
import { useAuth } from '../../hooks/useAuth';
import { bootstrapMemberWithToken } from '../../api/memberBootstrapApi';
import { auth } from '../../lib/firebaseAuth';
import { bootstrapCapturedUser } from './bootstrapCapturedUser';
import {
  bootstrapGateStatus,
  createMemberBootstrapSession,
  type BootstrapOutcome,
} from './memberBootstrapSession';
import { v2SignUpNameHandoff } from './signUpNameHandoff';
import { signOutThenClearHandoff } from './v2SignUpFlow';

// The transient sign-up name is cleared as soon as that uid's bootstrap succeeds.
const v2MemberBootstrapSession = createMemberBootstrapSession((uid) => v2SignUpNameHandoff.clear(uid));

/**
 * MC-1 — V2 member session establishment.
 *
 * After Firebase authentication (email/password sign-in, sign-up, Google, or a
 * restored session) the V2 shell calls the explicit member bootstrap once and
 * renders its children only after it succeeds. A new user therefore never
 * enters the shell just to hit `401 unknown_member`.
 *
 * Failure is bounded and recoverable: the member sees a clear message with a
 * user-initiated "Try again" and "Sign out". Nothing retries automatically and
 * no other API call provisions a member.
 */
export function V2MemberBootstrapGate({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const uid = user?.uid ?? null;
  // Outcome is bound to the uid it was produced for (see bootstrapGateStatus).
  const [outcome, setOutcome] = useState<BootstrapOutcome | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [signOutFailed, setSignOutFailed] = useState(false);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    setOutcome(null);
    // Capture the Firebase user for THIS uid; its name, token and request stay
    // bound together even if the global auth.currentUser changes meanwhile.
    const captured = user;
    const run = () =>
      bootstrapCapturedUser({
        user: captured as NonNullable<typeof captured>,
        expectedUid: uid,
        currentUid: () => auth.currentUser?.uid ?? null,
        handoff: v2SignUpNameHandoff,
        send: bootstrapMemberWithToken,
      });
    v2MemberBootstrapSession.ensure(uid, run).then(
      () => { if (!cancelled) setOutcome({ uid, status: 'ready' }); },
      () => { if (!cancelled) setOutcome({ uid, status: 'failed' }); },
    );
    return () => { cancelled = true; };
  }, [uid, attempt]); // eslint-disable-line react-hooks/exhaustive-deps -- `user` is captured for this uid on purpose

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // Clear the sign-up hand-off only after sign-out actually succeeds.
  const signOut = useCallback(() => {
    setSignOutFailed(false);
    signOutThenClearHandoff(logout, v2SignUpNameHandoff).catch(() => setSignOutFailed(true));
  }, [logout]);

  const status = bootstrapGateStatus(outcome, uid);
  if (status === 'ready') return <>{children}</>;
  if (status === 'working') return <LoadingSpinner fullScreen label="Setting up your account..." />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div role="alert" className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-black tracking-tight text-slate-900">We couldn't finish setting up your account</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Please check your connection and try again. Your sign-in is fine.
        </p>
        {signOutFailed && (
          <p className="mt-3 text-xs font-bold text-red-600">We couldn't sign you out. Please try again.</p>
        )}
        <button
          type="button"
          onClick={retry}
          className="mt-5 w-full rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={signOut}
          className="mt-2 w-full rounded-2xl px-4 py-3 text-sm font-bold text-slate-600"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
