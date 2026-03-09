import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useProfileSetup, useSaveProfileSetup } from '../../hooks/useProfileSetup';

function ProfileSettingsScreen() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const { data: setup } = useProfileSetup(user?.uid);
  const saveProfileSetup = useSaveProfileSetup(user?.uid);

  const [isProfileSearchable, setIsProfileSearchable] = useState(true);
  const [allowMessages, setAllowMessages] = useState(true);
  const [showActivity, setShowActivity] = useState(true);

  useEffect(() => {
    if (!setup?.privacySettings) return;
    setIsProfileSearchable(setup.privacySettings.isProfileSearchable ?? true);
    setAllowMessages(setup.privacySettings.allowMessages ?? true);
    setShowActivity(setup.privacySettings.showActivity ?? true);
  }, [setup?.privacySettings]);

  const persistPrivacy = async (patch: Partial<{ isProfileSearchable: boolean; allowMessages: boolean; showActivity: boolean }>) => {
    if (!user?.uid) return;
    try {
      await saveProfileSetup.mutateAsync({
        exerciseInterests: setup?.exerciseInterests ?? [],
        customInterests: setup?.customInterests ?? [],
        primaryGoal: setup?.primaryGoal,
        secondaryGoal: setup?.secondaryGoal,
        customGoals: setup?.customGoals ?? [],
        onboardingCompleted: setup?.onboardingCompleted ?? true,
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
          showWeightHeightToGroups: setup?.privacySettings?.showWeightHeightToGroups ?? true,
          showBirthdayToFriends: setup?.privacySettings?.showBirthdayToFriends ?? true,
          isProfileSearchable: patch.isProfileSearchable ?? isProfileSearchable,
          allowMessages: patch.allowMessages ?? allowMessages,
          showActivity: patch.showActivity ?? showActivity,
        },
      });
    } catch {
      showToast('Could not save preference.', 'error');
    }
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen bg-slate-50 pb-[96px]">
        <header className="px-4 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate('/app/profile')}>
            <ArrowLeft size={22} className="text-slate-900" />
          </button>
          <h1 className="text-[18px] leading-[22px] font-black text-slate-900">Settings</h1>
          <span className="w-10" />
        </header>

        <main className="px-4 py-4 space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-[14px] leading-[18px] font-bold text-slate-500 uppercase tracking-[0.08em]">Preferences</h2>
            <div className="mt-3 space-y-3">
              {[
                {
                  label: 'Profile searchable',
                  value: isProfileSearchable,
                  onToggle: async () => {
                    const next = !isProfileSearchable;
                    setIsProfileSearchable(next);
                    await persistPrivacy({ isProfileSearchable: next });
                  },
                },
                {
                  label: 'Allow direct messages',
                  value: allowMessages,
                  onToggle: async () => {
                    const next = !allowMessages;
                    setAllowMessages(next);
                    await persistPrivacy({ allowMessages: next });
                  },
                },
                {
                  label: 'Show activity in profile',
                  value: showActivity,
                  onToggle: async () => {
                    const next = !showActivity;
                    setShowActivity(next);
                    await persistPrivacy({ showActivity: next });
                  },
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-800">{item.label}</span>
                  <button
                    className={`h-8 min-w-[56px] rounded-full px-2 text-xs font-bold ${item.value ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600'}`}
                    onClick={item.onToggle}
                    disabled={saveProfileSetup.isPending}
                  >
                    {item.value ? 'ON' : 'OFF'}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-[14px] leading-[18px] font-bold text-slate-500 uppercase tracking-[0.08em]">Account</h2>
            <div className="mt-3 space-y-2">
              <button className="w-full h-11 rounded-xl border border-slate-200 px-3 text-left text-sm font-semibold text-slate-800 flex items-center justify-between" onClick={() => navigate('/app/profile/personal-info')}>
                Personal Information <ChevronRight size={16} />
              </button>
              <button className="w-full h-11 rounded-xl border border-slate-200 px-3 text-left text-sm font-semibold text-slate-800 flex items-center justify-between" onClick={() => navigate('/app/profile/settings/analytics')}>
                Reports & Analytics <ChevronRight size={16} />
              </button>
              <button className="w-full h-11 rounded-xl border border-slate-200 px-3 text-left text-sm font-semibold text-slate-800 flex items-center justify-between" onClick={() => navigate('/app/donate')}>
                Contributions & Donations <ChevronRight size={16} />
              </button>
              <button className="w-full h-11 rounded-xl border border-slate-200 px-3 text-left text-sm font-semibold text-slate-800 flex items-center justify-between" onClick={() => navigate('/app/help')}>
                Support Center <ChevronRight size={16} />
              </button>
              <button className="w-full h-11 rounded-xl border border-slate-200 px-3 text-left text-sm font-semibold text-slate-800 flex items-center justify-between" onClick={() => showToast('Open Terms & Conditions document here.', 'info')}>
                Terms & Conditions <ChevronRight size={16} />
              </button>
              <button className="w-full h-11 rounded-xl border border-slate-200 px-3 text-left text-sm font-semibold text-slate-800 flex items-center justify-between" onClick={() => showToast('Open Privacy Policy document here.', 'info')}>
                Privacy Policy <ChevronRight size={16} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                className="h-11 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold"
                onClick={() => showToast('Account deletion requires support verification. Contact support.', 'info')}
              >
                Delete Account
              </button>
              <button
                className="h-11 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm font-semibold"
                onClick={async () => {
                  await logout();
                  navigate('/app/login', { replace: true });
                }}
              >
                Sign Out
              </button>
            </div>
          </section>
        </main>

        <BottomNav active="profile" />
      </div>
    </Screen>
  );
}

export default ProfileSettingsScreen;
