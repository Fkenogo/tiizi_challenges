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
      <p className="text-xs text-slate-500 mb-3">
        Amounts shown are mixed currencies (KES, RWF, UGX). Totals below are numeric sums — not currency-converted.
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card variant="flat">
          <p className="text-xs uppercase font-bold text-slate-500">All-Time Confirmed</p>
          <p className="text-2xl font-black text-slate-900">{data?.totalDonationsAllTime.toLocaleString() ?? 0}</p>
          <p className="text-xs text-slate-400">confirmed by users</p>
        </Card>
        <Card variant="flat">
          <p className="text-xs uppercase font-bold text-slate-500">Confirmed (30 days)</p>
          <p className="text-2xl font-black text-slate-900">{data?.totalDonations30d.toLocaleString() ?? 0}</p>
        </Card>
        <Card variant="flat">
          <p className="text-xs uppercase font-bold text-slate-500">Avg Contribution</p>
          <p className="text-2xl font-black text-slate-900">{data?.avgDonationAmount.toLocaleString() ?? 0}</p>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
        <Card variant="flat">
          <p className="text-xs uppercase font-bold text-slate-500">Platform Support</p>
          <p className="text-xl font-black text-slate-900">{data?.bySource.platform_support.toLocaleString() ?? 0}</p>
        </Card>
        <Card variant="flat">
          <p className="text-xs uppercase font-bold text-slate-500">Challenge Causes</p>
          <p className="text-xl font-black text-slate-900">{data?.bySource.challenge_cause.toLocaleString() ?? 0}</p>
        </Card>
        <Card variant="flat">
          <p className="text-xs uppercase font-bold text-slate-500">Legacy Donations</p>
          <p className="text-xl font-black text-slate-900">{data?.bySource.legacy.toLocaleString() ?? 0}</p>
        </Card>
      </div>

      <Card className="mt-3">
        <p className="text-sm font-black text-slate-900">Top Campaigns by Confirmed Amount</p>
        <div className="mt-2 space-y-2">
          {(data?.topCampaigns ?? []).map((item) => (
            <div key={item.campaignId} className="rounded-lg border border-slate-200 p-2 flex items-center justify-between">
              <span className="text-sm text-slate-700">{item.name}</span>
              <span className="text-sm font-bold text-slate-900">
                {item.currency} {item.raisedAmount.toLocaleString()}
              </span>
            </div>
          ))}
          {(data?.topCampaigns ?? []).length === 0 && (
            <p className="text-sm text-slate-500">No campaign data yet.</p>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          "Confirmed" = marked as sent by user. Tiizi has not verified these payments.
        </p>
      </Card>
    </AdminLayout>
  );
}

export default DonationReportsScreen;
