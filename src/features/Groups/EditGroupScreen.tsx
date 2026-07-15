import { ArrowLeft, Camera, Shield } from 'lucide-react';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useGroup, useUpdateGroup } from '../../hooks/useGroups';
import { isLikelyDirectImageUrl, isPersistableImageSource, isValidImageUrl, readFileAsDataUrl, uploadImageFile } from '../../services/imageUploadService';
import { ACTIVITY_OPTIONS, GROUP_GOALS, GROUP_TYPES, LOCATION_SCOPES, WELLNESS_OPTIONS } from './groupOptions';
import { normalizeGroupGoals } from './groupGoalNormalization';
import { MAX_GROUP_DESCRIPTION_LENGTH, MAX_GROUP_NAME_LENGTH, isValidGroupDraft } from './groupValidation';
import { DEFAULT_GROUP_RULES, getCustomGroupRules, isDuplicateGroupRule } from './groupRules';

function ToggleRow({ title, subtitle, value, onToggle, disabled }: { title: string; subtitle: string; value: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <div className="py-4 border-b border-slate-100 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[16px] leading-[22px] font-bold text-slate-900">{title}</p>
          <p className="mt-1 text-[14px] leading-[20px] text-[#60748f]">{subtitle}</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          className={`h-8 w-14 rounded-full p-1 transition ${value ? 'bg-primary' : 'bg-slate-200'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          onClick={onToggle}
        >
          <span className={`block h-6 w-6 rounded-full bg-white transition ${value ? 'translate-x-6' : ''}`} />
        </button>
      </div>
    </div>
  );
}


function EditGroupScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { data: group, isLoading } = useGroup(id);
  const updateGroup = useUpdateGroup();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverPreview, setCoverPreview] = useState('');
  // Tracks an explicit "Remove cover image" action, distinct from merely
  // having an empty coverImageUrl string (which could also mean "no cover
  // was ever set" or "user hasn't touched this field"). Only this flag
  // triggers deleting the Firestore field — clearing the URL input in some
  // other indirect way, or pasting invalid text, must not silently delete a
  // valid existing cover.
  const [coverRemoved, setCoverRemoved] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [requireAdminApproval, setRequireAdminApproval] = useState(false);
  const [allowMemberChallenges, setAllowMemberChallenges] = useState(true);
  const [groupType, setGroupType] = useState('');
  const [activityInterests, setActivityInterests] = useState<string[]>([]);
  const [wellnessTopics, setWellnessTopics] = useState<string[]>([]);
  const [groupGoals, setGroupGoals] = useState<string[]>([]);
  const [locationScope, setLocationScope] = useState('');
  const [groupRules, setGroupRules] = useState<string[]>([]);
  const [customRule, setCustomRule] = useState('');
  const [showActivityPicker, setShowActivityPicker] = useState(false);
  const [showWellnessPicker, setShowWellnessPicker] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!group || hydrated) return;
    setName(group.name ?? '');
    setDescription(group.description ?? '');
    setCoverImageUrl(group.coverImageUrl ?? '');
    setCoverPreview(group.coverImageUrl ?? '');
    setIsPrivate(group.isPrivate ?? false);
    setRequireAdminApproval(group.requireAdminApproval ?? false);
    setAllowMemberChallenges(group.allowMemberChallenges ?? true);
    setGroupType(group.groupType ?? '');
    setActivityInterests(group.activityInterests ?? []);
    setWellnessTopics(group.wellnessTopics ?? []);
    setGroupGoals(normalizeGroupGoals(group.groupGoals ?? []));
    setLocationScope(group.locationScope ?? '');
    setGroupRules(group.groupRules ?? []);
    setHydrated(true);
  }, [group, hydrated]);

  const isOwner = group?.ownerId === user?.uid;

  if (!isLoading && (!group || !isOwner)) {
    return (
      <Screen className="st-page">
        <div className="mx-auto max-w-mobile px-4 pt-8">
          <p className="text-[18px] font-black text-slate-900">Not authorised</p>
          <button className="mt-4 h-12 rounded-xl bg-slate-100 text-slate-700 px-5 font-bold" onClick={() => navigate(-1)}>Go Back</button>
        </div>
      </Screen>
    );
  }

  const handleCoverChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Snapshot the pre-replacement state so a failed, non-persistable
    // upload can fully roll back — otherwise the preview would keep
    // showing the failed replacement image while Save would actually
    // preserve a different (the old stored) cover, a misleading mismatch.
    const previousCoverImageUrl = coverImageUrl;
    const previousCoverPreview = coverPreview;
    const previousCoverRemoved = coverRemoved;

    try {
      const dataUrl = await readFileAsDataUrl(file);

      // Only clear the "removed" flag once the file has actually been read
      // successfully — if reading fails below, the existing stored cover
      // must remain in effect, not be treated as replaced.
      setCoverRemoved(false);
      setCoverPreview(dataUrl);

      try {
        const uploadedUrl = await uploadImageFile(file, `groups/${Date.now()}_${file.name}`);
        setCoverImageUrl(uploadedUrl);
      } catch {
        // Only fall back to the local data URL if it's actually persistable
        // (Firestore has a document size limit) — otherwise leave
        // coverImageUrl untouched so handleSave's resolution preserves the
        // existing stored cover rather than submitting something invalid.
        if (isPersistableImageSource(dataUrl)) {
          setCoverImageUrl(dataUrl);
          showToast('Using local image preview.', 'info');
        } else {
          // Roll back the preview/removed-flag we optimistically set above —
          // without this, the screen would show the failed replacement
          // image while Save would actually preserve the previous cover.
          setCoverImageUrl(previousCoverImageUrl);
          setCoverPreview(previousCoverPreview);
          setCoverRemoved(previousCoverRemoved);
          showToast('Image upload failed. Choose a smaller image or try again.', 'error');
        }
      }
    } catch {
      showToast('Could not read selected image.', 'error');
    } finally {
      // Reset the input so selecting the same file again re-fires onChange.
      e.target.value = '';
    }
  };

  const handleRemoveCover = () => {
    setCoverImageUrl('');
    setCoverPreview('');
    setCoverRemoved(true);
  };

  const toggleActivity = (id: string) => {
    setActivityInterests((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 10 ? [...prev, id] : prev,
    );
  };

  const toggleWellness = (id: string) => {
    setWellnessTopics((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 10 ? [...prev, id] : prev,
    );
  };

  const toggleGoal = (id: string) => {
    setGroupGoals((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev,
    );
  };

  const toggleRule = (rule: string) => {
    setGroupRules((prev) =>
      prev.includes(rule) ? prev.filter((r) => r !== rule) : [...prev, rule],
    );
  };

  const addCustomRule = () => {
    const trimmed = customRule.trim();
    if (trimmed && !isDuplicateGroupRule(trimmed, groupRules)) {
      setGroupRules((prev) => [...prev, trimmed]);
      setCustomRule('');
    }
  };

  const removeRule = (rule: string) => {
    setGroupRules((prev) => prev.filter((r) => r !== rule));
  };

  const handleSave = async () => {
    if (!id) return;
    if (!isValidGroupDraft(name, description)) {
      showToast(`Group name needs 3+ characters and description needs 10+ characters.`, 'error');
      return;
    }
    // `null` = owner explicitly clicked "Remove cover image" → delete the
    // Firestore field. Otherwise resolve to a persistable value if one
    // exists, or `undefined` ("don't touch this field") if the current
    // input isn't a usable image — this deliberately does NOT delete an
    // existing valid cover just because the text field currently holds
    // something invalid/unrecognized; only the explicit Remove action does.
    const resolvedCover: string | null | undefined = coverRemoved
      ? null
      : isPersistableImageSource(coverImageUrl)
        ? coverImageUrl
        : isValidImageUrl(coverImageUrl) && isLikelyDirectImageUrl(coverImageUrl)
          ? coverImageUrl
          : undefined;

    // Private groups always require approval to join (groupService.joinGroup
    // treats isPrivate as needsApproval regardless of this flag) — force the
    // persisted value to match so the toggle never misrepresents actual join
    // behavior, mirroring CreateGroupScreen's identical rule.
    const resolvedRequireAdminApproval = isPrivate ? true : requireAdminApproval;

    try {
      await updateGroup.mutateAsync({
        groupId: id,
        patch: {
          name: name.trim(),
          description: description.trim(),
          ...(resolvedCover !== undefined && { coverImageUrl: resolvedCover }),
          isPrivate,
          requireAdminApproval: resolvedRequireAdminApproval,
          allowMemberChallenges,
          // `null` explicitly clears the field (deleted in Firestore via
          // updateGroup) — omitting it or sending `undefined` would leave
          // the previous value in place, which is not what "cleared this
          // selection in the UI and saved" should mean.
          groupType: groupType || null,
          activityInterests: activityInterests.length ? activityInterests : null,
          wellnessTopics: wellnessTopics.length ? wellnessTopics : null,
          groupGoals: groupGoals.length ? groupGoals : null,
          locationScope: locationScope || null,
          groupRules: groupRules.length ? groupRules : null,
        },
      });
      showToast('Group updated.', 'success');
      navigate(`/app/group/${id}`);
    } catch {
      // The mutation's onError (useGroups.ts useUpdateGroup) already logs
      // the underlying error to the console — this screen stays free of
      // raw console/Firebase diagnostics per the pilot UX polish guard.
      showToast('Could not save changes.', 'error');
    }
  };

  const fallbackCover = 'https://images.unsplash.com/photo-1486218119243-13883505764c?auto=format&fit=crop&w=1200&q=80';

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen bg-slate-50 pb-24">
        {/* Header */}
        <header className="sticky top-0 z-20 flex items-center gap-3 bg-white border-b border-slate-200 px-4 py-3">
          <button className="h-9 w-9 flex items-center justify-center rounded-full bg-slate-100" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} className="text-slate-700" />
          </button>
          <h1 className="flex-1 text-[17px] font-black text-slate-900">Edit Group</h1>
          <button
            className="h-9 px-5 rounded-full bg-primary text-white text-[14px] font-bold disabled:opacity-60"
            onClick={handleSave}
            disabled={updateGroup.isPending || !isValidGroupDraft(name, description)}
          >
            {updateGroup.isPending ? 'Saving…' : 'Save'}
          </button>
        </header>

        <div className="px-4 pt-5 space-y-6">
          {/* Cover photo */}
          <div>
            <p className="text-[13px] font-bold text-slate-500 uppercase tracking-wide mb-2">Cover Photo</p>
            <div className="relative rounded-2xl overflow-hidden" style={{ height: 140 }}>
              <img
                src={coverPreview || fallbackCover}
                alt="Cover"
                className="h-full w-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = fallbackCover; }}
              />
              <button
                className="absolute bottom-3 right-3 h-9 px-4 rounded-full bg-black/60 text-white text-[13px] font-bold flex items-center gap-2"
                onClick={() => fileRef.current?.click()}
              >
                <Camera size={14} /> Change
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
            </div>
            {coverPreview && (
              <button
                type="button"
                className="mt-2 text-[13px] font-bold text-red-600"
                onClick={handleRemoveCover}
                aria-label="Remove cover image"
              >
                Remove cover image
              </button>
            )}
          </div>

          {/* Basic info */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
            <div>
              <label className="block text-[13px] font-bold text-slate-700 mb-1">Group Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={MAX_GROUP_NAME_LENGTH}
                placeholder="e.g. Nairobi Morning Runners"
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[15px] text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[13px] font-bold text-slate-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={MAX_GROUP_DESCRIPTION_LENGTH}
                rows={3}
                placeholder="What is your group about?"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[15px] text-slate-900 resize-none"
              />
            </div>
          </div>

          {/* Group type */}
          <div>
            <p className="text-[13px] font-bold text-slate-500 uppercase tracking-wide mb-2">Group Type</p>
            <div className="flex flex-wrap gap-2">
              {GROUP_TYPES.map((t) => (
                <button
                  key={t.id}
                  className={`h-9 rounded-full px-4 text-[13px] font-bold border transition ${groupType === t.id ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-200'}`}
                  onClick={() => setGroupType(groupType === t.id ? '' : t.id)}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Location scope */}
          <div>
            <p className="text-[13px] font-bold text-slate-500 uppercase tracking-wide mb-2">Scope</p>
            <div className="flex flex-wrap gap-2">
              {LOCATION_SCOPES.map((s) => (
                <button
                  key={s.id}
                  className={`h-9 rounded-full px-4 text-[13px] font-bold border transition ${locationScope === s.id ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-200'}`}
                  onClick={() => setLocationScope(locationScope === s.id ? '' : s.id)}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Activity interests */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] font-bold text-slate-500 uppercase tracking-wide">Activity Focus</p>
              <button className="text-[13px] font-bold text-primary" onClick={() => setShowActivityPicker(true)}>
                {activityInterests.length > 0 ? `${activityInterests.length} selected` : 'Add'} →
              </button>
            </div>
            {activityInterests.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {activityInterests.map((id) => {
                  const opt = ACTIVITY_OPTIONS.find((a) => a.id === id);
                  return <span key={id} className="h-8 rounded-full bg-primary/10 px-3 text-[12px] font-bold text-primary inline-flex items-center">{opt?.icon} {opt?.name}</span>;
                })}
              </div>
            )}
          </div>

          {/* Wellness topics */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] font-bold text-slate-500 uppercase tracking-wide">Wellness Focus</p>
              <button className="text-[13px] font-bold text-primary" onClick={() => setShowWellnessPicker(true)}>
                {wellnessTopics.length > 0 ? `${wellnessTopics.length} selected` : 'Add'} →
              </button>
            </div>
            {wellnessTopics.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {wellnessTopics.map((id) => {
                  const opt = WELLNESS_OPTIONS.find((w) => w.id === id);
                  return <span key={id} className="h-8 rounded-full bg-emerald-50 px-3 text-[12px] font-bold text-emerald-700 inline-flex items-center">{opt?.icon} {opt?.name}</span>;
                })}
              </div>
            )}
          </div>

          {/* Group goals */}
          <div>
            <p className="text-[13px] font-bold text-slate-500 uppercase tracking-wide mb-2">Group Goals (up to 5)</p>
            <div className="flex flex-wrap gap-2">
              {GROUP_GOALS.map((g) => (
                <button
                  key={g.id}
                  className={`h-9 rounded-full px-4 text-[13px] font-bold border transition ${groupGoals.includes(g.id) ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-200'}`}
                  onClick={() => toggleGoal(g.id)}
                >
                  {g.icon} {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Community rules */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield size={14} className="text-primary" />
              <p className="text-[13px] font-bold text-slate-500 uppercase tracking-wide">Community Rules</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
              {DEFAULT_GROUP_RULES.map((rule) => (
                <label key={rule} className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupRules.includes(rule)}
                    onChange={() => toggleRule(rule)}
                    className="h-4 w-4 rounded border-slate-300 text-primary"
                  />
                  <span className="text-[14px] text-slate-700">{rule}</span>
                </label>
              ))}
            </div>
            {/* Rules this group already had that aren't part of the canonical
                checkbox list above (owner-typed custom rules, or rules from
                before taxonomy consolidation) — shown so they remain visible
                and removable rather than silently disappearing from the UI
                while still being saved. */}
            {getCustomGroupRules(groupRules).length > 0 && (
              <div className="mt-3">
                <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wide mb-2">Existing custom rules</p>
                <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
                  {getCustomGroupRules(groupRules).map((rule) => (
                    <div key={rule} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="text-[14px] text-slate-700">{rule}</span>
                      <button
                        type="button"
                        className="text-[12px] font-bold text-red-600"
                        onClick={() => removeRule(rule)}
                        aria-label={`Remove rule: ${rule}`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <input
                value={customRule}
                onChange={(e) => setCustomRule(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomRule(); } }}
                placeholder="Add a custom rule…"
                className="flex-1 h-10 rounded-xl border border-slate-200 bg-white px-3 text-[14px] text-slate-900"
              />
              <button
                className="h-10 px-4 rounded-xl bg-slate-100 text-slate-700 text-[14px] font-bold disabled:opacity-50"
                onClick={addCustomRule}
                disabled={!customRule.trim()}
              >
                Add
              </button>
            </div>
          </div>

          {/* Privacy & permissions */}
          <div>
            <p className="text-[13px] font-bold text-slate-500 uppercase tracking-wide mb-2">Privacy & Permissions</p>
            <div className="bg-white rounded-2xl border border-slate-200 px-4">
              <ToggleRow
                title="Private group"
                subtitle="Only members can see content"
                value={isPrivate}
                onToggle={() => setIsPrivate((v) => !v)}
              />
              <ToggleRow
                title="Require admin approval"
                subtitle={isPrivate ? 'Always on for private groups' : 'New members need approval to join'}
                value={isPrivate ? true : requireAdminApproval}
                onToggle={() => setRequireAdminApproval((v) => !v)}
                disabled={isPrivate}
              />
              <ToggleRow
                title="Members can create challenges"
                subtitle="Allow all members to create group challenges"
                value={allowMemberChallenges}
                onToggle={() => setAllowMemberChallenges((v) => !v)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Activity picker sheet */}
      {showActivityPicker && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setShowActivityPicker(false)}>
          <div className="w-full max-w-mobile mx-auto bg-white rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[17px] font-black text-slate-900">Activity Focus</p>
              <button className="h-9 px-4 rounded-full bg-primary text-white text-[14px] font-bold" onClick={() => setShowActivityPicker(false)}>Done</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ACTIVITY_OPTIONS.map((a) => (
                <button
                  key={a.id}
                  className={`h-11 rounded-xl px-3 text-left text-[13px] font-bold border transition ${activityInterests.includes(a.id) ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-200'}`}
                  onClick={() => toggleActivity(a.id)}
                >
                  {a.icon} {a.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Wellness picker sheet */}
      {showWellnessPicker && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setShowWellnessPicker(false)}>
          <div className="w-full max-w-mobile mx-auto bg-white rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[17px] font-black text-slate-900">Wellness Focus</p>
              <button className="h-9 px-4 rounded-full bg-primary text-white text-[14px] font-bold" onClick={() => setShowWellnessPicker(false)}>Done</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {WELLNESS_OPTIONS.map((w) => (
                <button
                  key={w.id}
                  className={`h-11 rounded-xl px-3 text-left text-[13px] font-bold border transition ${wellnessTopics.includes(w.id) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200'}`}
                  onClick={() => toggleWellness(w.id)}
                >
                  {w.icon} {w.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}

export default EditGroupScreen;
