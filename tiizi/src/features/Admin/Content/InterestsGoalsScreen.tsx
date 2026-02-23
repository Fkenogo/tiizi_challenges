import { useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useInterestsGoals } from '../../../hooks/useAdminContent';
import { AdminLayout } from '../layout/AdminLayout';

function InterestsGoalsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useInterestsGoals();

  if (isLoading) return <LoadingSpinner fullScreen label="Loading interests and goals..." />;

  return (
    <AdminLayout title="Interests & Goals" permissions={permissions}>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">Manage exercise interests and wellness goals shown in onboarding/profile.</p>
          <div className="flex gap-2">
            <button className="h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold" onClick={() => navigate('/app/admin/content/books')}>Books</button>
            <button className="h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold" onClick={() => navigate('/app/admin/content/onboarding')}>Onboarding</button>
            <button className="h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold" onClick={() => navigate('/app/admin/content/notifications')}>Notifications</button>
          </div>
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
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((row) => (
                <tr key={`${row.type}-${row.id}`} className="border-b border-slate-100">
                  <td className="py-2 pr-3 text-slate-700 capitalize">{row.type}</td>
                  <td className="py-2 pr-3 font-semibold text-slate-900">{row.icon ? `${row.icon} ` : ''}{row.name}</td>
                  <td className="py-2 pr-3 text-slate-700">{row.category}</td>
                  <td className="py-2 pr-3 text-slate-700">{row.isDefault ? 'Yes' : 'No'}</td>
                  <td className="py-2 pr-3 text-slate-700">{row.isActive ? 'Yes' : 'No'}</td>
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
