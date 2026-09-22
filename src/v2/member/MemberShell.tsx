import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { V2BrandMark } from '../brand';
import { V2AccountTrigger, V2NavItem, V2NotificationTrigger, V2Sheet } from '../components/V2Primitives';
import { useV2Locale } from '../i18n/V2Locale';

/**
 * TIIZI S1 — Member shell (adopted reference: primary Today /
 * Challenges / Groups; Activity Guide contextual-secondary;
 * Profile + notifications secondary).
 *
 * New shell, not a restyled V1 shell: mobile-first bottom bar with
 * V2 labels/routes, responsive top treatment on desktop. No V1 bottom
 * navigation, no V1 Home/Group/onboarding composition.
 */

const PRIMARY = [
  { to: '/v2/today', key: 'today', labelKey: 'shell.today' },
  { to: '/v2/challenges', key: 'challenges', labelKey: 'shell.challenges' },
  { to: '/v2/groups', key: 'groups', labelKey: 'shell.groups' },
] as const;

const SECONDARY = [
  { to: '/v2/guide', key: 'guide', labelKey: 'shell.guide' },
  { to: '/v2/profile', key: 'profile', labelKey: 'shell.profile' },
  { to: '/v2/notifications', key: 'notifications', labelKey: 'shell.notifications' },
] as const;

function navClass(active: boolean) {
  return `flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] font-bold transition-colors ${
    active ? 'text-primary' : 'text-slate-400 hover:text-slate-700'
  }`;
}

export function V2MemberShell() {
  const { t } = useV2Locale();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top treatment: brand + secondary triggers (responsive, both form factors) */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
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

          {/* Desktop primary tabs */}
          <nav className="ml-4 hidden items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 md:flex" aria-label="Primary">
            {PRIMARY.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-lg px-4 py-1.5 text-xs font-bold transition-colors ${
                    isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`
                }
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <V2NotificationTrigger unread={false} onOpen={() => navigate('/v2/notifications')} />
            <V2AccountTrigger name="Member" onOpen={() => setAccountOpen(true)} />
          </div>
        </div>

        {/* Desktop secondary row */}
        <div className="hidden border-t border-slate-100 md:block">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-1 px-4 py-1.5 sm:px-6" aria-label="Secondary">
            {SECONDARY.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1 text-xs font-bold transition-colors ${
                    isActive ? 'bg-orange-50 text-primary' : 'text-slate-500 hover:text-slate-900'
                  }`
                }
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
            <NavLink
              to="/v2/operator/overview"
              className="ml-auto rounded-lg px-3 py-1 text-xs font-bold text-slate-400 hover:text-slate-700"
            >
              {t('shell.operator')} →
            </NavLink>
          </div>
        </div>
      </header>

      {/* Routed member surface */}
      <main className="mx-auto w-full max-w-6xl pb-24 md:pb-10">
        <Outlet />
      </main>

      {/* Mobile primary navigation: exactly Today / Challenges / Groups.
          Activity Guide is contextual (Challenges), not a primary destination;
          Profile / Notifications stay in the header (account sheet + bell). */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 md:hidden"
        aria-label="Member"
      >
        <div className="mx-auto grid w-full max-w-3xl grid-cols-3">
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

      <V2Sheet open={accountOpen} onClose={() => setAccountOpen(false)} title="Your account">
        <div className="space-y-2">
          <V2NavItem label={t('shell.profile')} onClick={() => { setAccountOpen(false); navigate('/v2/profile'); }} />
          <V2NavItem label={t('shell.notifications')} onClick={() => { setAccountOpen(false); navigate('/v2/notifications'); }} />
          <p className="px-1 pt-2 text-xs leading-5 text-slate-500">
            Account settings, language, and sign-out arrive with the next slices. Nothing here changes
            your V1 profile.
          </p>
        </div>
      </V2Sheet>
    </div>
  );
}
