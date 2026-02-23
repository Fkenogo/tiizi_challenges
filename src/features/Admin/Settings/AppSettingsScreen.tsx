import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useAppConfig, useSaveAppConfig } from '../../../hooks/useAdminSettings';
import { AppConfig } from '../../../services/adminSettingsService';
import { AdminLayout } from '../layout/AdminLayout';

function AppSettingsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useAppConfig();
  const saveMutation = useSaveAppConfig();
  const [form, setForm] = useState<AppConfig | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (isLoading || !form) return <LoadingSpinner fullScreen label="Loading app settings..." />;

  const onSave = async () => {
    if (!user?.uid) return;
    try {
      await saveMutation.mutateAsync({ config: form, actorUid: user.uid });
      showToast('App settings saved.', 'success');
    } catch {
      showToast('Could not save app settings.', 'error');
    }
  };

  const onResetAdminPreferences = () => {
    if (typeof window === 'undefined') return;
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('tiizi_admin_') || key.startsWith('tiizi_admin_table_prefs_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
    window.dispatchEvent(new Event('tiizi-admin-density-change'));
    showToast('Admin UI preferences reset.', 'success');
  };

  return (
    <AdminLayout title="App Settings" permissions={permissions}>
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input value={form.appName} onChange={(e) => setForm({ ...form, appName: e.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="App name" />
          <input value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Support email" />
          <input value={form.termsUrl} onChange={(e) => setForm({ ...form, termsUrl: e.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Terms URL" />
          <input value={form.privacyUrl} onChange={(e) => setForm({ ...form, privacyUrl: e.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Privacy URL" />
          <input type="number" value={form.maxChallengesPerUser} onChange={(e) => setForm({ ...form, maxChallengesPerUser: Number(e.target.value) || 0 })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Max challenges/user" />
          <input type="number" value={form.maxGroupsPerUser} onChange={(e) => setForm({ ...form, maxGroupsPerUser: Number(e.target.value) || 0 })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Max groups/user" />
          <input type="number" value={form.maxWorkoutLogsPerDay} onChange={(e) => setForm({ ...form, maxWorkoutLogsPerDay: Number(e.target.value) || 0 })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Max workout logs/day" />
          <label className="h-10 rounded-lg border border-slate-200 px-3 text-sm flex items-center justify-between">
            <span>Maintenance mode</span>
            <input type="checkbox" checked={form.maintenanceMode} onChange={(e) => setForm({ ...form, maintenanceMode: e.target.checked })} />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50" disabled={!permissions.canManageAppSettings || saveMutation.isPending} onClick={onSave}>Save Settings</button>
          <button className="h-10 px-4 rounded-lg border border-slate-200 text-slate-700 text-sm font-bold disabled:opacity-50" disabled={!permissions.canManageAppSettings} onClick={onResetAdminPreferences}>Reset All Admin Prefs</button>
          <button className="h-10 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold disabled:opacity-50" disabled={!permissions.canManageAdminUsers} onClick={() => navigate('/app/admin/settings/admin-users')}>Admin Users</button>
          <button className="h-10 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold disabled:opacity-50" disabled={!permissions.canViewSystemLogs} onClick={() => navigate('/app/admin/settings/logs')}>System Logs</button>
        </div>
      </Card>
    </AdminLayout>
  );
}

export default AppSettingsScreen;
