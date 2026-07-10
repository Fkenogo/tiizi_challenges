import { ArrowLeft, ChevronDown, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useProfileSetup, useSaveProfileSetup } from '../../hooks/useProfileSetup';

type GoalOption = { id: string; name: string; icon: string; description: string };

const goalOptions: GoalOption[] = [
  { id: 'weight-loss', name: 'Lose Weight', icon: '⚖️', description: 'Lose excess weight and burn fat.' },
  { id: 'stay-healthy-active', name: 'Stay Healthy & Active', icon: '❤️', description: 'Maintain overall health and energy.' },
  { id: 'build-strength', name: 'Build Strength', icon: '💪', description: 'Get stronger and build muscle.' },
  { id: 'improve-fitness', name: 'Improve Endurance & Fitness', icon: '🏃', description: 'Increase stamina and endurance.' },
  { id: 'lose-belly-fat', name: 'Reduce Belly Fat', icon: '🎯', description: 'Target stubborn mid-section fat.' },
  { id: 'manage-health-condition', name: 'Manage a Health Condition', icon: '🩺', description: 'Support diabetes, blood pressure, or heart health.' },
  { id: 'reduce-stress', name: 'Reduce Stress', icon: '🌿', description: 'Improve mental health and relaxation.' },
  { id: 'improve-mental-health', name: 'Improve Mental Health', icon: '🧠', description: 'Boost mood, clarity, and emotional wellbeing.' },
  { id: 'increase-energy', name: 'Boost Energy', icon: '⚡', description: 'Combat fatigue and improve daily energy.' },
  { id: 'improve-flexibility', name: 'Improve Flexibility', icon: '🤸', description: 'Build better mobility and movement quality.' },
  { id: 'sleep-better', name: 'Sleep Better', icon: '😴', description: 'Improve sleep quality and recovery.' },
  { id: 'improve-nutrition', name: 'Improve Nutrition', icon: '🥗', description: 'Eat healthier and build better food habits.' },
  { id: 'sports-performance', name: 'Sports Performance', icon: '🏅', description: 'Train to compete and improve athletically.' },
  { id: 'build-daily-routine', name: 'Build Daily Routine', icon: '📅', description: 'Create consistent healthy habits.' },
  { id: 'feel-more-confident', name: 'Feel More Confident', icon: '✨', description: 'Improve confidence and self-esteem.' },
  { id: 'stay-accountable', name: 'Stay Accountable', icon: '👥', description: 'Use structure and tracking for motivation.' },
  { id: 'other', name: 'Other', icon: '✍️', description: 'Set a custom health goal.' },
];

const MAX = 10;

function ProfileHealthGoalsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: setup } = useProfileSetup(user?.uid);
  const saveProfileSetup = useSaveProfileSetup(user?.uid);

  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [customGoal, setCustomGoal] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!setup || hydrated) return;
    // Back-compat: goals[] takes priority, fall back to primaryGoal/secondaryGoal scalars
    setSelectedGoals(
      setup.goals?.length
        ? setup.goals
        : [setup.primaryGoal, setup.secondaryGoal].filter(Boolean) as string[],
    );
    setCustomGoal(setup.customGoals?.[0] ?? '');
    setHydrated(true);
  }, [setup, hydrated]);

  const selectedGoalNames = useMemo(
    () => goalOptions.filter((o) => selectedGoals.includes(o.id)).map((o) => o.name),
    [selectedGoals],
  );

  const toggleGoal = (id: string) => {
    setSelectedGoals((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX) return prev;
      return [...prev, id];
    });
  };

  const buildPayload = () => ({
    exerciseInterests: setup?.exerciseInterests ?? [],
    wellnessInterests: setup?.wellnessInterests ?? [],
    customInterests: setup?.customInterests ?? [],
    goals: selectedGoals,
    primaryGoal: selectedGoals[0],
    secondaryGoal: selectedGoals[1],
    customGoals: customGoal.trim() ? [customGoal.trim()] : (setup?.customGoals ?? []),
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
    if (selectedGoals.length < 1) {
      showToast('Choose at least one health goal.', 'error');
      return;
    }
    if (!user?.uid) { navigate('/app/login'); return; }
    try {
      await saveProfileSetup.mutateAsync(buildPayload());
      navigate('/app/profile/privacy-settings');
    } catch {
      showToast('Could not save your selections.', 'error');
    }
  };

  const handleSkip = async () => {
    if (!user?.uid) { navigate('/app/profile/privacy-settings'); return; }
    try { await saveProfileSetup.mutateAsync(buildPayload()); } catch { /* non-blocking */ }
    navigate('/app/profile/privacy-settings');
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe">
        <header className="flex items-center justify-between">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate('/app/profile/wellness-interests')}>
            <ArrowLeft size={28} className="text-slate-900" />
          </button>
          <p className="text-[16px] leading-[20px] tracking-[0.15em] font-bold uppercase text-slate-500">Profile Setup</p>
          <span className="w-10" />
        </header>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-[18px] leading-[24px] font-bold text-slate-700">Step 4 of 5</p>
          <p className="text-[18px] leading-[24px] font-bold text-primary">80% complete</p>
        </div>
        <div className="st-progress-track mt-3">
          <div className="st-progress-fill" style={{ width: '80%' }} />
        </div>

        <h1 className="st-heading-xl mt-6">Health Goals</h1>
        <p className="st-text-lg mt-3">What would you like to achieve? We'll tailor your challenges and communities to help you get there.</p>

        <div className="st-form-max mt-6">
          <button className="st-card w-full p-4 text-left" onClick={() => setShowModal(true)}>
            <div className="flex items-start justify-between">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Trophy size={22} className="text-primary" />
              </div>
              <div className="flex items-center gap-2">
                {selectedGoals.length > 0 && (
                  <span className="text-[12px] font-bold text-primary">{selectedGoals.length} selected</span>
                )}
                <ChevronDown size={22} className="text-slate-400" />
              </div>
            </div>
            <p className="st-heading-lg mt-4">Health Goals</p>
            <p className="st-text-lg mt-2">Choose at least 1 goal to personalise your experience.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedGoalNames.slice(0, 2).map((name) => (
                <span key={name} className="st-chip bg-primary text-white">{name} ×</span>
              ))}
              {selectedGoalNames.length > 2 && (
                <span className="st-chip border border-dashed border-slate-300 text-slate-500">+{selectedGoalNames.length - 2} more</span>
              )}
              {selectedGoalNames.length === 0 && (
                <span className="st-chip border border-dashed border-slate-300 text-slate-400">Tap to choose...</span>
              )}
            </div>
          </button>
        </div>

        <div className="st-form-max mt-6 grid grid-cols-[1fr_1.55fr] gap-3">
          <button className="st-btn-secondary" onClick={() => navigate('/app/profile/wellness-interests')}>Previous</button>
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
              <h3 className="text-[20px] leading-[24px] font-black text-slate-900">Health Goals</h3>
              <button
                className="h-10 px-4 rounded-full border border-slate-200 text-[14px] font-bold"
                onClick={() => setShowModal(false)}
              >
                Done
              </button>
            </div>
            <p className="text-[13px] mb-4">
              {selectedGoals.length >= MAX
                ? <span className="font-semibold text-primary">Maximum selected.</span>
                : <span className="text-slate-500">{selectedGoals.length} / {MAX} selected</span>}
            </p>
            <div className="space-y-2">
              {goalOptions.map((goal) => {
                const active = selectedGoals.includes(goal.id);
                return (
                  <button
                    key={goal.id}
                    className={`w-full rounded-xl border p-3 text-left ${active ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white'}`}
                    onClick={() => toggleGoal(goal.id)}
                  >
                    <p className={`text-[14px] font-bold ${active ? 'text-primary' : 'text-slate-900'}`}>{goal.icon} {goal.name}</p>
                    <p className="text-[12px] leading-[17px] text-slate-600 mt-1">{goal.description}</p>
                  </button>
                );
              })}
              <input
                className="st-input"
                placeholder="Other goal (optional)"
                value={customGoal}
                maxLength={100}
                onChange={(e) => setCustomGoal(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}

export default ProfileHealthGoalsScreen;
