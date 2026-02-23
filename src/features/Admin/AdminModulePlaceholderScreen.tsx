import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../../components/Mobile';
import { useAuth } from '../../hooks/useAuth';
import { useAdminPermissions } from '../../hooks/useAdminPermissions';
import { AdminLayout } from './layout/AdminLayout';

const titles: Record<string, string> = {
  '/app/admin/exercises': 'Exercise Management',
  '/app/admin/users': 'User Management',
  '/app/admin/groups': 'Group Management',
  '/app/admin/analytics': 'Analytics & Reporting',
  '/app/admin/settings': 'System Settings',
};

function AdminModulePlaceholderScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const title = titles[location.pathname] ?? 'Admin Module';

  return (
    <AdminLayout title={title} permissions={permissions}>
      <Card>
        <p className="text-sm font-bold text-slate-900">{title} module scaffolded.</p>
        <p className="text-sm text-slate-600 mt-2">
          This module is staged and ready for full implementation without impacting current working flows.
        </p>
        <button className="mt-4 h-11 px-4 rounded-xl bg-primary text-white text-sm font-bold" onClick={() => navigate('/app/admin/dashboard')}>
          Back to Dashboard
        </button>
      </Card>
    </AdminLayout>
  );
}

export default AdminModulePlaceholderScreen;
