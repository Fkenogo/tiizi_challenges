import { ArrowLeft, Camera, ChevronDown, Shield } from 'lucide-react';
import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { setActiveGroupId } from '../../hooks/useActiveGroup';
import { useCreateGroup } from '../../hooks/useGroups';
import { isLikelyDirectImageUrl, isPersistableImageSource, isValidImageUrl, readFileAsDataUrl, uploadImageFile } from '../../services/imageUploadService';
import { GroupBottomNav } from './components/GroupBottomNav';

function ToggleRow({ title, subtitle, value, onToggle }: { title: string; subtitle: string; value: boolean; onToggle: () => void }) {
  return (
    <div className="py-4 border-b border-slate-100 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[16px] leading-[22px] font-bold text-slate-900">{title}</p>
          <p className="mt-1 text-[14px] leading-[20px] text-[#60748f]">{subtitle}</p>
        </div>
        <button type="button" className={`h-8 w-14 rounded-full p-1 transition ${value ? 'bg-primary' : 'bg-slate-200'}`} onClick={onToggle}>
          <span className={`block h-6 w-6 rounded-full bg-white transition ${value ? 'translate-x-6' : ''}`} />
        </button>
      </div>
    </div>
  );
}

const GROUP_TYPES = [
  { id: 'fitness', label: 'Fitness', icon: '💪' },
  { id: 'wellness', label: 'Wellness', icon: '🧘' },
  { id: 'mixed', label: 'Mixed', icon: '🌀' },
  { id: 'cause-based', label: 'Cause-based', icon: '❤️' },
  { id: 'workplace', label: 'Workplace', icon: '🏢' },
  { id: 'school', label: 'School', icon: '🎓' },
  { id: 'friends-family', label: 'Friends / Family', icon: '👨‍👩‍👧' },
  { id: 'community', label: 'Community', icon: '🏘️' },
];

const ACTIVITY_OPTIONS = [
  { id: 'running', name: 'Running', icon: '🏃' },
  { id: 'walking', name: 'Walking', icon: '🚶' },
  { id: 'gym-weightlifting', name: 'Gym / Weightlifting', icon: '💪' },
  { id: 'home-workouts', name: 'Home Workouts', icon: '🏠' },
  { id: 'yoga', name: 'Yoga', icon: '🧘' },
  { id: 'swimming', name: 'Swimming', icon: '🏊' },
  { id: 'cycling', name: 'Cycling', icon: '🚴' },
  { id: 'football', name: 'Football (Soccer)', icon: '⚽' },
  { id: 'basketball', name: 'Basketball', icon: '🏀' },
  { id: 'hiking', name: 'Hiking', icon: '⛰️' },
  { id: 'group-fitness', name: 'Group Fitness', icon: '👥' },
  { id: 'hiit-circuit', name: 'HIIT / Circuit', icon: '⚡' },
  { id: 'pilates', name: 'Pilates', icon: '🤸' },
  { id: 'dancing', name: 'Dancing', icon: '💃' },
  { id: 'martial-arts', name: 'Martial Arts / Boxing', icon: '🥊' },
  { id: 'jump-rope', name: 'Jump Rope', icon: '🪢' },
  { id: 'stretching-mobility', name: 'Stretching / Mobility', icon: '🙆' },
  { id: 'other', name: 'Other', icon: '✍️' },
];

const WELLNESS_OPTIONS = [
  { id: 'mental-health', name: 'Mental Health', icon: '💙' },
  { id: 'sleep', name: 'Sleep & Recovery', icon: '😴' },
  { id: 'nutrition', name: 'Nutrition & Diet', icon: '🥗' },
  { id: 'hydration', name: 'Hydration', icon: '💧' },
  { id: 'meditation', name: 'Meditation', icon: '☮️' },
  { id: 'stress-management', name: 'Stress Management', icon: '🌿' },
  { id: 'weight-management', name: 'Weight Management', icon: '⚖️' },
  { id: 'chronic-condition', name: 'Chronic Condition Support', icon: '🏥' },
  { id: 'energy', name: 'Energy & Vitality', icon: '⚡' },
  { id: 'posture', name: 'Posture & Mobility', icon: '🙆' },
  { id: 'social', name: 'Social Connection', icon: '🤝' },
  { id: 'habits', name: 'Healthy Habits', icon: '✅' },
  { id: 'other', name: 'Other', icon: '✍️' },
];

const GROUP_GOALS = [
  'Keep Fit Together',
  'Lose Weight',
  'Build Strength',
  'Improve Mental Health',
  'Stay Consistent',
  'Train for an Event',
  'Support a Cause',
  'Build Workplace Wellness',
  'Family / Friends Accountability',
  'Other',
];

