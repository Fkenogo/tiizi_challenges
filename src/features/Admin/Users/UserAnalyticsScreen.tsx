import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useAdminUserAnalytics } from '../../../hooks/useAdminUsers';
import { AdminLayout } from '../layout/AdminLayout';

function UserAnalyticsScreen() {
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useAdminUserAnalytics();

  if (isLoading) return <LoadingSpinner fullScreen label="Loading user analytics..." />;

  return (
    <AdminLayout title="User Analytics" permissions={permissions}>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card variant="flat"><p className="text-xs uppercase font-bold text-slate-500">Total Users</p><p className="text-2xl font-black text-slate-900">{data?.totalUsers ?? 0}</p></Card>
        <Card variant="flat"><p className="text-xs uppercase font-bold text-slate-500">Active 7d</p><p className="text-2xl font-black text-slate-900">{data?.active7d ?? 0}</p></Card>
        <Card variant="flat"><p className="text-xs uppercase font-bold text-slate-500">Active 30d</p><p className="text-2xl font-black text-slate-900">{data?.active30d ?? 0}</p></Card>
        <Card variant="flat"><p className="text-xs uppercase font-bold text-slate-500">New Users 7d</p><p className="text-2xl font-black text-slate-900">{data?.newUsers7d ?? 0}</p></Card>
        <Card variant="flat"><p className="text-xs uppercase font-bold text-slate-500">New Users 30d</p><p className="text-2xl font-black text-slate-900">{data?.newUsers30d ?? 0}</p></Card>
        <Card variant="flat"><p className="text-xs uppercase font-bold text-slate-500">Churn Estimate 30d</p><p className="text-2xl font-black text-slate-900">{data?.churnEstimate30d ?? 0}</p></Card>
      </div>
    </AdminLayout>
  );
}

export default UserAnalyticsScreen;
