import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useChallengeAnalytics } from '../../../hooks/useAdminChallenges';
import { AdminLayout } from '../layout/AdminLayout';

function ChallengeAnalyticsScreen() {
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useChallengeAnalytics();

  if (isLoading) return <LoadingSpinner fullScreen label="Loading challenge analytics..." />;

  return (
    <AdminLayout title="Challenge Analytics" permissions={permissions}>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card variant="flat"><p className="text-xs uppercase font-bold text-slate-500">Total Challenges</p><p className="text-2xl font-black text-slate-900">{data?.totalChallenges ?? 0}</p></Card>
        <Card variant="flat"><p className="text-xs uppercase font-bold text-slate-500">Active</p><p className="text-2xl font-black text-slate-900">{data?.activeChallenges ?? 0}</p></Card>
        <Card variant="flat"><p className="text-xs uppercase font-bold text-slate-500">Completed</p><p className="text-2xl font-black text-slate-900">{data?.completedChallenges ?? 0}</p></Card>
        <Card variant="flat"><p className="text-xs uppercase font-bold text-slate-500">Avg Participants</p><p className="text-2xl font-black text-slate-900">{data?.avgParticipants ?? 0}</p></Card>
        <Card variant="flat"><p className="text-xs uppercase font-bold text-slate-500">Avg Completion %</p><p className="text-2xl font-black text-slate-900">{data?.avgCompletionRate ?? 0}</p></Card>
      </div>

      <Card className="mt-3">
        <p className="text-sm font-black text-slate-900">Challenge Types</p>
        <div className="mt-2 space-y-2">
          {Object.entries(data?.byType ?? {}).map(([type, count]) => (
            <div key={type} className="flex items-center justify-between rounded-lg border border-slate-200 p-2">
              <span className="text-sm text-slate-700 capitalize">{type}</span>
              <span className="text-sm font-bold text-slate-900">{count}</span>
            </div>
          ))}
        </div>
      </Card>
    </AdminLayout>
  );
}

export default ChallengeAnalyticsScreen;
