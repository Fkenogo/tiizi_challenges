import { ArrowLeft, ChevronDown, Dumbbell, Sparkles, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useProfileSetup, useSaveProfileSetup } from '../../hooks/useProfileSetup';

type InterestOption = { id: string; name: string; icon: string };
type GoalOption = { id: string; name: string; description: string; icon: string };

const exerciseInterests: InterestOption[] = [
  { id: 'running', name: 'Running', icon: '🏃' },
  { id: 'walking', name: 'Walking', icon: '🚶' },
  { id: 'gym-weightlifting', name: 'Gym/Weightlifting', icon: '💪' },
  { id: 'home-workouts', name: 'Home Workouts', icon: '🏠' },
  { id: 'yoga', name: 'Yoga', icon: '🧘' },
  { id: 'swimming', name: 'Swimming', icon: '🏊' },
  { id: 'cycling', name: 'Cycling', icon: '🚴' },
  { id: 'football', name: 'Football (Soccer)', icon: '⚽' },
  { id: 'hiking', name: 'Hiking', icon: '⛰️' },
  { id: 'group-fitness', name: 'Group Fitness Classes', icon: '👥' },
  { id: 'hiit-circuit', name: 'HIIT/Circuit Training', icon: '⚡' },
  { id: 'pilates', name: 'Pilates', icon: '🤸' },
  { id: 'dancing', name: 'Dancing', icon: '💃' },
  { id: 'stretching-mobility', name: 'Stretching/Mobility', icon: '🙆' },
  { id: 'other', name: 'Other', icon: '✍️' },
];

const wellnessGoals: GoalOption[] = [
  { id: 'weight-loss', name: 'Weight Loss', description: 'Lose excess weight and burn fat.', icon: '⚖️' },
  { id: 'stay-healthy-active', name: 'Stay Healthy & Active', description: 'Maintain overall health.', icon: '❤️' },
  { id: 'build-strength', name: 'Build Strength', description: 'Get stronger and build muscle.', icon: '💪' },
  { id: 'improve-fitness', name: 'Improve Fitness', description: 'Increase stamina and endurance.', icon: '🏃' },
  { id: 'manage-health-condition', name: 'Manage Health Condition', description: 'Support diabetes, blood pressure, or heart health.', icon: '🩺' },
  { id: 'reduce-stress', name: 'Reduce Stress', description: 'Improve mental health and relaxation.', icon: '🧘' },
  { id: 'increase-energy', name: 'Increase Energy', description: 'Combat fatigue and improve daily energy.', icon: '⚡' },
  { id: 'improve-flexibility', name: 'Improve Flexibility', description: 'Build better mobility and movement quality.', icon: '🤸' },
  { id: 'build-daily-routine', name: 'Build Daily Routine', description: 'Create consistent healthy habits.', icon: '📅' },
  { id: 'feel-more-confident', name: 'Feel More Confident', description: 'Improve confidence and self-esteem.', icon: '✨' },
  { id: 'stay-accountable', name: 'Stay Accountable', description: 'Use structure and tracking for motivation.', icon: '👥' },
  { id: 'other', name: 'Other', description: 'Set a custom wellness goal.', icon: '✍️' },
];

function ProfileInterestsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: profileSetup } = useProfileSetup(user?.uid);
  const saveProfileSetup = useSaveProfileSetup(user?.uid);

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState('');
  const [customGoal, setCustomGoal] = useState('');
  const [openModal, setOpenModal] = useState<'interests' | 'goals' | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!profileSetup || hydrated) return;
    setSelectedInterests(profileSetup.exerciseInterests ?? []);
    setSelectedGoals([profileSetup.primaryGoal, profileSetup.secondaryGoal].filter(Boolean) as string[]);
    setCustomInterest(profileSetup.customInterests?.[0] ?? '');
    setCustomGoal(profileSetup.customGoals?.[0] ?? '');
    setHydrated(true);
  }, [profileSetup, hydrated]);

  const selectedInterestNames = useMemo(
    () => exerciseInterests.filter((item) => selectedInterests.includes(item.id)).map((item) => item.name),
    [selectedInterests],
  );

  const selectedGoalNames = useMemo(
    () => wellnessGoals.filter((item) => selectedGoals.includes(item.id)).map((item) => item.name),
    [selectedGoals],
  );

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= 10) return prev;
      return [...prev, id];
    });
  };

  const toggleGoal = (id: string) => {
    setSelectedGoals((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const handleNext = async () => {
    if (selectedInterests.length < 1 || selectedGoals.length < 1) {
      showToast('Select at least 1 interest and 1 goal.', 'error');
      return;
    }

    if (!user?.uid) {
      navigate('/app/login');
      return;
    }

    try {
      await saveProfileSetup.mutateAsync({
        exerciseInterests: selectedInterests,
        customInterests: customInterest.trim() ? [customInterest.trim()] : [],
        primaryGoal: selectedGoals[0],
        secondaryGoal: selectedGoals[1],
        customGoals: customGoal.trim() ? [customGoal.trim()] : [],
        onboardingCompleted: false,
        region: profileSetup?.region ?? 'Kenya',
        personalInfo: profileSetup?.personalInfo ?? {
          fullName: '',
          email: '',
          phone: '',
          birthday: '',
          displayName: '',
        },
        privacySettings: profileSetup?.privacySettings ?? {
          isProfilePublic: true,
          showActivity: true,
          allowMessages: true,
          showWeightHeightToGroups: true,
          showBirthdayToFriends: true,
          isProfileSearchable: true,
        },
      });
      navigate('/app/profile/privacy-settings');
    } catch {
      showToast('Could not save your interests and goals.', 'error');
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
          <p className="text-[18px] leading-[24px] font-bold text-slate-700">Step 2 of 3</p>
          <p className="text-[18px] leading-[24px] font-bold text-primary">66% complete</p>
        </div>
        <div className="st-progress-track mt-3">
          <div className="st-progress-fill" style={{ width: '66%' }} />
        </div>

        <h1 className="st-heading-xl mt-6">What moves you?</h1>
        <p className="st-text-lg mt-3">Tell us about your activity preferences and health objectives.</p>

        <div className="st-form-max mt-6 space-y-4">
          <button className="st-card w-full p-4 text-left" onClick={() => setOpenModal('interests')}>
            <div className="flex items-start justify-between">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Dumbbell size={22} className="text-primary" />
              </div>
              <ChevronDown size={22} className="text-slate-400" />
            </div>
            <p className="st-heading-lg mt-4">Exercise Interests</p>
            <p className="st-text-lg mt-2">Choose the activities you enjoy most</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedInterestNames.slice(0, 2).map((name) => (
                <span key={name} className="st-chip bg-primary text-white">{name} ×</span>
              ))}
              {selectedInterestNames.length > 2 && <span className="st-chip border border-dashed border-slate-300 text-slate-500">+{selectedInterestNames.length - 2} more</span>}
              {selectedInterestNames.length === 0 && <span className="st-chip border border-dashed border-slate-300 text-slate-400">Select more...</span>}
            </div>
          </button>

          <button className="st-card w-full p-4 text-left" onClick={() => setOpenModal('goals')}>
            <div className="flex items-start justify-between">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Trophy size={22} className="text-primary" />
              </div>
              <ChevronDown size={22} className="text-slate-400" />
            </div>
            <p className="st-heading-lg mt-4">Wellness Goals</p>
            <p className="st-text-lg mt-2">What do you want to achieve?</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedGoalNames.slice(0, 1).map((name) => (
                <span key={name} className="st-chip bg-primary text-white">{name} ×</span>
              ))}
              {selectedGoalNames.length > 1 && <span className="st-chip border border-dashed border-slate-300 text-slate-500">+{selectedGoalNames.length - 1} more</span>}
              {selectedGoalNames.length === 0 && <span className="st-chip border border-dashed border-slate-300 text-slate-400">Select more...</span>}
            </div>
          </button>

          <div className="st-card overflow-hidden relative">
            <img
              src="https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=800&q=80"
              alt="Daily inspiration"
              className="w-full h-56 object-cover"
            />
            <div className="absolute inset-0 bg-black/25" />
            <div className="absolute left-4 bottom-4 text-white">
              <p className="text-[11px] tracking-[0.16em] uppercase font-bold">Daily Inspiration</p>
              <p className="text-[16px] leading-[20px] font-black mt-2">Every move counts</p>
            </div>
          </div>
        </div>

        <div className="st-form-max mt-6 grid grid-cols-[1fr_1.55fr] gap-3">
          <button className="st-btn-secondary" onClick={() => navigate('/app/profile/completion')}>Previous</button>
          <button className="st-btn-primary" onClick={handleNext} disabled={saveProfileSetup.isPending}>{saveProfileSetup.isPending ? 'Saving...' : 'Next Step →'}</button>
        </div>
      </div>

      {openModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-end">
          <div className="w-full max-w-mobile mx-auto rounded-t-3xl bg-white p-5 pb-7 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[20px] leading-[24px] font-black text-slate-900">{openModal === 'interests' ? 'Exercise Interests' : 'Wellness Goals'}</h3>
              <button className="h-10 px-4 rounded-full border border-slate-200 text-[14px] font-bold" onClick={() => setOpenModal(null)}>Done</button>
            </div>

            {openModal === 'interests' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {exerciseInterests.map((option) => {
                    const active = selectedInterests.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        className={`rounded-xl px-3 py-3 text-left text-[14px] font-bold border ${active ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-200'}`}
                        onClick={() => toggleInterest(option.id)}
                      >
                        {option.icon} {option.name}
                      </button>
                    );
                  })}
                </div>
                <input className="st-input" placeholder="Other interest (optional)" value={customInterest} maxLength={50} onChange={(e) => setCustomInterest(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-2">
                {wellnessGoals.map((goal) => {
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
                <input className="st-input" placeholder="Other goal (optional)" value={customGoal} maxLength={100} onChange={(e) => setCustomGoal(e.target.value)} />
              </div>
            )}
          </div>
        </div>
      )}
    </Screen>
  );
}

export default ProfileInterestsScreen;
