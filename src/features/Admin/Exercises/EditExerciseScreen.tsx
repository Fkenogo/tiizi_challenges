import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, EmptyState, LoadingSpinner } from '../../../components/Mobile';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useAdminExercise, useUpdateAdminExercise } from '../../../hooks/useAdminExercises';
import { AdminExerciseInput } from '../../../services/adminExerciseService';
import { AdminLayout } from '../layout/AdminLayout';
import { ExerciseForm } from './ExerciseForm';
import { defaultExerciseInput } from './exerciseFormUtils';

function EditExerciseScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useAdminExercise(id);
  const updateMutation = useUpdateAdminExercise();
  const [form, setForm] = useState<AdminExerciseInput>(defaultExerciseInput);

  useEffect(() => {
    if (!data) return;
    const { id: _id, ...rest } = data;
    setForm(rest);
  }, [data]);

  const onSave = async () => {
    if (!id) return;
    try {
      await updateMutation.mutateAsync({ id, input: form });
      showToast('Exercise updated.', 'success');
      navigate('/app/admin/exercises');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update exercise.', 'error');
    }
  };

  if (isLoading) return <LoadingSpinner fullScreen label="Loading exercise..." />;

  if (!data) {
    return (
      <EmptyState
        icon={<span>🏋️</span>}
        title="Exercise not found"
        message="Could not load this exercise for editing."
        action={(
          <button className="h-11 px-4 rounded-xl bg-primary text-white text-sm font-bold" onClick={() => navigate('/app/admin/exercises')}>
            Back to Exercise List
          </button>
        )}
      />
    );
  }

  return (
    <AdminLayout title={`Edit Exercise: ${data.name}`} permissions={permissions}>
      <Card>
        <ExerciseForm value={form} onChange={setForm} />
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50"
            disabled={!permissions.canEditExercises || updateMutation.isPending}
            onClick={onSave}
          >
            Save Changes
          </button>
          <button
            className="h-10 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold"
            onClick={() => navigate('/app/admin/exercises')}
          >
            Cancel
          </button>
        </div>
      </Card>
    </AdminLayout>
  );
}

export default EditExerciseScreen;
