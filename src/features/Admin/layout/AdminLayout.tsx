import { AdminPermissions } from '../../../services/adminAccessService';
import { AdminHeader } from './AdminHeader';
import { AdminSidebar } from './AdminSidebar';
import { ReactNode, useEffect } from 'react';
import { useAdminDensity } from '../../../hooks/useAdminDensity';

export function AdminLayout({
  title,
  permissions,
  children,
}: {
  title: string;
  permissions: AdminPermissions;
  children: ReactNode;
}) {
  const { density } = useAdminDensity();

  useEffect(() => {
    document.body.classList.toggle('admin-density-compact', density === 'compact');
    return () => {
      document.body.classList.remove('admin-density-compact');
    };
  }, [density]);

  return (
    <div className={`admin-shell min-h-[100dvh] bg-slate-100 flex ${density === 'compact' ? 'admin-shell-compact' : ''}`}>
      <AdminSidebar permissions={permissions} density={density} />
      <div className="flex-1 min-w-0">
        <AdminHeader title={title} />
        <main className={`${density === 'compact' ? 'p-4 lg:p-5' : 'p-6 lg:p-8'} max-w-[1700px]`}>{children}</main>
      </div>
    </div>
  );
}
