import { ChangeEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useAdminBooks, useUpsertAdminBook } from '../../../hooks/useAdminContent';
import type { AdminBookInput } from '../../../services/adminContentService';
import { AdminLayout } from '../layout/AdminLayout';

const EMPTY_FORM: AdminBookInput = {
  title: '',
  author: '',
  description: '',
  coverImageUrl: '',
  plainText: '',
};

function toBookInput(raw: Record<string, unknown>): AdminBookInput {
  const title = String(raw.title ?? raw.name ?? raw.bookTitle ?? '').trim();
  const author = String(raw.author ?? '').trim();
  const description = String(raw.description ?? '').trim();
  const coverImageUrl = String(raw.coverImageUrl ?? raw.cover ?? raw.imageUrl ?? '').trim();
  const plainText = String(raw.plainText ?? raw.content ?? raw.text ?? raw.bookText ?? '').trim();
  return { title, author, description, coverImageUrl, plainText };
}

function BooksScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useAdminBooks();
  const upsertMutation = useUpsertAdminBook();
  const [form, setForm] = useState<AdminBookInput>(EMPTY_FORM);
  const [bulkCount, setBulkCount] = useState<number>(0);

  const canManage = permissions.canManageContent;
  const isBusy = upsertMutation.isPending;
  const sortedBooks = useMemo(() => (data ?? []).slice().sort((a, b) => a.title.localeCompare(b.title)), [data]);

  const onSaveSingle = async () => {
    if (!user?.uid) {
      showToast('You must be signed in as admin.', 'error');
      return;
    }
    if (!form.title.trim()) {
      showToast('Book title is required.', 'error');
      return;
    }
    if (!form.plainText.trim()) {
      showToast('Book text is required.', 'error');
      return;
    }

    try {
      await upsertMutation.mutateAsync({ input: form, actorUid: user.uid });
      showToast('Book saved.', 'success');
      setForm(EMPTY_FORM);
    } catch {
      showToast('Could not save book.', 'error');
    }
  };

  const onUploadJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!user?.uid) {
      showToast('You must be signed in as admin.', 'error');
      event.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      const books = rows
        .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
        .map(toBookInput)
        .filter((row) => row.title && row.plainText);

      if (books.length === 0) {
        showToast('No valid books found in JSON.', 'error');
        event.target.value = '';
        return;
      }

      for (const book of books) {
        // Keep backend behavior unchanged: each JSON entry is saved as one book document.
        await upsertMutation.mutateAsync({ input: book, actorUid: user.uid });
      }
      setBulkCount(books.length);
      showToast(`Uploaded ${books.length} book(s).`, 'success');
    } catch {
      showToast('Invalid JSON file.', 'error');
    } finally {
      event.target.value = '';
    }
  };

  if (isLoading) return <LoadingSpinner fullScreen label="Loading books..." />;

  return (
    <AdminLayout title="Books Library Management" permissions={permissions}>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">Add or upload books used in the in-app reader library.</p>
          <div className="flex gap-2">
            <button className="h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold" onClick={() => navigate('/app/admin/content/interests-goals')}>Interests & Goals</button>
            <button className="h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold" onClick={() => navigate('/app/admin/content/onboarding')}>Onboarding</button>
          </div>
        </div>
      </Card>

      <Card className="mt-3">
        <p className="text-sm font-black text-slate-900 mb-3">Add or Upload Book</p>
        <div className="grid gap-2">
          <input
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            placeholder="Book title"
            disabled={!canManage || isBusy}
          />
          <input
            value={form.author}
            onChange={(e) => setForm((prev) => ({ ...prev, author: e.target.value }))}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            placeholder="Author (optional)"
            disabled={!canManage || isBusy}
          />
          <input
            value={form.coverImageUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, coverImageUrl: e.target.value }))}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
            placeholder="Cover image URL (optional)"
            disabled={!canManage || isBusy}
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            className="h-20 rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none"
            placeholder="Short description (optional)"
            disabled={!canManage || isBusy}
          />
          <textarea
            value={form.plainText}
            onChange={(e) => setForm((prev) => ({ ...prev, plainText: e.target.value }))}
            className="min-h-[180px] rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Book text/content"
            disabled={!canManage || isBusy}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50"
            onClick={onSaveSingle}
            disabled={!canManage || isBusy}
          >
            Save Book
          </button>
          <label className={`h-10 px-4 rounded-lg text-sm font-bold inline-flex items-center cursor-pointer ${canManage && !isBusy ? 'bg-slate-100 text-slate-800' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
            Upload JSON
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={onUploadJson}
              disabled={!canManage || isBusy}
            />
          </label>
          <button
            className="h-10 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold"
            onClick={() => setForm(EMPTY_FORM)}
            disabled={isBusy}
          >
            Clear
          </button>
        </div>
        {bulkCount > 0 ? <p className="mt-2 text-xs text-slate-600">Last JSON upload: {bulkCount} book(s)</p> : null}
      </Card>

      <Card className="mt-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-black text-slate-900">Published Books</p>
          <span className="text-xs text-slate-500">{sortedBooks.length} total</span>
        </div>
        <div className="mt-3 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-2 pr-3">Title</th>
                <th className="py-2 pr-3">Author</th>
                <th className="py-2 pr-3">Words</th>
              </tr>
            </thead>
            <tbody>
              {sortedBooks.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-semibold text-slate-900">{row.title}</td>
                  <td className="py-2 pr-3 text-slate-700">{row.author || '-'}</td>
                  <td className="py-2 pr-3 text-slate-700">{row.wordCount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedBooks.length === 0 ? (
            <p className="py-3 text-sm text-slate-600">No books published yet.</p>
          ) : null}
        </div>
      </Card>
    </AdminLayout>
  );
}

export default BooksScreen;
