import { ArrowLeft, ChevronDown, Heart } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useProfileSetup, useSaveProfileSetup } from '../../hooks/useProfileSetup';

type WellnessOption = { id: string; name: string; icon: string; description: string };

const wellnessOptions: WellnessOption[] = [
  { id: 'mental-health', name: 'Mental Health', icon: '🧠', description: 'Mindfulness, stress relief, emotional wellbeing' },
  { id: 'sleep', name: 'Sleep & Recovery', icon: '😴', description: 'Better sleep quality, rest, and recovery' },
  { id: 'nutrition', name: 'Nutrition & Diet', icon: '🥗', description: 'Healthy eating, balanced diet, meal tracking' },
  { id: 'hydration', name: 'Hydration', icon: '💧', description: 'Daily water intake, staying hydrated' },
  { id: 'meditation', name: 'Meditation', icon: '🧘', description: 'Breathing, mindfulness, and relaxation practices' },
  { id: 'stress-management', name: 'Stress Management', icon: '🌿', description: 'Techniques for managing daily stress' },
  { id: 'weight-management', name: 'Weight Management', icon: '⚖️', description: 'Healthy weight goals and body composition' },
  { id: 'chronic-condition', name: 'Chronic Condition Support', icon: '🩺', description: 'Diabetes, blood pressure, heart health support' },
  { id: 'energy', name: 'Energy & Vitality', icon: '⚡', description: 'Combat fatigue and boost daily energy levels' },
  { id: 'posture', name: 'Posture & Mobility', icon: '🙆', description: 'Flexibility, mobility, and postural health' },
  { id: 'social-wellness', name: 'Social Wellness', icon: '👥', description: 'Community, connection, and accountability' },
  { id: 'financial-wellness', name: 'Financial Wellness', icon: '💰', description: 'Healthy habits around money and spending' },
  { id: 'spiritual-wellness', name: 'Spiritual Wellness', icon: '✨', description: 'Purpose, values, and inner peace' },
  { id: 'preventive-health', name: 'Preventive Health', icon: '🛡️', description: 'Screenings, checkups, and proactive care' },
  { id: 'other', name: 'Other', icon: '✍️', description: 'My own custom wellness focus' },
];

const MAX = 10;

function ProfileWellnessInterestsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: setup } = useProfileSetup(user?.uid);
  const saveProfileSetup = useSaveProfileSetup(user?.uid);

  const [selectedWellness, setSelectedWellness] = useState<string[]>([]);
  const [customWellness, setCustomWellness] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!setup || hydrated) return;
    setSelectedWellness(setup.wellnessInterests ?? []);
    setHydrated(true);
  }, [setup, hydrated]);

  const selectedWellnessNames = useMemo(
    () => wellnessOptions.filter((o) => selectedWellness.includes(o.id)).map((o) => o.name),
    [selectedWellness],
  );

  const toggleWellness = (id: string) => {
    setSelectedWellness((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX) return prev;
      return [...prev, id];
    });
  };

  const buildPayload = () => ({
    exerciseInterests: setup?.exerciseInterests ?? [],
    wellnessInterests: selectedWellness,
    customInterests: setup?.customInterests ?? [],
    // Preserve existing goals — they are saved on the next step
    goals: setup?.goals ?? [],
    primaryGoal: setup?.primaryGoal,
    secondaryGoal: setup?.secondaryGoal,
    customGoals: setup?.customGoals ?? [],
    onboardingCompleted: setup?.onboardingCompleted ?? false,
    hasSeenIntro: setup?.hasSeenIntro ?? false,
    region: setup?.region ?? 'Kenya',
    personalInfo: setup?.personalInfo ?? { fullName: '', email: '', phone: '', birthday: '', displayName: '' },
    privacySettings: setup?.privacySettings ?? {
      isProfilePublic: true,
      showActivity: true,
      allowMessages: true,
      showWeightHeightToGroups: true,
      showBirthdayToFriends: true,
      isProfileSearchable: true,
    },
  });

  const handleNext = async () => {
    if (!user?.uid) { navigate('/app/login'); return; }
    try {
      await saveProfileSetup.mutateAsync(buildPayload());
      navigate('/app/profile/health-goals');
    } catch {
      showToast('Could not save your selections.', 'error');
    }
  };

  const handleSkip = async () => {
    if (!user?.uid) { navigate('/app/profile/health-goals'); return; }
    try { await saveProfileSetup.mutateAsync(buildPayload()); } catch { /* non-blocking */ }
    navigate('/app/profile/health-goals');
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe">
        <header className="flex items-center justify-between">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate('/app/profile/interests')}>
            <ArrowLeft size={28} className="text-slate-900" />
          </button>
          <p className="text-[16px] leading-[20px] tracking-[0.15em] font-bold uppercase text-slate-500">Profile Setup</p>
          <span className="w-10" />
        </header>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-[18px] leading-[24px] font-bold text-slate-700">Step 3 of 5</p>
          <p className="text-[18px] leading-[24px] font-bold text-primary">60% complete</p>
        </div>
        <div className="st-progress-track mt-3">
          <div className="st-progress-fill" style={{ width: '60%' }} />
        </div>

        <h1 className="st-heading-xl mt-6">Wellness Topics</h1>
        <p className="st-text-lg mt-3">Choose the wellness areas you'd like Tiizi to support. We'll personalise your communities, challenges, and recommendations based on your selections.</p>

        <div className="st-form-max mt-6">
          <button className="st-card w-full p-4 text-left" onClick={() => setShowModal(true)}>
            <div className="flex items-start justify-between">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Heart size={22} className="text-primary" />
              </div>
              <div className="flex items-center gap-2">
                {selectedWellness.length > 0 && (
                  <span className="text-[12px] font-bold text-primary">{selectedWellness.length} selected</span>
                )}
                <ChevronDown size={22} className="text-slate-400" />
              </div>
            </div>
            <p className="st-heading-lg mt-4">Wellness Topics</p>
            <p className="st-text-lg mt-2">Choose the wellness areas you'd like to focus on. Optional — pick up to {MAX}.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedWellnessNames.slice(0, 2).map((name) => (
                <span key={name} className="st-chip bg-primary text-white">{name} ×</span>
              ))}
              {selectedWellnessNames.length > 2 && (
                <span className="st-chip border border-dashed border-slate-300 text-slate-500">+{selectedWellnessNames.length - 2} more</span>
              )}
              {selectedWellnessNames.length === 0 && (
                <span className="st-chip border border-dashed border-slate-300 text-slate-400">Tap to choose (optional)...</span>
              )}
            </div>
          </button>
        </div>

        <div className="st-form-max mt-6 grid grid-cols-[1fr_1.55fr] gap-3">
          <button className="st-btn-secondary" onClick={() => navigate('/app/profile/interests')}>Previous</button>
          <button className="st-btn-primary" onClick={handleNext} disabled={saveProfileSetup.isPending}>
            {saveProfileSetup.isPending ? 'Saving...' : 'Next Step →'}
          </button>
        </div>

        <button
          className="st-form-max mt-4 w-full text-center text-[16px] leading-[22px] font-semibold text-slate-400"
          onClick={handleSkip}
        >
          Skip this step
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-end">
          <div className="w-full max-w-mobile mx-auto rounded-t-3xl bg-white p-5 pb-7 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[20px] leading-[24px] font-black text-slate-900">Wellness Topics</h3>
              <button
                className="h-10 px-4 rounded-full border border-slate-200 text-[14px] font-bold"
                onClick={() => setShowModal(false)}
              >
                Done
              </button>
            </div>
            <p className="text-[13px] mb-4">
              {selectedWellness.length >= MAX
                ? <span className="font-semibold text-primary">Maximum selected.</span>
                : <span className="text-slate-500">{selectedWellness.length} / {MAX} selected (optional)</span>}
            </p>
            <div className="space-y-2">
              {wellnessOptions.map((option) => {
                const active = selectedWellness.includes(option.id);
                return (
                  <button
                    key={option.id}
                    className={`w-full rounded-xl border p-3 text-left ${active ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white'}`}
                    onClick={() => toggleWellness(option.id)}
                  >
                    <p className={`text-[14px] font-bold ${active ? 'text-primary' : 'text-slate-900'}`}>{option.icon} {option.name}</p>
                    <p className="text-[12px] leading-[17px] text-slate-600 mt-1">{option.description}</p>
                  </button>
                );
              })}
              <input
                className="st-input"
                placeholder="Other wellness topic (optional)"
                value={customWellness}
                maxLength={80}
                onChange={(e) => setCustomWellness(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}

export default ProfileWellnessInterestsScreen;
