import { ArrowLeft, Calendar, Camera, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useProfileSetup, useSaveProfileSetup } from '../../hooks/useProfileSetup';
import { isPersistableImageSource, readFileAsDataUrl, uploadImageFile } from '../../services/imageUploadService';

type InterestOption = { id: string; name: string; icon: string };

const exerciseOptions: InterestOption[] = [
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
  { id: 'group-fitness', name: 'Group Fitness Classes', icon: '👥' },
  { id: 'hiit-circuit', name: 'HIIT / Circuit Training', icon: '⚡' },
  { id: 'pilates', name: 'Pilates', icon: '🤸' },
  { id: 'dancing', name: 'Dancing', icon: '💃' },
  { id: 'martial-arts', name: 'Martial Arts / Boxing', icon: '🥊' },
  { id: 'jump-rope', name: 'Jump Rope / Skipping', icon: '🪢' },
  { id: 'badminton', name: 'Badminton', icon: '🏸' },
  { id: 'stretching-mobility', name: 'Stretching / Mobility', icon: '🙆' },
  { id: 'other', name: 'Other', icon: '✍️' },
];

const wellnessOptions: InterestOption[] = [
  { id: 'mindfulness', name: 'Mindfulness', icon: '🧠' },
  { id: 'nutrition', name: 'Nutrition', icon: '🥗' },
  { id: 'sleep', name: 'Sleep', icon: '😴' },
  { id: 'mental-health', name: 'Mental Health', icon: '💙' },
  { id: 'hydration', name: 'Hydration', icon: '💧' },
  { id: 'stress-management', name: 'Stress Management', icon: '🌿' },
  { id: 'meditation', name: 'Meditation', icon: '☮️' },
  { id: 'journaling', name: 'Journaling', icon: '📓' },
  { id: 'breathing', name: 'Breathing Exercises', icon: '🌬️' },
  { id: 'recovery', name: 'Recovery & Rest', icon: '🛌' },
];

const goalOptions: InterestOption[] = [
  { id: 'improve-fitness', name: 'Improve Endurance & Fitness', icon: '🏃' },
  { id: 'build-strength', name: 'Build Strength', icon: '💪' },
  { id: 'lose-weight', name: 'Lose Weight', icon: '⚖️' },
  { id: 'lose-belly-fat', name: 'Reduce Belly Fat', icon: '🔥' },
  { id: 'eat-healthier', name: 'Eat Healthier', icon: '🥗' },
  { id: 'manage-stress', name: 'Manage Stress', icon: '🌿' },
  { id: 'improve-sleep', name: 'Improve Sleep', icon: '😴' },
  { id: 'manage-health-condition', name: 'Manage a Health Condition', icon: '🏥' },
  { id: 'increase-energy', name: 'Boost Energy', icon: '⚡' },
  { id: 'consistency', name: 'Stay Consistent', icon: '📅' },
];

const GENDER_OPTIONS = ['Female', 'Male', 'Non-binary', 'Prefer not to say', 'Self describe'];
const MAX = 10;

type ModalType = 'activities' | 'wellness' | 'goals' | null;

