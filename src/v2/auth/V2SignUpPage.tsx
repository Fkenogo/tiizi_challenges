import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { normalizeFirebaseAuthError } from '../../utils/firebaseAuthErrors';
import { resolveV2NextPath, v2NextQuery } from './v2NextPath';
import { V2AuthButton, V2AuthField, V2AuthLayout, V2ProviderButton } from './V2AuthLayout';

/**
 * TIIZI S1 CORR-001 — V2 sign-up experience.
 *
 * New V2 surface mirroring the existing account-creation
 * capability (email/password + Google). After sign-up the member
 * returns to the requested V2 route — never into V1 onboarding,
 * profile setup, or group prerequisites (deferred to their
 * authorised vertical slice).
 */

const EMAIL_PATTERN = /\S+@\S+\.\S+/;

export function V2SignUpPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { signup, loginWithGoogle, isAuthenticated, isReady } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const next = resolveV2NextPath(params.get('next'));

  useEffect(() => {
    if (isReady && isAuthenticated) navigate(next, { replace: true });
  }, [isReady, isAuthenticated, navigate, next]);

  const canSubmit =
    name.trim().length > 0
    && EMAIL_PATTERN.test(email.trim())
    && password.length >= 6
    && password === confirmPassword
    && !working;

  const handleSignUp = async () => {
    if (!canSubmit) return;
    setError('');
    setWorking(true);
    try {
      await signup(name.trim(), email.trim(), password);
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
      title="Join Tiizi"
      subtitle="Move together with your people — challenges, groups, and everyday momentum."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to={`/v2/sign-in${v2NextQuery(next)}`}
            className="font-bold text-primary hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSignUp();
        }}
      >
        <V2AuthField
          label="Your name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What should we call you?"
        />
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
        />
        <V2AuthField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repeat your password"
        />
        {password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword && (
          <p className="text-xs font-bold text-red-600">Passwords do not match yet.</p>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            {error}
          </p>
        )}
        <V2AuthButton type="submit" disabled={!canSubmit}>
          {working ? 'Creating your account…' : 'Create account'}
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

      <p className="mt-5 text-center text-xs leading-5 text-slate-400">
        By creating an account you agree to our{' '}
        <Link to="/terms" className="font-bold text-slate-600 underline">
          Terms
        </Link>{' '}
        and{' '}
        <Link to="/privacy" className="font-bold text-slate-600 underline">
          Privacy Policy
        </Link>
        .
      </p>
    </V2AuthLayout>
  );
}
