import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useSystemLogs } from '../../../hooks/useAdminSettings';
import { AdminLayout } from '../layout/AdminLayout';

function SystemLogsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const [severity, setSeverity] = useState<'all' | 'info' | 'warning' | 'error'>('all');
  const [actorUid, setActorUid] = useState('');
  const { data, isLoading } = useSystemLogs(200);

  const rows = useMemo(() => {
    const uidQuery = actorUid.trim().toLowerCase();
    return (data ?? [])
      .filter((row) => (severity === 'all' ? true : row.severity === severity))
      .filter((row) => (uidQuery ? row.actorUid.toLowerCase().includes(uidQuery) : true));
  }, [data, severity, actorUid]);

  if (isLoading) return <LoadingSpinner fullScreen label="Loading system logs..." />;

  return (
    <AdminLayout title="System Logs" permissions={permissions}>
      {!permissions.canViewSystemLogs ? (
        <Card>
          <p className="text-sm text-slate-700">You do not have permission to view system logs.</p>
          <button className="mt-3 h-10 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/admin/settings')}>
            Back to Settings
          </button>
        </Card>
      ) : (
        <>
      <Card>
        <div className="flex flex-wrap gap-2">
          <select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
            <option value="all">All severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
          <input
            value={actorUid}
            onChange={(e) => setActorUid(e.target.value)}
            placeholder="Filter by actor UID"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm flex-1 min-w-[240px]"
          />
          <button className="h-10 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/admin/settings')}>
            Back to Settings
          </button>
        </div>
      </Card>

      <Card className="mt-3">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-2 pr-3">Timestamp</th>
                <th className="py-2 pr-3">Severity</th>
                <th className="py-2 pr-3">Actor</th>
                <th className="py-2 pr-3">Action</th>
                <th className="py-2 pr-3">Target</th>
                <th className="py-2 pr-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3">{new Date(row.at).toLocaleString()}</td>
                  <td className="py-2 pr-3">{row.severity}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{row.actorUid}</td>
                  <td className="py-2 pr-3">{row.action}</td>
                  <td className="py-2 pr-3">{row.targetType}:{row.targetId}</td>
                  <td className="py-2 pr-3">{row.note ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
        </>
      )}
    </AdminLayout>
  );
}

export default SystemLogsScreen;
