import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { V2BrandMark } from '../brand';
import { useAuth } from '../../hooks/useAuth';

/**
 * TIIZI S1 — Operator shell boundary (adopted reference).
 *
 * Desktop-first, responsive Platform Operator Console. Social Cause review
 * delegates authority checks to the authenticated API; other sections expose
 * only capabilities with an existing Operator-scoped read or decision path.
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
  const { user } = useAuth();
  useEffect(() => {
    document.body.classList.add('operator-desktop');
    return () => document.body.classList.remove('operator-desktop');
  }, []);
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="bg-slate-950 text-slate-200 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto">
        <div className="flex items-center gap-2.5 border-b border-slate-800 p-4">
          <V2BrandMark size={30} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-400">
              Tiizi Platform Operator
            </p>
            <p className="font-black leading-tight text-white">
              Platform Operator Console{' '}
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
        <div className="border-b border-slate-800 px-4 py-3 lg:px-5">
          <p className="text-xs font-bold text-white">{user?.displayName || 'Fred Kenogo'}</p>
          <p className="mt-0.5 text-[10px] text-slate-400">Platform Operator</p>
        </div>
        <nav
          className="flex gap-1 overflow-x-auto p-2 sm:p-3 lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto"
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
            Social Cause review is available through the Platform Operator roster. Other sections are assembled only where an authorized capability exists.
            </p>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="border-b border-slate-200 bg-white px-4 py-2 text-[11px] text-slate-500 lg:hidden">
          Environment: <strong className="text-slate-900">Local / Development Preview</strong> · Data is non-production
        </div>
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
        <main className="w-full p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
