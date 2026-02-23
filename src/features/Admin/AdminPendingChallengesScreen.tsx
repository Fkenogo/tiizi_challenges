import { useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../components/Mobile';
import { usePendingChallenges, useApproveChallenge, useRequestChallengeChanges } from '../../hooks/useAdminChallenges';
import { useAuth } from '../../hooks/useAuth';
import { useAdminPermissions } from '../../hooks/useAdminPermissions';
import { AdminLayout } from './layout/AdminLayout';
import { useToast } from '../../context/ToastContext';

function AdminPendingChallengesScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data: pending, isLoading } = usePendingChallenges();
  const approveMutation = useApproveChallenge();
  const requestChangesMutation = useRequestChallengeChanges();

  if (isLoading) return <LoadingSpinner fullScreen label="Loading pending challenges..." />;

  const onApprove = async (challengeId: string) => {
    if (!user?.uid) return;
    try {
      await approveMutation.mutateAsync({ challengeId, moderatorUid: user.uid });
      showToast('Challenge approved.', 'success');
    } catch {
      showToast('Could not approve challenge.', 'error');
    }
  };

  const onRequestChanges = async (challengeId: string) => {
    if (!user?.uid) return;
    const note = window.prompt('Add moderation note for required changes:', 'Please refine challenge description and targets.');
    if (!note) return;
    try {
      await requestChangesMutation.mutateAsync({ challengeId, moderatorUid: user.uid, note });
      showToast('Change request sent.', 'success');
    } catch {
      showToast('Could not request changes.', 'error');
    }
  };

  return (
    <AdminLayout title="Pending Challenge Moderation" permissions={permissions}>
      <div>
        <div className="space-y-2">
          {(pending ?? []).length === 0 ? (
            <Card>
              <p className="text-sm text-slate-700">No pending challenges right now.</p>
            </Card>
          ) : (
            (pending ?? []).map((item) => (
            <Card key={item.id} variant="flat">
              <p className="text-sm font-bold text-slate-900">{item.name}</p>
              <p className="text-xs text-slate-600 mt-1">Owner: {item.createdBy.slice(0, 8)} • Type: {item.status}</p>
              <div className="mt-3 flex gap-2">
                <button className="h-9 px-3 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-50" disabled={!permissions.canApproveChallenges || approveMutation.isPending || requestChangesMutation.isPending} onClick={() => onApprove(item.id)}>
                  Approve
                </button>
                <button className="h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold disabled:opacity-50" disabled={!permissions.canRequestChallengeChanges || approveMutation.isPending || requestChangesMutation.isPending} onClick={() => onRequestChanges(item.id)}>
                  Request Changes
                </button>
              </div>
            </Card>
            ))
          )}
        </div>
        <Card className="mt-3">
          <div className="grid md:grid-cols-2 gap-2">
            <button className="h-11 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/admin/challenges/approved')}>
              View Approved Challenges
            </button>
            <button className="h-11 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/admin/challenges/templates')}>
              View Templates
            </button>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}

export default AdminPendingChallengesScreen;