const LOCATION_SCOPES = [
  { id: 'local', label: 'Local' },
  { id: 'online', label: 'Online' },
  { id: 'workplace', label: 'Workplace' },
  { id: 'school', label: 'School' },
  { id: 'private-circle', label: 'Private Circle' },
];

const DEFAULT_RULES = [
  'Be respectful',
  'No spam',
  'Encourage others',
  'Log honestly',
  'Keep health information private',
  'No unsafe advice',
];

const MAX_INTERESTS = 10;

type ModalType = 'activities' | 'wellness' | null;

function CreateGroupScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const createGroup = useCreateGroup();
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Core fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverImageUploadState, setCoverImageUploadState] = useState<'idle' | 'uploading'>('idle');
  const [isPrivate, setIsPrivate] = useState(false);
  const [allowMemberChallenges, setAllowMemberChallenges] = useState(true);
  const [requireAdminApproval, setRequireAdminApproval] = useState(false);

  // New metadata
  const [groupType, setGroupType] = useState('');
  const [activityInterests, setActivityInterests] = useState<string[]>([]);
  const [wellnessTopics, setWellnessTopics] = useState<string[]>([]);
  const [groupGoals, setGroupGoals] = useState<string[]>([]);
  const [locationScope, setLocationScope] = useState('');
  const [enabledRules, setEnabledRules] = useState<string[]>(DEFAULT_RULES.slice(0, 3));
  const [customRule, setCustomRule] = useState('');

  const [openModal, setOpenModal] = useState<ModalType>(null);

  const canSubmit = useMemo(
    () => !!name.trim() && name.trim().length >= 3 && description.trim().length >= 10 && !!user?.uid && !createGroup.isPending,
    [name, description, user?.uid, createGroup.isPending],
  );

  const handleCreate = async () => {
    if (!canSubmit || !user?.uid) return;
    const normalizedCover = coverImageUrl.trim();
    const persistableCover = isPersistableImageSource(normalizedCover) ? normalizedCover : undefined;
    if (normalizedCover && !persistableCover) {
      showToast('Cover image not saved — use a URL or upload a smaller file.', 'info');
    }
    const allRules = customRule.trim() ? [...enabledRules, customRule.trim()] : enabledRules;
    try {
      const created = await createGroup.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        ownerId: user.uid,
        coverImageUrl: persistableCover,
        isPrivate,
        requireAdminApproval: isPrivate ? true : requireAdminApproval,
        allowMemberChallenges,
        groupType: groupType || undefined,
        activityInterests: activityInterests.length ? activityInterests : undefined,
        wellnessTopics: wellnessTopics.length ? wellnessTopics : undefined,
        groupGoals: groupGoals.length ? groupGoals : undefined,
        locationScope: locationScope || undefined,
        groupRules: allRules.length ? allRules : undefined,
      });
      setActiveGroupId(created.id);
      showToast('Group created successfully.', 'success');
      navigate(`/app/group/${created.id}`);
    } catch {
      showToast('Could not create group.', 'error');
    }
  };

  const handleCoverFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setCoverImageUploadState('uploading');
      const uploadedUrl = await uploadImageFile(file, 'group-covers', user?.uid);
      setCoverImageUrl(uploadedUrl);
      showToast('Group cover uploaded.', 'success');
    } catch {
      try {
        const fallback = await readFileAsDataUrl(file);
        setCoverImageUrl(fallback);
        showToast('Using local image preview.', 'info');
      } catch {
        showToast('Could not read selected image.', 'error');
      }
    } finally {
      setCoverImageUploadState('idle');
      if (event.target) event.target.value = '';
    }
  };

  const toggleInterest = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : list.length >= MAX_INTERESTS ? list : [...list, id]);
  };

  const toggleGoal = (goal: string) => {
    setGroupGoals((prev) => prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]);
  };

  const toggleRule = (rule: string) => {
    setEnabledRules((prev) => prev.includes(rule) ? prev.filter((r) => r !== rule) : [...prev, rule]);
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen pb-[108px]">
        <header className="px-4 pt-6 pb-5 border-b border-slate-200 bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <button className="h-10 w-10 flex items-center justify-center text-primary" onClick={() => navigate('/app/groups')}>
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-[20px] leading-[24px] font-black text-[#171212]">Create New Group</h1>
            <span className="w-10" />
          </div>
        </header>

        <main className="px-4 pt-5 space-y-6">

          {/* ── Identity ── */}
          <section>
            <h2 className="text-[16px] leading-[20px] font-bold text-primary mb-3">Group Identity</h2>
            <div className="relative">
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 50))}
                placeholder="e.g., Morning Runners"
                className="w-full h-14 rounded-2xl border border-[#f9c6a7] bg-white px-4 pr-16 text-[16px] text-[#496284]"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-[#8da0ba]">{name.length}/50</span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 240))}
              placeholder="What is this group about? Who is it for?"
              className="mt-3 w-full h-32 rounded-3xl border border-[#f9c6a7] bg-white px-4 py-4 text-[16px] leading-[22px] text-[#496284]"
            />
          </section>

          {/* ── Cover Image ── */}
          <section className="rounded-[24px] border-2 border-dashed border-[#f6c8a7] bg-[#fff7f2] p-5 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-[#fde8d7] text-primary flex items-center justify-center">
              <Camera size={24} />
            </div>
            <p className="mt-3 text-[16px] leading-[22px] font-black text-slate-900">Cover Image</p>
            {coverImageUrl && (
              <div className="mt-3 overflow-hidden rounded-xl border border-[#f9c6a7]">
                <img src={coverImageUrl} alt="Group cover preview" className="h-28 w-full object-cover" />
              </div>
            )}
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverFileSelected} />
            <button
              type="button"
              className="mt-3 h-10 rounded-xl bg-primary px-5 text-[13px] font-bold text-white disabled:opacity-60"
              onClick={() => coverInputRef.current?.click()}
              disabled={coverImageUploadState === 'uploading'}
            >
              {coverImageUploadState === 'uploading' ? 'Uploading...' : 'Choose Image'}
            </button>
            <input
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="or paste image URL"
              className="mt-3 w-full h-10 rounded-xl border border-[#f9c6a7] bg-white px-4 text-[13px]"
            />
            {coverImageUrl.trim() && !isValidImageUrl(coverImageUrl) && !coverImageUrl.startsWith('data:image/') && (
              <p className="mt-2 text-[11px] text-amber-600">URL should start with http:// or https://</p>
            )}
            {isValidImageUrl(coverImageUrl) && !isLikelyDirectImageUrl(coverImageUrl) && (
              <p className="mt-2 text-[11px] text-amber-600">Use a direct image URL for reliable display.</p>
            )}
          </section>

          {/* ── Group Type ── */}
          <section>
            <h2 className="text-[16px] leading-[20px] font-bold text-primary mb-3">Group Type</h2>
            <div className="grid grid-cols-2 gap-2">
              {GROUP_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`rounded-2xl border px-3 py-3 text-left text-[14px] font-bold transition-colors ${groupType === t.id ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-200'}`}
                  onClick={() => setGroupType((prev) => prev === t.id ? '' : t.id)}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </section>

          {/* ── Activity Interests ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[16px] leading-[20px] font-bold text-primary">Activities <span className="text-slate-400 font-normal text-[13px]">(optional, max {MAX_INTERESTS})</span></h2>
              {activityInterests.length > 0 && <span className="text-[12px] font-bold text-primary">{activityInterests.length} selected</span>}
            </div>
            <button
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between text-left"
              onClick={() => setOpenModal('activities')}
            >
              <span className="text-[14px] text-slate-500">
                {activityInterests.length === 0 ? 'Choose activities this group focuses on...' : activityInterests.slice(0, 3).map((id) => ACTIVITY_OPTIONS.find((o) => o.id === id)?.name).join(', ') + (activityInterests.length > 3 ? ` +${activityInterests.length - 3}` : '')}
              </span>
              <ChevronDown size={18} className="text-slate-400 flex-shrink-0 ml-2" />
            </button>
          </section>

          {/* ── Wellness Topics ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[16px] leading-[20px] font-bold text-primary">Wellness Topics <span className="text-slate-400 font-normal text-[13px]">(optional, max {MAX_INTERESTS})</span></h2>
              {wellnessTopics.length > 0 && <span className="text-[12px] font-bold text-primary">{wellnessTopics.length} selected</span>}
            </div>
            <button
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between text-left"
              onClick={() => setOpenModal('wellness')}
            >
              <span className="text-[14px] text-slate-500">
                {wellnessTopics.length === 0 ? 'Choose wellness topics...' : wellnessTopics.slice(0, 3).map((id) => WELLNESS_OPTIONS.find((o) => o.id === id)?.name).join(', ') + (wellnessTopics.length > 3 ? ` +${wellnessTopics.length - 3}` : '')}
              </span>
              <ChevronDown size={18} className="text-slate-400 flex-shrink-0 ml-2" />
            </button>
          </section>

          {/* ── Group Goals ── */}
          <section>
            <h2 className="text-[16px] leading-[20px] font-bold text-primary mb-3">Group Goals <span className="text-slate-400 font-normal text-[13px]">(optional)</span></h2>
            <div className="flex flex-wrap gap-2">
              {GROUP_GOALS.map((goal) => (
                <button
                  key={goal}
                  type="button"
                  className={`rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors ${groupGoals.includes(goal) ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-200'}`}
                  onClick={() => toggleGoal(goal)}
                >
                  {goal}
                </button>
              ))}
            </div>
          </section>

          {/* ── Location Scope ── */}
          <section>
            <h2 className="text-[16px] leading-[20px] font-bold text-primary mb-3">Scope <span className="text-slate-400 font-normal text-[13px]">(optional)</span></h2>
            <div className="flex flex-wrap gap-2">
              {LOCATION_SCOPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`rounded-full border px-4 py-2 text-[13px] font-semibold ${locationScope === s.id ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-200'}`}
                  onClick={() => setLocationScope((prev) => prev === s.id ? '' : s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>

          {/* ── Rules & Privacy ── */}
          <section className="rounded-[24px] border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-1">
              <Shield size={20} className="text-primary" />
              <h3 className="text-[18px] leading-[24px] font-black text-[#171212]">Rules & Privacy</h3>
            </div>
            <ToggleRow
              title="Private Group"
              subtitle="Only invited members can join and see posts"
              value={isPrivate}
              onToggle={() => { const next = !isPrivate; setIsPrivate(next); if (next) setRequireAdminApproval(true); }}
            />
            <ToggleRow
              title="Allow Member Challenges"
              subtitle="Let members create and host their own tasks"
              value={allowMemberChallenges}
              onToggle={() => setAllowMemberChallenges((prev) => !prev)}
            />
            <ToggleRow
              title="Require Admin Approval"
              subtitle="New members must be vetted before joining"
              value={requireAdminApproval}
              onToggle={() => setRequireAdminApproval((prev) => !prev)}
            />

            <p className="text-[13px] font-bold text-slate-700 mt-5 mb-2">Community Rules</p>
            <div className="space-y-2">
              {DEFAULT_RULES.map((rule) => (
                <label key={rule} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-primary rounded"
                    checked={enabledRules.includes(rule)}
                    onChange={() => toggleRule(rule)}
                  />
                  <span className="text-[14px] text-slate-700">{rule}</span>
                </label>
              ))}
            </div>
            <input
              className="mt-3 w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700"
              placeholder="Add a custom rule (optional)"
              value={customRule}
              maxLength={80}
              onChange={(e) => setCustomRule(e.target.value)}
            />
          </section>

          <button
            className="w-full h-14 rounded-2xl bg-primary text-white text-[16px] font-bold shadow-[0_10px_24px_rgba(255,111,0,0.25)] disabled:opacity-60"
            onClick={handleCreate}
            disabled={!canSubmit}
          >
            {createGroup.isPending ? 'Creating...' : 'Create Group 🚀'}
          </button>
        </main>
      </div>

      <GroupBottomNav active="groups" />

      {/* Activity picker modal */}
      {openModal === 'activities' && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-end">
          <div className="w-full max-w-mobile mx-auto rounded-t-3xl bg-white p-5 pb-7 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[20px] font-black text-slate-900">Activities</h3>
              <button className="h-10 px-4 rounded-full border border-slate-200 text-[14px] font-bold" onClick={() => setOpenModal(null)}>Done</button>
            </div>
            <p className="text-[13px] mb-3 text-slate-500">
              {activityInterests.length >= MAX_INTERESTS ? <span className="font-semibold text-primary">Maximum selected.</span> : `${activityInterests.length} / ${MAX_INTERESTS} selected`}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ACTIVITY_OPTIONS.map((opt) => {
                const active = activityInterests.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    className={`rounded-xl px-3 py-3 text-left text-[14px] font-bold border ${active ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-200'}`}
                    onClick={() => toggleInterest(activityInterests, setActivityInterests, opt.id)}
                  >
                    {opt.icon} {opt.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Wellness picker modal */}
      {openModal === 'wellness' && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-end">
          <div className="w-full max-w-mobile mx-auto rounded-t-3xl bg-white p-5 pb-7 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[20px] font-black text-slate-900">Wellness Topics</h3>
              <button className="h-10 px-4 rounded-full border border-slate-200 text-[14px] font-bold" onClick={() => setOpenModal(null)}>Done</button>
            </div>
            <p className="text-[13px] mb-3 text-slate-500">
              {wellnessTopics.length >= MAX_INTERESTS ? <span className="font-semibold text-primary">Maximum selected.</span> : `${wellnessTopics.length} / ${MAX_INTERESTS} selected`}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {WELLNESS_OPTIONS.map((opt) => {
                const active = wellnessTopics.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    className={`rounded-xl px-3 py-3 text-left text-[14px] font-bold border ${active ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-200'}`}
                    onClick={() => toggleInterest(wellnessTopics, setWellnessTopics, opt.id)}
                  >
                    {opt.icon} {opt.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}

export default CreateGroupScreen;
