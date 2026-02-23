import { useNavigate, useParams } from 'react-router-dom';
import { Card, EmptyState, LoadingSpinner } from '../../../components/Mobile';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useAdminGroup, useSetAdminGroupFeatured, useSetAdminGroupStatus } from '../../../hooks/useAdminGroups';
import { AdminLayout } from '../layout/AdminLayout';

function GroupDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useAdminGroup(id);
  const setStatus = useSetAdminGroupStatus();
  const setFeatured = useSetAdminGroupFeatured();

  const onStatus = async (status: 'active' | 'flagged' | 'deactivated') => {
    if (!id || !user?.uid) return;
    try {
      await setStatus.mutateAsync({ groupId: id, status, adminUid: user.uid });
      showToast(`Group status set to ${status}.`, 'success');
    } catch {
      showToast('Could not update status.', 'error');
    }
  };

  const onFeatureToggle = async () => {
    if (!id || !user?.uid || !data) return;
    try {
      await setFeatured.mutateAsync({ groupId: id, isFeatured: !data.isFeatured, adminUid: user.uid });
      showToast(data.isFeatured ? 'Group unfeatured.' : 'Group featured.', 'success');
    } catch {
      showToast('Could not update feature status.', 'error');
    }
  };

  if (isLoading) return <LoadingSpinner fullScreen label="Loading group detail..." />;

  if (!data) {
    return (
      <EmptyState
        icon={<span>👥</span>}
        title="Group not found"
        message="Could not load this group for moderation."
        action={(
          <button className="h-11 px-4 rounded-xl bg-primary text-white text-sm font-bold" onClick={() => navigate('/app/admin/groups')}>
            Back to Groups
          </button>
        )}
      />
    );
  }

  return (
    <AdminLayout title={`Group Detail: ${data.name}`} permissions={permissions}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card variant="flat">
          <p className="text-xs font-bold uppercase text-slate-500">Overview</p>
          <p className="text-sm font-semibold text-slate-900 mt-2">{data.name}</p>
          <p className="text-sm text-slate-700 mt-1">{data.description}</p>
          <p className="text-sm text-slate-700 mt-2">Owner: {data.ownerId}</p>
          <p className="text-sm text-slate-700">Members: {data.memberCount}</p>
          <p className="text-sm text-slate-700">Challenges: {data.challengeCount}</p>
          <p className="text-sm text-slate-700">Workouts: {data.workoutCount}</p>
          <p className="text-sm text-slate-700">Status: {data.moderationStatus}</p>
          <p className="text-sm text-slate-700">Featured: {data.isFeatured ? 'Yes' : 'No'}</p>
        </Card>

        <Card variant="flat">
          <p className="text-xs font-bold uppercase text-slate-500">Moderation Actions</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="h-10 px-4 rounded-lg bg-green-600 text-white text-sm font-bold disabled:opacity-50" disabled={!permissions.canModerateGroups || setStatus.isPending} onClick={() => onStatus('active')}>Set Active</button>
            <button className="h-10 px-4 rounded-lg bg-amber-600 text-white text-sm font-bold disabled:opacity-50" disabled={!permissions.canModerateGroups || setStatus.isPending} onClick={() => onStatus('flagged')}>Flag Group</button>
            <button className="h-10 px-4 rounded-lg bg-red-600 text-white text-sm font-bold disabled:opacity-50" disabled={!permissions.canModerateGroups || setStatus.isPending} onClick={() => onStatus('deactivated')}>Deactivate</button>
            <button className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50" disabled={!permissions.canFeatureGroups || setFeatured.isPending} onClick={onFeatureToggle}>
              {data.isFeatured ? 'Unfeature' : 'Feature'}
            </button>
          </div>
        </Card>
      </div>

      <Card className="mt-3">
        <p className="text-xs font-bold uppercase text-slate-500">Recent Challenges</p>
        <div className="mt-2 space-y-2">
          {data.recentChallenges.length === 0 ? (
            <p className="text-sm text-slate-600">No challenges in this group yet.</p>
          ) : (
            data.recentChallenges.map((challenge) => (
              <div key={challenge.id} className="rounded-lg border border-slate-200 p-2">
                <p className="text-sm font-semibold text-slate-900">{challenge.name}</p>
                <p className="text-xs text-slate-600 mt-1">{challenge.status} • {new Date(challenge.startDate).toLocaleDateString()}</p>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="mt-3">
        <p className="text-xs font-bold uppercase text-slate-500">Recent Group Workouts</p>
        <div className="mt-2 space-y-2">
          {data.recentWorkouts.length === 0 ? (
            <p className="text-sm text-slate-600">No workouts linked to this group yet.</p>
          ) : (
            data.recentWorkouts.map((workout) => (
              <div key={workout.id} className="rounded-lg border border-slate-200 p-2">
                <p className="text-sm text-slate-800">User {workout.userId.slice(0, 8)} logged {workout.value} {workout.unit}</p>
                <p className="text-xs text-slate-500 mt-1">{new Date(workout.completedAt).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
        <button className="mt-3 h-10 px-4 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/admin/groups')}>
          Back to Group List
        </button>
      </Card>
    </AdminLayout>
  );
}

export default GroupDetailScreen;
