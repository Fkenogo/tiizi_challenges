import { Archive, CheckCircle2, RefreshCw, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import {
  useAllChallengesAdmin,
  useArchiveChallenge,
  useDeactivateChallenge,
  useDeleteChallengeAdmin,
  useMarkChallengeCompleted,
  useReactivateChallenge,
} from '../../../hooks/useAdminChallenges';
import type { AdminChallengeRow, ChallengeStatusFilter } from '../../../services/adminChallengeService';
import { AdminLayout } from '../layout/AdminLayout';

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: 'Active', bg: 'bg-green-100', text: 'text-green-800' },
  upcoming: { label: 'Upcoming', bg: 'bg-blue-100', text: 'text-blue-800' },
  completed: { label: 'Completed', bg: 'bg-slate-100', text: 'text-slate-600' },
  archived: { label: 'Archived', bg: 'bg-amber-100', text: 'text-amber-800' },
  inactive: { label: 'Inactive', bg: 'bg-red-100', text: 'text-red-800' },
  draft: { label: 'Draft', bg: 'bg-purple-100', text: 'text-purple-800' },
  pending: { label: 'Pending', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  deleted: { label: 'Deleted', bg: 'bg-slate-200', text: 'text-slate-500' },
};

const STATUS_FILTERS: Array<{ key: ChallengeStatusFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'archived', label: 'Archived' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'draft', label: 'Draft' },
];

const TYPE_OPTIONS = ['all', 'collective', 'competitive', 'streak'] as const;
const CATEGORY_OPTIONS = ['all', 'fitness', 'wellness', 'fasting', 'hydration', 'sleep', 'mindfulness', 'nutrition', 'habits'] as const;

