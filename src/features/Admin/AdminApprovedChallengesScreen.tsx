import { useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../components/Mobile';
import { useApprovedChallenges } from '../../hooks/useAdminChallenges';
import { useAuth } from '../../hooks/useAuth';
import { useAdminPermissions } from '../../hooks/useAdminPermissions';
import { AdminLayout } from './layout/AdminLayout';

function AdminApprovedChallengesScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data: approved, isLoading } = useApprovedChallenges();

  if (isLoading) return <LoadingSpinner fullScreen label="Loading approved challenges..." />;

  return (
    <AdminLayout title="Approved Challenges" permissions={permissions}>
      <div>
        <div className="space-y-2">
          {(approved ?? []).length === 0 ? (
            <Card>
              <p className="text-sm text-slate-700">No approved challenges yet.</p>
            </Card>
          ) : (
            (approved ?? []).map((item) => (
            <Card key={item.id} variant="flat">
              <p className="text-sm font-bold text-slate-900">{item.name}</p>
              <p className="text-xs text-slate-600 mt-1">
                Approved {item.moderatedAt ? new Date(item.moderatedAt).toLocaleString() : 'previously'}
              </p>
            </Card>
            ))
          )}
        </div>
        <Card className="mt-3">
          <button className="w-full h-11 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/admin/challenges/pending')}>
            Back to Pending Queue
          </button>
          <button className="w-full h-11 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold mt-2" onClick={() => navigate('/app/admin/dashboard')}>
            Back to Dashboard
          </button>
        </Card>
      </div>
    </AdminLayout>
  );
}

export default AdminApprovedChallengesScreen;
