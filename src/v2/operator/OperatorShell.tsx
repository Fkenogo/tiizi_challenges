import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, CircleDollarSign, Gauge, Globe2, LayoutDashboard, LibraryBig,
  ScrollText, Settings2, ShieldCheck, Users, UsersRound, Workflow, type LucideIcon,
} from 'lucide-react';
import { V2BrandMark } from '../brand';
import { useAuth } from '../../hooks/useAuth';
import { fetchOperatorOverview } from '../../api/operatorConsoleApi';

export const V2_OPERATOR_NAV: Array<{ to: string; key: string; label: string; Icon: LucideIcon }> = [
  { to: '/v2/operator/overview', key: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { to: '/v2/operator/users', key: 'users', label: 'Users', Icon: Users },
  { to: '/v2/operator/groups', key: 'groups', label: 'Groups', Icon: UsersRound },
  { to: '/v2/operator/activities', key: 'activities', label: 'Activities & Knowledge', Icon: Activity },
  { to: '/v2/operator/challenges', key: 'challenges', label: 'Challenges', Icon: Workflow },
  { to: '/v2/operator/templates', key: 'templates', label: 'Templates', Icon: LibraryBig },
  { to: '/v2/operator/review', key: 'review', label: 'Review & Attention', Icon: ShieldCheck },
  { to: '/v2/operator/support', key: 'support', label: 'Donations / Support', Icon: CircleDollarSign },
  { to: '/v2/operator/content', key: 'content', label: 'Content & Localisation', Icon: Globe2 },
  { to: '/v2/operator/access', key: 'access', label: 'Access & Roles', Icon: Users },
  { to: '/v2/operator/health', key: 'health', label: 'Platform Health', Icon: Gauge },
  { to: '/v2/operator/audit', key: 'audit', label: 'Audit Log', Icon: ScrollText },
  { to: '/v2/operator/settings', key: 'settings', label: 'Settings', Icon: Settings2 },
];

export function V2OperatorShell() {
  const navigate = useNavigate(); const { user } = useAuth();
  const overview = useQuery({ queryKey: ['operator-console', 'overview'], queryFn: fetchOperatorOverview, enabled: !!user?.uid, staleTime: 10_000 });
  useEffect(() => {
    document.body.classList.add('operator-desktop');
    return () => document.body.classList.remove('operator-desktop');
  }, []);
  const exit = () => navigate('/v2/today');
  return <div className="min-h-screen bg-slate-100 text-slate-900 lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
    <aside className="border-b border-slate-800 bg-slate-950 text-slate-200 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0">
      <div className="flex items-center gap-3 border-b border-slate-800 p-4">
        <V2BrandMark size={32} /><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-widest text-orange-400">Tiizi Platform Operator</p><p className="mt-1 text-sm font-black leading-tight text-white">Operations console</p></div>
        <button type="button" onClick={exit} className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-bold lg:hidden">Member view</button>
      </div>
      <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3 lg:px-5"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-sm font-black text-white">F</div><div><p className="text-xs font-bold text-white">{user?.displayName || 'Fred Kenogo'}</p><p className="mt-0.5 text-[10px] text-slate-400">Platform Operator</p></div></div>
      <nav className="flex gap-1 overflow-x-auto p-2 sm:p-3 lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-1 lg:overflow-x-hidden lg:overflow-y-auto" aria-label="Operator sections">
        {V2_OPERATOR_NAV.map(({ to, key, label, Icon }) => <NavLink key={key} to={to} end={key === 'overview'} className={({ isActive }) => `flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-bold transition-colors lg:w-full ${isActive ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}><Icon size={16} aria-hidden="true" /><span className="flex-1">{label}</span>{key === 'review' && !!overview.data?.counts.pending_causes && <span className="rounded bg-amber-400/20 px-1.5 py-0.5 font-mono text-[10px] text-amber-200">{overview.data.counts.pending_causes}</span>}</NavLink>)}
      </nav>
      <div className="hidden border-t border-slate-800 p-4 lg:block"><button type="button" onClick={exit} className="w-full rounded-xl bg-slate-800 px-3 py-2.5 text-xs font-bold text-white hover:bg-slate-700">← Exit to Member experience</button><p className="mt-3 text-[10px] leading-relaxed text-slate-500">Read capabilities are scoped to the current Platform Operator grant. Cause decisions are separately roster-authorized and audited.</p></div>
    </aside>
    <div className="min-w-0"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600 sm:px-6"><p>Environment: <strong className="text-slate-900">Local / Development Preview</strong> <span className="text-slate-400">·</span> Data is non-production</p><button type="button" onClick={exit} className="font-bold text-primary hover:underline lg:hidden">Exit to Member experience →</button></div><main className="w-full p-3 sm:p-5 xl:p-7"><Outlet /></main></div>
  </div>;
}
