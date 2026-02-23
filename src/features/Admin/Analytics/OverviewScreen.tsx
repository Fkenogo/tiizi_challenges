import { useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useAdminOverviewMetrics } from '../../../hooks/useAdminAnalytics';
import { AdminLayout } from '../layout/AdminLayout';

function OverviewScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useAdminOverviewMetrics();

  if (isLoading) return <LoadingSpinner fullScreen label="Loading analytics overview..." />;

  return (
    <AdminLayout title="Analytics Overview" permissions={permissions}>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card variant="flat"><p className="text-xs text-slate-500 uppercase font-bold">Total Users</p><p className="text-2xl font-black">{data?.totalUsers ?? 0}</p></Card>
        <Card variant="flat"><p className="text-xs text-slate-500 uppercase font-bold">Active Users (7d)</p><p className="text-2xl font-black">{data?.activeUsers7d ?? 0}</p></Card>
        <Card variant="flat"><p className="text-xs text-slate-500 uppercase font-bold">Total Exercises</p><p className="text-2xl font-black">{data?.totalExercises ?? 0}</p></Card>
        <Card variant="flat"><p className="text-xs text-slate-500 uppercase font-bold">Active Challenges</p><p className="text-2xl font-black">{data?.activeChallenges ?? 0}</p></Card>
        <Card variant="flat"><p className="text-xs text-slate-500 uppercase font-bold">Workouts Logged</p><p className="text-2xl font-black">{data?.totalWorkouts ?? 0}</p></Card>
        <Card variant="flat"><p className="text-xs text-slate-500 uppercase font-bold">Groups</p><p className="text-2xl font-black">{data?.totalGroups ?? 0}</p></Card>
      </div>

      <Card className="mt-3">
        <div className="flex flex-wrap gap-2">
          <button className="h-10 px-3 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50" disabled={!permissions.canViewUserGrowthAnalytics} onClick={() => navigate('/app/admin/analytics/user-growth')}>User Growth</button>
          <button className="h-10 px-3 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold disabled:opacity-50" disabled={!permissions.canViewEngagementAnalytics} onClick={() => navigate('/app/admin/analytics/engagement')}>Engagement</button>
          <button className="h-10 px-3 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold disabled:opacity-50" disabled={!permissions.canViewRevenueAnalytics} onClick={() => navigate('/app/admin/analytics/revenue')}>Revenue</button>
        </div>
      </Card>

      <Card className="mt-3">
        <p className="text-sm font-bold text-slate-900">Recent Activity</p>
        <div className="mt-2 space-y-2">
          {(data?.recentActivity ?? []).map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 p-2">
              <p className="text-sm text-slate-800">{item.message}</p>
              <p className="text-xs text-slate-500 mt-1">{new Date(item.at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </Card>
    </AdminLayout>
  );
}

export default OverviewScreen;
