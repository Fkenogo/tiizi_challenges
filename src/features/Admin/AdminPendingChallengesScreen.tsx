import { useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../components/Mobile';
import { useState } from 'react';
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    <AdminLayout title="Pending Cause Challenge Approvals" permissions={permissions}>
      <div>
        <Card>
          <p className="text-sm text-slate-600">
            Only donation-enabled Fitness + Cause challenges require approval. Standard challenges go live automatically.
          </p>
        </Card>
        <div className="space-y-2">
          {(pending ?? []).length === 0 ? (
            <Card>
              <p className="text-sm text-slate-700">No pending challenges right now.</p>
            </Card>
          ) : (
            (pending ?? []).map((item) => (
            <Card key={item.id} variant="flat">
              <p className="text-sm font-bold text-slate-900">{item.name}</p>
              <p className="text-xs text-slate-600 mt-1">Owner: {item.createdBy.slice(0, 8)} • Status: {item.status}</p>
              {item.donation?.enabled ? (
                <p className="mt-1 text-xs text-amber-700 font-semibold">
                  Fitness + Cause challenge • Requires super admin approval before active
                </p>
              ) : null}
              <div className="mt-2">
                <button
                  className="text-xs font-bold text-primary"
                  onClick={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
                >
                  {expandedId === item.id ? 'Hide details' : 'View details'}
                </button>
              </div>
              {expandedId === item.id ? (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 space-y-1">
                  <p><span className="font-bold text-slate-900">Description:</span> {item.description || 'No description'}</p>
                  <p><span className="font-bold text-slate-900">Timeline:</span> {item.startDate} to {item.endDate}</p>
                  <p><span className="font-bold text-slate-900">Type:</span> {item.challengeType || 'collective'}</p>
                  <p><span className="font-bold text-slate-900">Group:</span> {item.groupId || 'N/A'}</p>
                  <p><span className="font-bold text-slate-900">Activities:</span> {(item.activities ?? []).length}</p>
                  {(item.activities ?? []).slice(0, 4).map((activity, index) => (
                    <p key={`${item.id}-activity-${index}`}>
                      • {activity.exerciseName || activity.exerciseId || 'Activity'}: {activity.targetValue} {activity.unit}
                    </p>
                  ))}
                  {item.donation?.enabled ? (
                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2">
                      <p className="font-bold text-amber-900">Social Cause Details</p>
                      <p><span className="font-semibold">Cause:</span> {item.donation.causeName || 'N/A'}</p>
                      <p><span className="font-semibold">Description:</span> {item.donation.causeDescription || 'N/A'}</p>
                      <p><span className="font-semibold">Target:</span> KES {(item.donation.targetAmountKes ?? 0).toLocaleString()}</p>
                      <p><span className="font-semibold">Contribution window:</span> {item.donation.contributionStartDate || '-'} to {item.donation.contributionEndDate || '-'}</p>
                      <p><span className="font-semibold">Mobile:</span> {item.donation.contributionPhoneNumber || 'N/A'}</p>
                      <p><span className="font-semibold">Card URL:</span> {item.donation.contributionCardUrl || 'N/A'}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
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
