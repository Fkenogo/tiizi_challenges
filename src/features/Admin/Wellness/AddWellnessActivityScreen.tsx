import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/Mobile';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useCreateAdminWellnessActivity } from '../../../hooks/useAdminWellnessActivities';
import { AdminLayout } from '../layout/AdminLayout';
import { WellnessActivityForm } from './WellnessActivityForm';
import { defaultWellnessActivityInput } from './wellnessActivityFormUtils';

function AddWellnessActivityScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions } = useAdminPermissions(user?.uid);
  const createMutation = useCreateAdminWellnessActivity();
  const [form, setForm] = useState(defaultWellnessActivityInput);

  const onSave = async (resetAfter: boolean) => {
    try {
      const id = await createMutation.mutateAsync(form);
      showToast('Wellness activity created.', 'success');
      if (resetAfter) {
        setForm(defaultWellnessActivityInput);
      } else {
        navigate(`/app/admin/wellness-activities/${id}/edit`);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not create wellness activity.', 'error');
    }
  };

  return (
    <AdminLayout title="Add Wellness Activity" permissions={permissions}>
      <Card>
        <WellnessActivityForm value={form} onChange={setForm} />
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50"
            disabled={!permissions.canModerateChallenges || createMutation.isPending}
            onClick={() => onSave(false)}
          >
            Publish
          </button>
          <button
            className="h-10 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold disabled:opacity-50"
            disabled={!permissions.canModerateChallenges || createMutation.isPending}
            onClick={() => onSave(true)}
          >
            Save & Add Another
          </button>
          <button
            className="h-10 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold"
            onClick={() => navigate('/app/admin/wellness-activities')}
          >
            Cancel
          </button>
        </div>
      </Card>
    </AdminLayout>
  );
}

export default AddWellnessActivityScreen;
