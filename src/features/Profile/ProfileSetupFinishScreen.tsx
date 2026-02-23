import { ArrowLeft, Camera, Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useProfileSetup, useSaveProfileSetup } from '../../hooks/useProfileSetup';

function ProfileSetupFinishScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: setup } = useProfileSetup(user?.uid);
  const saveProfileSetup = useSaveProfileSetup(user?.uid);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    setDisplayName(setup?.personalInfo?.displayName || setup?.personalInfo?.fullName || '');
  }, [setup]);

  const handleFinishSetup = async () => {
    if (!user?.uid) {
      showToast('You must be logged in.', 'error');
      return;
    }

    try {
      await saveProfileSetup.mutateAsync({
        exerciseInterests: setup?.exerciseInterests ?? [],
        customInterests: setup?.customInterests ?? [],
        primaryGoal: setup?.primaryGoal,
        secondaryGoal: setup?.secondaryGoal,
        customGoals: setup?.customGoals ?? [],
        onboardingCompleted: true,
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
          fullName: setup?.personalInfo?.fullName ?? displayName.trim(),
          email: setup?.personalInfo?.email ?? '',
          phone: setup?.personalInfo?.phone ?? '',
          birthday: setup?.personalInfo?.birthday ?? '',
          weightKg: setup?.personalInfo?.weightKg,
          heightCm: setup?.personalInfo?.heightCm,
          displayName: displayName.trim() || setup?.personalInfo?.fullName || '',
        },
      });
      navigate('/app/home');
    } catch {
      showToast('Could not complete setup.', 'error');
    }
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe">
        <header className="flex items-center">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate('/app/profile/privacy-settings')}>
            <ArrowLeft size={28} className="text-slate-900" />
          </button>
        </header>

        <h1 className="st-heading-xl mt-8">Let’s get you set up.</h1>

        <div className="mt-8 flex flex-col items-center">
          <div className="relative h-48 w-48 rounded-full bg-orange-50/80 border-4 border-white shadow-sm flex items-center justify-center">
            <div className="h-28 w-28 rounded-full bg-white border border-orange-100 shadow-inner flex items-center justify-center">
              <Camera size={34} className="text-orange-200" />
            </div>
            <button className="absolute bottom-3 right-2 h-14 w-14 rounded-full bg-primary text-white flex items-center justify-center">
              <Camera size={24} />
            </button>
          </div>
          <p className="text-primary text-[16px] leading-[20px] font-bold mt-4">Add Photo</p>
        </div>

        <div className="st-form-max st-card mt-8 p-5">
          <p className="text-[12px] tracking-[0.16em] uppercase font-bold text-slate-500">Display Name</p>
          <div className="relative mt-3">
            <input className="st-input pr-12" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Enter your name" />
            <Pencil size={22} className="absolute right-4 top-1/2 -translate-y-1/2 text-primary" />
          </div>
          <p className="st-text-lg mt-4">This is how your group members will see you.</p>
        </div>

        <button className="st-form-max st-btn-primary mt-8" onClick={handleFinishSetup} disabled={saveProfileSetup.isPending}>
          {saveProfileSetup.isPending ? 'Saving...' : 'Finish Setup ✓'}
        </button>

        <button className="st-form-max mt-6 w-full text-center text-[18px] leading-[24px] font-semibold text-slate-500" onClick={() => navigate('/app/home')}>
          Skip for now
        </button>
      </div>
    </Screen>
  );
}

export default ProfileSetupFinishScreen;
