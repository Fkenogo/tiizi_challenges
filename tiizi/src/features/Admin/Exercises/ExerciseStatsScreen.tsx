import { useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useAdminExerciseStats } from '../../../hooks/useAdminExercises';
import { AdminLayout } from '../layout/AdminLayout';

function ExerciseStatsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useAdminExerciseStats();

  if (isLoading) return <LoadingSpinner fullScreen label="Loading exercise stats..." />;

  return (
    <AdminLayout title="Exercise Analytics" permissions={permissions}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card variant="flat">
          <p className="text-[11px] uppercase font-bold text-slate-500">Total Exercises</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{data?.totalExercises ?? 0}</p>
        </Card>
        <Card variant="flat">
          <p className="text-[11px] uppercase font-bold text-slate-500">Tier Distribution</p>
          <div className="mt-2 space-y-1">
            {Object.entries(data?.byTier1 ?? {}).map(([key, value]) => (
              <p key={key} className="text-sm text-slate-700">{key}: <span className="font-bold">{value}</span></p>
            ))}
          </div>
        </Card>
        <Card variant="flat">
          <p className="text-[11px] uppercase font-bold text-slate-500">Difficulty Distribution</p>
          <div className="mt-2 space-y-1">
            {Object.entries(data?.byDifficulty ?? {}).map(([key, value]) => (
              <p key={key} className="text-sm text-slate-700">{key}: <span className="font-bold">{value}</span></p>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-3">
        <p className="text-sm font-bold text-slate-900">Most Used in Challenges</p>
        <div className="mt-2 space-y-2">
          {(data?.mostUsedInChallenges ?? []).map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 p-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">{item.name}</p>
              <p className="text-xs font-bold text-primary">{item.usageCount} uses</p>
            </div>
          ))}
        </div>
        <button className="mt-3 h-10 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold disabled:opacity-50" disabled={!permissions.canViewExerciseStats} onClick={() => navigate('/app/admin/exercises')}>
          Back to Exercise List
        </button>
      </Card>
    </AdminLayout>
  );
}

export default ExerciseStatsScreen;
