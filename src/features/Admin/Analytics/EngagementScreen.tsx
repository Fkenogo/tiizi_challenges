import { useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useAdminEngagement } from '../../../hooks/useAdminAnalytics';
import { AdminLayout } from '../layout/AdminLayout';

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card variant="flat">
      <p className="text-xs uppercase font-bold text-slate-500">{label}</p>
      <p className="text-2xl font-black text-slate-900 mt-1">{value}</p>
    </Card>
  );
}

function EngagementScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useAdminEngagement();

  if (isLoading) return <LoadingSpinner fullScreen label="Loading engagement analytics..." />;

  return (
    <AdminLayout title="Engagement Analytics" permissions={permissions}>
      {!permissions.canViewEngagementAnalytics ? (
        <Card>
          <p className="text-sm text-slate-700">You do not have permission to view engagement analytics.</p>
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

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
        <Metric label="DAU" value={data?.dau ?? 0} />
        <Metric label="WAU" value={data?.wau ?? 0} />
        <Metric label="MAU" value={data?.mau ?? 0} />
        <Metric label="Workouts (30d)" value={data?.workoutsLast30d ?? 0} />
        <Metric label="Avg workouts/user (30d)" value={data?.avgWorkoutsPerActiveUser30d ?? 0} />
        <Metric label="Challenge participants (30d)" value={data?.challengeParticipationUsers30d ?? 0} />
      </div>

      <Card className="mt-3">
        <p className="text-sm text-slate-700">
          Group-active users in last 30 days: <span className="font-bold text-slate-900">{data?.groupActiveUsers30d ?? 0}</span>
        </p>
      </Card>
        </>
      )}
    </AdminLayout>
  );
}

export default EngagementScreen;
