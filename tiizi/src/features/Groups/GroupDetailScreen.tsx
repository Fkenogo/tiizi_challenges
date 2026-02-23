import { ArrowLeft, CalendarClock, MoreVertical, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useChallenges } from '../../hooks/useChallenges';
import { setActiveGroupId } from '../../hooks/useActiveGroup';
import { useGroup, useGroupMembershipStatus, useJoinGroup } from '../../hooks/useGroups';
import { useChallengeWorkouts } from '../../hooks/useWorkouts';
import { GroupBottomNav } from './components/GroupBottomNav';
import { GroupDetailTabs } from './components/GroupDetailTabs';

const fallbackCover =
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80';

function GroupDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { data: group, isLoading } = useGroup(id);
  const { data: membershipStatus = 'none' } = useGroupMembershipStatus(id);
  const joinGroup = useJoinGroup();
  const { data: challenges = [] } = useChallenges();

  useEffect(() => {
    if (id) setActiveGroupId(id);
  }, [id]);

  const groupChallenges = useMemo(
    () => challenges.filter((challenge) => challenge.groupId === id),
    [challenges, id],
  );

  const activeChallenge = groupChallenges.find((challenge) => challenge.status === 'active') || groupChallenges[0];
  const upcomingChallenge = groupChallenges.find((challenge) => challenge.id !== activeChallenge?.id);
  const { data: activeChallengeWorkouts = [] } = useChallengeWorkouts(activeChallenge?.id);

  const activeProgress = useMemo(() => {
    if (!activeChallenge) return { percent: 0, daysRemaining: 0, totalDays: 0, myLogs: 0 };
    const start = Date.parse(activeChallenge.startDate);
    const end = Date.parse(activeChallenge.endDate);
    const now = Date.now();
    const oneDay = 1000 * 60 * 60 * 24;
    const totalDays = Math.max(1, Math.ceil((end - start) / oneDay) + 1);
    const elapsedDays = Math.max(1, Math.floor((now - start) / oneDay) + 1);
    const percentFromDate = Math.max(0, Math.min(100, Math.round((elapsedDays / totalDays) * 100)));
    const targetTotal = (activeChallenge.activities ?? []).reduce(
      (sum, activity) => sum + Math.max(0, Number(activity.targetValue) || 0),
      0,
    );
    const totalLogged = activeChallengeWorkouts.reduce((sum, workout) => sum + Math.max(0, Number(workout.value) || 0), 0);
    const percentFromWorkouts = targetTotal > 0 ? Math.round((totalLogged / targetTotal) * 100) : 0;
    const percent = Math.max(1, Math.min(100, Math.max(percentFromDate, percentFromWorkouts)));
    const daysRemaining = Math.max(0, Math.ceil((end - now) / oneDay));
    const myLogs = user?.uid
      ? activeChallengeWorkouts.filter((workout) => workout.userId === user.uid).length
      : 0;

    return { percent, daysRemaining, totalDays, myLogs };
  }, [activeChallenge, activeChallengeWorkouts, user?.uid]);

  const handleJoin = async () => {
    if (!id) return;
    try {
      const result = await joinGroup.mutateAsync({ groupId: id });
      if (!result) {
        showToast('Could not join group.', 'error');
        return;
      }
      if (result.status === 'pending') {
        showToast('Join request sent for approval.', 'success');
        return;
      }
      showToast('Joined group.', 'success');
    } catch {
      showToast('Could not join group.', 'error');
    }
  };

  if (!id || (!isLoading && !group)) {
    return (
      <Screen className="st-page">
        <div className="mx-auto max-w-mobile px-4 pt-8">
          <p className="text-[20px] leading-[24px] font-black text-slate-900">Group not found</p>
          <button className="mt-4 h-12 rounded-xl bg-primary text-white px-5 font-bold" onClick={() => navigate('/app/groups')}>Back to Groups</button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen pb-[96px]">
        <header className="px-4 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <button className="h-10 w-10 flex items-center justify-center text-primary" onClick={() => navigate('/app/groups')}><ArrowLeft size={24} /></button>
            <h1 className="text-[18px] leading-[22px] font-black text-slate-900">Group Detail</h1>
            <button className="h-10 w-10 flex items-center justify-center text-slate-700"><MoreVertical size={22} /></button>
          </div>
        </header>

        <section className="px-4 pt-4 pb-5 bg-white border-b border-slate-200">
          <div className="flex items-start gap-4">
            <img src={group?.coverImageUrl || fallbackCover} alt={group?.name} className="h-24 w-24 rounded-2xl object-cover" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] leading-[21px] font-black text-slate-900 truncate">{group?.name}</h2>
                <ShieldCheck size={16} className="text-blue-500" />
              </div>
              <p className="mt-1 text-[14px] leading-[20px] font-medium text-[#61758f]">{(group?.memberCount ?? 0).toLocaleString()} Members • {(group?.isPrivate ? 'Private' : 'Official')} Group</p>
              {membershipStatus === 'joined' && (
                <button className="mt-3 h-10 px-5 rounded-xl bg-[#e9eff8] text-slate-900 text-[15px] font-semibold">✓ Joined</button>
              )}
              {membershipStatus === 'pending' && (
                <button className="mt-3 h-10 px-5 rounded-xl bg-[#fff1e7] text-primary text-[15px] font-semibold">Pending Approval</button>
              )}
              {membershipStatus === 'none' && (
                <button className="mt-3 h-10 px-5 rounded-xl bg-primary text-white text-[15px] font-semibold disabled:opacity-60" onClick={handleJoin} disabled={joinGroup.isPending}>
                  {joinGroup.isPending ? 'Joining...' : 'Join Group'}
                </button>
              )}
            </div>
          </div>
        </section>

        <GroupDetailTabs groupId={id} active="challenges" />

        <main className="px-4 pt-6 space-y-7">
          <section>
            <h3 className="text-[16px] leading-[21px] font-black text-slate-900">Active Challenges</h3>
            <article className="mt-3 rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              {membershipStatus !== 'joined' ? (
                <>
                  <p className="text-[18px] leading-[24px] font-black text-slate-900">Join this group to access challenges</p>
                  <p className="mt-2 text-[14px] leading-[20px] text-[#61758f]">All challenges and workout logs are available only to approved group members.</p>
                </>
              ) : activeChallenge ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[17px] leading-[22px] font-black text-slate-900">{activeChallenge.name}</p>
                      <p className="text-[14px] leading-[20px] text-[#61758f]">{activeChallenge.challengeType || 'Group challenge'}</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-[12px] leading-[14px] font-bold text-emerald-700 uppercase">Enrolled</span>
                  </div>

                  <div className="mt-6 flex items-end justify-between">
                    <p className="text-[16px] leading-[20px] font-semibold text-[#3c4f69]">Current Progress</p>
                    <p className="text-[22px] leading-[26px] font-black text-primary">{activeProgress.percent}%</p>
                  </div>
                  <div className="mt-2 h-3 rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${activeProgress.percent}%` }} />
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-3">
                    <p className="text-[14px] leading-[18px] text-[#61758f] flex items-center gap-2">
                      <CalendarClock size={16} />
                      {activeProgress.daysRemaining > 0
                        ? `${activeProgress.daysRemaining} day${activeProgress.daysRemaining === 1 ? '' : 's'} remaining`
                        : 'Final day'}
                    </p>
                    <button className="h-11 px-6 rounded-xl bg-primary text-white text-[15px] font-bold" onClick={() => navigate(`/app/challenge/${activeChallenge.id}?groupId=${id}`)}>Continue</button>
                  </div>
                  <p className="mt-3 text-[13px] leading-[18px] text-[#61758f]">
                    {activeProgress.myLogs} personal log{activeProgress.myLogs === 1 ? '' : 's'} in this challenge
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[18px] leading-[24px] font-black text-slate-900">No active challenges</p>
                  <p className="mt-2 text-[14px] leading-[20px] text-[#61758f]">Create your first group challenge to start activity.</p>
                  <button className="mt-4 h-11 px-6 rounded-xl bg-primary text-white text-[15px] font-bold" onClick={() => navigate(`/app/create-challenge?groupId=${id}`)}>Create Group Challenge</button>
                </>
              )}
            </article>
          </section>

          <section>
            <h3 className="text-[16px] leading-[21px] font-black text-slate-900">Upcoming Challenges</h3>
            <article className="mt-3 rounded-[24px] border border-dashed border-[#c9d7e9] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              {upcomingChallenge ? (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img src={upcomingChallenge.coverImageUrl || group?.coverImageUrl || fallbackCover} alt={upcomingChallenge.name} className="h-16 w-16 rounded-2xl object-cover" />
                    <div>
                      <p className="text-[17px] leading-[22px] font-black text-slate-900">{upcomingChallenge.name}</p>
                      <p className="mt-1 text-[14px] leading-[20px] text-[#61758f]">
                        Starts in{' '}
                        {Math.max(
                          0,
                          Math.ceil((Date.parse(upcomingChallenge.startDate) - Date.now()) / (1000 * 60 * 60 * 24)),
                        )}{' '}
                        day(s)
                      </p>
                    </div>
                  </div>
                  <button className="h-10 px-4 rounded-xl border border-[#f7b790] text-primary text-[14px] font-semibold">Remind Me</button>
                </div>
              ) : (
                <p className="text-[14px] leading-[20px] text-[#61758f]">No upcoming challenges set yet.</p>
              )}
            </article>
          </section>
        </main>
      </div>

      <GroupBottomNav active="groups" />
    </Screen>
  );
}

export default GroupDetailScreen;
