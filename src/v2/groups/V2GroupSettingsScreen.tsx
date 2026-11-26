import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { V2Button, V2Page } from '../components/V2Primitives';
import { useV2GroupDetail, useUpdateV2GroupSettings, useV2GroupOptions } from './useV2Groups';
import { useV2GroupId } from '../group/V2GroupScope';
import { GROUP_COVER_CATALOGUE, coverGradientFor, coverLabelFor, isGroupCoverId } from './groupCovers';
import { GroupInterestsPicker } from './GroupInterestsPicker';
import { INTEREST_ISSUE_COPY, interestIssue, interestVocabulary, sameInterestSet } from './groupInterests';
import { V2LocalImagePicker } from '../media/V2LocalImagePicker';
import { removeGroupCoverImage, saveGroupCoverImage, type V2MediaImageProjection } from '../../api/mediaApi';
import { useLocalImagePreview } from '../media/useLocalImagePreview';
import { useFileUploadIdentity } from '../media/useFileUploadIdentity';
import { useAuth } from '../../hooks/useAuth';
import type { V2GroupDetail } from '../../api/groupsApi';
import { invalidateV2GroupCoverReads, v2GroupDetailKey } from './groupQueryKeys';
import { removeLocalGroupCoverPreview } from './localGroupCoverPreviews';

