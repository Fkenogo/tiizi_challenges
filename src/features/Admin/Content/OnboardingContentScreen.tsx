import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useOnboardingContent } from '../../../hooks/useAdminContent';
import { AdminLayout } from '../layout/AdminLayout';

function OnboardingContentScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useOnboardingContent();

  if (isLoading) return <LoadingSpinner fullScreen label="Loading onboarding content..." />;

  return (
    <AdminLayout title="Onboarding Content" permissions={permissions}>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">Review versioned onboarding copy and active steps.</p>
          <div className="flex gap-2">
            <button className="h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold" onClick={() => navigate('/app/admin/content/books')}>Books</button>
            <button className="h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold" onClick={() => navigate('/app/admin/content/interests-goals')}>Interests & Goals</button>
          </div>
        </div>
      </Card>

      <div className="mt-3 space-y-2">
        {(data ?? []).length === 0 ? (
          <Card><p className="text-sm text-slate-700">No onboarding content entries found.</p></Card>
        ) : (
          (data ?? []).map((item) => (
            <Card key={item.id} variant="flat">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-slate-900">{item.stepKey}</p>
                  <p className="text-sm text-slate-800 mt-1">{item.title}</p>
                  <p className="text-xs text-slate-600 mt-1">{item.body}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700'}`}>
                  v{item.version}
                </span>
              </div>
            </Card>
          ))
        )}
      </div>
    </AdminLayout>
  );
}

export default OnboardingContentScreen;
