import { useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useDonationCampaigns } from '../../../hooks/useAdminDonations';
import { AdminLayout } from '../layout/AdminLayout';

function DonationCampaignsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useDonationCampaigns();

  if (isLoading) return <LoadingSpinner fullScreen label="Loading donation campaigns..." />;

  return (
    <AdminLayout title="Donation Campaigns" permissions={permissions}>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">Track campaign goals, raised amounts, and donor reach.</p>
          <div className="flex gap-2">
            <button className="h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold" onClick={() => navigate('/app/admin/donations/transactions')}>Transactions</button>
            <button className="h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold" onClick={() => navigate('/app/admin/donations/reports')}>Reports</button>
          </div>
        </div>
      </Card>
      <Card className="mt-3">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-2 pr-3">Campaign</th>
                <th className="py-2 pr-3">Goal</th>
                <th className="py-2 pr-3">Raised</th>
                <th className="py-2 pr-3">Donors</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((campaign) => (
                <tr key={campaign.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-semibold text-slate-900">{campaign.name}</td>
                  <td className="py-2 pr-3 text-slate-700">{campaign.goalAmount.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-slate-700">{campaign.raisedAmount.toLocaleString()}</td>
                  <td className="py-2 pr-3 text-slate-700">{campaign.donorCount}</td>
                  <td className="py-2 pr-3 text-slate-700 capitalize">{campaign.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(data ?? []).length === 0 ? <p className="text-sm text-slate-600 mt-2">No donation campaigns yet.</p> : null}
      </Card>
    </AdminLayout>
  );
}

export default DonationCampaignsScreen;
