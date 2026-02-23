import { ArrowLeft, Calendar, Camera } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useProfileSetup, useSaveProfileSetup } from '../../hooks/useProfileSetup';

function ProfileCompletionScreen() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const { data: setup } = useProfileSetup(user?.uid);
  const saveProfileSetup = useSaveProfileSetup(user?.uid);

  const [fullName, setFullName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const weightOptions = Array.from({ length: 171 }, (_, idx) => 30 + idx); // 30kg-200kg
  const heightOptions = Array.from({ length: 121 }, (_, idx) => 120 + idx); // 120cm-240cm

  useEffect(() => {
    setFullName(setup?.personalInfo?.fullName || profile?.displayName || '');
    setBirthday(setup?.personalInfo?.birthday || '');
    setWeightKg(setup?.personalInfo?.weightKg ? String(setup.personalInfo.weightKg) : '');
    setHeightCm(setup?.personalInfo?.heightCm ? String(setup.personalInfo.heightCm) : '');
  }, [setup, profile?.displayName]);

  const handleNext = async () => {
    if (!user?.uid || !fullName.trim()) {
      showToast('Please enter your full name.', 'error');
      return;
    }

    try {
      await saveProfileSetup.mutateAsync({
        exerciseInterests: setup?.exerciseInterests ?? [],
        customInterests: setup?.customInterests ?? [],
        primaryGoal: setup?.primaryGoal,
        secondaryGoal: setup?.secondaryGoal,
        customGoals: setup?.customGoals ?? [],
        onboardingCompleted: false,
        region: setup?.region ?? 'Kenya',
        privacySettings: setup?.privacySettings ?? {
          isProfilePublic: true,
          showActivity: true,
          allowMessages: true,
          showWeightHeightToGroups: true,
          showBirthdayToFriends: true,
          isProfileSearchable: true,
        },
        personalInfo: {
          fullName: fullName.trim(),
          email: setup?.personalInfo?.email ?? profile?.email ?? '',
          phone: setup?.personalInfo?.phone ?? '',
          birthday: birthday.trim(),
          weightKg: Number(weightKg) || undefined,
          heightCm: Number(heightCm) || undefined,
          displayName: setup?.personalInfo?.displayName ?? fullName.trim(),
        },
      });
      navigate('/app/profile/interests');
    } catch {
      showToast('Could not save your profile details.', 'error');
    }
  };

  const handleSkipForNow = async () => {
    if (!user?.uid) {
      navigate('/app/home');
      return;
    }
    try {
      await saveProfileSetup.mutateAsync({
        exerciseInterests: setup?.exerciseInterests ?? [],
        customInterests: setup?.customInterests ?? [],
        primaryGoal: setup?.primaryGoal,
        secondaryGoal: setup?.secondaryGoal,
        customGoals: setup?.customGoals ?? [],
        onboardingCompleted: false,
        region: setup?.region ?? 'Kenya',
        privacySettings: setup?.privacySettings ?? {
          isProfilePublic: true,
          showActivity: true,
          allowMessages: true,
          showWeightHeightToGroups: true,
          showBirthdayToFriends: true,
          isProfileSearchable: true,
        },
        personalInfo: {
          fullName: fullName.trim() || setup?.personalInfo?.fullName || profile?.displayName || '',
          email: setup?.personalInfo?.email ?? profile?.email ?? '',
          phone: setup?.personalInfo?.phone ?? '',
          birthday: birthday.trim(),
          weightKg: Number(weightKg) || undefined,
          heightCm: Number(heightCm) || undefined,
          displayName: setup?.personalInfo?.displayName || fullName.trim() || setup?.personalInfo?.fullName || profile?.displayName || '',
        },
      });
    } catch {
      // Non-blocking skip path.
    } finally {
      navigate('/app/home');
    }
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe">
        <div className="flex items-center justify-between">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate('/app/signup')}>
            <ArrowLeft size={28} className="text-slate-900" />
          </button>
          <span className="w-10" />
          <span className="w-10" />
        </div>

        <div className="mt-2 flex items-center justify-between">
          <p className="text-[18px] leading-[24px] font-bold text-slate-500">Step 1 of 3</p>
          <p className="text-[18px] leading-[24px] font-bold text-primary">33%</p>
        </div>

        <div className="st-progress-track mt-3">
          <div className="st-progress-fill" style={{ width: '33%' }} />
        </div>

        <h1 className="st-heading-xl mt-6">Complete Your Profile</h1>

        <div className="mt-6 flex flex-col items-center">
          <div className="relative h-44 w-44 rounded-full border-[3px] border-dashed border-orange-200 bg-orange-50/30 flex items-center justify-center">
            <div className="h-14 w-14 rounded-full bg-primary/20" />
            <button className="absolute bottom-2 right-2 h-14 w-14 rounded-full bg-primary text-white flex items-center justify-center">
              <Camera size={22} />
            </button>
          </div>
          <p className="mt-4 text-[16px] leading-[22px] font-bold text-slate-500">Tap to add a profile picture</p>
        </div>

        <div className="st-form-max mt-8 space-y-5">
          <div>
            <p className="st-label">Full Name</p>
            <input className="st-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" />
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
                placeholder="DD/MM/YYYY"
              />
              <Calendar size={24} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="st-label">Weight</p>
              <div className="relative">
                <select className="st-input pr-12 appearance-none" value={weightKg} onChange={(e) => setWeightKg(e.target.value)}>
                  <option value="">00</option>
                  {weightOptions.map((value) => (
                    <option key={value} value={String(value)}>
                      {value}
                    </option>
                  ))}
                </select>
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-[14px] font-bold">kg</span>
              </div>
            </div>
            <div>
              <p className="st-label">Height</p>
              <div className="relative">
                <select className="st-input pr-12 appearance-none" value={heightCm} onChange={(e) => setHeightCm(e.target.value)}>
                  <option value="">000</option>
                  {heightOptions.map((value) => (
                    <option key={value} value={String(value)}>
                      {value}
                    </option>
                  ))}
                </select>
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-[14px] font-bold">cm</span>
              </div>
            </div>
          </div>
        </div>

        <button className="st-form-max st-btn-primary mt-8" onClick={handleNext} disabled={saveProfileSetup.isPending}>
          {saveProfileSetup.isPending ? 'Saving...' : 'Next Step →'}
        </button>

        <p className="mt-4 text-center text-[12px] leading-[18px] text-slate-400">By continuing, you agree to Tiizi's Terms of Service.</p>
        <button className="st-form-max mt-4 text-center text-[16px] leading-[22px] font-semibold text-slate-500" onClick={handleSkipForNow}>
          Skip for now
        </button>
      </div>
    </Screen>
  );
}

export default ProfileCompletionScreen;
