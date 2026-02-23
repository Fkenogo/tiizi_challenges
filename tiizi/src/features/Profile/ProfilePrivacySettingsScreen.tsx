import { ArrowLeft, Bell, Home, PlusCircle, Search, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useProfileSetup, useSaveProfileSetup } from '../../hooks/useProfileSetup';

function ProfilePrivacySettingsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: setup } = useProfileSetup(user?.uid);
  const saveProfileSetup = useSaveProfileSetup(user?.uid);

  const [showWeightHeightToGroups, setShowWeightHeightToGroups] = useState(true);
  const [showBirthdayToFriends, setShowBirthdayToFriends] = useState(true);
  const [isProfileSearchable, setIsProfileSearchable] = useState(false);

  useEffect(() => {
    if (!setup?.privacySettings) return;
    setShowWeightHeightToGroups(setup.privacySettings.showWeightHeightToGroups ?? true);
    setShowBirthdayToFriends(setup.privacySettings.showBirthdayToFriends ?? true);
    setIsProfileSearchable(setup.privacySettings.isProfileSearchable ?? false);
  }, [setup?.privacySettings]);

  const handleFinish = async () => {
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
        onboardingCompleted: false,
        region: setup?.region ?? 'Kenya',
        personalInfo: setup?.personalInfo ?? {
          fullName: '',
          email: '',
          phone: '',
          birthday: '',
          displayName: '',
        },
        privacySettings: {
          isProfilePublic: setup?.privacySettings?.isProfilePublic ?? true,
          showActivity: setup?.privacySettings?.showActivity ?? true,
          allowMessages: setup?.privacySettings?.allowMessages ?? true,
          showWeightHeightToGroups,
          showBirthdayToFriends,
          isProfileSearchable,
        },
      });
      navigate('/app/profile/setup-finish');
    } catch {
      showToast('Failed to save privacy settings.', 'error');
    }
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe">
        <header className="flex items-center justify-between">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate('/app/profile/interests')}>
            <ArrowLeft size={28} className="text-slate-900" />
          </button>
          <h1 className="st-heading-md">Profile Setup</h1>
          <span className="w-10" />
        </header>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-[18px] leading-[24px] font-bold text-slate-900">Step 3 of 3</p>
          <p className="text-[18px] leading-[24px] font-bold text-primary">100% Complete</p>
        </div>
        <div className="st-progress-track mt-3">
          <div className="st-progress-fill" style={{ width: '100%' }} />
        </div>

        <h2 className="st-heading-xl mt-6">Final Touches</h2>
        <p className="text-[12px] tracking-[0.16em] uppercase font-bold text-slate-500 mt-6">Privacy Settings</p>

        <div className="st-form-max mt-4 space-y-4">
          {[{ title: 'Show weight/height to groups', subtitle: 'Only visible in communities you join', value: showWeightHeightToGroups, set: setShowWeightHeightToGroups }, { title: 'Show birthday to friends', subtitle: 'Notify your friends when it’s your day', value: showBirthdayToFriends, set: setShowBirthdayToFriends }, { title: 'Make profile searchable', subtitle: 'Allow others to find you by name', value: isProfileSearchable, set: setIsProfileSearchable }].map((item) => (
            <div key={item.title} className="st-card px-5 py-4 flex items-center justify-between">
              <div className="pr-4">
                <p className="text-[20px] leading-[24px] font-bold text-slate-900">{item.title}</p>
                <p className="text-[14px] leading-[20px] text-slate-500 mt-1">{item.subtitle}</p>
              </div>
              <button className={`st-toggle ${item.value ? 'on' : ''}`} onClick={() => item.set((prev: boolean) => !prev)}>
                <span />
              </button>
            </div>
          ))}
        </div>

        <p className="st-form-max text-[12px] tracking-[0.16em] uppercase font-bold text-slate-500 mt-8">Public Profile Preview</p>
        <div className="st-form-max st-card mt-4 overflow-hidden">
          <div className="h-28 bg-orange-100" />
          <div className="p-4 pt-0 -mt-12">
            <div className="h-20 w-20 rounded-2xl border-4 border-white bg-orange-50" />
            <div className="mt-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[16px] leading-[20px] font-black text-slate-900">Alex Rivers</p>
                <p className="text-[14px] leading-[20px] text-slate-500">@alex_r</p>
              </div>
              <span className="st-pill bg-orange-50 text-primary">New Member</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div><p className="text-[11px] uppercase tracking-[0.12em] text-slate-400 font-bold">Height</p><p className="text-[16px] font-bold text-slate-900">{setup?.personalInfo?.heightCm || 182} cm</p></div>
              <div><p className="text-[11px] uppercase tracking-[0.12em] text-slate-400 font-bold">Weight</p><p className="text-[16px] font-bold text-slate-900">{setup?.personalInfo?.weightKg || 78} kg</p></div>
              <div><p className="text-[11px] uppercase tracking-[0.12em] text-slate-400 font-bold">Joined</p><p className="text-[16px] font-bold text-slate-900">Today</p></div>
            </div>
            <div className="h-px bg-slate-200 my-4" />
            <p className="text-[15px] leading-[22px] italic text-slate-700">"Ready to start my fitness journey with Tiizi! Let’s hit those goals together."</p>
          </div>
        </div>

        <button className="st-form-max st-btn-primary mt-8" disabled={saveProfileSetup.isPending} onClick={handleFinish}>{saveProfileSetup.isPending ? 'Saving...' : 'Finish Profile'}</button>
        <button className="st-form-max mt-5 w-full text-center text-[18px] leading-[24px] font-medium text-slate-500" onClick={() => navigate('/app/profile/interests')}>← Back to step 2</button>

        <div className="mt-8 border-t border-slate-200 pt-3 flex items-center justify-around text-slate-400">
          <Home size={22} />
          <Search size={22} />
          <PlusCircle size={24} className="text-primary" />
          <Bell size={22} />
          <User size={22} className="text-slate-900" />
        </div>
      </div>
    </Screen>
  );
}

export default ProfilePrivacySettingsScreen;
