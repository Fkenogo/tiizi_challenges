import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useNotificationTemplates } from '../../../hooks/useAdminContent';
import { AdminLayout } from '../layout/AdminLayout';

function NotificationsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useNotificationTemplates();

  if (isLoading) return <LoadingSpinner fullScreen label="Loading notification templates..." />;

  return (
    <AdminLayout title="Notifications" permissions={permissions}>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">Manage push, in-app, and email templates and broadcast states.</p>
          <div className="flex gap-2">
            <button className="h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold" onClick={() => navigate('/app/admin/content/books')}>Books</button>
            <button className="h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold" onClick={() => navigate('/app/admin/content/interests-goals')}>Interests & Goals</button>
          </div>
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
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-semibold text-slate-900">{item.name}</td>
                  <td className="py-2 pr-3 text-slate-700">{item.channel}</td>
                  <td className="py-2 pr-3 text-slate-700">{item.audience}</td>
                  <td className="py-2 pr-3 text-slate-700 capitalize">{item.status}</td>
                  <td className="py-2 pr-3 text-slate-700">{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-'}</td>
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
