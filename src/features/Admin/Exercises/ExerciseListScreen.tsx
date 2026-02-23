import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useAdminExercises, useDeleteAdminExercise } from '../../../hooks/useAdminExercises';
import { useAdminTablePrefs } from '../../../hooks/useAdminTablePrefs';
import { AdminLayout } from '../layout/AdminLayout';

type SortKey = 'name' | 'usageCount';

function ExerciseListScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useAdminExercises();
  const deleteMutation = useDeleteAdminExercise();
  const { prefs, setPrefs, resetPrefs } = useAdminTablePrefs<{
    searchTerm: string;
    tier1: string;
    difficulty: string;
    sortKey: SortKey;
    pageSize: number;
    page: number;
  }>('exercise_list', {
    searchTerm: '',
    tier1: 'All',
    difficulty: 'All',
    sortKey: 'name',
    pageSize: 25,
    page: 1,
  });

  const rows = useMemo(() => {
    const list = [...(data ?? [])]
      .filter((x) => (prefs.tier1 === 'All' ? true : x.tier_1 === prefs.tier1))
      .filter((x) => (prefs.difficulty === 'All' ? true : x.difficulty === prefs.difficulty))
      .filter((x) => {
        const q = prefs.searchTerm.trim().toLowerCase();
        if (!q) return true;
        return x.name.toLowerCase().includes(q) || x.tier_1.toLowerCase().includes(q) || x.tier_2.toLowerCase().includes(q);
      });
    if (prefs.sortKey === 'usageCount') return list.sort((a, b) => b.usageCount - a.usageCount);
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [data, prefs.tier1, prefs.difficulty, prefs.searchTerm, prefs.sortKey]);

  const totalPages = Math.max(1, Math.ceil(rows.length / prefs.pageSize));
  const clampedPage = Math.min(Math.max(1, prefs.page), totalPages);
  const pageRows = rows.slice((clampedPage - 1) * prefs.pageSize, clampedPage * prefs.pageSize);

  const tier1Options = Array.from(new Set((data ?? []).map((x) => x.tier_1))).sort();

  const onExport = () => {
    const payload = JSON.stringify(rows, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'tiizi-exercises-export.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const onDelete = async (id: string, name: string) => {
    const confirmed = window.confirm(`Delete exercise "${name}"? This cannot be undone.`);
    if (!confirmed) return;
    await deleteMutation.mutateAsync(id);
  };

  if (isLoading) return <LoadingSpinner fullScreen label="Loading admin exercises..." />;

  return (
    <AdminLayout title="Exercise Management" permissions={permissions}>
      <Card>
        <div className="flex flex-wrap gap-2">
          <input
            value={prefs.searchTerm}
            onChange={(e) => setPrefs((prev) => ({ ...prev, searchTerm: e.target.value, page: 1 }))}
            placeholder="Search by name/category..."
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm flex-1 min-w-[200px]"
          />
          <select value={prefs.tier1} onChange={(e) => setPrefs((prev) => ({ ...prev, tier1: e.target.value, page: 1 }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
            <option value="All">All Tier 1</option>
            {tier1Options.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <select value={prefs.difficulty} onChange={(e) => setPrefs((prev) => ({ ...prev, difficulty: e.target.value, page: 1 }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
            <option value="All">All Difficulty</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
          <select value={prefs.sortKey} onChange={(e) => setPrefs((prev) => ({ ...prev, sortKey: e.target.value as SortKey }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
            <option value="name">Sort: Name</option>
            <option value="usageCount">Sort: Usage</option>
          </select>
          <select value={prefs.pageSize} onChange={(e) => setPrefs((prev) => ({ ...prev, pageSize: Number(e.target.value), page: 1 }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>
          <button className="h-10 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 disabled:opacity-50" disabled={!permissions.canExportExercises} onClick={onExport}>Export</button>
          <button className="h-10 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700" onClick={resetPrefs}>Reset Prefs</button>
          <button className="h-10 px-3 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50" disabled={!permissions.canCreateExercises} onClick={() => navigate('/app/admin/exercises/add')}>Add Exercise</button>
          <button className="h-10 px-3 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold disabled:opacity-50" disabled={!permissions.canImportExercises} onClick={() => navigate('/app/admin/exercises/import')}>Bulk Import</button>
          <button className="h-10 px-3 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold disabled:opacity-50" disabled={!permissions.canViewExerciseStats} onClick={() => navigate('/app/admin/exercises/stats')}>Stats</button>
        </div>
      </Card>

      <Card className="mt-3">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Tier 1</th>
                <th className="py-2 pr-3">Tier 2</th>
                <th className="py-2 pr-3">Difficulty</th>
                <th className="py-2 pr-3">Usage</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-semibold text-slate-900">{row.name}</td>
                  <td className="py-2 pr-3 text-slate-700">{row.tier_1}</td>
                  <td className="py-2 pr-3 text-slate-700">{row.tier_2}</td>
                  <td className="py-2 pr-3 text-slate-700">{row.difficulty}</td>
                  <td className="py-2 pr-3 text-slate-700">{row.usageCount}</td>
                  <td className="py-2 space-x-2">
                    <button className="text-primary font-bold disabled:opacity-50" disabled={!permissions.canEditExercises} onClick={() => navigate(`/app/admin/exercises/${row.id}/edit`)}>Edit</button>
                    <button className="text-red-600 font-bold disabled:opacity-50" disabled={!permissions.canDeleteExercises || deleteMutation.isPending} onClick={() => onDelete(row.id, row.name)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
          <span>Page {clampedPage} of {totalPages}</span>
          <div className="flex gap-2">
            <button className="h-8 px-2 rounded border border-slate-200 disabled:opacity-50" disabled={clampedPage <= 1} onClick={() => setPrefs((prev) => ({ ...prev, page: clampedPage - 1 }))}>Prev</button>
            <button className="h-8 px-2 rounded border border-slate-200 disabled:opacity-50" disabled={clampedPage >= totalPages} onClick={() => setPrefs((prev) => ({ ...prev, page: clampedPage + 1 }))}>Next</button>
          </div>
        </div>
      </Card>
    </AdminLayout>
  );
}

export default ExerciseListScreen;
