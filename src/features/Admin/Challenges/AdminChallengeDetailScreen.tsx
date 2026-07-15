import { Archive, ArrowLeft, CheckCircle2, RefreshCw, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import {
  useAdminChallenge,
  useArchiveChallenge,
  useDeactivateChallenge,
  useDeleteChallengeAdmin,
  useMarkChallengeCompleted,
  useReactivateChallenge,
} from '../../../hooks/useAdminChallenges';
import { AdminLayout } from '../layout/AdminLayout';

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: 'Active', bg: 'bg-green-100', text: 'text-green-800' },
  upcoming: { label: 'Upcoming', bg: 'bg-blue-100', text: 'text-blue-800' },
  completed: { label: 'Completed', bg: 'bg-slate-100', text: 'text-slate-600' },
  archived: { label: 'Archived', bg: 'bg-amber-100', text: 'text-amber-800' },
  inactive: { label: 'Inactive', bg: 'bg-red-100', text: 'text-red-800' },
  draft: { label: 'Draft', bg: 'bg-purple-100', text: 'text-purple-800' },
  pending: { label: 'Pending', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  deleted: { label: 'Deleted', bg: 'bg-slate-200', text: 'text-slate-500' },
};

function StatusBadge({ status }: { status: string }) {
  const badge = STATUS_BADGE[status] ?? { label: status, bg: 'bg-slate-100', text: 'text-slate-600' };
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${badge.bg} ${badge.text}`}>
      {badge.label}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
      <p className="w-36 flex-shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex-1 text-[13px] text-slate-800">{children}</div>
    </div>
  );
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function AdminChallengeDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data: challenge, isLoading } = useAdminChallenge(id);
  const { showToast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const archiveMutation = useArchiveChallenge();
  const deactivateMutation = useDeactivateChallenge();
  const reactivateMutation = useReactivateChallenge();
  const completeMutation = useMarkChallengeCompleted();
  const deleteMutation = useDeleteChallengeAdmin();

  const handleAction = async (action: string) => {
    if (!id) return;
    if (action === 'delete') { setConfirmDelete(true); return; }
    try {
      if (action === 'archive') await archiveMutation.mutateAsync(id);
      else if (action === 'deactivate') await deactivateMutation.mutateAsync(id);
      else if (action === 'reactivate') await reactivateMutation.mutateAsync(id);
      else if (action === 'complete') await completeMutation.mutateAsync(id);
      showToast(`Challenge ${action}d.`, 'success');
    } catch {
      showToast(`Failed to ${action} challenge.`, 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!id) return;
    try {
      await deleteMutation.mutateAsync(id);
      showToast('Challenge deleted.', 'success');
      navigate('/app/admin/challenges/active');
    } catch {
      showToast('Failed to delete challenge.', 'error');
    } finally {
      setConfirmDelete(false);
    }
  };

  if (isLoading) return <LoadingSpinner fullScreen label="Loading challenge..." />;
  if (!challenge) return (
    <AdminLayout title="Challenge Detail" permissions={permissions}>
      <Card><p className="text-sm text-slate-600">Challenge not found.</p></Card>
    </AdminLayout>
  );

  const effectiveStatus = challenge.effectiveStatus;
  const extra = challenge as unknown as Record<string, unknown>;
  const description = extra.description ? String(extra.description) : undefined;
  const engineVersion = extra.engineVersion ? String(extra.engineVersion) : undefined;
  const groupCumulativeTarget = extra.groupCumulativeTarget != null ? String(extra.groupCumulativeTarget) : undefined;
  const requiredConsecutiveDays = extra.requiredConsecutiveDays != null ? String(extra.requiredConsecutiveDays) : undefined;
  const activities = Array.isArray(extra.activities)
    ? extra.activities as Array<Record<string, unknown>>
    : [];

  return (
    <AdminLayout title="Challenge Detail" permissions={permissions}>
      {/* Back */}
      <button
        className="flex items-center gap-1.5 text-[12px] font-semibold text-primary mb-3"
        onClick={() => navigate('/app/admin/challenges/active')}
      >
        <ArrowLeft size={14} /> Back to Challenge Management
      </button>

      {/* Header */}
      <Card className="mb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[18px] font-black text-slate-900 leading-tight">{challenge.name}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={effectiveStatus} />
              {effectiveStatus !== challenge.status && (
                <span className="text-[10px] text-slate-400 italic">stored: {challenge.status}</span>
              )}
              <span className="text-[11px] text-slate-500 capitalize">{challenge.challengeType}</span>
              <span className="text-[11px] text-slate-500 capitalize">{challenge.category}</span>
            </div>
            {description && (
              <p className="mt-2 text-[12px] text-slate-600 leading-snug">{description}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Details */}
      <Card className="mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Details</p>
        <Row label="Status">{effectiveStatus}</Row>
        <Row label="Stored Status">{challenge.status}</Row>
        <Row label="Type"><span className="capitalize">{challenge.challengeType}</span></Row>
        <Row label="Category"><span className="capitalize">{challenge.category}</span></Row>
        <Row label="Group">
          {challenge.groupId ? (
            <button
              className="text-primary hover:underline text-left"
              onClick={() => navigate(`/app/admin/groups/${challenge.groupId}`)}
            >
              {challenge.groupName || challenge.groupId}
            </button>
          ) : '—'}
        </Row>
        <Row label="Group ID">{challenge.groupId ?? '—'}</Row>
        <Row label="Participants">{challenge.participantCount.toLocaleString()}</Row>
        <Row label="Start date">{fmtDate(challenge.startDate)}</Row>
        <Row label="End date">{fmtDate(challenge.endDate)}</Row>
        <Row label="Created">{fmtDate(challenge.createdAt)}</Row>
        <Row label="Updated">{fmtDate(challenge.updatedAt)}</Row>
        <Row label="Created by">{challenge.createdBy ?? '—'}</Row>
        {engineVersion && <Row label="Engine">v{engineVersion}</Row>}
        {groupCumulativeTarget && <Row label="Group target">{groupCumulativeTarget}</Row>}
        {requiredConsecutiveDays && <Row label="Required days">{requiredConsecutiveDays}</Row>}
        {challenge.moderationStatus && (
          <Row label="Moderation"><span className="capitalize">{challenge.moderationStatus}</span></Row>
        )}
      </Card>

      {/* Activities */}
      {activities.length > 0 && (
        <Card className="mb-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
            Activities ({activities.length})
          </p>
          <div className="space-y-2">
            {activities.map((act, i) => (
              <div key={i} className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-[13px] font-semibold text-slate-800">
                  {String(act.exerciseName ?? act.name ?? `Activity ${i + 1}`)}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-slate-500">
                  {act.targetValue != null && <span>Target: {String(act.targetValue)} {String(act.unit ?? '')}</span>}
                  {act.activityType ? <span>Type: {String(act.activityType)}</span> : null}
                  {act.category ? <span>Category: {String(act.category)}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Lifecycle actions */}
      {permissions.canModerateChallenges && (
        <Card className="mb-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Actions</p>
          <div className="flex flex-wrap gap-2">
            {effectiveStatus === 'active' && (
              <>
                <button
                  className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold"
                  onClick={() => handleAction('deactivate')}
                >
                  <XCircle size={13} className="text-red-500" /> Deactivate
                </button>
                <button
                  className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold"
                  onClick={() => handleAction('complete')}
                >
                  <CheckCircle2 size={13} className="text-green-600" /> Mark Completed
                </button>
                <button
                  className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold"
                  onClick={() => handleAction('archive')}
                >
                  <Archive size={13} className="text-amber-600" /> Archive
                </button>
              </>
            )}
            {(effectiveStatus === 'inactive' || effectiveStatus === 'draft' || effectiveStatus === 'archived' || effectiveStatus === 'completed') && (
              <button
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold"
                onClick={() => handleAction('reactivate')}
              >
                {effectiveStatus === 'archived' ? <RotateCcw size={13} className="text-blue-600" /> : <RefreshCw size={13} className="text-green-600" />}
                {effectiveStatus === 'archived' ? 'Restore to Active' : 'Reactivate'}
              </button>
            )}
            <button
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-red-50 text-red-700 text-xs font-semibold"
              onClick={() => handleAction('delete')}
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </Card>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-[15px] font-black text-slate-900">Delete challenge?</p>
            <p className="mt-1 text-sm text-slate-600">
              "<span className="font-semibold">{challenge.name}</span>" will be soft-deleted and hidden from users.
            </p>
            <div className="mt-4 flex gap-2">
              <button className="flex-1 h-10 rounded-xl bg-red-600 text-white text-sm font-bold" onClick={handleConfirmDelete}>
                Delete
              </button>
              <button className="flex-1 h-10 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