function EditProfileScreen() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const { data: setup } = useProfileSetup(user?.uid);
  const saveProfileSetup = useSaveProfileSetup(user?.uid);

  // Personal info
  const [fullName, setFullName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [gender, setGender] = useState('');
  const [genderSelfDescribe, setGenderSelfDescribe] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Interests
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [selectedWellness, setSelectedWellness] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  // Privacy
  const [showWeightHeight, setShowWeightHeight] = useState(true);
  const [showBirthday, setShowBirthday] = useState(true);
  const [isSearchable, setIsSearchable] = useState(false);

  // Modal
  const [openModal, setOpenModal] = useState<ModalType>(null);

  const weightOptions = Array.from({ length: 171 }, (_, i) => 30 + i);
  const heightOptions = Array.from({ length: 121 }, (_, i) => 120 + i);

  useEffect(() => {
    if (!setup) return;
    setFullName(setup.personalInfo?.fullName || profile?.displayName || '');
    setBirthday(setup.personalInfo?.birthday || '');
    setWeightKg(setup.personalInfo?.weightKg ? String(setup.personalInfo.weightKg) : '');
    setHeightCm(setup.personalInfo?.heightCm ? String(setup.personalInfo.heightCm) : '');
    setGender(setup.personalInfo?.gender || '');
    setGenderSelfDescribe(setup.personalInfo?.genderSelfDescribe || '');
    setPhotoUrl(setup.personalInfo?.photoURL || user?.photoURL || '');
    setSelectedActivities(setup.exerciseInterests ?? []);
    setSelectedWellness(setup.wellnessInterests ?? []);
    const storedGoals = setup.goals?.length
      ? setup.goals
      : [setup.primaryGoal, setup.secondaryGoal].filter(Boolean) as string[];
    setSelectedGoals(storedGoals);
    setShowWeightHeight(setup.privacySettings?.showWeightHeightToGroups ?? true);
    setShowBirthday(setup.privacySettings?.showBirthdayToFriends ?? true);
    setIsSearchable(setup.privacySettings?.isProfileSearchable ?? false);
  }, [setup, profile?.displayName, user?.photoURL]);

  const handlePickPhoto = () => {
    if (isUploadingPhoto) return;
    fileInputRef.current?.click();
  };

  const handlePhotoSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingPhoto(true);
      const url = await uploadImageFile(file, 'profile-photos', user?.uid);
      setPhotoUrl(url);
      showToast('Photo updated.', 'success');
    } catch {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        if (isPersistableImageSource(dataUrl)) {
          setPhotoUrl(dataUrl);
        } else {
          showToast('Image too large. Choose a smaller photo.', 'error');
        }
      } catch {
        showToast('Could not process image.', 'error');
      }
    } finally {
      setIsUploadingPhoto(false);
      event.target.value = '';
    }
  };

  const toggleItem = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : list.length >= MAX ? list : [...list, id]);
  };

  const activityNames = useMemo(
    () => exerciseOptions.filter((o) => selectedActivities.includes(o.id)).map((o) => o.name),
    [selectedActivities],
  );
  const wellnessNames = useMemo(
    () => wellnessOptions.filter((o) => selectedWellness.includes(o.id)).map((o) => o.name),
    [selectedWellness],
  );
  const goalNames = useMemo(
    () => goalOptions.filter((o) => selectedGoals.includes(o.id)).map((o) => o.name),
    [selectedGoals],
  );

  const handleSave = async () => {
    if (!user?.uid) return;
    try {
      await saveProfileSetup.mutateAsync({
        exerciseInterests: selectedActivities,
        wellnessInterests: selectedWellness,
        customInterests: setup?.customInterests ?? [],
        customWellnessInterests: setup?.customWellnessInterests ?? [],
        goals: selectedGoals,
        primaryGoal: setup?.primaryGoal,
        secondaryGoal: setup?.secondaryGoal,
        customGoals: setup?.customGoals ?? [],
        onboardingCompleted: setup?.onboardingCompleted ?? false,
        hasSeenIntro: setup?.hasSeenIntro ?? true,
        region: setup?.region ?? 'Kenya',
        personalInfo: {
          fullName: fullName.trim() || setup?.personalInfo?.fullName || '',
          email: setup?.personalInfo?.email ?? profile?.email ?? '',
          phone: setup?.personalInfo?.phone ?? '',
          birthday: birthday.trim(),
          weightKg: Number(weightKg) || undefined,
          heightCm: Number(heightCm) || undefined,
          displayName: setup?.personalInfo?.displayName || fullName.trim() || '',
          photoURL: photoUrl || undefined,
          gender: gender || undefined,
          genderSelfDescribe: gender === 'Self describe' ? genderSelfDescribe.trim() || undefined : undefined,
        },
        privacySettings: {
          isProfilePublic: setup?.privacySettings?.isProfilePublic ?? true,
          showActivity: setup?.privacySettings?.showActivity ?? true,
          allowMessages: setup?.privacySettings?.allowMessages ?? true,
          showWeightHeightToGroups: showWeightHeight,
          showBirthdayToFriends: showBirthday,
          isProfileSearchable: isSearchable,
        },
      });
      showToast('Profile updated.', 'success');
      navigate(-1);
    } catch {
      showToast('Could not save changes.', 'error');
    }
  };

  const privacyToggles = [
    { title: 'Show weight / height to groups', value: showWeightHeight, set: setShowWeightHeight },
    { title: 'Show birthday to friends', value: showBirthday, set: setShowBirthday },
    { title: 'Make profile searchable', value: isSearchable, set: setIsSearchable },
  ];

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe">
        <header className="flex items-center justify-between">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate(-1)}>
            <ArrowLeft size={28} className="text-slate-900" />
          </button>
          <p className="text-[16px] leading-[20px] font-black text-slate-900">Edit Profile</p>
          <span className="w-10" />
        </header>

        {/* ── Photo ── */}
        <div className="mt-6 flex flex-col items-center">
          <div
            className="relative h-24 w-24 rounded-full border-[3px] border-dashed border-orange-200 bg-orange-50/30 flex items-center justify-center overflow-hidden cursor-pointer"
            onClick={handlePickPhoto}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') handlePickPhoto(); }}
          >
            {photoUrl
              ? <img src={photoUrl} alt="Profile" className="h-full w-full object-cover" />
              : <div className="h-10 w-10 rounded-full bg-primary/20" />}
            <button
              type="button"
              className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center"
              onClick={(e) => { e.stopPropagation(); handlePickPhoto(); }}
              disabled={isUploadingPhoto}
            >
              <Camera size={14} />
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelected} />
          <p className="mt-2 text-[12px] text-slate-400">{isUploadingPhoto ? 'Uploading...' : 'Tap to update photo'}</p>
        </div>

        {/* ── Personal Info ── */}
        <p className="text-[12px] tracking-[0.16em] uppercase font-bold text-slate-500 mt-8">Personal Info</p>
        <div className="st-form-max mt-4 space-y-4">
          <div>
            <p className="st-label">Full Name</p>
            <input className="st-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
          </div>

          <div>
            <p className="st-label">Birthday</p>
            <div className="relative">
              <input
                className="st-input pr-12"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
              />
              <Calendar size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div>
            <p className="st-label">Gender <span className="text-slate-400 font-normal">(optional)</span></p>
            <div className="flex flex-wrap gap-2">
              {GENDER_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`rounded-full border px-4 py-2 text-[13px] font-semibold ${gender === opt ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-200'}`}
                  onClick={() => setGender((prev) => prev === opt ? '' : opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
            {gender === 'Self describe' && (
              <input
                className="st-input mt-3"
                placeholder="Describe your gender..."
                value={genderSelfDescribe}
                maxLength={60}
                onChange={(e) => setGenderSelfDescribe(e.target.value)}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="st-label">Weight</p>
              <div className="relative">
                <select className="st-input pr-12 appearance-none" value={weightKg} onChange={(e) => setWeightKg(e.target.value)}>
                  <option value="">—</option>
                  {weightOptions.map((v) => <option key={v} value={String(v)}>{v}</option>)}
                </select>
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-[13px] font-bold">kg</span>
              </div>
            </div>
            <div>
              <p className="st-label">Height</p>
              <div className="relative">
                <select className="st-input pr-12 appearance-none" value={heightCm} onChange={(e) => setHeightCm(e.target.value)}>
                  <option value="">—</option>
                  {heightOptions.map((v) => <option key={v} value={String(v)}>{v}</option>)}
                </select>
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-[13px] font-bold">cm</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Activities ── */}
        <p className="text-[12px] tracking-[0.16em] uppercase font-bold text-slate-500 mt-8">Activities</p>
        <div className="st-form-max mt-4">
          <button className="st-card w-full p-4 text-left" onClick={() => setOpenModal('activities')}>
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-bold text-slate-900">Activities You Enjoy</p>
              <div className="flex items-center gap-2">
                {selectedActivities.length > 0 && <span className="text-[12px] font-bold text-primary">{selectedActivities.length} selected</span>}
                <ChevronDown size={18} className="text-slate-400" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {activityNames.slice(0, 3).map((n) => <span key={n} className="st-chip bg-primary text-white">{n}</span>)}
              {activityNames.length > 3 && <span className="st-chip border border-dashed border-slate-300 text-slate-500">+{activityNames.length - 3} more</span>}
              {activityNames.length === 0 && <span className="st-chip border border-dashed border-slate-300 text-slate-400">Tap to choose...</span>}
            </div>
          </button>
        </div>

        {/* ── Wellness Topics ── */}
        <p className="text-[12px] tracking-[0.16em] uppercase font-bold text-slate-500 mt-6">Wellness Topics</p>
        <div className="st-form-max mt-4">
          <button className="st-card w-full p-4 text-left" onClick={() => setOpenModal('wellness')}>
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-bold text-slate-900">Wellness Topics <span className="text-slate-400 font-normal text-[12px]">(optional)</span></p>
              <div className="flex items-center gap-2">
                {selectedWellness.length > 0 && <span className="text-[12px] font-bold text-primary">{selectedWellness.length} selected</span>}
                <ChevronDown size={18} className="text-slate-400" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {wellnessNames.slice(0, 3).map((n) => <span key={n} className="st-chip bg-primary text-white">{n}</span>)}
              {wellnessNames.length > 3 && <span className="st-chip border border-dashed border-slate-300 text-slate-500">+{wellnessNames.length - 3} more</span>}
              {wellnessNames.length === 0 && <span className="st-chip border border-dashed border-slate-300 text-slate-400">Tap to choose...</span>}
            </div>
          </button>
        </div>

        {/* ── Health Goals ── */}
        <p className="text-[12px] tracking-[0.16em] uppercase font-bold text-slate-500 mt-6">Health Goals</p>
        <div className="st-form-max mt-4">
          <button className="st-card w-full p-4 text-left" onClick={() => setOpenModal('goals')}>
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-bold text-slate-900">Health Goals</p>
              <div className="flex items-center gap-2">
                {selectedGoals.length > 0 && <span className="text-[12px] font-bold text-primary">{selectedGoals.length} selected</span>}
                <ChevronDown size={18} className="text-slate-400" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {goalNames.slice(0, 3).map((n) => <span key={n} className="st-chip bg-primary text-white">{n}</span>)}
              {goalNames.length > 3 && <span className="st-chip border border-dashed border-slate-300 text-slate-500">+{goalNames.length - 3} more</span>}
              {goalNames.length === 0 && <span className="st-chip border border-dashed border-slate-300 text-slate-400">Tap to choose...</span>}
            </div>
          </button>
        </div>

        {/* ── Privacy ── */}
        <p className="text-[12px] tracking-[0.16em] uppercase font-bold text-slate-500 mt-8">Privacy</p>
        <div className="st-form-max mt-4 space-y-3">
          {privacyToggles.map((item) => (
            <div key={item.title} className="st-card px-5 py-4 flex items-center justify-between">
              <p className="text-[14px] font-bold text-slate-900 pr-4">{item.title}</p>
              <button
                className={`st-toggle ${item.value ? 'on' : ''}`}
                onClick={() => item.set((prev: boolean) => !prev)}
              >
                <span />
              </button>
            </div>
          ))}
        </div>

        {/* ── CTAs ── */}
        <button
          className="st-form-max st-btn-primary mt-8"
          onClick={handleSave}
          disabled={saveProfileSetup.isPending}
        >
          {saveProfileSetup.isPending ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          className="st-form-max mt-4 w-full text-center text-[15px] font-semibold text-slate-500"
          onClick={() => navigate(-1)}
        >
          Cancel
        </button>
      </div>

      {/* ── Activity Modal ── */}
      {openModal === 'activities' && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-end">
          <div className="w-full max-w-mobile mx-auto rounded-t-3xl bg-white p-5 pb-7 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[20px] font-black text-slate-900">Activities You Enjoy</h3>
              <button className="h-10 px-4 rounded-full border border-slate-200 text-[14px] font-bold" onClick={() => setOpenModal(null)}>Done</button>
            </div>
            <p className="text-[13px] mb-4">
              {selectedActivities.length >= MAX
                ? <span className="font-semibold text-primary">Maximum selected.</span>
                : <span className="text-slate-500">{selectedActivities.length} / {MAX} selected</span>}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {exerciseOptions.map((opt) => {
                const active = selectedActivities.includes(opt.id);
                return (
                  <button key={opt.id} className={`rounded-xl px-3 py-3 text-left text-[14px] font-bold border ${active ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-200'}`} onClick={() => toggleItem(selectedActivities, setSelectedActivities, opt.id)}>
                    {opt.icon} {opt.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Wellness Modal ── */}
      {openModal === 'wellness' && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-end">
          <div className="w-full max-w-mobile mx-auto rounded-t-3xl bg-white p-5 pb-7 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[20px] font-black text-slate-900">Wellness Topics</h3>
              <button className="h-10 px-4 rounded-full border border-slate-200 text-[14px] font-bold" onClick={() => setOpenModal(null)}>Done</button>
            </div>
            <p className="text-[13px] mb-4">
              {selectedWellness.length >= MAX
                ? <span className="font-semibold text-primary">Maximum selected.</span>
                : <span className="text-slate-500">{selectedWellness.length} / {MAX} selected</span>}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {wellnessOptions.map((opt) => {
                const active = selectedWellness.includes(opt.id);
                return (
                  <button key={opt.id} className={`rounded-xl px-3 py-3 text-left text-[14px] font-bold border ${active ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-200'}`} onClick={() => toggleItem(selectedWellness, setSelectedWellness, opt.id)}>
                    {opt.icon} {opt.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Goals Modal ── */}
      {openModal === 'goals' && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-end">
          <div className="w-full max-w-mobile mx-auto rounded-t-3xl bg-white p-5 pb-7 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[20px] font-black text-slate-900">Health Goals</h3>
              <button className="h-10 px-4 rounded-full border border-slate-200 text-[14px] font-bold" onClick={() => setOpenModal(null)}>Done</button>
            </div>
            <p className="text-[13px] mb-4">
              {selectedGoals.length >= MAX
                ? <span className="font-semibold text-primary">Maximum selected.</span>
                : <span className="text-slate-500">{selectedGoals.length} / {MAX} selected</span>}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {goalOptions.map((opt) => {
                const active = selectedGoals.includes(opt.id);
                return (
                  <button key={opt.id} className={`rounded-xl px-3 py-3 text-left text-[14px] font-bold border ${active ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-200'}`} onClick={() => toggleItem(selectedGoals, setSelectedGoals, opt.id)}>
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

export default EditProfileScreen;
