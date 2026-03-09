import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, EmptyState, LoadingSpinner } from '../../../components/Mobile';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useAdminWellnessActivity, useUpdateAdminWellnessActivity } from '../../../hooks/useAdminWellnessActivities';
import type { AdminWellnessActivityInput } from '../../../services/adminWellnessActivityService';
import { AdminLayout } from '../layout/AdminLayout';
import { WellnessActivityForm } from './WellnessActivityForm';
import { defaultWellnessActivityInput } from './wellnessActivityFormUtils';

function normalizeWellnessInput(input: Partial<AdminWellnessActivityInput>): AdminWellnessActivityInput {
  return {
    ...defaultWellnessActivityInput,
    ...input,
    protocolSteps: input.protocolSteps ?? defaultWellnessActivityInput.protocolSteps,
    benefits: input.benefits ?? defaultWellnessActivityInput.benefits,
    guidelines: input.guidelines ?? defaultWellnessActivityInput.guidelines,
    warnings: input.warnings ?? defaultWellnessActivityInput.warnings,
    contraindications: input.contraindications ?? defaultWellnessActivityInput.contraindications,
    tags: input.tags ?? defaultWellnessActivityInput.tags,
    bonusConditions: input.bonusConditions ?? defaultWellnessActivityInput.bonusConditions,
  };
}

function EditWellnessActivityScreen() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const id = params.id ? decodeURIComponent(params.id) : undefined;
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useAdminWellnessActivity(id);
  const updateMutation = useUpdateAdminWellnessActivity();
  const [form, setForm] = useState<AdminWellnessActivityInput>(defaultWellnessActivityInput);

  useEffect(() => {
    if (!data) return;
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = data;
    setForm(normalizeWellnessInput(rest));
  }, [data]);

  const onSave = async () => {
    if (!id) return;
    try {
      await updateMutation.mutateAsync({ id, input: form });
      showToast('Wellness activity updated.', 'success');
      navigate('/app/admin/wellness-activities');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update wellness activity.', 'error');
    }
  };

  if (isLoading) return <LoadingSpinner fullScreen label="Loading wellness activity..." />;

  if (!data) {
    return (
      <EmptyState
        icon={<span>✨</span>}
        title="Wellness activity not found"
        message="Could not load this wellness activity for editing."
        action={(
          <button
            className="h-11 px-4 rounded-xl bg-primary text-white text-sm font-bold"
            onClick={() => navigate('/app/admin/wellness-activities')}
          >
            Back to Wellness Activities
          </button>
        )}
      />
    );
  }

  return (
    <AdminLayout title={`Edit Wellness Activity: ${data.name}`} permissions={permissions}>
      <Card>
        <WellnessActivityForm value={form} onChange={setForm} />
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50"
            disabled={!permissions.canModerateChallenges || updateMutation.isPending}
            onClick={onSave}
          >
            Save Changes
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

export default EditWellnessActivityScreen;
