import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen, Section } from '../../components/Layout';
import { Card } from '../../components/Mobile';
import { useAuth } from '../../hooks/useAuth';
import { useProfileSetup, useSaveProfileSetup } from '../../hooks/useProfileSetup';
import { useToast } from '../../context/ToastContext';

function ProfilePersonalInfoScreen() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { showToast } = useToast();
  const { data: setup } = useProfileSetup(user?.uid);
  const saveProfileSetup = useSaveProfileSetup(user?.uid);
  const [name, setName] = useState(profile?.displayName ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!setup) return;
    setName(setup.personalInfo?.fullName ?? profile?.displayName ?? '');
    setEmail(setup.personalInfo?.email ?? profile?.email ?? '');
    setPhone(setup.personalInfo?.phone ?? '');
  }, [setup, profile?.displayName, profile?.email]);

  const handleSave = async () => {
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
        onboardingCompleted: setup?.onboardingCompleted ?? false,
        region: setup?.region ?? 'Kenya',
        privacySettings: setup?.privacySettings ?? {
          isProfilePublic: true,
          showActivity: true,
          allowMessages: true,
        },
        personalInfo: {
          fullName: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
        },
      });
      showToast('Personal info saved.', 'success');
      navigate('/app/profile');
    } catch {
      showToast('Failed to save personal info.', 'error');
    }
  };

  return (
    <Screen>
      <Section title="Personal Info">
        <Card>
          <div className="space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm" />
            <button className="w-full h-11 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50" disabled={saveProfileSetup.isPending} onClick={handleSave}>
              Save
            </button>
            <button className="w-full h-11 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/profile')}>
              Cancel
            </button>
          </div>
        </Card>
      </Section>
    </Screen>
  );
}

export default ProfilePersonalInfoScreen;
