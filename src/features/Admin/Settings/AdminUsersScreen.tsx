import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useAdminUsersConfig, useUpsertAdminUser } from '../../../hooks/useAdminSettings';
import { AdminLayout } from '../layout/AdminLayout';

function AdminUsersScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useAdminUsersConfig();
  const upsertMutation = useUpsertAdminUser();
  const [uid, setUid] = useState('');
  const [uidError, setUidError] = useState('');
  const [role, setRole] = useState<'super_admin' | 'content_manager' | 'moderator' | 'support' | 'admin'>('admin');
  const [status, setStatus] = useState<'active' | 'suspended'>('active');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');

  if (isLoading) return <LoadingSpinner fullScreen label="Loading admin users..." />;

  const onSave = async () => {
    if (!user?.uid) return;
    if (!uid.trim()) {
      setUidError('User UID is required.');
      return;
    }
    setUidError('');
    try {
      await upsertMutation.mutateAsync({
        actorUid: user.uid,
        payload: {
          uid: uid.trim(),
          role,
          status,
          displayName: displayName.trim() || undefined,
          email: email.trim() || undefined,
        },
      });
      showToast('Admin user saved.', 'success');
      setUid('');
      setUidError('');
      setDisplayName('');
      setEmail('');
    } catch {
      showToast('Could not save admin user.', 'error');
    }
  };

  return (
    <AdminLayout title="Admin User Management" permissions={permissions}>
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <input
              value={uid}
              onChange={(e) => { setUid(e.target.value); if (e.target.value.trim()) setUidError(''); }}
              placeholder="User UID (required)"
              className={`h-10 w-full rounded-lg border px-3 text-sm ${uidError ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
            />
            {uidError ? <p className="mt-1 text-xs text-red-600">{uidError}</p> : null}
          </div>
          <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
            <option value="super_admin">super_admin</option>
            <option value="content_manager">content_manager</option>
            <option value="moderator">moderator</option>
            <option value="support">support</option>
            <option value="admin">admin</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
            <option value="active">active</option>
            <option value="suspended">suspended</option>
          </select>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name (optional)" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className="h-10 rounded-lg border border-slate-200 px-3 text-sm md:col-span-2" />
        </div>
        <div className="mt-3 flex gap-2">
          <button className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50" disabled={!permissions.canManageAdminUsers || upsertMutation.isPending} onClick={onSave}>{upsertMutation.isPending ? 'Saving…' : 'Save Admin User'}</button>
          <button className="h-10 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/admin/settings')}>Back to App Settings</button>
        </div>
      </Card>

      <Card className="mt-3">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-2 pr-3">UID</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-sm text-slate-500 text-center">No admin users configured yet.</td>
                </tr>
              ) : (data ?? []).map((row) => (
                <tr key={row.uid} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-mono text-xs">{row.uid}</td>
                  <td className="py-2 pr-3">{row.role}</td>
                  <td className="py-2 pr-3">{row.status}</td>
                  <td className="py-2 pr-3">{row.displayName ?? '-'}</td>
                  <td className="py-2 pr-3">{row.email ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminLayout>
  );
}

export default AdminUsersScreen;
