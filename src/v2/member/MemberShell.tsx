import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { V2BrandMark } from '../brand';
import {
  V2AccountTrigger,
  V2Button,
  V2NavItem,
  V2NotificationTrigger,
  V2Sheet,
} from '../components/V2Primitives';
import { useV2Locale } from '../i18n/V2Locale';
import { useAuth } from '../../hooks/useAuth';
import { useV2MemberIdentity } from '../profile/useV2MemberIdentity';
import { useV2SignOut } from '../profile/useV2SignOut';

/**
 * TIIZI — V2 MEMBER SHELL FOUNDER CORRECTION 002.
 *
 * Member app is mobile-only at every viewport width: a bounded, centered
 * mobile canvas with a persistent bottom bar and a clean top area.
 *
 * Navigation ownership:
 * - PRIMARY (Today / Challenges / Groups) — bottom bar at every width;
 * - ACCOUNT (Activity Guide / Profile) — account sheet only;
 * - Notifications — the header bell only;
 * - Operator — not member navigation; its route tree stays outside this shell.
 */

const PRIMARY = [
  { to: '/v2/today', key: 'today', labelKey: 'shell.today' },
  { to: '/v2/challenges', key: 'challenges', labelKey: 'shell.challenges' },
  { to: '/v2/groups', key: 'groups', labelKey: 'shell.groups' },
] as const;

/** Account-sheet destinations. Notifications is deliberately absent (bell only). */
const ACCOUNT = [
  { to: '/v2/guide', key: 'guide', labelKey: 'shell.guide' },
  { to: '/v2/profile', key: 'profile', labelKey: 'shell.profile' },
] as const;

function navClass(active: boolean) {
  return `flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] font-bold transition-colors ${
    active ? 'text-primary' : 'text-slate-400 hover:text-slate-700'
  }`;
}

export function V2MemberShell() {
  const { t } = useV2Locale();
  const navigate = useNavigate();
  const { user } = useAuth();
  const identity = useV2MemberIdentity();
  const signOut = useV2SignOut();
  const [accountOpen, setAccountOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const displayName = identity.displayName ?? 'Member';
  const email = user?.email ?? null;

  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
      setAccountOpen(false);
    } catch {
      setSignOutError("We couldn't sign you out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto min-h-screen w-full max-w-md bg-slate-50 shadow-xl">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-14 w-full items-center gap-3 px-4">
            <button
              type="button"
              onClick={() => navigate('/v2/today')}
              className="flex items-center gap-2 text-left"
              aria-label="Tiizi Today"
            >
              <V2BrandMark size={30} />
              <span className="flex flex-col leading-none">
                <span className="text-lg font-black tracking-tight">tiizi</span>
                <span className="hidden text-[10px] font-bold uppercase tracking-widest text-primary sm:inline">
                  Together We Move
                </span>
              </span>
            </button>

            <div className="ml-auto flex items-center gap-2">
              <V2NotificationTrigger unread={false} onOpen={() => navigate('/v2/notifications')} />
              <V2AccountTrigger name={displayName} onOpen={() => setAccountOpen(true)} />
            </div>
          </div>
        </header>

        <main className="w-full pb-24">
          <Outlet />
        </main>

        <nav
          className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-slate-200 bg-white px-2 pb-[env(safe-area-inset-bottom)] pt-1.5"
          aria-label="Member"
        >
          <div className="mx-auto grid w-full grid-cols-3">
            {PRIMARY.map((item) => (
              <NavLink key={item.key} to={item.to} className={({ isActive }) => navClass(isActive)}>
                {({ isActive }) => (
                  <>
                    <span
                      className={`h-1 w-8 rounded-full ${isActive ? 'bg-primary' : 'bg-transparent'}`}
                      aria-hidden
                    />
                    {t(item.labelKey)}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        <V2Sheet
          open={accountOpen}
          onClose={() => setAccountOpen(false)}
          title="Your account"
          variant="member"
        >
          <div className="space-y-2">
            <div className="rounded-xl bg-slate-50 px-3 py-3">
              <p className="text-sm font-bold text-slate-900">{displayName}</p>
              <p className="mt-0.5 break-words text-xs leading-5 text-slate-500">
                {email ?? 'No email address is available for this account.'}
              </p>
            </div>
            {ACCOUNT.map((item) => (
              <V2NavItem
                key={item.key}
                label={t(item.labelKey)}
                onClick={() => {
                  setAccountOpen(false);
                  navigate(item.to);
                }}
              />
            ))}
            <div className="pt-2">
              <V2Button
                variant="secondary"
                className="w-full"
                onClick={() => void handleSignOut()}
                disabled={signingOut}
              >
                {signingOut ? 'Signing out…' : 'Sign out'}
              </V2Button>
              {signOutError && (
                <p role="alert" className="mt-2 px-1 text-xs leading-5 text-red-700">
                  {signOutError}
                </p>
              )}
            </div>
          </div>
        </V2Sheet>
      </div>
    </div>
  );
}
