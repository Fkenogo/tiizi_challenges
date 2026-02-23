import { useMemo } from 'react';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useAdminTablePrefs } from '../../../hooks/useAdminTablePrefs';
import { useSetSupportTicketStatus, useSupportTickets } from '../../../hooks/useAdminUsers';
import { AdminLayout } from '../layout/AdminLayout';

function SupportTicketsScreen() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useSupportTickets();
  const setStatus = useSetSupportTicketStatus();
  const { prefs, setPrefs, resetPrefs } = useAdminTablePrefs<{
    status: 'all' | 'new' | 'in_progress' | 'resolved';
    priority: 'all' | 'low' | 'medium' | 'high' | 'urgent';
    search: string;
    pageSize: number;
    page: number;
  }>('support_tickets', {
    status: 'all',
    priority: 'all',
    search: '',
    pageSize: 25,
    page: 1,
  });

  if (isLoading) return <LoadingSpinner fullScreen label="Loading support tickets..." />;

  const rows = useMemo(() => {
    const q = prefs.search.trim().toLowerCase();
    return (data ?? [])
      .filter((ticket) => (prefs.status === 'all' ? true : ticket.status === prefs.status))
      .filter((ticket) => (prefs.priority === 'all' ? true : ticket.priority === prefs.priority))
      .filter((ticket) => {
        if (!q) return true;
        return ticket.subject.toLowerCase().includes(q) || ticket.userEmail.toLowerCase().includes(q) || ticket.message.toLowerCase().includes(q);
      });
  }, [data, prefs.status, prefs.priority, prefs.search]);

  const totalPages = Math.max(1, Math.ceil(rows.length / prefs.pageSize));
  const clampedPage = Math.min(Math.max(1, prefs.page), totalPages);
  const pageRows = rows.slice((clampedPage - 1) * prefs.pageSize, clampedPage * prefs.pageSize);

  const onSetStatus = async (ticketId: string, status: 'new' | 'in_progress' | 'resolved') => {
    if (!user?.uid) return;
    try {
      await setStatus.mutateAsync({ ticketId, status, actorUid: user.uid });
      showToast(`Ticket set to ${status}.`, 'success');
    } catch {
      showToast('Could not update ticket status.', 'error');
    }
  };

  return (
    <AdminLayout title="Support Tickets" permissions={permissions}>
      <Card>
        <div className="flex flex-wrap gap-2">
          <input
            value={prefs.search}
            onChange={(e) => setPrefs((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
            placeholder="Search by subject/email/message"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm flex-1 min-w-[260px]"
          />
          <select value={prefs.status} onChange={(e) => setPrefs((prev) => ({ ...prev, status: e.target.value as typeof prev.status, page: 1 }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
          <select value={prefs.priority} onChange={(e) => setPrefs((prev) => ({ ...prev, priority: e.target.value as typeof prev.priority, page: 1 }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
            <option value="all">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <select value={prefs.pageSize} onChange={(e) => setPrefs((prev) => ({ ...prev, pageSize: Number(e.target.value), page: 1 }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>
          <button className="h-10 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700" onClick={resetPrefs}>
            Reset Prefs
          </button>
        </div>
      </Card>

      <div className="mt-3 space-y-2">
        {rows.length === 0 ? (
          <Card><p className="text-sm text-slate-700">No tickets yet.</p></Card>
        ) : (
          pageRows.map((ticket) => (
            <Card key={ticket.id} variant="flat">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">{ticket.subject}</p>
                  <p className="text-xs text-slate-600 mt-1">{ticket.userEmail || ticket.userId}</p>
                  <p className="text-sm text-slate-700 mt-2">{ticket.message || 'No message details.'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-500">{ticket.priority}</p>
                  <p className="text-[11px] font-bold text-slate-700 mt-1">{ticket.status}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold disabled:opacity-50" disabled={!permissions.canManageUsers || setStatus.isPending} onClick={() => onSetStatus(ticket.id, 'in_progress')}>In Progress</button>
                <button className="h-9 px-3 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-50" disabled={!permissions.canManageUsers || setStatus.isPending} onClick={() => onSetStatus(ticket.id, 'resolved')}>Resolve</button>
              </div>
            </Card>
          ))
        )}
      </div>
      <Card className="mt-3">
        <div className="flex items-center justify-between text-xs text-slate-600">
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

export default SupportTicketsScreen;
