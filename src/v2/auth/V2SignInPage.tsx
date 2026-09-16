import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../lib/firebaseAuth';
import {
  getFirebaseAuthErrorCode,
  isPasswordResetVisibleError,
  normalizeFirebaseAuthError,
} from '../../utils/firebaseAuthErrors';
import { resolveV2NextPath, v2NextQuery } from './v2NextPath';
import { V2AuthButton, V2AuthField, V2AuthLayout, V2ProviderButton } from './V2AuthLayout';

/**
 * TIIZI S1 CORR-001 — V2 sign-in experience.
 *
 * New V2 surface (not a restyled V1 screen). Reuses only neutral
 * authentication capability: session state + email/password +
 * Google credential handling from the shared auth infrastructure,
 * and password-recovery delivery via Firebase Auth. Recovery copy
 * never reveals whether an account exists.
 */

const EMAIL_PATTERN = /\S+@\S+\.\S+/;

function V2ForgotPasswordDialog({
  initialEmail,
  onClose,
}: {
  initialEmail: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const valid = EMAIL_PATTERN.test(email.trim());

  const handleSend = async () => {
    setError('');
    if (!valid) {
      setError('Enter a valid email address.');
      return;
    }
    setSending(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (err) {
      const code = getFirebaseAuthErrorCode(err);
      if (isPasswordResetVisibleError(code)) {
        setError(normalizeFirebaseAuthError(err));
      } else {
        // Never reveal whether the account exists: show the same
        // success state as a real send.
        setSent(true);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-8 sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900">Reset your password</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200"
          >
            Close
          </button>
        </div>
        {sent ? (
          <div className="mt-4">
            <p className="text-sm leading-6 text-slate-600">
              Check your email for a link to reset your password.
            </p>
            <div className="mt-5">
              <V2AuthButton onClick={onClose}>Done</V2AuthButton>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm leading-6 text-slate-600">
              Enter the email address on your account and we will send you a link to
              reset your password.
            </p>
            <div className="mt-4">
              <V2AuthField
                label="Email address"
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
            <div className="mt-5">
              <V2AuthButton onClick={handleSend} disabled={sending || !valid}>
                {sending ? 'Sending…' : 'Send reset link'}
              </V2AuthButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function V2SignInPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { login, loginWithGoogle, isAuthenticated, isReady } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);

  const next = resolveV2NextPath(params.get('next'));

  useEffect(() => {
    if (isReady && isAuthenticated) navigate(next, { replace: true });
  }, [isReady, isAuthenticated, navigate, next]);

  const canSubmit = EMAIL_PATTERN.test(email.trim()) && password.length >= 6 && !working;

  const handleSignIn = async () => {
    if (!canSubmit) return;
    setError('');
    setWorking(true);
    try {
      await login(email.trim(), password);
      navigate(next);
    } catch (err) {
      setError(normalizeFirebaseAuthError(err));
    } finally {
      setWorking(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setWorking(true);
    try {
      await loginWithGoogle();
      navigate(next);
    } catch (err) {
      setError(normalizeFirebaseAuthError(err));
    } finally {
      setWorking(false);
    }
  };

  return (
    <V2AuthLayout
      title="Welcome back"
      subtitle="Sign in to pick up where you left off — your today, challenges, and groups are waiting."
      footer={
        <>
          New here?{' '}
          <Link
            to={`/v2/sign-up${v2NextQuery(next)}`}
            className="font-bold text-primary hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSignIn();
        }}
      >
        <V2AuthField
          label="Email address"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <V2AuthField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowRecovery(true)}
            className="text-xs font-bold text-primary hover:underline"
          >
            Forgot password?
          </button>
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            {error}
          </p>
        )}
        <V2AuthButton type="submit" disabled={!canSubmit}>
          {working ? 'Signing in…' : 'Sign in'}
        </V2AuthButton>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Or continue with
        </p>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <V2ProviderButton onClick={() => void handleGoogle()} disabled={working}>
        Continue with Google
      </V2ProviderButton>

      {showRecovery && (
        <V2ForgotPasswordDialog initialEmail={email} onClose={() => setShowRecovery(false)} />
      )}
    </V2AuthLayout>
  );
}
