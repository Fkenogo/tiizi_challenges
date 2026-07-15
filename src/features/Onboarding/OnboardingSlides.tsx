import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getOnboardingPath, useProfileSetup, useSaveProfileSetup } from '../../hooks/useProfileSetup';
import { OnboardingSlide } from './OnboardingSlide';
import { ONBOARDING_SLIDES } from './onboardingData';

function OnboardingSlides() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: setup } = useProfileSetup(user?.uid);
  const saveProfileSetup = useSaveProfileSetup(user?.uid);
  const [current, setCurrent] = useState(0);
  const [saving, setSaving] = useState(false);

  // If user has already seen intro, skip straight to their onboarding path
  useEffect(() => {
    if (setup?.hasSeenIntro) {
      navigate(getOnboardingPath(setup), { replace: true });
    }
  }, [setup, navigate]);

  const markSeenAndContinue = async () => {
    setSaving(true);
    try {
      if (user?.uid) {
        await saveProfileSetup.mutateAsync({
          exerciseInterests: setup?.exerciseInterests ?? [],
          wellnessInterests: setup?.wellnessInterests ?? [],
          customInterests: setup?.customInterests ?? [],
          customWellnessInterests: setup?.customWellnessInterests ?? [],
          goals: setup?.goals ?? [],
          primaryGoal: setup?.primaryGoal,
          secondaryGoal: setup?.secondaryGoal,
          customGoals: setup?.customGoals ?? [],
          onboardingCompleted: setup?.onboardingCompleted ?? false,
          hasSeenIntro: true,
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
      }
    } catch { /* non-blocking — navigate regardless */ }
    navigate('/app/profile/completion');
  };

  const handleNext = () => {
    if (current < ONBOARDING_SLIDES.length - 1) {
      setCurrent((prev) => prev + 1);
    } else {
      markSeenAndContinue();
    }
  };

  return (
    <OnboardingSlide
      slide={ONBOARDING_SLIDES[current]}
      current={current}
      total={ONBOARDING_SLIDES.length}
      isLast={current === ONBOARDING_SLIDES.length - 1}
      saving={saving}
      onNext={handleNext}
      onSkip={markSeenAndContinue}
    />
  );
}

export default OnboardingSlides;
