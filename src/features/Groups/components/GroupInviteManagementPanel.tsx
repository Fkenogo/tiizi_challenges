import { Check, Clipboard, Link2, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  useApproveGroupJoinRequest,
  useCreateGroupInvite,
  useGroupInvites,
  useGroupJoinRequests,
  useRejectGroupJoinRequest,
  useRevokeGroupInvite,
} from '../../../hooks/useGroupInvites';
import { getGroupInviteErrorMessage, type GroupInviteType } from '../../../services/groupInviteUtils';

type Props = {
  groupId: string;
};

function formatDate(value: unknown) {
  if (!value) return 'Not set';
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : value;
  }
  if (typeof value === 'object' && value && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toLocaleString();
  }
  if (typeof value === 'object' && value && 'seconds' in value && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000).toLocaleString();
  }
  return String(value);
}

function defaultExpiry() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  date.setMinutes(0, 0, 0);
  return date.toISOString().slice(0, 16);
}

function inviteStatus(invite: { status: string; expiresAt: string }) {
  if (String(invite.status).toLowerCase() === 'revoked') return 'revoked';
  const expiresMs = Date.parse(invite.expiresAt);
  if (Number.isFinite(expiresMs) && expiresMs <= Date.now()) return 'expired';
  return invite.status || 'active';
}

