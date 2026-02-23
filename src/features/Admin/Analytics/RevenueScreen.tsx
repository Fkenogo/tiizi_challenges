import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useAdminRevenue } from '../../../hooks/useAdminAnalytics';
import { AdminLayout } from '../layout/AdminLayout';

function RevenueScreen() {
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useAdminRevenue();

  if (isLoading) return <LoadingSpinner fullScreen label="Loading revenue analytics..." />;

  return (
    <AdminLayout title="Revenue Analytics" permissions={permissions}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card variant="flat"><p className="text-xs uppercase font-bold text-slate-500">Total Donations</p><p className="text-2xl font-black text-slate-900">{data?.totalDonations.toLocaleString() ?? 0}</p></Card>
        <Card variant="flat"><p className="text-xs uppercase font-bold text-slate-500">Donations (30d)</p><p className="text-2xl font-black text-slate-900">{data?.donations30d.toLocaleString() ?? 0}</p></Card>
        <Card variant="flat"><p className="text-xs uppercase font-bold text-slate-500">Average Donation</p><p className="text-2xl font-black text-slate-900">{data?.averageDonation.toLocaleString() ?? 0}</p></Card>
        <Card variant="flat"><p className="text-xs uppercase font-bold text-slate-500">Active Campaigns</p><p className="text-2xl font-black text-slate-900">{data?.activeCampaigns ?? 0}</p></Card>
      </div>
    </AdminLayout>
  );
}

export default RevenueScreen;
