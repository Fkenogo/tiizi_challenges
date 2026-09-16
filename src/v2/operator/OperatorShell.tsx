import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { V2BrandMark } from '../brand';

/**
 * TIIZI S1 — Operator shell boundary (adopted reference).
 *
 * Desktop-first, responsive. Navigation covers all 13 console
 * sections as bounded placeholders. No authority/RBAC: the shell
 * never gates on admin permissions (that would bind S1 to operator
 * authority, which belongs to a later slice).
 */

export const V2_OPERATOR_NAV = [
  { to: '/v2/operator/overview', key: 'overview', label: 'Overview' },
  { to: '/v2/operator/users', key: 'users', label: 'Users' },
  { to: '/v2/operator/groups', key: 'groups', label: 'Groups' },
  { to: '/v2/operator/activities', key: 'activities', label: 'Activities & Knowledge' },
  { to: '/v2/operator/challenges', key: 'challenges', label: 'Challenges' },
  { to: '/v2/operator/templates', key: 'templates', label: 'Templates' },
  { to: '/v2/operator/review', key: 'review', label: 'Review & Attention' },
  { to: '/v2/operator/support', key: 'support', label: 'Donations / Support' },
  { to: '/v2/operator/content', key: 'content', label: 'Content & Localisation' },
  { to: '/v2/operator/access', key: 'access', label: 'Access & Roles' },
  { to: '/v2/operator/health', key: 'health', label: 'Platform Health' },
  { to: '/v2/operator/audit', key: 'audit', label: 'Audit Log' },
  { to: '/v2/operator/settings', key: 'settings', label: 'Settings' },
] as const;

export function V2OperatorShell() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="bg-slate-950 text-slate-200 lg:flex lg:min-h-screen lg:flex-col">
        <div className="flex items-center gap-2.5 border-b border-slate-800 p-4">
          <V2BrandMark size={30} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-400">
              Tiizi Operator
            </p>
            <p className="font-black leading-tight text-white">
              Operations console{' '}
              <span className="ml-1 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] text-slate-300">
                PREVIEW
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/v2/today')}
            className="ml-auto rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-bold lg:hidden"
          >
            Member view
          </button>
        </div>
        <nav
          className="flex gap-1 overflow-x-auto p-2 sm:p-3 lg:flex-col lg:overflow-visible"
          aria-label="Operator sections"
        >
          {V2_OPERATOR_NAV.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                  isActive ? 'bg-primary text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-slate-800 p-4 lg:block">
          <button
            type="button"
            onClick={() => navigate('/v2/today')}
            className="w-full rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold hover:bg-slate-700"
          >
            ← Exit to Member experience
          </button>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
            Preview only: sections state intent, grant no permissions, and change no data.
          </p>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="hidden items-center justify-between border-b border-slate-200 bg-white px-6 py-3 lg:flex">
          <p className="text-xs text-slate-500">
            Environment: <strong className="text-slate-900">Local preview</strong> · Data is
            non-production
          </p>
          <button
            type="button"
            onClick={() => navigate('/v2/today')}
            className="text-xs font-bold text-primary hover:underline"
          >
            Exit to Member experience →
          </button>
        </div>
        <main className="mx-auto w-full max-w-6xl p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
