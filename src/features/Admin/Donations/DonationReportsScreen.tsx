import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useDonationReports } from '../../../hooks/useAdminDonations';
import { AdminLayout } from '../layout/AdminLayout';

function DonationReportsScreen() {
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useDonationReports();

  if (isLoading) return <LoadingSpinner fullScreen label="Loading donation reports..." />;

  return (
    <AdminLayout title="Donation Reports" permissions={permissions}>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card variant="flat"><p className="text-xs uppercase font-bold text-slate-500">All-Time Donations</p><p className="text-2xl font-black text-slate-900">{data?.totalDonationsAllTime.toLocaleString() ?? 0}</p></Card>
        <Card variant="flat"><p className="text-xs uppercase font-bold text-slate-500">Donations (30d)</p><p className="text-2xl font-black text-slate-900">{data?.totalDonations30d.toLocaleString() ?? 0}</p></Card>
        <Card variant="flat"><p className="text-xs uppercase font-bold text-slate-500">Avg Donation</p><p className="text-2xl font-black text-slate-900">{data?.avgDonationAmount.toLocaleString() ?? 0}</p></Card>
      </div>

      <Card className="mt-3">
        <p className="text-sm font-black text-slate-900">Top Campaigns</p>
        <div className="mt-2 space-y-2">
          {(data?.topCampaigns ?? []).map((item) => (
            <div key={item.campaignId} className="rounded-lg border border-slate-200 p-2 flex items-center justify-between">
              <span className="text-sm text-slate-700">{item.name}</span>
              <span className="text-sm font-bold text-slate-900">{item.raisedAmount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </Card>
    </AdminLayout>
  );
}

export default DonationReportsScreen;
