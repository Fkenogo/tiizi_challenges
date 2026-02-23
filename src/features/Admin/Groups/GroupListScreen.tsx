import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useAdminGroups, useSetAdminGroupStatus } from '../../../hooks/useAdminGroups';
import { useAdminTablePrefs } from '../../../hooks/useAdminTablePrefs';
import { useToast } from '../../../context/ToastContext';
import { AdminLayout } from '../layout/AdminLayout';

type GroupSortKey = 'name' | 'memberCount' | 'challengeCount' | 'createdAt';

function GroupListScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { showToast } = useToast();
  const { data, isLoading } = useAdminGroups();
  const setStatus = useSetAdminGroupStatus();
  const { prefs, setPrefs, resetPrefs } = useAdminTablePrefs<{
    search: string;
    statusFilter: 'all' | 'active' | 'flagged' | 'deactivated';
    sortKey: GroupSortKey;
    pageSize: number;
    page: number;
  }>('group_list', {
    search: '',
    statusFilter: 'all',
    sortKey: 'name',
    pageSize: 25,
    page: 1,
  });

  const rows = useMemo(() => {
    const q = prefs.search.trim().toLowerCase();
    const filtered = (data ?? [])
      .filter((g) => (prefs.statusFilter === 'all' ? true : g.moderationStatus === prefs.statusFilter))
      .filter((g) => {
        if (!q) return true;
        return g.name.toLowerCase().includes(q) || g.ownerId.toLowerCase().includes(q);
      });
    if (prefs.sortKey === 'memberCount') return filtered.sort((a, b) => b.memberCount - a.memberCount);
    if (prefs.sortKey === 'challengeCount') return filtered.sort((a, b) => b.challengeCount - a.challengeCount);
    if (prefs.sortKey === 'createdAt') return filtered.sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [data, prefs.search, prefs.statusFilter, prefs.sortKey]);

  const totalPages = Math.max(1, Math.ceil(rows.length / prefs.pageSize));
  const clampedPage = Math.min(Math.max(1, prefs.page), totalPages);
  const pageRows = rows.slice((clampedPage - 1) * prefs.pageSize, clampedPage * prefs.pageSize);

  const onSetStatus = async (groupId: string, status: 'active' | 'flagged' | 'deactivated') => {
    if (!user?.uid) return;
    try {
      await setStatus.mutateAsync({ groupId, status, adminUid: user.uid });
      showToast(`Group status updated to ${status}.`, 'success');
    } catch {
      showToast('Could not update group status.', 'error');
    }
  };

  if (isLoading) return <LoadingSpinner fullScreen label="Loading groups..." />;

  return (
    <AdminLayout title="Group Management" permissions={permissions}>
      <Card>
        <div className="flex flex-wrap gap-2">
          <input
            value={prefs.search}
            onChange={(e) => setPrefs((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
            placeholder="Search groups by name/owner id"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm flex-1 min-w-[240px]"
          />
          <select
            value={prefs.statusFilter}
            onChange={(e) => setPrefs((prev) => ({ ...prev, statusFilter: e.target.value as 'all' | 'active' | 'flagged' | 'deactivated', page: 1 }))}
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="flagged">Flagged</option>
            <option value="deactivated">Deactivated</option>
          </select>
          <select value={prefs.sortKey} onChange={(e) => setPrefs((prev) => ({ ...prev, sortKey: e.target.value as GroupSortKey }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
            <option value="name">Sort: Name</option>
            <option value="memberCount">Sort: Members</option>
            <option value="challengeCount">Sort: Challenges</option>
            <option value="createdAt">Sort: Created</option>
          </select>
          <select value={prefs.pageSize} onChange={(e) => setPrefs((prev) => ({ ...prev, pageSize: Number(e.target.value), page: 1 }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>
          <button className="h-10 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700" onClick={resetPrefs}>
            Reset Prefs
          </button>
          <button className="h-10 px-3 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/admin/groups/moderation')}>
            Moderation Queue
          </button>
        </div>
      </Card>

      <Card className="mt-3">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-2 pr-3">Group</th>
                <th className="py-2 pr-3">Owner</th>
                <th className="py-2 pr-3">Members</th>
                <th className="py-2 pr-3">Challenges</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((group) => (
                <tr key={group.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3">
                    <p className="font-semibold text-slate-900">{group.name}</p>
                    <p className="text-xs text-slate-500">{group.isFeatured ? 'Featured' : 'Standard'}</p>
                  </td>
                  <td className="py-2 pr-3 text-slate-700">{group.ownerId.slice(0, 8)}</td>
                  <td className="py-2 pr-3 text-slate-700">{group.memberCount}</td>
                  <td className="py-2 pr-3 text-slate-700">{group.challengeCount}</td>
                  <td className="py-2 pr-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      group.moderationStatus === 'active'
                        ? 'bg-green-100 text-green-700'
                        : group.moderationStatus === 'flagged'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-200 text-slate-700'
                    }`}
                    >
                      {group.moderationStatus}
                    </span>
                  </td>
                  <td className="py-2 space-x-2">
                    <button className="text-primary font-bold" onClick={() => navigate(`/app/admin/groups/${group.id}`)}>View</button>
                    <button className="text-amber-700 font-bold" disabled={!permissions.canModerateGroups || setStatus.isPending} onClick={() => onSetStatus(group.id, 'flagged')}>Flag</button>
                    <button className="text-red-600 font-bold" disabled={!permissions.canModerateGroups || setStatus.isPending} onClick={() => onSetStatus(group.id, 'deactivated')}>Deactivate</button>
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

export default GroupListScreen;
