import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useProfileSetup, useSaveProfileSetup } from '../../hooks/useProfileSetup';

const NEXT_STEPS = [
  { icon: '👥', label: 'Join your first community' },
  { icon: '🏆', label: 'Complete your first challenge' },
  { icon: '📝', label: 'Log your first activity' },
];

function getCommunityRec(interests: string[]): string {
  if (interests.some((i) => ['walking', 'running', 'cycling', 'hiking'].includes(i))) {
    return 'Find an active movement group';
  }
  if (interests.some((i) => ['gym-weightlifting', 'hiit-circuit', 'home-workouts'].includes(i))) {
    return 'Join a strength community';
  }
  if (interests.some((i) => ['yoga', 'pilates', 'stretching-mobility'].includes(i))) {
    return 'Explore wellness communities';
  }
  return 'Find your first community';
}

function getChallengeRec(goals: string[]): string {
  if (goals.some((g) => ['consistency', 'sleep', 'stress', 'manage-stress', 'improve-sleep'].includes(g))) {
    return 'Start with a 7-day streak challenge';
  }
  if (goals.some((g) => ['improve-fitness', 'build-strength', 'lose-weight', 'lose-belly-fat'].includes(g))) {
    return 'Try a beginner fitness challenge';
  }
  return 'Join your first challenge';
}

function ProfileSetupFinishScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: setup } = useProfileSetup(user?.uid);
  const saveProfileSetup = useSaveProfileSetup(user?.uid);
  const [launching, setLaunching] = useState(false);

  const displayName =
    setup?.personalInfo?.displayName || setup?.personalInfo?.fullName || 'there';

  const activityCount = setup?.exerciseInterests?.length ?? 0;
  const wellnessCount = setup?.wellnessInterests?.length ?? 0;
  const goalCount = setup?.goals?.length ?? 0;

  const communityRec = getCommunityRec(setup?.exerciseInterests ?? []);
  const challengeRec = getChallengeRec(setup?.goals ?? []);

  const basePayload = () => ({
    exerciseInterests: setup?.exerciseInterests ?? [],
    wellnessInterests: setup?.wellnessInterests ?? [],
    customInterests: setup?.customInterests ?? [],
    customWellnessInterests: setup?.customWellnessInterests ?? [],
    goals: setup?.goals ?? [],
    primaryGoal: setup?.primaryGoal,
    secondaryGoal: setup?.secondaryGoal,
    customGoals: setup?.customGoals ?? [],
    onboardingCompleted: true as const,
    hasSeenIntro: setup?.hasSeenIntro ?? true,
    region: setup?.region ?? 'Kenya',
    personalInfo: setup?.personalInfo ?? {
      fullName: '', email: '', phone: '', birthday: '', displayName: '',
    },
    privacySettings: setup?.privacySettings ?? {
      isProfilePublic: true,
      showActivity: true,
      allowMessages: true,
      showWeightHeightToGroups: true,
      showBirthdayToFriends: true,
      isProfileSearchable: true,
    },
  });

  const handleStart = async () => {
    if (!user?.uid) {
      showToast('You must be logged in.', 'error');
      return;
    }
    try {
      setLaunching(true);
      await saveProfileSetup.mutateAsync(basePayload());
      await new Promise((r) => setTimeout(r, 1000));
      navigate('/app/home');
    } catch {
      setLaunching(false);
      showToast('Could not complete setup.', 'error');
    }
  };

  const handleSkip = async () => {
    try {
      await saveProfileSetup.mutateAsync(basePayload());
    } catch { /* non-blocking */ }
    navigate('/app/home');
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe">
        <header className="flex items-center">
          <button
            className="h-10 w-10 flex items-center justify-center"
            onClick={() => navigate('/app/profile/privacy-settings')}
          >
            <ArrowLeft size={28} className="text-slate-900" />
          </button>
        </header>

        {/* ── Header ── */}
        <div className="mt-6">
          <p className="text-[32px] leading-none">🎉</p>
          <h1 className="st-heading-xl mt-3">Welcome to Tiizi, {displayName}!</h1>
          <p className="st-text-lg mt-2">Your profile is ready. Here's what we've set up for you.</p>
        </div>

        {/* ── Section A: Your Tiizi Profile ── */}
        <p className="text-[12px] tracking-[0.16em] uppercase font-bold text-slate-500 mt-8">Your Tiizi Profile</p>
        <div className="st-form-max mt-4 grid grid-cols-3 gap-3">
          <div className="st-card px-3 py-4 text-center">
            <p className="text-[28px] leading-none font-black text-primary">{activityCount}</p>
            <p className="text-[11px] leading-[14px] font-bold text-slate-500 mt-1">
              {activityCount === 1 ? 'Activity' : 'Activities'}
            </p>
          </div>
          <div className="st-card px-3 py-4 text-center">
            <p className="text-[28px] leading-none font-black text-primary">{wellnessCount}</p>
            <p className="text-[11px] leading-[14px] font-bold text-slate-500 mt-1">
              {wellnessCount === 1 ? 'Wellness Topic' : 'Wellness Topics'}
            </p>
          </div>
          <div className="st-card px-3 py-4 text-center">
            <p className="text-[28px] leading-none font-black text-primary">{goalCount}</p>
            <p className="text-[11px] leading-[14px] font-bold text-slate-500 mt-1">
              {goalCount === 1 ? 'Health Goal' : 'Health Goals'}
            </p>
          </div>
        </div>

        {/* ── Section B: Recommended for You ── */}
        <p className="text-[12px] tracking-[0.16em] uppercase font-bold text-slate-500 mt-8">Recommended for You</p>
        <div className="st-form-max mt-4 space-y-3">
          <div className="st-card px-4 py-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-[20px] flex-shrink-0">👥</div>
            <div>
              <p className="text-[13px] font-bold text-slate-900">{communityRec}</p>
              <p className="text-[12px] text-slate-500 mt-0.5">Based on your activities</p>
            </div>
          </div>
          <div className="st-card px-4 py-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-[20px] flex-shrink-0">🏆</div>
            <div>
              <p className="text-[13px] font-bold text-slate-900">{challengeRec}</p>
              <p className="text-[12px] text-slate-500 mt-0.5">Based on your goals</p>
            </div>
          </div>
        </div>

        {/* ── Section C: Next Steps ── */}
        <p className="text-[12px] tracking-[0.16em] uppercase font-bold text-slate-500 mt-8">Next Steps</p>
        <div className="st-form-max mt-4 space-y-3">
          {NEXT_STEPS.map(({ icon, label }) => (
            <div key={label} className="st-card px-4 py-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-[20px] flex-shrink-0">{icon}</div>
              <p className="text-[14px] font-bold text-slate-900">{label}</p>
            </div>
          ))}
        </div>

        {/* ── CTA ── */}
        <button
          className="st-form-max st-btn-primary mt-8"
          onClick={handleStart}
          disabled={launching || saveProfileSetup.isPending}
        >
          {launching ? 'Preparing your personalised Tiizi home...' : 'Start Exploring Tiizi →'}
        </button>

        <button
          className="st-form-max mt-5 w-full text-center text-[16px] leading-[24px] font-semibold text-slate-400"
          onClick={handleSkip}
        >
          Skip for now
        </button>
      </div>
    </Screen>
  );
}

export default ProfileSetupFinishScreen;
