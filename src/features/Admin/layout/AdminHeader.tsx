import { Bell } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminDensity } from '../../../hooks/useAdminDensity';

export function AdminHeader({ title }: { title: string }) {
  const { profile } = useAuth();
  const { density, toggle } = useAdminDensity();

  return (
    <header className="admin-header h-16 px-6 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 sticky top-0 z-20 flex items-center justify-between">
      <h1 className="text-lg font-black text-slate-900">{title}</h1>
      <div className="flex items-center gap-3">
        <button
          className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700"
          onClick={toggle}
        >
          {density === 'compact' ? 'Comfortable' : 'Compact'}
        </button>
        <button className="h-9 w-9 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600">
          <Bell size={16} />
        </button>
        <div className="text-right">
          <p className="text-xs font-bold text-slate-900">{profile?.displayName || 'Admin User'}</p>
          <p className="text-[11px] text-slate-500">{profile?.email || 'admin@tiizi.app'}</p>
        </div>
      </div>
    </header>
  );
}
