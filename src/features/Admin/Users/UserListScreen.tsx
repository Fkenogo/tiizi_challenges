import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useAdminTablePrefs } from '../../../hooks/useAdminTablePrefs';
import { useAdminUsers, useSetAdminUserStatus } from '../../../hooks/useAdminUsers';
import { AdminLayout } from '../layout/AdminLayout';

type UserSortKey = 'name' | 'createdAt' | 'lastActiveAt';

function UserListScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useAdminUsers();
  const setStatus = useSetAdminUserStatus();
  const { prefs, setPrefs, resetPrefs } = useAdminTablePrefs<{
    search: string;
    statusFilter: 'all' | 'active' | 'suspended';
    sortKey: UserSortKey;
    pageSize: number;
    page: number;
  }>('user_list', {
    search: '',
    statusFilter: 'all',
    sortKey: 'name',
    pageSize: 25,
    page: 1,
  });

  const rows = useMemo(() => {
    const q = prefs.search.trim().toLowerCase();
    const filtered = (data ?? [])
      .filter((item) => (prefs.statusFilter === 'all' ? true : item.accountStatus === prefs.statusFilter))
      .filter((item) => {
        if (!q) return true;
        return item.displayName.toLowerCase().includes(q) || item.email.toLowerCase().includes(q);
      });
    if (prefs.sortKey === 'createdAt') return filtered.sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
    if (prefs.sortKey === 'lastActiveAt') return filtered.sort((a, b) => Date.parse(b.lastActiveAt || '') - Date.parse(a.lastActiveAt || ''));
    return filtered.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [data, prefs.search, prefs.statusFilter, prefs.sortKey]);

  const totalPages = Math.max(1, Math.ceil(rows.length / prefs.pageSize));
  const clampedPage = Math.min(Math.max(1, prefs.page), totalPages);
  const pageRows = rows.slice((clampedPage - 1) * prefs.pageSize, clampedPage * prefs.pageSize);

  const onSetStatus = async (uid: string, status: 'active' | 'suspended') => {
    if (!user?.uid) return;
    try {
      await setStatus.mutateAsync({ uid, status, adminUid: user.uid });
      showToast(`User ${status === 'active' ? 'activated' : 'suspended'}.`, 'success');
    } catch {
      showToast('Could not update user status.', 'error');
    }
  };

  if (isLoading) return <LoadingSpinner fullScreen label="Loading users..." />;

  return (
    <AdminLayout title="User Management" permissions={permissions}>
      <Card>
        <div className="flex flex-wrap gap-2">
          <input
            value={prefs.search}
            onChange={(e) => setPrefs((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
            placeholder="Search by name or email"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm flex-1 min-w-[220px]"
          />
          <select
            value={prefs.statusFilter}
            onChange={(e) => setPrefs((prev) => ({ ...prev, statusFilter: e.target.value as 'all' | 'active' | 'suspended', page: 1 }))}
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <select
            value={prefs.sortKey}
            onChange={(e) => setPrefs((prev) => ({ ...prev, sortKey: e.target.value as UserSortKey }))}
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
          >
            <option value="name">Sort: Name</option>
            <option value="createdAt">Sort: Join Date</option>
            <option value="lastActiveAt">Sort: Last Active</option>
          </select>
          <select value={prefs.pageSize} onChange={(e) => setPrefs((prev) => ({ ...prev, pageSize: Number(e.target.value), page: 1 }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>
          <button className="h-10 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700" onClick={resetPrefs}>
            Reset Prefs
          </button>
          <button className="h-10 px-3 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/admin/users/analytics')}>
            User Analytics
          </button>
          <button className="h-10 px-3 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/admin/users/support-tickets')}>
            Support Tickets
          </button>
        </div>
      </Card>

      <Card className="mt-3">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Join Date</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-semibold text-slate-900">{item.displayName}</td>
                  <td className="py-2 pr-3 text-slate-700">{item.email || '-'}</td>
                  <td className="py-2 pr-3 text-slate-700">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'}</td>
                  <td className="py-2 pr-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.accountStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {item.accountStatus}
                    </span>
                  </td>
                  <td className="py-2 space-x-2">
                    <button className="text-primary font-bold" onClick={() => navigate(`/app/admin/users/${item.id}`)}>View</button>
                    {item.accountStatus === 'active' ? (
                      <button className="text-red-600 font-bold" disabled={!permissions.canSuspendUsers || setStatus.isPending} onClick={() => onSetStatus(item.id, 'suspended')}>Suspend</button>
                    ) : (
                      <button className="text-green-600 font-bold" disabled={!permissions.canSuspendUsers || setStatus.isPending} onClick={() => onSetStatus(item.id, 'active')}>Activate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
          <span>Page {clampedPage} of {totalPages}</span>
          <div className="flex gap-2">
            <button className="h-8 px-2 rounded border border-slate-200 disabled:opacity-50" disabled={clampedPage <= 1} onClick={() => setPrefs((prev) => ({ ...prev, page: clampedPage - 1 }))}>Prev</button>
            <button className="h-8 px-2 rounded border border-slate-200 disabled:opacity-50" disabled={clampedPage >= totalPages} onClick={() => setPrefs((prev) => ({ ...prev, page: clampedPage + 1 }))}>Next</button>
          </div>
        </div>
      </Card>
    </AdminLayout>
  );
}

export default UserListScreen;
