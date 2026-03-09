import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import {
  useActivateAdminGroup,
  useGroupModerationQueue,
  useSetGroupModerationQueueStatus,
  useSuspendAdminGroup,
  useSuspendGroupMember,
} from '../../../hooks/useAdminGroups';
import { AdminLayout } from '../layout/AdminLayout';

function GroupModerationScreen() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useGroupModerationQueue();
  const setStatus = useSetGroupModerationQueueStatus();
  const suspendGroup = useSuspendAdminGroup();
  const activateGroup = useActivateAdminGroup();
  const suspendMember = useSuspendGroupMember();

  if (isLoading) return <LoadingSpinner fullScreen label="Loading moderation queue..." />;

  const onResolve = async (reportId: string, status: 'open' | 'reviewed' | 'resolved') => {
    if (!user?.uid) return;
    try {
      await setStatus.mutateAsync({ reportId, status, adminUid: user.uid });
      showToast(`Report set to ${status}.`, 'success');
    } catch {
      showToast('Could not update report.', 'error');
    }
  };

  const onSuspendGroup = async (groupId: string) => {
    if (!user?.uid) return;
    try {
      await suspendGroup.mutateAsync({ groupId, adminUid: user.uid });
      showToast('Group suspended.', 'success');
    } catch {
      showToast('Could not suspend group.', 'error');
    }
  };

  const onRestoreGroup = async (groupId: string) => {
    if (!user?.uid) return;
    try {
      await activateGroup.mutateAsync({ groupId, adminUid: user.uid });
      showToast('Group restored to active.', 'success');
    } catch {
      showToast('Could not restore group.', 'error');
    }
  };

  const onSuspendMember = async (groupId: string, userId: string) => {
    if (!user?.uid) return;
    try {
      await suspendMember.mutateAsync({ groupId, userId, adminUid: user.uid });
      showToast('Member suspended from group.', 'success');
    } catch {
      showToast('Could not suspend member.', 'error');
    }
  };

  return (
    <AdminLayout title="Group Moderation" permissions={permissions}>
      <Card>
        <p className="text-sm text-slate-600">Review flagged group content and resolve moderation actions.</p>
      </Card>

      <div className="mt-3 space-y-2">
        {(data ?? []).length === 0 ? (
          <Card><p className="text-sm text-slate-700">No flagged reports in queue.</p></Card>
        ) : (
          (data ?? []).map((item) => (
            <Card key={item.id} variant="flat">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">{item.groupName}</p>
                  <p className="text-xs text-slate-600 mt-1">{item.reportType}</p>
                  <p className="text-sm text-slate-700 mt-2">{item.reason || 'No reason provided.'}</p>
                  {item.reportedUserId ? (
                    <p className="text-xs text-slate-500 mt-1">Reported member: {item.reportedUserId.slice(0, 8)}</p>
                  ) : null}
                </div>
                <span className="text-xs font-bold text-slate-600">{item.status}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold disabled:opacity-50" disabled={!permissions.canModerateGroups || setStatus.isPending} onClick={() => onResolve(item.id, 'reviewed')}>Mark Reviewed</button>
                <button className="h-9 px-3 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-50" disabled={!permissions.canModerateGroups || setStatus.isPending} onClick={() => onResolve(item.id, 'resolved')}>Resolve</button>
                <button className="h-9 px-3 rounded-lg bg-red-100 text-red-700 text-xs font-bold disabled:opacity-50" disabled={!permissions.canModerateGroups || suspendGroup.isPending} onClick={() => onSuspendGroup(item.groupId)}>Suspend Group</button>
                <button className="h-9 px-3 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold disabled:opacity-50" disabled={!permissions.canModerateGroups || activateGroup.isPending} onClick={() => onRestoreGroup(item.groupId)}>Restore Group</button>
                {item.reportedUserId ? (
                  <button className="h-9 px-3 rounded-lg bg-red-50 text-red-700 text-xs font-bold disabled:opacity-50" disabled={!permissions.canModerateGroups || suspendMember.isPending} onClick={() => onSuspendMember(item.groupId, item.reportedUserId!)}>
                    Suspend Member
                  </button>
                ) : null}
              </div>
            </Card>
          ))
        )}
      </div>
    </AdminLayout>
  );
}

export default GroupModerationScreen;
