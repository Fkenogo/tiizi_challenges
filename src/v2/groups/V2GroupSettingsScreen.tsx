import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { V2Button, V2Page } from '../components/V2Primitives';
import { useV2GroupDetail, useUpdateV2GroupSettings } from './useV2Groups';
import { useV2GroupId } from '../group/V2GroupScope';
import { GROUP_COVER_CATALOGUE, coverLabelFor } from './groupCovers';

export function V2GroupSettingsScreen() {
  const groupId = useV2GroupId();
  const detail = useV2GroupDetail(groupId);
  const update = useUpdateV2GroupSettings(groupId ?? '');
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagline, setTagline] = useState('');
  const [location, setLocation] = useState('');
  const [focusTags, setFocusTags] = useState('');
  const [coverId, setCoverId] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [requireAdminApproval, setRequireAdminApproval] = useState(false);
  const [allowMemberChallenges, setAllowMemberChallenges] = useState(true);
  useEffect(() => {
    const group = detail.data;
    if (!group) return;
    setName(group.name); setDescription(group.description); setTagline(group.tagline);
    setLocation(group.location); setFocusTags(group.focusTags.join(', ')); setCoverId(group.coverId);
    setIsPrivate(group.isPrivate); setRequireAdminApproval(group.requireAdminApproval ?? false);
    setAllowMemberChallenges(group.allowMemberChallenges ?? true);
  }, [detail.data]);

  if (detail.isLoading) return <V2Page><p className="text-sm text-slate-600">Loading Group settings…</p></V2Page>;
  if (!detail.data || detail.data.viewerRelationship !== 'steward') return <V2Page><h1 className="text-lg font-black">Settings unavailable</h1><p className="mt-2 text-sm text-slate-600">These settings are available to the Accountable Steward.</p></V2Page>;
  const group = detail.data;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate({ name, description, tagline, location, focusTags: focusTags.split(',').map(tag => tag.trim()).filter(Boolean), coverId, isPrivate, requireAdminApproval, allowMemberChallenges }, { onSuccess: () => navigate(`/v2/groups/${group.id}`) });
  };
  const field = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900';
  const label = 'block text-sm font-bold text-slate-800';
  const choice = (title: string, checked: boolean, onChange: (value: boolean) => void, help: string) => <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-1 accent-orange-600"/><span><span className="block text-sm font-bold text-slate-800">{title}</span><span className="mt-0.5 block text-xs leading-5 text-slate-600">{help}</span></span></label>;

  return <V2Page>
    <Link to={`/v2/groups/${group.id}`} className="text-sm font-bold text-slate-500 hover:text-slate-800">← Back to {group.name}</Link>
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Accountable Steward</p>
      <h1 className="mt-1 text-2xl font-black text-slate-900">Manage Group</h1>
      <p className="mt-1 text-sm leading-6 text-slate-600">Update how people understand, find, and join your Group.</p>
      <form className="mt-6 space-y-7" onSubmit={submit}>
        <section className="space-y-4"><div><h2 className="text-base font-black">Group identity</h2><p className="text-xs text-slate-500">Focus tags can affect text search. Location is descriptive only.</p></div>
          <label className={label}>Name<input className={field} required maxLength={200} value={name} onChange={e => setName(e.target.value)} /></label>
          <label className={label}>Description<textarea className={field} rows={4} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} /></label>
          <label className={label}>Tagline<input className={field} maxLength={140} value={tagline} onChange={e => setTagline(e.target.value)} /></label>
          <label className={label}>Location<input className={field} maxLength={120} value={location} onChange={e => setLocation(e.target.value)} /><span className="mt-1 block text-xs font-normal text-slate-500">A short description. It does not affect search or access.</span></label>
          <label className={label}>Focus tags<input className={field} maxLength={300} value={focusTags} onChange={e => setFocusTags(e.target.value)} placeholder="Walking, wellbeing" /><span className="mt-1 block text-xs font-normal text-slate-500">Separate up to 8 tags with commas. These may appear in text search.</span></label>
          <fieldset><legend className={label}>Group cover</legend><div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">{GROUP_COVER_CATALOGUE.map(id => <button key={id} type="button" aria-label={`Select ${coverLabelFor(id)}`} aria-pressed={coverId === id} onClick={() => setCoverId(coverId === id ? null : id)} className={`h-12 rounded-xl bg-gradient-to-br ${id === 'cover-1' ? 'from-orange-400 to-rose-500' : id === 'cover-2' ? 'from-sky-400 to-indigo-600' : id === 'cover-3' ? 'from-emerald-400 to-teal-700' : id === 'cover-4' ? 'from-amber-300 to-orange-600' : id === 'cover-5' ? 'from-violet-400 to-fuchsia-600' : id === 'cover-6' ? 'from-cyan-300 to-blue-600' : id === 'cover-7' ? 'from-lime-300 to-green-700' : 'from-pink-300 to-red-600'} ring-offset-2 ${coverId === id ? 'ring-2 ring-orange-600' : ''}`}><span className="sr-only">{coverLabelFor(id)}</span></button>)}</div><p className="mt-1 text-xs text-slate-500">Choose from the existing covers. No image upload.</p></fieldset>
        </section>
        <section className="space-y-3"><h2 className="text-base font-black">Privacy & joining</h2>{choice('Private Group', isPrivate, setIsPrivate, 'People outside the Group cannot discover it normally. A valid invite code may still resolve it. Existing members are unaffected.')}{choice('Require approval to join', requireAdminApproval, setRequireAdminApproval, 'New join attempts require Steward approval. Existing pending requests remain pending until explicitly decided.')}</section>
        <section className="space-y-3"><h2 className="text-base font-black">Member Challenges</h2>{choice('Allow ordinary members to create Challenges', allowMemberChallenges, setAllowMemberChallenges, 'When off, ordinary members cannot establish new Group Challenges. Existing Challenges remain unchanged; you can still create them.')}</section>
        {update.isError && <p role="alert" className="text-sm text-red-700">We could not save these changes. Please review the fields and try again.</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end"><V2Button variant="secondary" onClick={() => navigate(`/v2/groups/${group.id}`)}>Cancel</V2Button><V2Button type="submit" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save changes'}</V2Button></div>
      </form>
    </div>
  </V2Page>;
}
