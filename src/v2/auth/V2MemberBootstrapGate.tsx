import { useCallback, useEffect, useRef, useState } from 'react';
import { LoadingSpinner } from '../../components/Mobile';
import { useAuth } from '../../hooks/useAuth';
import { bootstrapMember } from '../../api/memberBootstrapApi';
import { createMemberBootstrapSession } from './memberBootstrapSession';

const v2MemberBootstrapSession = createMemberBootstrapSession(bootstrapMember);

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
type GateState = 'working' | 'ready' | 'failed';

export function V2MemberBootstrapGate({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const uid = user?.uid ?? null;
  // The Firebase user's actual displayName only (never the localStorage
  // fallback profile, never an email-derived value). Read at call time.
  const displayNameRef = useRef<string | null>(null);
  displayNameRef.current = user?.displayName?.trim() || null;
  const [state, setState] = useState<GateState>('working');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    setState('working');
    v2MemberBootstrapSession.ensure(uid, displayNameRef.current).then(
      () => { if (!cancelled) setState('ready'); },
      () => { if (!cancelled) setState('failed'); },
    );
    return () => { cancelled = true; };
  }, [uid, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (state === 'ready') return <>{children}</>;
  if (state === 'working') return <LoadingSpinner fullScreen label="Setting up your account..." />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div role="alert" className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-black tracking-tight text-slate-900">We couldn't finish setting up your account</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Please check your connection and try again. Your sign-in is fine.
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-5 w-full rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-2 w-full rounded-2xl px-4 py-3 text-sm font-bold text-slate-600"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
