import { ArrowLeft, CalendarClock, MoreVertical, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useChallengesByGroup } from '../../hooks/useChallenges';
import { setActiveGroupId } from '../../hooks/useActiveGroup';
import { useGroup, useGroupMemberCount, useGroupMembershipStatus, useJoinGroup, useLeaveGroup, useReportGroup } from '../../hooks/useGroups';
import { useChallengeWorkouts } from '../../hooks/useWorkouts';
import { db } from '../../lib/firebase';
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
  const { data: memberCount = 0 } = useGroupMemberCount(id);
  const { data: membershipStatus = 'none' } = useGroupMembershipStatus(id);
  const joinGroup = useJoinGroup();
  const leaveGroup = useLeaveGroup();
  const reportGroup = useReportGroup();
  const { data: challenges = [] } = useChallengesByGroup(id);

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
  const { data: activeChallengeWellnessLogs = [] } = useQuery({
    queryKey: ['challenge-wellness-logs', activeChallenge?.id],
    queryFn: async () => {
      if (!activeChallenge?.id) return [] as Array<{ userId?: string; value?: number; activityId?: string }>;
      const snap = await getDocs(query(collection(db, 'wellnessLogs'), where('challengeId', '==', activeChallenge.id)));
      return snap.docs.map((item) => item.data() as { userId?: string; value?: number; activityId?: string });
    },
    enabled: !!activeChallenge?.id,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const activeProgress = useMemo(() => {
    if (!activeChallenge) return { percent: 0, daysRemaining: 0, totalDays: 0, myLogs: 0, progressLabel: '0 of 0' };
    const start = Date.parse(activeChallenge.startDate);
    const end = Date.parse(activeChallenge.endDate);
    const now = Date.now();
    const oneDay = 1000 * 60 * 60 * 24;
    const totalDays = Math.max(1, Math.ceil((end - start) / oneDay) + 1);
    const primaryActivity = activeChallenge.activities?.[0];
    const targetTotal = Math.max(1, Number(primaryActivity?.targetValue ?? 0));
    const unit = String(primaryActivity?.unit ?? 'units');
    const isWellness = (activeChallenge.category && activeChallenge.category !== 'fitness') || !!primaryActivity?.activityId;

    let totalLogged = 0;
    let myLogs = 0;
    if (isWellness) {
      activeChallengeWellnessLogs.forEach((item) => {
        const sameActivity = primaryActivity?.activityId ? item.activityId === primaryActivity.activityId : true;
        if (!sameActivity) return;
        const include = activeChallenge.challengeType === 'collective' ? true : item.userId === user?.uid;
        if (!include) return;
        totalLogged += Math.max(0, Number(item.value ?? 0));
        if (item.userId === user?.uid) myLogs += 1;
      });
    } else {
      activeChallengeWorkouts.forEach((item) => {
        const sameActivity = primaryActivity?.exerciseId ? item.exerciseId === primaryActivity.exerciseId : true;
        if (!sameActivity) return;
        const include = activeChallenge.challengeType === 'collective' ? true : item.userId === user?.uid;
        if (!include) return;
        totalLogged += Math.max(0, Number(item.value ?? 0));
        if (item.userId === user?.uid) myLogs += 1;
      });
    }
    const percent = targetTotal > 0 ? Math.max(0, Math.min(100, Math.round((totalLogged / targetTotal) * 100))) : 0;
    const daysRemaining = Math.max(0, Math.ceil((end - now) / oneDay));
    const formattedLogged = Number.isInteger(totalLogged) ? totalLogged : Number(totalLogged.toFixed(1));
    const progressLabel = `${formattedLogged} ${unit} of ${targetTotal} ${unit}`;

    return { percent, daysRemaining, totalDays, myLogs, progressLabel };
  }, [activeChallenge, activeChallengeWorkouts, activeChallengeWellnessLogs, user?.uid]);

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

  if (group?.isPrivate && membershipStatus !== 'joined') {
    return (
      <Screen className="st-page">
        <div className="mx-auto max-w-mobile px-4 pt-8">
          <p className="text-[20px] leading-[24px] font-black text-slate-900">Private group</p>
          <p className="mt-2 text-[14px] leading-[20px] text-[#61758f]">
            This group is private. Join request approval is required before viewing feed, challenges, members, and leaderboard.
          </p>
          {membershipStatus === 'pending' ? (
            <button className="mt-4 h-12 rounded-xl bg-[#fff1e7] text-primary px-5 font-bold">
              Request Pending Approval
            </button>
          ) : (
            <button className="mt-4 h-12 rounded-xl bg-primary text-white px-5 font-bold disabled:opacity-60" onClick={handleJoin} disabled={joinGroup.isPending}>
              {joinGroup.isPending ? 'Joining...' : 'Request to Join'}
            </button>
          )}
          <button className="mt-3 h-12 rounded-xl bg-slate-100 text-slate-700 px-5 font-bold" onClick={() => navigate('/app/groups')}>
            Back to Groups
          </button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen bg-slate-50 pb-[96px]">
        <header className="sticky top-0 z-20 px-4 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <button className="h-10 w-10 flex items-center justify-center text-primary" onClick={() => navigate('/app/groups')}><ArrowLeft size={24} /></button>
            <h1 className="text-[18px] leading-[22px] font-black text-slate-900">Group Detail</h1>
            <button
              className="h-10 w-10 flex items-center justify-center text-slate-700"
              onClick={async () => {
                if (!user?.uid || !id) return;
                const reason = window.prompt('Report this group to admin. Add a brief reason:');
                if (!reason || !reason.trim()) return;
                try {
                  await reportGroup.mutateAsync({
                    groupId: id,
                    reporterUid: user.uid,
                    reason,
                    reportType: 'group',
                  });
                  showToast('Report submitted to admin moderation.', 'success');
                } catch {
                  showToast('Could not submit report.', 'error');
                }
              }}
            >
              <MoreVertical size={22} />
            </button>
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
              <p className="mt-1 text-[14px] leading-[20px] font-medium text-[#61758f]">{memberCount.toLocaleString()} Members • {(group?.isPrivate ? 'Private' : 'Official')} Group</p>
              {membershipStatus === 'joined' && (
                <div className="mt-3 flex gap-2">
                  <button className="h-10 px-5 rounded-xl bg-[#e9eff8] text-slate-900 text-[15px] font-semibold">✓ Joined</button>
                  <button
                    className="h-10 px-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-[14px] font-semibold disabled:opacity-60"
                    disabled={leaveGroup.isPending}
                    onClick={async () => {
                      if (!id) return;
                      try {
                        await leaveGroup.mutateAsync(id);
                        showToast('You left this group.', 'success');
                        navigate('/app/groups');
                      } catch (error) {
                        const message = error instanceof Error ? error.message : 'Could not leave group.';
                        showToast(message, 'error');
                      }
                    }}
                  >
                    {leaveGroup.isPending ? 'Leaving...' : 'Leave'}
                  </button>
                </div>
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
                  {activeChallenge ? (
                    <>
                      <p className="text-[18px] leading-[24px] font-black text-slate-900">{activeChallenge.name}</p>
                      <p className="mt-1 text-[14px] leading-[20px] text-[#61758f]">{activeChallenge.challengeType || 'Group challenge'} • {activeChallenge.status}</p>
                      <p className="mt-2 text-[14px] leading-[20px] text-[#61758f]">You can preview public group challenges. Join the group to participate.</p>
                      <div className="mt-4 flex gap-2">
                        <button className="h-10 px-4 rounded-xl border border-slate-300 text-slate-800 text-[14px] font-semibold" onClick={() => navigate(`/app/challenge/${activeChallenge.id}?groupId=${id}`)}>
                          View Challenge
                        </button>
                        <button className="h-10 px-4 rounded-xl bg-primary text-white text-[14px] font-semibold disabled:opacity-60" onClick={handleJoin} disabled={joinGroup.isPending}>
                          {joinGroup.isPending ? 'Joining...' : 'Join Group'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-[18px] leading-[24px] font-black text-slate-900">Join this group to access challenges</p>
                      <p className="mt-2 text-[14px] leading-[20px] text-[#61758f]">All challenges and workout logs are available only to approved group members.</p>
                    </>
                  )}
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
                    <p className="text-[16px] leading-[20px] font-black text-primary">{activeProgress.progressLabel}</p>
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
