import { useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useAdminDashboard } from '../../../hooks/useAdminDashboard';
import { AdminLayout } from '../layout/AdminLayout';

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card variant="flat">
      <p className="text-[11px] uppercase font-bold text-slate-500">{label}</p>
      <p className="text-2xl font-black text-slate-900 mt-1">{value}</p>
    </Card>
  );
}

function AdminDashboardScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useAdminDashboard();

  if (isLoading) return <LoadingSpinner fullScreen label="Loading admin dashboard..." />;

  return (
    <AdminLayout title="Dashboard Overview" permissions={permissions}>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Total Users" value={data?.totalUsers ?? 0} />
        <StatCard label="Active Users (7d)" value={data?.activeUsers7d ?? 0} />
        <StatCard label="Exercises" value={data?.totalExercises ?? 0} />
        <StatCard label="Active Challenges" value={data?.activeChallenges ?? 0} />
        <StatCard label="Total Workouts" value={data?.totalWorkouts ?? 0} />
        <StatCard label="Total Groups" value={data?.totalGroups ?? 0} />
      </div>

      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900">Recent Activity</h2>
          <button className="text-xs font-bold text-primary" onClick={() => navigate('/app/admin/challenges/pending')}>
            Go To Moderation
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {(data?.recentActivity ?? []).length === 0 ? (
            <p className="text-sm text-slate-600">No recent activity yet.</p>
          ) : (
            (data?.recentActivity ?? []).map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-slate-800">{item.message}</p>
                <p className="text-[11px] text-slate-500 mt-1">{new Date(item.at).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="mt-4">
        <div className="flex flex-wrap gap-2">
          <button className="h-10 px-3 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/admin/challenges/active')}>Active Challenges</button>
          <button className="h-10 px-3 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/admin/donations/campaigns')}>Donations</button>
          <button className="h-10 px-3 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/admin/content/interests-goals')}>Content</button>
          <button className="h-10 px-3 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/admin/settings')}>Settings</button>
        </div>
      </Card>
    </AdminLayout>
  );
}

export default AdminDashboardScreen;
