import { ArrowLeft, ChevronDown, Dumbbell } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useProfileSetup, useSaveProfileSetup } from '../../hooks/useProfileSetup';

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

const MAX = 10;

function ProfileInterestsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: profileSetup } = useProfileSetup(user?.uid);
  const saveProfileSetup = useSaveProfileSetup(user?.uid);

  const [selected, setSelected] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!profileSetup || hydrated) return;
    setSelected(profileSetup.exerciseInterests ?? []);
    setCustomInterest(profileSetup.customInterests?.[0] ?? '');
    setHydrated(true);
  }, [profileSetup, hydrated]);

  const selectedNames = useMemo(
    () => exerciseOptions.filter((o) => selected.includes(o.id)).map((o) => o.name),
    [selected],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX) return prev;
      return [...prev, id];
    });
  };

  const handleNext = async () => {
    if (selected.length < 3) {
      showToast('Choose at least 3 activities.', 'error');
      return;
    }
    if (!user?.uid) {
      navigate('/app/login');
      return;
    }
    try {
      await saveProfileSetup.mutateAsync({
        exerciseInterests: selected,
        wellnessInterests: profileSetup?.wellnessInterests ?? [],
        customInterests: customInterest.trim() ? [customInterest.trim()] : [],
        goals: profileSetup?.goals ?? [],
        primaryGoal: profileSetup?.primaryGoal,
        secondaryGoal: profileSetup?.secondaryGoal,
        customGoals: profileSetup?.customGoals ?? [],
        onboardingCompleted: profileSetup?.onboardingCompleted ?? false,
        hasSeenIntro: profileSetup?.hasSeenIntro ?? false,
        region: profileSetup?.region ?? 'Kenya',
        personalInfo: profileSetup?.personalInfo ?? { fullName: '', email: '', phone: '', birthday: '', displayName: '' },
        privacySettings: profileSetup?.privacySettings ?? {
          isProfilePublic: true,
          showActivity: true,
          allowMessages: true,
          showWeightHeightToGroups: true,
          showBirthdayToFriends: true,
          isProfileSearchable: true,
        },
      });
      navigate('/app/profile/wellness-interests');
    } catch {
      showToast('Could not save your activities.', 'error');
    }
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe">
        <header className="flex items-center justify-between">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate('/app/profile/completion')}>
            <ArrowLeft size={28} className="text-slate-900" />
          </button>
          <p className="text-[16px] leading-[20px] tracking-[0.15em] font-bold uppercase text-slate-500">Profile Setup</p>
          <span className="w-10" />
        </header>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-[18px] leading-[24px] font-bold text-slate-700">Step 2 of 5</p>
          <p className="text-[18px] leading-[24px] font-bold text-primary">40% complete</p>
        </div>
        <div className="st-progress-track mt-3">
          <div className="st-progress-fill" style={{ width: '40%' }} />
        </div>

        <h1 className="st-heading-xl mt-6">Activities You Enjoy</h1>
        <p className="st-text-lg mt-3">Choose the activities you enjoy most. We'll personalise your groups, challenges, and activity recommendations.</p>

        <div className="st-form-max mt-6">
          <button className="st-card w-full p-4 text-left" onClick={() => setShowModal(true)}>
            <div className="flex items-start justify-between">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Dumbbell size={22} className="text-primary" />
              </div>
              <div className="flex items-center gap-2">
                {selected.length > 0 && (
                  <span className="text-[12px] font-bold text-primary">{selected.length} selected</span>
                )}
                <ChevronDown size={22} className="text-slate-400" />
              </div>
            </div>
            <p className="st-heading-lg mt-4">Activities You Enjoy</p>
            <p className="st-text-lg mt-2">Choose 3 to 10 activities to personalise your experience.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedNames.slice(0, 2).map((name) => (
                <span key={name} className="st-chip bg-primary text-white">{name} ×</span>
              ))}
              {selectedNames.length > 2 && (
                <span className="st-chip border border-dashed border-slate-300 text-slate-500">+{selectedNames.length - 2} more</span>
              )}
              {selectedNames.length === 0 && (
                <span className="st-chip border border-dashed border-slate-300 text-slate-400">Tap to choose...</span>
              )}
            </div>
          </button>
        </div>

        <div className="st-form-max mt-6 grid grid-cols-[1fr_1.55fr] gap-3">
          <button className="st-btn-secondary" onClick={() => navigate('/app/profile/completion')}>Previous</button>
          <button className="st-btn-primary" onClick={handleNext} disabled={saveProfileSetup.isPending || selected.length < 3}>
            {saveProfileSetup.isPending ? 'Saving...' : 'Next Step →'}
          </button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-end">
          <div className="w-full max-w-mobile mx-auto rounded-t-3xl bg-white p-5 pb-7 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[20px] leading-[24px] font-black text-slate-900">Activities You Enjoy</h3>
              <button className="h-10 px-4 rounded-full border border-slate-200 text-[14px] font-bold" onClick={() => setShowModal(false)}>Done</button>
            </div>
            <p className="text-[13px] mb-4">
              {selected.length >= MAX
                ? <span className="font-semibold text-primary">Maximum selected.</span>
                : <span className="text-slate-500">{selected.length} / {MAX} selected</span>}
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {exerciseOptions.map((option) => {
                  const active = selected.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      className={`rounded-xl px-3 py-3 text-left text-[14px] font-bold border ${active ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-200'}`}
                      onClick={() => toggle(option.id)}
                    >
                      {option.icon} {option.name}
                    </button>
                  );
                })}
              </div>
              <input
                className="st-input"
                placeholder="Other activity (optional)"
                value={customInterest}
                maxLength={50}
                onChange={(e) => setCustomInterest(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}

export default ProfileInterestsScreen;
