import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import {
  useDeleteNotificationTemplate,
  useNotificationTemplates,
  usePublishNotificationTemplate,
  useUpsertNotificationTemplate,
} from '../../../hooks/useAdminContent';
import { AdminLayout } from '../layout/AdminLayout';

type NotificationFormState = {
  id: string;
  name: string;
  channel: 'push' | 'in_app' | 'email';
  audience: string;
  subject: string;
  body: string;
  scheduledAt: string;
  triggerType: 'manual' | 'scheduled' | 'inactivity' | 'challenge_completion' | 'streak_milestone' | 'donation_nudge';
  triggerCooldownDays: number;
  inactivityDays: number;
  milestoneValue: number;
};

const EMPTY_FORM: NotificationFormState = {
  id: '',
  name: '',
  channel: 'in_app',
  audience: 'all-users',
  subject: '',
  body: '',
  scheduledAt: '',
  triggerType: 'manual',
  triggerCooldownDays: 0,
  inactivityDays: 14,
  milestoneValue: 0,
};

function NotificationsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useNotificationTemplates();
  const upsertMutation = useUpsertNotificationTemplate();
  const publishMutation = usePublishNotificationTemplate();
  const deleteMutation = useDeleteNotificationTemplate();
  const [form, setForm] = useState(EMPTY_FORM);

  if (isLoading) return <LoadingSpinner fullScreen label="Loading notification templates..." />;

  const onSave = async () => {
    if (!user?.uid) return;
    try {
      await upsertMutation.mutateAsync({
        actorUid: user.uid,
        input: {
          id: form.id || undefined,
          name: form.name,
          channel: form.channel,
          audience: form.audience,
          subject: form.subject,
          body: form.body,
          scheduledAt: form.scheduledAt || undefined,
          status: form.scheduledAt ? 'scheduled' : 'draft',
          triggerType: form.triggerType,
          triggerCooldownDays: form.triggerCooldownDays,
          inactivityDays: form.inactivityDays,
          milestoneValue: form.milestoneValue,
        },
      });
      showToast(form.id ? 'Notification updated.' : 'Notification template created.', 'success');
      setForm(EMPTY_FORM);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save notification.', 'error');
    }
  };

  const onEdit = (id: string) => {
    const row = (data ?? []).find((item) => item.id === id);
    if (!row) return;
    setForm({
      id: row.id,
      name: row.name,
      channel: row.channel,
      audience: row.audience,
      subject: row.subject ?? '',
      body: row.body ?? '',
      scheduledAt: row.scheduledAt ?? '',
      triggerType: row.triggerType ?? 'manual',
      triggerCooldownDays: row.triggerCooldownDays ?? 0,
      inactivityDays: row.inactivityDays ?? 14,
      milestoneValue: row.milestoneValue ?? 0,
    });
  };

  const onPublish = async (id: string) => {
    if (!user?.uid) return;
    try {
      await publishMutation.mutateAsync({ id, actorUid: user.uid });
      showToast('Notification marked as published.', 'success');
    } catch {
      showToast('Could not publish notification.', 'error');
    }
  };

  const onDelete = async (id: string) => {
    const confirmed = window.confirm('Delete this notification template?');
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(id);
      showToast('Notification deleted.', 'success');
      if (form.id === id) setForm(EMPTY_FORM);
    } catch {
      showToast('Could not delete notification.', 'error');
    }
  };

  return (
    <AdminLayout title="Notifications" permissions={permissions}>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">Create, schedule, publish, and manage push, in-app, and email communications.</p>
          <div className="flex gap-2">
            <button className="h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold" onClick={() => navigate('/app/admin/content/interests-goals')}>Interests & Goals</button>
            <button className="h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold" onClick={() => navigate('/app/admin/content/pages')}>Content Pages</button>
          </div>
        </div>
      </Card>
      <Card className="mt-3">
        <p className="text-sm font-black text-slate-900 mb-3">{form.id ? 'Edit Notification' : 'Create Notification'}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
            placeholder="Template name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <input
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
            placeholder="Audience (e.g. all-users, group-admins)"
            value={form.audience}
            onChange={(e) => setForm((prev) => ({ ...prev, audience: e.target.value }))}
          />
          <select
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
            value={form.channel}
            onChange={(e) => setForm((prev) => ({ ...prev, channel: e.target.value as 'push' | 'in_app' | 'email' }))}
          >
            <option value="in_app">In app</option>
            <option value="push">Push</option>
            <option value="email">Email</option>
          </select>
          <input
            type="datetime-local"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
            value={form.scheduledAt}
            onChange={(e) => setForm((prev) => ({ ...prev, scheduledAt: e.target.value }))}
          />
          <select
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
            value={form.triggerType}
            onChange={(e) => setForm((prev) => ({ ...prev, triggerType: e.target.value as NotificationFormState['triggerType'] }))}
          >
            <option value="manual">Manual broadcast</option>
            <option value="scheduled">Scheduled time</option>
            <option value="inactivity">Dormant user nudge</option>
            <option value="challenge_completion">Challenge completion</option>
            <option value="streak_milestone">Streak milestone</option>
            <option value="donation_nudge">Support Tiizi reminder</option>
          </select>
          <input
            type="number"
            min={0}
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
            placeholder="Cooldown days"
            value={form.triggerCooldownDays}
            onChange={(e) => setForm((prev) => ({ ...prev, triggerCooldownDays: Number(e.target.value) || 0 }))}
          />
          {form.triggerType === 'inactivity' ? (
            <input
              type="number"
              min={1}
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
              placeholder="Inactivity days"
              value={form.inactivityDays}
              onChange={(e) => setForm((prev) => ({ ...prev, inactivityDays: Number(e.target.value) || 1 }))}
            />
          ) : null}
          {form.triggerType === 'streak_milestone' ? (
            <input
              type="number"
              min={1}
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
              placeholder="Milestone value (days)"
              value={form.milestoneValue}
              onChange={(e) => setForm((prev) => ({ ...prev, milestoneValue: Number(e.target.value) || 1 }))}
            />
          ) : null}
          <input
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm md:col-span-2"
            placeholder="Subject (optional for email)"
            value={form.subject}
            onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
          />
          <textarea
            className="min-h-[100px] rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
            placeholder="Notification message"
            value={form.body}
            onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50" disabled={!permissions.canManageNotifications || upsertMutation.isPending} onClick={onSave}>
            {form.id ? 'Update' : 'Save Draft'}
          </button>
          <button className="h-10 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => setForm(EMPTY_FORM)}>Clear</button>
        </div>
      </Card>

      <Card className="mt-3">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-2 pr-3">Template</th>
                <th className="py-2 pr-3">Channel</th>
                <th className="py-2 pr-3">Audience</th>
                <th className="py-2 pr-3">Trigger</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Updated</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-semibold text-slate-900">{item.name}</td>
                  <td className="py-2 pr-3 text-slate-700">{item.channel}</td>
                  <td className="py-2 pr-3 text-slate-700">{item.audience}</td>
                  <td className="py-2 pr-3 text-slate-700 capitalize">{(item.triggerType || 'manual').replace(/_/g, ' ')}</td>
                  <td className="py-2 pr-3 text-slate-700 capitalize">{item.status}</td>
                  <td className="py-2 pr-3 text-slate-700">{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-'}</td>
                  <td className="py-2 pr-3">
                    <div className="flex gap-2">
                      <button className="text-primary font-bold disabled:opacity-50" disabled={!permissions.canManageNotifications} onClick={() => onEdit(item.id)}>Edit</button>
                      <button className="text-slate-700 font-bold disabled:opacity-50" disabled={!permissions.canManageNotifications || publishMutation.isPending || item.status === 'sent'} onClick={() => onPublish(item.id)}>Publish</button>
                      <button className="text-red-600 font-bold disabled:opacity-50" disabled={!permissions.canManageNotifications || deleteMutation.isPending} onClick={() => onDelete(item.id)}>Delete</button>
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

export default NotificationsScreen;
