import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useAdminWellnessActivities, useDeleteAdminWellnessActivity } from '../../../hooks/useAdminWellnessActivities';
import { AdminLayout } from '../layout/AdminLayout';

function WellnessActivityListScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data = [], isLoading } = useAdminWellnessActivities();
  const deleteMutation = useDeleteAdminWellnessActivity();

  const rows = useMemo(() => [...data].sort((a, b) => a.name.localeCompare(b.name)), [data]);

  const handleDelete = async (id: string, name: string) => {
    const confirmed = window.confirm(`Delete wellness activity "${name}"? This cannot be undone.`);
    if (!confirmed) return;
    await deleteMutation.mutateAsync(id);
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
                  <td className="py-2 space-x-2">
                    <button
                      className="text-primary font-bold disabled:opacity-50"
                      disabled={!permissions.canModerateChallenges}
                      onClick={() => navigate(`/app/admin/wellness-activities/${encodeURIComponent(row.id)}/edit`)}
                    >
                      Edit
                    </button>
                    <button
                      className="text-red-600 font-bold disabled:opacity-50"
                      disabled={!permissions.canModerateChallenges || deleteMutation.isPending}
                      onClick={() => handleDelete(row.id, row.name)}
                    >
                      Delete
                    </button>
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