export function V2GroupSettingsScreen() {
  const groupId = useV2GroupId();
  const detail = useV2GroupDetail(groupId);
  const update = useUpdateV2GroupSettings(groupId ?? '');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagline, setTagline] = useState('');
  const [location, setLocation] = useState('');
  const options = useV2GroupOptions();
  const [focusTags, setFocusTags] = useState<string[]>([]);
  const [coverId, setCoverId] = useState<string | null>(null);
  const coverPhoto = useLocalImagePreview();
  const coverUploadIdentity = useFileUploadIdentity();
  const [isPrivate, setIsPrivate] = useState(false);
  const [requireAdminApproval, setRequireAdminApproval] = useState(false);
  const [allowMemberChallenges, setAllowMemberChallenges] = useState(true);
  const [coverSaving, setCoverSaving] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [coverSuccess, setCoverSuccess] = useState<string | null>(null);
  const [failedCoverAction, setFailedCoverAction] = useState<{ type: 'upload'; file: File } | { type: 'remove' } | null>(null);
  const [coverSavedInSession, setCoverSavedInSession] = useState(false);
  const initializedIdentityRef = useRef<string | null>(null);
  const uidRef = useRef(user?.uid);
  const groupIdRef = useRef(groupId);
  const coverOperationSeqRef = useRef(0);
  const coverInFlightRef = useRef(false);
  uidRef.current = user?.uid;
  groupIdRef.current = groupId;
  useEffect(() => {
    const group = detail.data;
    const identityKey = `${user?.uid ?? 'signed-out'}:${group?.id ?? 'none'}`;
    if (!group || initializedIdentityRef.current === identityKey) return;
    initializedIdentityRef.current = identityKey;
    coverOperationSeqRef.current += 1;
    coverInFlightRef.current = false;
    coverUploadIdentity.reset();
    coverPhoto.remove();
    setCoverSaving(false);
    setCoverError(null);
    setCoverSuccess(null);
    setFailedCoverAction(null);
    setCoverSavedInSession(false);
    setName(group.name); setDescription(group.description); setTagline(group.tagline);
    setLocation(group.location); setFocusTags(group.focusTags); setCoverId(group.coverId);
    setIsPrivate(group.isPrivate); setRequireAdminApproval(group.requireAdminApproval ?? false);
    setAllowMemberChallenges(group.allowMemberChallenges ?? true);
  }, [detail.data, user?.uid, coverUploadIdentity.reset]);

  if (detail.isLoading) return <V2Page><p className="text-sm text-slate-600">Loading Group settings…</p></V2Page>;
  if (!detail.data || detail.data.viewerRelationship !== 'steward') return <V2Page><h1 className="text-lg font-black">Settings unavailable</h1><p className="mt-2 text-sm text-slate-600">These settings are available to the Accountable Steward.</p></V2Page>;
  const group = detail.data;
  const vocabulary = interestVocabulary(options.data?.focusAreas);
  const focusIssue = interestIssue(focusTags, group.focusTags, vocabulary);
  const focusTagsValid = focusIssue === null;
  const hasChanges = name !== group.name
    || description !== group.description
    || tagline !== group.tagline
    || location !== group.location
    || !sameInterestSet(focusTags, group.focusTags)
    || coverId !== group.coverId
    || isPrivate !== group.isPrivate
    || requireAdminApproval !== (group.requireAdminApproval ?? false)
    || allowMemberChallenges !== (group.allowMemberChallenges ?? true);
  const reconcileCover = async (coverImage: V2MediaImageProjection, uidAtMutation: string | undefined) => {
    removeLocalGroupCoverPreview(group.id);
    queryClient.setQueryData<V2GroupDetail>(
      v2GroupDetailKey(group.id, uidAtMutation),
      (current) => current ? { ...current, coverImage } : current,
    );
    await invalidateV2GroupCoverReads(queryClient, uidAtMutation, group.id);
  };
  const uploadCoverFile = (file: File) => {
    if (coverInFlightRef.current) return;
    const uidAtMutation = uidRef.current;
    const operation = ++coverOperationSeqRef.current;
    const idempotencyKey = coverUploadIdentity.keyForFile(file);
    coverInFlightRef.current = true;
    setCoverError(null);
    setCoverSuccess(null);
    setFailedCoverAction(null);
    setCoverSaving(true);
    void saveGroupCoverImage(group.id, file, { idempotencyKey })
      .then(async (coverImage) => {
        if (uidRef.current !== uidAtMutation || groupIdRef.current !== group.id || coverOperationSeqRef.current !== operation) return;
        coverUploadIdentity.reset();
        coverPhoto.remove();
        await reconcileCover(coverImage, uidAtMutation);
        if (uidRef.current !== uidAtMutation || groupIdRef.current !== group.id || coverOperationSeqRef.current !== operation) return;
        setCoverSuccess('Cover photo saved');
        setCoverSavedInSession(true);
      })
      .catch(() => {
        if (uidRef.current !== uidAtMutation || groupIdRef.current !== group.id || coverOperationSeqRef.current !== operation) return;
        coverPhoto.remove();
        setCoverError('Could not save the Group cover photo. Please try again.');
        setFailedCoverAction({ type: 'upload', file });
      })
      .finally(() => {
        if (coverOperationSeqRef.current === operation) {
          coverInFlightRef.current = false;
          if (uidRef.current === uidAtMutation && groupIdRef.current === group.id) setCoverSaving(false);
        }
      });
  };
  const removeCoverFile = () => {
    if (coverInFlightRef.current) return;
    const uidAtMutation = uidRef.current;
    const operation = ++coverOperationSeqRef.current;
    coverInFlightRef.current = true;
    setCoverError(null);
    setCoverSuccess(null);
    setFailedCoverAction(null);
    setCoverSaving(true);
    void removeGroupCoverImage(group.id)
      .then(async (coverImage) => {
        if (uidRef.current !== uidAtMutation || groupIdRef.current !== group.id || coverOperationSeqRef.current !== operation) return;
        coverUploadIdentity.reset();
        coverPhoto.remove();
        await reconcileCover(coverImage, uidAtMutation);
        if (uidRef.current !== uidAtMutation || groupIdRef.current !== group.id || coverOperationSeqRef.current !== operation) return;
        setCoverSuccess('Cover photo removed');
        setCoverSavedInSession(true);
      })
      .catch(() => {
        if (uidRef.current !== uidAtMutation || groupIdRef.current !== group.id || coverOperationSeqRef.current !== operation) return;
        setCoverError('Could not remove the Group cover photo. Please try again.');
        setFailedCoverAction({ type: 'remove' });
      })
      .finally(() => {
        if (coverOperationSeqRef.current === operation) {
          coverInFlightRef.current = false;
          if (uidRef.current === uidAtMutation && groupIdRef.current === group.id) setCoverSaving(false);
        }
      });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!focusTagsValid) return;
    update.mutate({ name, description, tagline, location, focusTags: sameInterestSet(focusTags, group.focusTags) ? group.focusTags : focusTags, coverId, isPrivate, requireAdminApproval, allowMemberChallenges }, { onSuccess: () => navigate(`/v2/groups/${group.id}`) });
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
        <section className="space-y-4"><div><h2 className="text-base font-black">Group identity</h2><p className="text-xs text-slate-500">Group Interests can affect text search. Location is descriptive only.</p></div>
          <label className={label}>Name<input className={field} required maxLength={200} value={name} onChange={e => setName(e.target.value)} /></label>
          <label className={label}>Description<textarea className={field} rows={4} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} /></label>
          <label className={label}>Tagline<input className={field} maxLength={140} value={tagline} onChange={e => setTagline(e.target.value)} /></label>
          <label className={label}>Location<input className={field} maxLength={120} value={location} onChange={e => setLocation(e.target.value)} /><span className="mt-1 block text-xs font-normal text-slate-500">A short description. It does not affect search or access.</span></label>
          <GroupInterestsPicker value={focusTags} onChange={setFocusTags} vocabulary={vocabulary} />
          {focusIssue && <p role="alert" className="text-xs font-bold text-red-700">{INTEREST_ISSUE_COPY[focusIssue]}</p>}
          <fieldset>
            <legend className={label}>Group cover</legend>
            <div className="mt-2">
              <V2LocalImagePicker
                subject="Group cover"
                preview={coverPhoto}
                persistedUrl={group.coverImage?.status === 'ready' ? group.coverImage.url : null}
                durable={group.coverImage?.status !== 'not_configured'}
                isSaving={coverSaving}
                refreshKey={`group-cover-picker-${group.id}`}
                onPersistedImageExpired={() => {
                  if (groupId) void invalidateV2GroupCoverReads(queryClient, user?.uid, groupId);
                }}
                onSelectFile={group.coverImage?.status !== 'not_configured' ? uploadCoverFile : undefined}
                onRemove={group.coverImage?.status === 'ready' ? removeCoverFile : undefined}
                previewClassName="h-28 w-full rounded-xl bg-slate-100"
                fallback={
                  isGroupCoverId(coverId) ? (
                    <div className={`h-full w-full bg-gradient-to-br ${coverGradientFor(coverId)}`} aria-hidden="true" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-100 px-4 text-center text-sm font-medium text-slate-500">No photo selected</div>
                  )
                }
              />
            </div>
            <p className="mb-2 mt-4 text-xs font-bold text-slate-600">Or choose a Tiizi cover</p>
            <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">{GROUP_COVER_CATALOGUE.map(id => <button key={id} type="button" aria-label={`Select ${coverLabelFor(id)}`} aria-pressed={coverId === id} onClick={() => setCoverId(coverId === id ? null : id)} className={`h-12 rounded-xl bg-gradient-to-br ${coverGradientFor(id)} ring-offset-2 ${coverId === id ? 'ring-2 ring-orange-600' : ''}`}><span className="sr-only">{coverLabelFor(id)}</span></button>)}</div>
            <p className="mt-1 text-xs text-slate-500">Cover photo uploads save immediately. Save changes below applies to Group information, catalogue cover, privacy, and Challenge settings.</p>
            {coverSuccess && <p role="status" aria-live="polite" className="mt-1 text-xs font-bold text-emerald-700">{coverSuccess}</p>}
            {coverError && (
              <div role="alert" className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-red-700">
                <span>{coverError}</span>
                {failedCoverAction && (
                  <button
                    type="button"
                    disabled={coverSaving}
                    onClick={() => {
                      if (failedCoverAction.type === 'upload') {
                        uploadCoverFile(failedCoverAction.file);
                      } else {
                        removeCoverFile();
                      }
                    }}
                    className="underline underline-offset-2 hover:text-red-900 disabled:opacity-60"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
          </fieldset>
        </section>
        <section className="space-y-3"><h2 className="text-base font-black">Privacy & joining</h2>{choice('Private Group', isPrivate, setIsPrivate, 'People outside the Group cannot discover it normally. A valid invite code may still resolve it. Existing members are unaffected.')}{choice('Require approval to join', requireAdminApproval, setRequireAdminApproval, 'New join attempts require Steward approval. Existing pending requests remain pending until explicitly decided.')}</section>
        <section className="space-y-3"><h2 className="text-base font-black">Member Challenges</h2>{choice('Allow ordinary members to create Challenges', allowMemberChallenges, setAllowMemberChallenges, 'When off, ordinary members cannot establish new Group Challenges. Existing Challenges remain unchanged; you can still create them.')}</section>
        {update.isError && <p role="alert" className="text-sm text-red-700">We could not save these changes. Please review the fields and try again.</p>}
        <div className="space-y-2 border-t border-slate-100 pt-4">
          {coverSavedInSession && (
            <p className="text-xs text-slate-600 sm:text-right">
              {hasChanges
                ? 'Your cover photo is already saved. Cancel discards unsaved Group detail edits only.'
                : 'Your cover photo is already saved. Save changes is for Group information and settings.'}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <V2Button variant="secondary" onClick={() => navigate(`/v2/groups/${group.id}`)}>
              {hasChanges || !coverSavedInSession ? 'Cancel' : 'Done'}
            </V2Button>
            <V2Button type="submit" disabled={update.isPending || !hasChanges || !focusTagsValid}>
              {update.isPending ? 'Saving…' : 'Save changes'}
            </V2Button>
          </div>
        </div>
      </form>
    </div>
  </V2Page>;
}
