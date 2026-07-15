import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useChallengeAnalytics } from '../../../hooks/useAdminChallenges';
import { AdminLayout } from '../layout/AdminLayout';

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card variant="flat">
      <p className="text-[10px] uppercase font-bold tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-black text-slate-900 mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </Card>
  );
}

function BarRow({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs capitalize text-slate-700">{label}</span>
        <span className="text-xs font-bold text-slate-900">{value} <span className="text-slate-400 font-normal">({pct}%)</span></span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100">
        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ChallengeAnalyticsScreen() {
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading, isRefetching, refetch, dataUpdatedAt } = useChallengeAnalytics();

  if (isLoading) return <LoadingSpinner fullScreen label="Loading challenge analytics..." />;

  const d = data;
  if (!d) return (
    <AdminLayout title="Challenge Analytics" permissions={permissions}>
      <Card><p className="text-sm text-slate-600">No analytics data available.</p></Card>
    </AdminLayout>
  );

  const totalType = Object.values(d.byType).reduce((s, v) => s + v, 0);
  const totalCategory = Object.values(d.byCategory).reduce((s, v) => s + v, 0);
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : null;

  return (
    <AdminLayout title="Challenge Analytics" permissions={permissions}>
      <div className="flex items-center justify-end gap-3 mb-2">
        {lastUpdated && (
          <span className="text-[11px] text-slate-400">Updated {lastUpdated}</span>
        )}
        <button
          className="h-8 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
          disabled={isRefetching}
          onClick={() => refetch()}
        >
          {isRefetching ? '…' : '↻'} {isRefetching ? 'Refreshing' : 'Refresh'}
        </button>
      </div>

      {/* Status overview */}
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Status Overview</p>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
        <MetricCard label="Total Challenges" value={d.totalChallenges} />
        <MetricCard label="Active" value={d.activeChallenges} />
        <MetricCard label="Upcoming" value={d.upcomingChallenges} />
        <MetricCard label="Completed" value={d.completedChallenges} />
        <MetricCard label="Archived" value={d.archivedChallenges} />
        <MetricCard label="Draft / Inactive" value={d.draftChallenges} />
        <MetricCard label="New (30 days)" value={d.recentlyCreated} />
        <MetricCard label="Avg Participants" value={d.avgParticipants} />
        <MetricCard label="Avg Completion %" value={`${d.avgCompletionRate}%`} sub="across all member logs" />
      </div>

      {/* By type */}
      <Card className="mb-3">
        <p className="text-sm font-black text-slate-900 mb-3">By Challenge Type</p>
        <div className="space-y-2.5">
          {Object.entries(d.byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
            <BarRow key={type} label={type} value={count} total={totalType} />
          ))}
        </div>
        {Object.keys(d.completionRateByType).length > 0 && (
          <>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mt-4 mb-2">Avg Completion Rate by Type</p>
            <div className="space-y-1">
              {Object.entries(d.completionRateByType).sort((a, b) => b[1] - a[1]).map(([type, rate]) => (
                <div key={type} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-1.5">
                  <span className="text-xs capitalize text-slate-700">{type}</span>
                  <span className="text-xs font-bold text-slate-900">{rate}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* By category */}
      <Card className="mb-3">
        <p className="text-sm font-black text-slate-900 mb-3">By Category</p>
        <div className="space-y-2.5">
          {Object.entries(d.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
            <BarRow key={cat} label={cat} value={count} total={totalCategory} />
          ))}
        </div>
      </Card>

      {/* Top by participants */}
      {d.topByParticipants.length > 0 && (
        <Card className="mb-3">
          <p className="text-sm font-black text-slate-900 mb-3">Top by Participants</p>
          <div className="space-y-1">
            {d.topByParticipants.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-1.5">
                <span className="text-[10px] font-black text-slate-400 w-4">{idx + 1}</span>
                <span className="flex-1 text-xs text-slate-700 truncate">{item.name}</span>
                <span className="text-xs font-bold text-slate-900">{item.participantCount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="text-[10px] text-slate-400 text-center mt-2">
        Analytics are computed client-side from Firestore reads. High-volume data may benefit from Cloud Function aggregation.
      </p>
    </AdminLayout>
  );
}

export default ChallengeAnalyticsScreen;