function StatusBadge({ status }: { status: string }) {
  const badge = STATUS_BADGE[status] ?? { label: status, bg: 'bg-slate-100', text: 'text-slate-600' };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${badge.bg} ${badge.text}`}>
      {badge.label}
    </span>
  );
}

function ActionMenu({ challenge, onAction }: {
  challenge: AdminChallengeRow;
  onAction: (action: string, challenge: AdminChallengeRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const status = challenge.effectiveStatus;
  return (
    <div className="relative">
      <button
        className="h-7 px-2 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold"
        onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }}
      >
        ···
      </button>
      {open && (
        <div
          className="absolute right-0 top-8 z-50 w-44 rounded-xl border border-slate-200 bg-white shadow-lg py-1"
          onClick={(e) => e.stopPropagation()}
        >
          {status === 'active' && (
            <>
              <button className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50" onClick={() => { setOpen(false); onAction('deactivate', challenge); }}>
                <XCircle size={13} className="text-red-500" /> Deactivate
              </button>
              <button className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50" onClick={() => { setOpen(false); onAction('complete', challenge); }}>
                <CheckCircle2 size={13} className="text-green-600" /> Mark Completed
              </button>
              <button className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50" onClick={() => { setOpen(false); onAction('archive', challenge); }}>
                <Archive size={13} className="text-amber-600" /> Archive
              </button>
            </>
          )}
          {(status === 'inactive' || status === 'draft') && (
            <button className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50" onClick={() => { setOpen(false); onAction('reactivate', challenge); }}>
              <RefreshCw size={13} className="text-green-600" /> Reactivate
            </button>
          )}
          {status === 'archived' && (
            <button className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50" onClick={() => { setOpen(false); onAction('reactivate', challenge); }}>
              <RotateCcw size={13} className="text-blue-600" /> Restore to Active
            </button>
          )}
          <button className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50" onClick={() => { setOpen(false); onAction('delete', challenge); }}>
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

function ChallengeManagementScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useAllChallengesAdmin();
  const { showToast } = useToast();
  const archiveMutation = useArchiveChallenge();
  const deactivateMutation = useDeactivateChallenge();
  const reactivateMutation = useReactivateChallenge();
  const completeMutation = useMarkChallengeCompleted();
  const deleteMutation = useDeleteChallengeAdmin();

  const [statusFilter, setStatusFilter] = useState<ChallengeStatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<AdminChallengeRow | null>(null);

  const filtered = useMemo(() => {
    const rows = data ?? [];
    return rows.filter((c) => {
      if (c.effectiveStatus === 'deleted' || c.status === 'deleted') return false;
      if (statusFilter !== 'all' && c.effectiveStatus !== statusFilter) return false;
      if (typeFilter !== 'all' && c.challengeType !== typeFilter) return false;
      if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return c.name.toLowerCase().includes(q) || (c.groupName ?? '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [data, statusFilter, typeFilter, categoryFilter, search]);

  const handleAction = async (action: string, challenge: AdminChallengeRow) => {
    if (action === 'delete') { setConfirmDelete(challenge); return; }
    try {
      if (action === 'archive') await archiveMutation.mutateAsync(challenge.id);
      else if (action === 'deactivate') await deactivateMutation.mutateAsync(challenge.id);
      else if (action === 'reactivate') await reactivateMutation.mutateAsync(challenge.id);
      else if (action === 'complete') await completeMutation.mutateAsync(challenge.id);
      showToast(`Challenge ${action}d.`, 'success');
    } catch {
      showToast(`Failed to ${action} challenge.`, 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteMutation.mutateAsync(confirmDelete.id);
      showToast('Challenge deleted.', 'success');
    } catch {
      showToast('Failed to delete challenge.', 'error');
    } finally {
      setConfirmDelete(null);
    }
  };

  if (isLoading) return <LoadingSpinner fullScreen label="Loading challenges..." />;

  return (
    <AdminLayout title="Challenge Management" permissions={permissions}>
      {/* Actions bar */}
      <Card className="mb-3">
        <div className="flex flex-wrap gap-2">
          <button className="h-9 px-3 rounded-lg bg-primary text-white text-sm font-bold" onClick={() => navigate('/app/admin/challenges/create')}>
            + Create Challenge
          </button>
          <button className="h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/admin/challenges/analytics')}>
            Analytics
          </button>
          <button className="h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/admin/challenges/templates')}>
            Templates
          </button>
        </div>
      </Card>

      {/* Filters */}
      <Card className="mb-3">
        <input
          className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm mb-2"
          placeholder="Search by name or group..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5 mb-2">
          {STATUS_FILTERS.map((sf) => (
            <button
              key={sf.key}
              className={`h-7 px-2.5 rounded-full text-[11px] font-semibold ${statusFilter === sf.key ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}
              onClick={() => setStatusFilter(sf.key)}
            >
              {sf.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            className="h-8 rounded-lg border border-slate-200 px-2 text-xs text-slate-700"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t === 'all' ? 'All types' : t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          <select
            className="h-8 rounded-lg border border-slate-200 px-2 text-xs text-slate-700"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c === 'all' ? 'All categories' : c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>
      </Card>

      {/* Summary */}
      <p className="text-xs text-slate-500 mb-2 px-1">{filtered.length} challenge{filtered.length !== 1 ? 's' : ''}</p>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card><p className="text-sm text-slate-500">No challenges match your filters.</p></Card>
      ) : (
        <Card>
          <div className="overflow-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead>
                <tr className="text-left border-b border-slate-200">
                  <th className="py-2 pr-3 font-semibold text-slate-600">Name</th>
                  <th className="py-2 pr-3 font-semibold text-slate-600">Status</th>
                  <th className="py-2 pr-3 font-semibold text-slate-600">Type</th>
                  <th className="py-2 pr-3 font-semibold text-slate-600">Category</th>
                  <th className="py-2 pr-3 font-semibold text-slate-600">Group</th>
                  <th className="py-2 pr-3 font-semibold text-slate-600">Participants</th>
                  <th className="py-2 pr-3 font-semibold text-slate-600">Start</th>
                  <th className="py-2 pr-3 font-semibold text-slate-600">End</th>
                  <th className="py-2 font-semibold text-slate-600"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`/app/admin/challenges/${row.id}`)}
                  >
                    <td className="py-2 pr-3 font-semibold text-slate-900 max-w-[180px] truncate">{row.name}</td>
                    <td className="py-2 pr-3"><StatusBadge status={row.effectiveStatus} /></td>
                    <td className="py-2 pr-3 capitalize text-slate-700">{row.challengeType}</td>
                    <td className="py-2 pr-3 capitalize text-slate-700">{row.category}</td>
                    <td className="py-2 pr-3 text-slate-600 max-w-[120px] truncate">
                      {row.groupName ? (
                        <button
                          className="text-primary hover:underline"
                          onClick={(e) => { e.stopPropagation(); navigate(`/app/admin/groups/${row.groupId}`); }}
                        >
                          {row.groupName}
                        </button>
                      ) : row.groupId ? (
                        <button
                          className="text-primary hover:underline"
                          onClick={(e) => { e.stopPropagation(); navigate(`/app/admin/groups/${row.groupId}`); }}
                        >
                          {row.groupId.slice(0, 8)}…
                        </button>
                      ) : '—'}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{row.participantCount.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-slate-600">{row.startDate ? new Date(row.startDate).toLocaleDateString() : '—'}</td>
                    <td className="py-2 pr-3 text-slate-600">{row.endDate ? new Date(row.endDate).toLocaleDateString() : '—'}</td>
                    <td className="py-2" onClick={(e) => e.stopPropagation()}>
                      <ActionMenu challenge={row} onAction={handleAction} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-[15px] font-black text-slate-900">Delete challenge?</p>
            <p className="mt-1 text-sm text-slate-600">
              "<span className="font-semibold">{confirmDelete.name}</span>" will be soft-deleted and hidden from users. This cannot be undone from the UI.
            </p>
            <div className="mt-4 flex gap-2">
              <button className="flex-1 h-10 rounded-xl bg-red-600 text-white text-sm font-bold" onClick={handleConfirmDelete}>
                Delete
              </button>
              <button className="flex-1 h-10 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default ChallengeManagementScreen;
