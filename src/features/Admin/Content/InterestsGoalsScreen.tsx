import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useDeleteInterestGoal, useInterestsGoals, useUpsertInterestGoal } from '../../../hooks/useAdminContent';
import { AdminLayout } from '../layout/AdminLayout';

type InterestGoalFormState = {
  id: string;
  name: string;
  type: 'interest' | 'goal';
  category: string;
  icon: string;
  isActive: boolean;
  isDefault: boolean;
  order: number;
};

const EMPTY_FORM: InterestGoalFormState = {
  id: '',
  name: '',
  type: 'interest',
  category: 'Exercise',
  icon: '',
  isActive: true,
  isDefault: false,
  order: 0,
};

function InterestsGoalsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useInterestsGoals();
  const upsertMutation = useUpsertInterestGoal();
  const deleteMutation = useDeleteInterestGoal();
  const [form, setForm] = useState(EMPTY_FORM);
  const rows = useMemo(() => data ?? [], [data]);

  if (isLoading) return <LoadingSpinner fullScreen label="Loading interests and goals..." />;

  const onSubmit = async () => {
    if (!user?.uid) return;
    try {
      await upsertMutation.mutateAsync({
        actorUid: user.uid,
        input: {
          id: form.id || undefined,
          name: form.name,
          type: form.type,
          category: form.category,
          icon: form.icon,
          isActive: form.isActive,
          isDefault: form.isDefault,
          order: form.order,
        },
      });
      showToast(form.id ? 'Item updated.' : 'Item created.', 'success');
      setForm(EMPTY_FORM);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save item.', 'error');
    }
  };

  const onEdit = (id: string) => {
    const row = rows.find((item) => item.id === id);
    if (!row) return;
    setForm({
      id: row.id,
      name: row.name,
      type: row.type,
      category: row.category,
      icon: row.icon ?? '',
      isActive: row.isActive,
      isDefault: row.isDefault,
      order: row.order,
    });
  };

  const onToggleActive = async (id: string) => {
    if (!user?.uid) return;
    const row = rows.find((item) => item.id === id);
    if (!row) return;
    try {
      await upsertMutation.mutateAsync({
        actorUid: user.uid,
        input: {
          id: row.id,
          name: row.name,
          type: row.type,
          category: row.category,
          icon: row.icon ?? '',
          isActive: !row.isActive,
          isDefault: row.isDefault,
          order: row.order,
        },
      });
      showToast(`Item marked ${!row.isActive ? 'active' : 'inactive'}.`, 'success');
    } catch {
      showToast('Could not update status.', 'error');
    }
  };

  const onDelete = async (id: string) => {
    const row = rows.find((item) => item.id === id);
    if (!row) return;
    const confirmed = window.confirm(`Delete "${row.name}"?`);
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync({ type: row.type, id: row.id });
      showToast('Item deleted.', 'success');
      if (form.id === row.id) setForm(EMPTY_FORM);
    } catch {
      showToast('Could not delete item.', 'error');
    }
  };

  return (
    <AdminLayout title="Interests & Goals" permissions={permissions}>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">Manage exercise interests and wellness goals shown in onboarding/profile. Add, edit, activate, and delete entries.</p>
          <div className="flex gap-2">
            <button className="h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold" onClick={() => navigate('/app/admin/content/onboarding')}>Onboarding</button>
            <button className="h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold" onClick={() => navigate('/app/admin/content/notifications')}>Notifications</button>
          </div>
        </div>
      </Card>
      <Card className="mt-3">
        <p className="text-sm font-black text-slate-900 mb-3">{form.id ? 'Edit Item' : 'Add New Item'}</p>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm md:col-span-2"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <select
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
            value={form.type}
            onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as 'interest' | 'goal' }))}
          >
            <option value="interest">Interest</option>
            <option value="goal">Goal</option>
          </select>
          <input
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
            placeholder="Category"
            value={form.category}
            onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
          />
          <input
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
            placeholder="Icon (emoji optional)"
            value={form.icon}
            onChange={(e) => setForm((prev) => ({ ...prev, icon: e.target.value }))}
          />
          <input
            type="number"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
            placeholder="Order"
            value={form.order}
            onChange={(e) => setForm((prev) => ({ ...prev, order: Number(e.target.value) || 0 }))}
          />
          <label className="h-10 rounded-lg border border-slate-200 px-3 text-sm flex items-center justify-between">
            <span>Active</span>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
            />
          </label>
          <label className="h-10 rounded-lg border border-slate-200 px-3 text-sm flex items-center justify-between">
            <span>Default</span>
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
            />
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50"
            onClick={onSubmit}
            disabled={!permissions.canManageContent || upsertMutation.isPending}
          >
            {form.id ? 'Update' : 'Add'}
          </button>
          <button
            className="h-10 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold"
            onClick={() => setForm(EMPTY_FORM)}
          >
            Clear
          </button>
        </div>
      </Card>
      <Card className="mt-3">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Default</th>
                <th className="py-2 pr-3">Active</th>
                <th className="py-2 pr-3">Order</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.type}-${row.id}`} className="border-b border-slate-100">
                  <td className="py-2 pr-3 text-slate-700 capitalize">{row.type}</td>
                  <td className="py-2 pr-3 font-semibold text-slate-900">{row.icon ? `${row.icon} ` : ''}{row.name}</td>
                  <td className="py-2 pr-3 text-slate-700">{row.category}</td>
                  <td className="py-2 pr-3 text-slate-700">{row.isDefault ? 'Yes' : 'No'}</td>
                  <td className="py-2 pr-3 text-slate-700">{row.isActive ? 'Yes' : 'No'}</td>
                  <td className="py-2 pr-3 text-slate-700">{row.order}</td>
                  <td className="py-2 pr-3">
                    <div className="flex gap-2">
                      <button className="text-primary font-bold disabled:opacity-50" disabled={!permissions.canManageContent} onClick={() => onEdit(row.id)}>Edit</button>
                      <button className="text-slate-700 font-bold disabled:opacity-50" disabled={!permissions.canManageContent || upsertMutation.isPending} onClick={() => onToggleActive(row.id)}>
                        {row.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button className="text-red-600 font-bold disabled:opacity-50" disabled={!permissions.canManageContent || deleteMutation.isPending} onClick={() => onDelete(row.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminLayout>
  );
}

export default InterestsGoalsScreen;
