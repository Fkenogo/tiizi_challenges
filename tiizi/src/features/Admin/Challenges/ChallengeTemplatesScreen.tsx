import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useChallengeTemplates } from '../../../hooks/useAdminChallenges';
import { AdminLayout } from '../layout/AdminLayout';

function ChallengeTemplatesScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useChallengeTemplates();

  if (isLoading) return <LoadingSpinner fullScreen label="Loading challenge templates..." />;

  return (
    <AdminLayout title="Challenge Templates" permissions={permissions}>
      <Card>
        <p className="text-sm text-slate-600">Reusable templates with version history and quick deploy status.</p>
        <button className="mt-3 h-10 px-3 rounded-lg bg-primary text-white text-sm font-bold" onClick={() => navigate('/app/admin/challenges/create')}>
          Create Template
        </button>
      </Card>

      <div className="mt-3 space-y-2">
        {(data ?? []).length === 0 ? (
          <Card><p className="text-sm text-slate-700">No templates found yet.</p></Card>
        ) : (
          (data ?? []).map((item) => (
            <Card key={item.id} variant="flat">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-600 mt-1">{item.description || 'No description provided.'}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {item.challengeType} • {item.difficultyLevel} • {item.durationDays} days • {item.activityCount} activities
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${item.isPublished ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {item.isPublished ? 'Published' : 'Draft'}
                </span>
              </div>
            </Card>
          ))
        )}
      </div>
    </AdminLayout>
  );
}

export default ChallengeTemplatesScreen;
