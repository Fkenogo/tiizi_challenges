import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/Mobile';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useBulkImportAdminExercises } from '../../../hooks/useAdminExercises';
import { adminExerciseService } from '../../../services/adminExerciseService';
import { AdminLayout } from '../layout/AdminLayout';

function BulkImportScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions } = useAdminPermissions(user?.uid);
  const bulkImportMutation = useBulkImportAdminExercises();
  const [raw, setRaw] = useState('');

  const validation = useMemo(() => {
    if (!raw.trim()) return { valid: [], errors: [] as string[] };
    try {
      const parsed = JSON.parse(raw) as unknown;
      return adminExerciseService.validateBulkImport(parsed);
    } catch {
      return { valid: [], errors: ['Invalid JSON format.'] };
    }
  }, [raw]);

  const onImport = async () => {
    if (validation.valid.length === 0) {
      showToast('No valid exercises to import.', 'error');
      return;
    }
    const result = await bulkImportMutation.mutateAsync(validation.valid);
    if (result.errors.length > 0) {
      showToast(`Imported ${result.importedCount}/${result.validCount} exercises. Some rows failed.`, 'info');
      return;
    }
    showToast(`Imported ${result.importedCount} exercises successfully.`, 'success');
    navigate('/app/admin/exercises');
  };

  return (
    <AdminLayout title="Bulk Import Exercises" permissions={permissions}>
      <Card>
        <p className="text-sm text-slate-700 mb-2">Paste an array of exercise JSON objects and validate before import.</p>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder='[{"name":"Push-Up", ...}]'
          className="w-full min-h-64 rounded-xl border border-slate-200 p-3 text-sm font-mono"
        />
      </Card>

      <Card className="mt-3">
        <p className="text-sm font-bold text-slate-900">Validation Summary</p>
        <p className="text-sm text-slate-700 mt-1">Valid rows: {validation.valid.length}</p>
        <p className="text-sm text-slate-700">Errors: {validation.errors.length}</p>
        {validation.errors.length > 0 && (
          <div className="mt-2 max-h-40 overflow-auto rounded-lg border border-red-200 bg-red-50 p-2">
            {validation.errors.slice(0, 20).map((error) => (
              <p key={error} className="text-xs text-red-700">{error}</p>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <button className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50" disabled={!permissions.canImportExercises || bulkImportMutation.isPending} onClick={onImport}>
            Import Valid Rows
          </button>
          <button className="h-10 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/admin/exercises')}>
            Back
          </button>
        </div>
      </Card>
    </AdminLayout>
  );
}

export default BulkImportScreen;
