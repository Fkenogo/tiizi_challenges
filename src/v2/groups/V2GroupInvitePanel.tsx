import { useState } from 'react';
import { ApiError } from '../../api/apiClient';
import { V2Button, V2Card, V2TextInput } from '../components/V2Primitives';
import { useJoinGroup, useResolveGroupInvite } from './useV2Groups';

export function V2GroupInvitePanel({ onOpen }: { onOpen: (id: string) => void }) {
  const [code, setCode] = useState('');
  const resolve = useResolveGroupInvite();
  const group = resolve.data;
  const join = useJoinGroup(group?.id ?? null);
  const status = join.isSuccess ? join.data.status : group?.viewerRelationship;
  return <section aria-label="Join with code" className="mx-auto w-full max-w-xl space-y-3">
    <V2Card><h2 className="text-base font-black text-slate-900">Join with an invite code</h2><p className="mt-1 text-sm text-slate-600">Enter a Group’s code to preview it. You choose whether to join or request access.</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row"><div className="min-w-0 flex-1"><label className="sr-only" htmlFor="group-invite-code">Invite code</label><V2TextInput value={code} onChange={(value) => { setCode(value); resolve.reset(); join.reset(); }} placeholder="TIZI-XXXX-XXXX-XXXX" maxLength={24} /></div><V2Button disabled={!code.trim() || resolve.isPending} onClick={() => resolve.mutate(code.trim())}>{resolve.isPending ? 'Checking…' : 'Preview Group'}</V2Button></div>
      {resolve.isError && <p role="alert" className="mt-2 text-sm text-red-700">{resolve.error instanceof ApiError && resolve.error.status === 503 ? 'Tiizi is unavailable. Please try again.' : 'That code could not be found. Check it and try again.'}</p>}
    </V2Card>
    {group && <V2Card><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Group preview</p><h3 className="mt-1 text-lg font-black text-slate-900">{group.name}</h3>{(group.tagline || group.description) && <p className="mt-1 text-sm text-slate-600">{group.tagline || group.description}</p>}<p className="mt-2 text-xs text-slate-500">{group.isPrivate ? 'Private Group · invite code access' : group.location ? `Based in ${group.location}` : 'Tiizi Group'} · {group.admissionMode === 'approval' ? 'Steward approval required' : 'Open to join'}</p>
      <div className="mt-3">{status === 'pending' ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">Your request is pending Steward review.</p> : ['active','member','steward'].includes(status ?? '') ? <V2Button variant="secondary" onClick={() => onOpen(group.id)}>Open Group</V2Button> : <V2Button disabled={join.isPending} onClick={() => join.mutate()}>{join.isPending ? 'Sending…' : group.admissionMode === 'approval' ? 'Request to Join' : 'Join Group'}</V2Button>}</div>
      {join.isError && <p role="alert" className="mt-2 text-xs text-red-700">We could not update your membership. Please try again.</p>}
    </V2Card>}
  </section>;
}
