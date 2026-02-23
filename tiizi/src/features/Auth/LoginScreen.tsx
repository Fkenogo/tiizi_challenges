import { ArrowLeft, Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';

function LoginScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { login, loginWithGoogle, isAuthenticated, isReady } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const nextPath = (() => {
    const raw = params.get('next');
    if (!raw) return '/app/groups';
    return raw.startsWith('/app') ? raw : '/app/groups';
  })();

  useEffect(() => {
    if (isReady && isAuthenticated) navigate(nextPath, { replace: true });
  }, [isReady, isAuthenticated, navigate, nextPath]);

  const handleLogin = async () => {
    if (!/\S+@\S+\.\S+/.test(email) || password.trim().length < 6) return;
    setLoading(true);
    try {
      await login(email, password);
      navigate(nextPath);
    } catch {
      showToast('Login failed. Try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate(nextPath);
    } catch {
      showToast('Google sign-in failed. Try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe px-4">
        <header className="flex items-center justify-between">
          <button className="h-8 w-8 flex items-center justify-center" onClick={() => navigate('/app/welcome')}>
            <ArrowLeft size={20} className="text-slate-900" />
          </button>
          <h1 className="text-base font-bold">Login</h1>
          <span className="w-8" />
        </header>

        <div className="mt-4 border-b border-slate-200 flex">
          <button
            className="flex-1 h-10 text-sm font-medium text-slate-500 border-b-2 border-transparent"
            onClick={() => navigate(`/app/signup${params.get('next') ? `?next=${encodeURIComponent(params.get('next') ?? '')}` : ''}`)}
          >
            Sign Up
          </button>
          <button className="flex-1 h-10 text-sm font-semibold text-slate-900 border-b-2 border-primary">Login</button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs font-medium text-slate-600 mb-1">Email Address</p>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="w-full h-10 rounded-lg border border-slate-200 pl-10 pr-3 text-sm" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-600 mb-1">Password</p>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="w-full h-10 rounded-lg border border-slate-200 pl-10 pr-10 text-sm" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" />
              <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={18} className="text-slate-400" /> : <Eye size={18} className="text-slate-400" />}
              </button>
            </div>
          </div>
        </div>

        <button onClick={handleLogin} disabled={loading || !/\S+@\S+\.\S+/.test(email) || password.trim().length < 6} className="mt-6 w-full h-10 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-60">
          {loading ? 'Signing In...' : 'Continue'}
        </button>

        <div className="mt-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <p className="text-[10px] uppercase font-bold text-slate-400">Or Continue With</p>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button className="h-12 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900" onClick={handleGoogle} disabled={loading}>
            Google
          </button>
          <button className="h-12 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900" disabled>Apple</button>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          No account?{' '}
          <button className="text-primary font-semibold" onClick={() => navigate(`/app/signup${params.get('next') ? `?next=${encodeURIComponent(params.get('next') ?? '')}` : ''}`)}>
            Sign up
          </button>
        </p>
      </div>
    </Screen>
  );
}

export default LoginScreen;
