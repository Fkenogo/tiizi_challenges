import { useMemo, useState } from 'react';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useContentPages, useDeleteContentPage, useUpsertContentPage } from '../../../hooks/useAdminContent';
import { AdminLayout } from '../layout/AdminLayout';

type ContentPageFormState = {
  id: string;
  title: string;
  slug: string;
  category: 'legal' | 'policy' | 'update' | 'help';
  status: 'draft' | 'published';
  body: string;
};

const EMPTY_FORM: ContentPageFormState = {
  id: '',
  title: '',
  slug: '',
  category: 'policy',
  status: 'draft',
  body: '',
};

function ContentPagesScreen() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useContentPages();
  const upsertMutation = useUpsertContentPage();
  const deleteMutation = useDeleteContentPage();
  const [form, setForm] = useState(EMPTY_FORM);
  const rows = useMemo(() => data ?? [], [data]);

  if (isLoading) return <LoadingSpinner fullScreen label="Loading content pages..." />;

  const onSubmit = async () => {
    if (!user?.uid) return;
    try {
      await upsertMutation.mutateAsync({
        actorUid: user.uid,
        input: {
          id: form.id || undefined,
          title: form.title,
          slug: form.slug,
          category: form.category,
          status: form.status,
          body: form.body,
        },
      });
      showToast(form.id ? 'Content page updated.' : 'Content page created.', 'success');
      setForm(EMPTY_FORM);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save content page.', 'error');
    }
  };

  const onEdit = (id: string) => {
    const row = rows.find((item) => item.id === id);
    if (!row) return;
    setForm({
      id: row.id,
      title: row.title,
      slug: row.slug,
      category: row.category,
      status: row.status,
      body: row.body,
    });
  };

  const onDelete = async (id: string) => {
    const row = rows.find((item) => item.id === id);
    if (!row) return;
    const confirmed = window.confirm(`Delete "${row.title}"?`);
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(id);
      showToast('Content page deleted.', 'success');
      if (form.id === id) setForm(EMPTY_FORM);
    } catch {
      showToast('Could not delete content page.', 'error');
    }
  };

  return (
    <AdminLayout title="Content Pages" permissions={permissions}>
      <Card>
        <p className="text-sm text-slate-600">
          Manage legal pages, policies, updates, and help content used across the app.
        </p>
      </Card>

      <Card className="mt-3">
        <p className="text-sm font-black text-slate-900 mb-3">{form.id ? 'Edit Content Page' : 'Create Content Page'}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          />
          <input
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
            placeholder="Slug (e.g. terms-and-conditions)"
            value={form.slug}
            onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
          />
          <select
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
            value={form.category}
            onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as 'legal' | 'policy' | 'update' | 'help' }))}
          >
            <option value="legal">Legal</option>
            <option value="policy">Policy</option>
            <option value="update">Update</option>
            <option value="help">Help</option>
          </select>
          <select
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
            value={form.status}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as 'draft' | 'published' }))}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
          <textarea
            className="min-h-[180px] rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
            placeholder="Page content"
            value={form.body}
            onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50" disabled={!permissions.canManageContent || upsertMutation.isPending} onClick={onSubmit}>
            {form.id ? 'Update' : 'Create'}
          </button>
          <button className="h-10 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => setForm(EMPTY_FORM)}>Clear</button>
        </div>
      </Card>

      <Card className="mt-3">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">Slug</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Updated</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-semibold text-slate-900">{item.title}</td>
                  <td className="py-2 pr-3 text-slate-700">{item.slug}</td>
                  <td className="py-2 pr-3 text-slate-700 capitalize">{item.category}</td>
                  <td className="py-2 pr-3 text-slate-700 capitalize">{item.status}</td>
                  <td className="py-2 pr-3 text-slate-700">{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-'}</td>
                  <td className="py-2 pr-3">
                    <div className="flex gap-2">
                      <button className="text-primary font-bold disabled:opacity-50" disabled={!permissions.canManageContent} onClick={() => onEdit(item.id)}>Edit</button>
                      <button className="text-red-600 font-bold disabled:opacity-50" disabled={!permissions.canManageContent || deleteMutation.isPending} onClick={() => onDelete(item.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="py-3 text-sm text-slate-600">No content pages found.</p> : null}
        </div>
      </Card>
    </AdminLayout>
  );
}

export default ContentPagesScreen;
