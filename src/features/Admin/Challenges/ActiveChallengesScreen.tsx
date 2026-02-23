import { useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useActiveChallenges } from '../../../hooks/useAdminChallenges';
import { AdminLayout } from '../layout/AdminLayout';

function ActiveChallengesScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useActiveChallenges();

  if (isLoading) return <LoadingSpinner fullScreen label="Loading active challenges..." />;

  return (
    <AdminLayout title="Active Challenges" permissions={permissions}>
      <Card>
        <div className="flex flex-wrap gap-2">
          <button className="h-10 px-3 rounded-lg bg-primary text-white text-sm font-bold" onClick={() => navigate('/app/admin/challenges/create')}>
            Create Challenge
          </button>
          <button className="h-10 px-3 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/admin/challenges/analytics')}>
            Challenge Analytics
          </button>
        </div>
      </Card>

      <Card className="mt-3">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Participants</th>
                <th className="py-2 pr-3">Start</th>
                <th className="py-2 pr-3">End</th>
                <th className="py-2 pr-3">Progress</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-semibold text-slate-900">{row.name}</td>
                  <td className="py-2 pr-3 text-slate-700">{Number((row as { participantCount?: number }).participantCount ?? 0)}</td>
                  <td className="py-2 pr-3 text-slate-700">{new Date(row.startDate).toLocaleDateString()}</td>
                  <td className="py-2 pr-3 text-slate-700">{new Date(row.endDate).toLocaleDateString()}</td>
                  <td className="py-2 pr-3 text-slate-700">{Number((row as { progress?: number }).progress ?? 0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(data ?? []).length === 0 ? <p className="text-sm text-slate-600 mt-2">No active challenges.</p> : null}
      </Card>
    </AdminLayout>
  );
}

export default ActiveChallengesScreen;
