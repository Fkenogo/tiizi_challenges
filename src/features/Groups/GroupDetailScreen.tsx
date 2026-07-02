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
import { isChallengeOngoing, isChallengeUpcoming } from '../../utils/challengeLifecycle';
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
  const isDeactivated = group?.status === 'inactive';
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

  const activeChallenges = useMemo(
    () => groupChallenges.filter((c) => isChallengeOngoing(c)),
    [groupChallenges],
  );
  const upcomingChallenges = useMemo(
    () => groupChallenges.filter((c) => isChallengeUpcoming(c)),
    [groupChallenges],
  );
  const activeChallenge = activeChallenges[0] ?? null;
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
                const reason = 'Reported by member';
                try {
                  await reportGroup.mutateAsync({
                    groupId: id,
                    reporterUid: user.uid,
                    reason,
                    reportType: 'group',
                  });
                  showToast('Report submitted for review.', 'success');
                } catch {
                  showToast('Could not submit report.', 'error');
                }
              }}
            >
              <MoreVertical size={22} />
            </button>
          </div>
        </header>

        {isDeactivated && (
          <div className="mx-4 mt-4 rounded-2xl bg-slate-100 border border-slate-300 px-4 py-3">
            <p className="text-[14px] font-bold text-slate-800">This community is no longer active.</p>
            <p className="text-[12px] text-slate-600 mt-0.5">
              It has been deactivated by Tiizi administrators. Challenges are now read-only and no new activity can be recorded.
            </p>
          </div>
        )}

        <section className="px-4 pt-4 pb-5 bg-white border-b border-slate-200">
          <div className="flex items-start gap-4">
            <img src={group?.coverImageUrl || fallbackCover} alt={group?.name} className="h-24 w-24 rounded-2xl object-cover" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] leading-[21px] font-black text-slate-900 truncate">{group?.name}</h2>
                <ShieldCheck size={16} className="text-blue-500" />
              </div>
              <p className="mt-1 text-[14px] leading-[20px] font-medium text-[#61758f]">{memberCount.toLocaleString()} Members • {(group?.isPrivate ? 'Private' : 'Official')} Group</p>
              {!isDeactivated && membershipStatus === 'joined' && (
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
              {!isDeactivated && membershipStatus === 'pending' && (
                <button className="mt-3 h-10 px-5 rounded-xl bg-[#fff1e7] text-primary text-[15px] font-semibold">Pending Approval</button>
              )}
              {!isDeactivated && membershipStatus === 'none' && (
                <button className="mt-3 h-10 px-5 rounded-xl bg-primary text-white text-[15px] font-semibold disabled:opacity-60" onClick={handleJoin} disabled={joinGroup.isPending}>
                  {joinGroup.isPending ? 'Joining...' : 'Join Group'}
                </button>
              )}
            </div>
          </div>
        </section>

        <GroupDetailTabs groupId={id} active="challenges" />

        <main className="px-4 pt-6 space-y-7">
          {/* ── Active Challenges ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[16px] leading-[21px] font-black text-slate-900">Ongoing Challenges</h3>
              {activeChallenges.length > 0 && (
                <button
                  className="text-[13px] font-semibold text-primary"
                  onClick={() => navigate(`/app/challenges/browse?groupId=${id}`)}
                >
                  View All
                </button>
              )}
            </div>

            {membershipStatus !== 'joined' && activeChallenges.length === 0 && (
              <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <p className="text-[18px] leading-[24px] font-black text-slate-900">Join this group to access challenges</p>
                <p className="mt-2 text-[14px] leading-[20px] text-[#61758f]">All challenges and workout logs are available only to approved group members.</p>
              </article>
            )}

            {membershipStatus !== 'joined' && activeChallenges.length > 0 && (
              <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <p className="text-[18px] leading-[24px] font-black text-slate-900">{activeChallenges[0].name}</p>
                <p className="mt-1 text-[14px] leading-[20px] text-[#61758f]">{activeChallenges[0].challengeType || 'Group challenge'} • {activeChallenges.length} active</p>
                <p className="mt-2 text-[14px] leading-[20px] text-[#61758f]">Join the group to participate in {activeChallenges.length > 1 ? 'these challenges' : 'this challenge'}.</p>
                <div className="mt-4 flex gap-2">
                  <button className="h-10 px-4 rounded-xl border border-slate-300 text-slate-800 text-[14px] font-semibold" onClick={() => navigate(`/app/challenge/${activeChallenges[0].id}?groupId=${id}`)}>
                    Preview
                  </button>
                  <button className="h-10 px-4 rounded-xl bg-primary text-white text-[14px] font-semibold disabled:opacity-60" onClick={handleJoin} disabled={joinGroup.isPending}>
                    {joinGroup.isPending ? 'Joining...' : 'Join Group'}
                  </button>
                </div>
              </article>
            )}

            {membershipStatus === 'joined' && activeChallenges.length === 0 && (
              <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <p className="text-[18px] leading-[24px] font-black text-slate-900">No ongoing challenges</p>
                <p className="mt-2 text-[14px] leading-[20px] text-[#61758f]">Create a challenge to get started.</p>
                <button className="mt-4 h-11 px-6 rounded-xl bg-primary text-white text-[15px] font-bold" onClick={() => navigate(`/app/create-challenge?groupId=${id}`)}>Create Challenge</button>
              </article>
            )}

            {membershipStatus === 'joined' && activeChallenges.length > 0 && (
              <div className="-mx-4 overflow-x-auto px-4">
                <div className="flex gap-3 pb-1" style={{ width: 'max-content' }}>
                  {activeChallenges.slice(0, 3).map((c, idx) => {
                    const isFirst = idx === 0;
                    const daysLeft = Math.max(0, Math.ceil((Date.parse(c.endDate) - Date.now()) / (1000 * 60 * 60 * 24)));
                    return (
                      <button
                        key={c.id}
                        className="w-[240px] shrink-0 rounded-[20px] border border-slate-200 bg-white p-4 text-left shadow-[0_1px_3px_rgba(15,23,42,0.07)]"
                        onClick={() => navigate(`/app/challenge/${c.id}?groupId=${id}`)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[14px] leading-[19px] font-black text-slate-900 line-clamp-2">{c.name}</p>
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 uppercase leading-[16px]">Active</span>
                        </div>
                        <p className="mt-1 text-[11px] leading-[15px] text-[#61758f] capitalize">{c.challengeType || 'challenge'}</p>
                        {isFirst && (
                          <>
                            <div className="mt-3 h-2 rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${activeProgress.percent}%` }} />
                            </div>
                            <p className="mt-1.5 text-[11px] text-[#61758f]">{activeProgress.progressLabel}</p>
                          </>
                        )}
                        <div className="mt-3 flex items-center justify-between">
                          <p className="text-[11px] text-[#61758f] flex items-center gap-1">
                            <CalendarClock size={12} />
                            {daysLeft > 0 ? `${daysLeft}d left` : 'Final day'}
                          </p>
                          <span className="text-[12px] font-bold text-primary">{isFirst ? 'Continue' : 'View'} →</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* ── Upcoming Challenges ── */}
          <section>
            <h3 className="text-[16px] leading-[21px] font-black text-slate-900">Upcoming Challenges</h3>
            <div className="mt-3 space-y-3">
              {upcomingChallenges.length === 0 ? (
                <article className="rounded-[24px] border border-dashed border-[#c9d7e9] bg-white p-5">
                  <p className="text-[14px] leading-[20px] text-[#61758f]">Scheduled challenges will appear here when this group has upcoming challenges.</p>
                </article>
              ) : (
                upcomingChallenges.map((c) => (
                  <article key={c.id} className="rounded-[24px] border border-dashed border-[#c9d7e9] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <img src={c.coverImageUrl || group?.coverImageUrl || fallbackCover} alt={c.name} className="h-16 w-16 rounded-2xl object-cover" />
                        <div>
                          <p className="text-[17px] leading-[22px] font-black text-slate-900">{c.name}</p>
                          <p className="mt-1 text-[14px] leading-[20px] text-[#61758f]">
                            Starts in {Math.max(0, Math.ceil((Date.parse(c.startDate) - Date.now()) / (1000 * 60 * 60 * 24)))} day(s)
                          </p>
                        </div>
                      </div>
                      <button
                        className="h-10 px-4 rounded-xl border border-[#f7b790] text-primary text-[14px] font-semibold"
                        onClick={() => navigate(`/app/challenge/${c.id}?groupId=${id}`)}
                      >
                        View
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </main>
      </div>

      <GroupBottomNav active="groups" />
    </Screen>
  );
}

export default GroupDetailScreen;