export function GroupInviteManagementPanel({ groupId }: Props) {
  const [type, setType] = useState<GroupInviteType>('one_time');
  const [maxUses, setMaxUses] = useState(5);
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);
  const [note, setNote] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  const invites = useGroupInvites(groupId);
  const requests = useGroupJoinRequests(groupId);
  const createInvite = useCreateGroupInvite(groupId);
  const revokeInvite = useRevokeGroupInvite(groupId);
  const approveRequest = useApproveGroupJoinRequest(groupId);
  const rejectRequest = useRejectGroupJoinRequest(groupId);

  const pendingRequests = useMemo(
    () => (requests.data ?? []).filter((request) => request.status === 'pending'),
    [requests.data],
  );

  const handleCreate = async () => {
    setError(null);
    setCreatedToken(null);
    try {
      const result = await createInvite.mutateAsync({
        groupId,
        type,
        maxUses: type === 'one_time' ? 1 : maxUses,
        expiresAt: new Date(expiresAt).toISOString(),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setCreatedToken(result.token);
      setNote('');
    } catch (createError) {
      setError(getGroupInviteErrorMessage(createError));
    }
  };

  const canSubmit = Boolean(expiresAt) && (type === 'one_time' || maxUses > 0) && !createInvite.isPending;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary" />
            <h3 className="text-[16px] leading-[20px] font-black text-slate-900">Invite Management</h3>
          </div>
          <p className="mt-1 text-[13px] leading-[18px] text-[#61758f]">Create private invites and review join requests.</p>
        </div>
        <button
          type="button"
          className="h-9 w-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center"
          onClick={() => {
            invites.refetch();
            requests.refetch();
          }}
          aria-label="Refresh invites and requests"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {createdToken && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[13px] leading-[18px] font-bold text-emerald-900">This code will only be shown once.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded-xl bg-white px-3 py-2 text-[14px] font-black tracking-[0.08em] text-slate-900 break-all">
              {createdToken}
            </code>
            <button
              type="button"
              className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center"
              onClick={() => navigator.clipboard?.writeText(createdToken)}
              aria-label="Copy invite code"
            >
              <Clipboard size={17} />
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[13px] leading-[18px] font-semibold text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 grid gap-3">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
          {(['one_time', 'multi_use'] as GroupInviteType[]).map((option) => (
            <button
              key={option}
              type="button"
              className={`h-10 rounded-xl text-[14px] font-bold ${type === option ? 'bg-white text-slate-900 shadow-sm' : 'text-[#61758f]'}`}
              onClick={() => setType(option)}
            >
              {option === 'one_time' ? 'One-time' : 'Multi-use'}
            </button>
          ))}
        </div>

        <label className="grid gap-1 text-[13px] font-bold text-[#1f334f]">
          Expiry
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            className="h-12 rounded-xl border border-[#d8e2f0] bg-white px-3 text-[14px] font-semibold text-slate-900"
          />
        </label>

        {type === 'multi_use' && (
          <label className="grid gap-1 text-[13px] font-bold text-[#1f334f]">
            Max uses
            <input
              type="number"
              min={1}
              max={10000}
              value={maxUses}
              onChange={(event) => setMaxUses(Number(event.target.value))}
              className="h-12 rounded-xl border border-[#d8e2f0] bg-white px-3 text-[14px] font-semibold text-slate-900"
            />
          </label>
        )}

        <label className="grid gap-1 text-[13px] font-bold text-[#1f334f]">
          Note
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Optional context for managers"
            className="rounded-xl border border-[#d8e2f0] bg-white px-3 py-2 text-[14px] leading-[20px] text-slate-900"
          />
        </label>

        <button
          type="button"
          className="h-12 rounded-xl bg-primary text-white text-[15px] font-black disabled:opacity-60"
          disabled={!canSubmit}
          onClick={handleCreate}
        >
          {createInvite.isPending ? 'Creating...' : 'Create Invite'}
        </button>
      </div>

      <div className="mt-5">
        <h4 className="text-[14px] leading-[18px] font-black text-slate-900">Invites</h4>
        <div className="mt-2 space-y-2">
          {invites.isLoading ? (
            <p className="text-[13px] leading-[18px] text-[#61758f]">Loading invites...</p>
          ) : (invites.data ?? []).length === 0 ? (
            <p className="text-[13px] leading-[18px] text-[#61758f]">No invites created yet.</p>
          ) : (
            (invites.data ?? []).map((invite) => {
              const status = inviteStatus(invite);
              return (
                <div key={invite.id} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[14px] leading-[18px] font-black text-slate-900">
                        {invite.type === 'one_time' ? 'One-time' : 'Multi-use'} invite
                      </p>
                      <p className="mt-1 text-[12px] leading-[16px] text-[#61758f]">
                        {invite.useCount}/{invite.maxUses} uses · expires {formatDate(invite.expiresAt)}
                      </p>
                      {invite.note && <p className="mt-1 text-[12px] leading-[16px] text-slate-700">{invite.note}</p>}
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black uppercase text-slate-700">
                      {status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[12px] leading-[16px] text-[#61758f]">Created {formatDate(invite.createdAt)}</p>
                    {status === 'active' && (
                      <button
                        type="button"
                        className="h-9 px-3 rounded-xl bg-red-50 text-[13px] font-bold text-red-700 disabled:opacity-60"
                        disabled={revokeInvite.isPending}
                        onClick={async () => {
                          setError(null);
                          try {
                            await revokeInvite.mutateAsync(invite.id);
                          } catch (revokeError) {
                            setError(getGroupInviteErrorMessage(revokeError));
                          }
                        }}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-5">
        <h4 className="text-[14px] leading-[18px] font-black text-slate-900">Join Requests</h4>
        <div className="mt-2 space-y-2">
          {requests.isLoading ? (
            <p className="text-[13px] leading-[18px] text-[#61758f]">Loading requests...</p>
          ) : pendingRequests.length === 0 ? (
            <p className="text-[13px] leading-[18px] text-[#61758f]">No pending requests.</p>
          ) : (
            pendingRequests.map((request) => (
              <div key={request.id} className="rounded-2xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] leading-[18px] font-black text-slate-900">{request.userId}</p>
                    <p className="mt-1 text-[12px] leading-[16px] text-[#61758f]">
                      Requested {formatDate(request.requestedAt)} · {request.source}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center disabled:opacity-60"
                      disabled={approveRequest.isPending}
                      onClick={async () => {
                        setError(null);
                        try {
                          await approveRequest.mutateAsync(request);
                        } catch (approveError) {
                          setError(getGroupInviteErrorMessage(approveError));
                        }
                      }}
                      aria-label="Approve request"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      className="h-9 w-9 rounded-xl bg-red-50 text-red-700 flex items-center justify-center disabled:opacity-60"
                      disabled={rejectRequest.isPending}
                      onClick={() => setRejectingRequestId(request.id)}
                      aria-label="Reject request"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
                {rejectingRequestId === request.id && (
                  <div className="mt-3 flex gap-2">
                    <input
                      id={`reject-${request.id}`}
                      placeholder="Reason"
                      value={rejectionReasons[request.id] ?? ''}
                      onChange={(event) =>
                        setRejectionReasons((current) => ({ ...current, [request.id]: event.target.value }))
                      }
                      className="h-10 min-w-0 flex-1 rounded-xl border border-[#d8e2f0] px-3 text-[13px]"
                    />
                    <button
                      type="button"
                      className="h-10 px-3 rounded-xl bg-red-600 text-[13px] font-bold text-white"
                      onClick={async () => {
                        setError(null);
                        try {
                          await rejectRequest.mutateAsync({ request, reason: rejectionReasons[request.id] });
                          setRejectingRequestId(null);
                        } catch (rejectError) {
                          setError(getGroupInviteErrorMessage(rejectError));
                        }
                      }}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <p className="mt-4 flex items-center gap-2 text-[12px] leading-[16px] text-[#61758f]">
        <Link2 size={14} />
        Invite tokens are hidden after creation. Existing rows never expose token hashes.
      </p>
    </section>
  );
}
