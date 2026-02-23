import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/Mobile';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useCreateAdminExercise } from '../../../hooks/useAdminExercises';
import { AdminLayout } from '../layout/AdminLayout';
import { ExerciseForm } from './ExerciseForm';
import { defaultExerciseInput } from './exerciseFormUtils';

function AddExerciseScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions } = useAdminPermissions(user?.uid);
  const createMutation = useCreateAdminExercise();
  const [form, setForm] = useState(defaultExerciseInput);

  const onSave = async (resetAfter: boolean) => {
    try {
      const id = await createMutation.mutateAsync(form);
      showToast('Exercise created.', 'success');
      if (resetAfter) {
        setForm(defaultExerciseInput);
      } else {
        navigate(`/app/admin/exercises/${id}/edit`);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not create exercise.', 'error');
    }
  };

  return (
    <AdminLayout title="Add Exercise" permissions={permissions}>
      <Card>
        <ExerciseForm value={form} onChange={setForm} />
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50"
            disabled={!permissions.canCreateExercises || createMutation.isPending}
            onClick={() => onSave(false)}
          >
            Publish
          </button>
          <button
            className="h-10 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold disabled:opacity-50"
            disabled={!permissions.canCreateExercises || createMutation.isPending}
            onClick={() => onSave(true)}
          >
            Save & Add Another
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

export default AddExerciseScreen;
