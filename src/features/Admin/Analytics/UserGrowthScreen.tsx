import { useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useAdminUserGrowth } from '../../../hooks/useAdminAnalytics';
import { AdminLayout } from '../layout/AdminLayout';

function UserGrowthScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useAdminUserGrowth(30);

  if (isLoading) return <LoadingSpinner fullScreen label="Loading user growth..." />;

  return (
    <AdminLayout title="User Growth (30d)" permissions={permissions}>
      {!permissions.canViewUserGrowthAnalytics ? (
        <Card>
          <p className="text-sm text-slate-700">You do not have permission to view user growth analytics.</p>
          <button className="mt-3 h-10 px-3 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/admin/analytics')}>
            Back to Overview
          </button>
        </Card>
      ) : (
        <>
      <Card>
        <button className="h-10 px-3 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/admin/analytics')}>
          Back to Overview
        </button>
      </Card>

      <Card className="mt-3">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Signups</th>
                <th className="py-2 pr-3">Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((row) => (
                <tr key={row.date} className="border-b border-slate-100">
                  <td className="py-2 pr-3">{row.date}</td>
                  <td className="py-2 pr-3 font-semibold text-slate-900">{row.signups}</td>
                  <td className="py-2 pr-3 text-slate-700">{row.cumulativeUsers}</td>
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

export default UserGrowthScreen;
