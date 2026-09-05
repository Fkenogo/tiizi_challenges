import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useAdminWellnessActivities, useSetWellnessActivityLifecycleStatus } from '../../../hooks/useAdminWellnessActivities';
import { lifecycleLabel } from '../../../utils/knowledgeLifecycle';
import { AdminLayout } from '../layout/AdminLayout';

function WellnessActivityListScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data = [], isLoading } = useAdminWellnessActivities();
  const lifecycleMutation = useSetWellnessActivityLifecycleStatus();

  const rows = useMemo(() => [...data].sort((a, b) => a.name.localeCompare(b.name)), [data]);

  // Retirement replaces destructive deletion for canonical Knowledge —
  // retired records stay readable by ID so historical challenges survive.
  const handleSetStatus = async (id: string, name: string, status: 'draft' | 'published' | 'retired') => {
    const confirmed = window.confirm(
      status === 'retired'
        ? `Retire wellness activity "${name}"? It will no longer be offered for new challenges, but existing challenges keep working.`
        : `Set wellness activity "${name}" to ${status}?`,
    );
    if (!confirmed) return;
    await lifecycleMutation.mutateAsync({ id, status });
  };

  if (isLoading) return <LoadingSpinner fullScreen label="Loading wellness activities..." />;

  return (
    <AdminLayout title="Wellness Activities" permissions={permissions}>
      <Card>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">Manage the wellness activity library used in wellness template creation.</p>
          <button
            className="h-10 px-3 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50"
            disabled={!permissions.canModerateChallenges}
            onClick={() => navigate('/app/admin/wellness-activities/add')}
          >
            Add Wellness Activity
          </button>
        </div>
      </Card>

      <Card className="mt-3">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Difficulty</th>
                <th className="py-2 pr-3">Metric</th>
                <th className="py-2 pr-3">Popular</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-semibold text-slate-900">{row.name}</td>
                  <td className="py-2 pr-3 text-slate-700 capitalize">{row.category}</td>
                  <td className="py-2 pr-3 text-slate-700 capitalize">{row.difficulty}</td>
                  <td className="py-2 pr-3 text-slate-700">{row.defaultTargetValue} {row.defaultMetricUnit}</td>
                  <td className="py-2 pr-3 text-slate-700">{row.popular ? 'Yes' : 'No'}</td>
                  <td className="py-2 pr-3 text-slate-700">{lifecycleLabel(row.lifecycleStatus)}</td>
                  <td className="py-2 space-x-2">
                    <button
                      className="text-primary font-bold disabled:opacity-50"
                      disabled={!permissions.canModerateChallenges}
                      onClick={() => navigate(`/app/admin/wellness-activities/${encodeURIComponent(row.id)}/edit`)}
                    >
                      Edit
                    </button>
                    {row.lifecycleStatus === 'retired' ? (
                      <button
                        className="text-emerald-600 font-bold disabled:opacity-50"
                        disabled={!permissions.canModerateChallenges || lifecycleMutation.isPending}
                        onClick={() => handleSetStatus(row.id, row.name, 'published')}
                      >
                        Republish
                      </button>
                    ) : (
                      <>
                        {row.lifecycleStatus === 'draft' && (
                          <button
                            className="text-emerald-600 font-bold disabled:opacity-50"
                            disabled={!permissions.canModerateChallenges || lifecycleMutation.isPending}
                            onClick={() => handleSetStatus(row.id, row.name, 'published')}
                          >
                            Publish
                          </button>
                        )}
                        <button
                          className="text-red-600 font-bold disabled:opacity-50"
                          disabled={!permissions.canModerateChallenges || lifecycleMutation.isPending}
                          onClick={() => handleSetStatus(row.id, row.name, 'retired')}
                        >
                          Retire
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">No wellness activities yet.</p>
        )}
      </Card>
    </AdminLayout>
  );
}

export default WellnessActivityListScreen;
