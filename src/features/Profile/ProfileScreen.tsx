import { ChevronRight, Settings, Share2 } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BottomNav, Screen } from '../../components/Layout';
import { useAuth } from '../../hooks/useAuth';
import { useChallenges } from '../../hooks/useChallenges';
import { useMyGroups } from '../../hooks/useGroups';
import { useProfileSetup } from '../../hooks/useProfileSetup';
import { useUserWorkouts } from '../../hooks/useWorkouts';
import { adminDonationService } from '../../services/adminDonationService';

function ProfileScreen() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { data: profileSetup } = useProfileSetup(user?.uid);
  const { data: myGroups = [] } = useMyGroups();
  const { data: challenges = [] } = useChallenges();
  const { data: workouts = [] } = useUserWorkouts(user?.uid);
  const { data: donationCampaigns = [] } = useQuery({
    queryKey: ['profile-donation-campaigns'],
    queryFn: () => adminDonationService.getCampaigns(),
    staleTime: 60 * 1000,
  });

  const myChallengeIds = useMemo(() => {
    const myGroupIds = new Set(myGroups.map((item) => item.id));
    return new Set(challenges.filter((item) => item.groupId && myGroupIds.has(item.groupId)).map((item) => item.id));
  }, [myGroups, challenges]);

  const wins = useMemo(
    () =>
      challenges.filter((item) => myChallengeIds.has(item.id) && item.status === 'completed').length,
    [challenges, myChallengeIds],
  );

  const displayName =
    profileSetup?.personalInfo?.displayName ||
    profileSetup?.personalInfo?.fullName ||
    profile?.displayName ||
    user?.displayName ||
    'Tiizi Member';

  const memberSinceYear = user?.metadata.creationTime ? new Date(user.metadata.creationTime).getFullYear() : new Date().getFullYear();
  const activeCampaign = donationCampaigns.find((campaign) => campaign.status === 'active') ?? donationCampaigns[0];
  const impactAmount = activeCampaign?.raisedAmount ?? workouts.length * 1.2;
  const impactTarget = activeCampaign?.goalAmount ?? 10000;
  const impactProgress = impactTarget > 0 ? Math.min(100, Math.round((impactAmount / impactTarget) * 100)) : 0;

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen pb-[96px] bg-slate-50">
        <header className="px-4 pt-4 pb-3 bg-slate-50">
          <div className="flex items-center justify-between">
            <button className="h-10 w-10 flex items-center justify-center text-slate-500" onClick={() => navigate('/app/profile/privacy-settings')}>
              <Settings size={22} />
            </button>
            <h1 className="st-page-title">Profile</h1>
            <button className="h-10 w-10 flex items-center justify-center text-slate-500">
              <Share2 size={22} />
            </button>
          </div>
        </header>

        <main className="px-4 pt-2 space-y-6">
          <section className="text-center">
            <div className="relative inline-block">
              <img
                src={user?.photoURL || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=320&q=80'}
                alt={displayName}
                className="h-40 w-40 rounded-full object-cover border-[6px] border-[#f4dccb]"
              />
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-[13px] leading-[16px] font-black uppercase tracking-[0.04em] text-white">
                {myGroups.length > 0 ? 'Top 5% Contributor' : 'New Member'}
              </span>
            </div>
            <h2 className="mt-6 st-section-title">{displayName}</h2>
            <p className="mt-2 st-body">
              Community Leader • Member since {memberSinceYear}
            </p>
          </section>

          <section className="grid grid-cols-3 gap-3">
            <article className="rounded-[20px] border border-slate-200 bg-white py-5 flex flex-col justify-center items-center">
              <p className="text-[16px] leading-[20px] font-black text-primary">{myGroups.length}</p>
              <p className="text-[13px] leading-[17px] tracking-[0.1em] font-bold text-slate-500 uppercase mt-1">Groups</p>
            </article>
            <article className="rounded-[20px] border border-slate-200 bg-white py-5 flex flex-col justify-center items-center">
              <p className="text-[16px] leading-[20px] font-black text-primary">{wins}</p>
              <p className="text-[13px] leading-[17px] tracking-[0.1em] font-bold text-slate-500 uppercase mt-1">Wins</p>
            </article>
            <article className="rounded-[20px] border border-slate-200 bg-white py-5 flex flex-col justify-center items-center">
              <p className="text-[16px] leading-[20px] font-black text-primary">{workouts.length}</p>
              <p className="text-[13px] leading-[17px] tracking-[0.1em] font-bold text-slate-500 uppercase mt-1">Nudges</p>
            </article>
          </section>

          <section className="rounded-[24px] border border-primary/20 bg-[#fff4eb] p-5">
            <div className="flex items-start gap-3">
              <div className="h-14 w-14 rounded-2xl bg-primary text-white flex items-center justify-center text-[28px] leading-none">❤</div>
              <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-[20px] font-black text-slate-900">Community Impact</p>
                <p className="text-[14px] leading-[20px] text-slate-600">{activeCampaign?.name ?? 'Clean Water Initiative'}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-[15px] leading-[20px] font-semibold">
              <span className="text-primary">${impactAmount.toFixed(0)} raised</span>
              <span className="text-slate-500">Goal: ${impactTarget.toLocaleString()}</span>
            </div>
            <div className="mt-3 h-3 rounded-full bg-primary/20 overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${impactProgress}%` }} />
            </div>
            <p className="mt-3 text-[14px] leading-[20px] text-slate-500">
              Your logged activity contributes to this campaign.
            </p>
            <button className="mt-4 h-[56px] w-full rounded-[16px] bg-primary text-white text-[16px] leading-[20px] font-black" onClick={() => navigate('/app/donate')}>
              Donate Now
            </button>
          </section>

          <section>
            <div className="flex items-end justify-between mb-3">
              <h3 className="st-section-title">My Groups</h3>
              <button className="text-[15px] leading-[20px] font-semibold text-primary" onClick={() => navigate('/app/groups')}>View All</button>
            </div>
            <div className="space-y-3">
              {myGroups.length === 0 ? (
                <article className="rounded-2xl border border-slate-200 bg-white px-4 py-5">
                  <p className="text-[16px] leading-[22px] text-slate-600">You are not in a group yet.</p>
                  <button className="mt-4 h-11 rounded-xl bg-primary px-5 text-[16px] font-semibold text-white" onClick={() => navigate('/app/groups')}>
                    Browse Groups
                  </button>
                </article>
              ) : (
                myGroups.slice(0, 3).map((group) => (
                  <article key={group.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={group.coverImageUrl || 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=200&q=80'}
                        alt={group.name}
                        className="h-12 w-12 rounded-xl object-cover"
                      />
                      <div className="min-w-0">
                        <p className="text-[15px] leading-[20px] font-black text-slate-900 truncate">{group.name}</p>
                        <p className="text-[13px] leading-[17px] text-slate-500">{group.memberCount} members</p>
                      </div>
                    </div>
                    <button className="text-slate-400" onClick={() => navigate(`/app/group/${group.id}`)} aria-label={`Open ${group.name}`}>
                      <ChevronRight size={18} />
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>
        </main>

        <BottomNav active="profile" />
      </div>
    </Screen>
  );
}

export default ProfileScreen;
