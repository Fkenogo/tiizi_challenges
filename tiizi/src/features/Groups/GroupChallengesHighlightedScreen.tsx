import { ArrowLeft, CheckCircle2, Settings, XCircle } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useHighlightedChallenges } from '../../hooks/useGroupInsights';
import { setActiveGroupId } from '../../hooks/useActiveGroup';
import { useChallenges, useUpdateChallengeStatus } from '../../hooks/useChallenges';
import { useGroup, useGroupMembershipStatus } from '../../hooks/useGroups';
import { GroupBottomNav } from './components/GroupBottomNav';

function GroupChallengesHighlightedScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: group } = useGroup(id);
  const { data: membershipStatus = 'none' } = useGroupMembershipStatus(id);
  const { data: highlighted = [] } = useHighlightedChallenges(id);
  const { data: allChallenges = [] } = useChallenges();
  const updateStatus = useUpdateChallengeStatus();
  const { showToast } = useToast();

  useEffect(() => {
    if (id) setActiveGroupId(id);
  }, [id]);

  if (!id || !group) {
    return (
      <Screen className="st-page">
        <div className="mx-auto max-w-mobile px-4 pt-8">
          <p className="text-[20px] leading-[24px] font-black text-slate-900">Group not found</p>
          <button className="mt-4 h-12 rounded-xl bg-primary text-white px-5 font-bold" onClick={() => navigate('/app/groups')}>Back to Groups</button>
        </div>
      </Screen>
    );
  }

  if (membershipStatus !== 'joined') {
    return (
      <Screen className="st-page">
        <div className="mx-auto max-w-mobile px-4 pt-8">
          <p className="text-[20px] leading-[24px] font-black text-slate-900">Approval center is members-only</p>
          <p className="mt-2 text-[14px] leading-[20px] text-[#61758f]">You need approved membership to review highlighted challenge requests.</p>
          <button className="mt-4 h-12 rounded-xl bg-primary text-white px-5 font-bold" onClick={() => navigate(`/app/group/${id}`)}>Go to Group Detail</button>
        </div>
      </Screen>
    );
  }

  const pendingItems = useMemo(
    () => allChallenges.filter((challenge) => challenge.groupId === id && challenge.status === 'draft'),
    [allChallenges, id],
  );
  const pendingItem = pendingItems[0] ?? highlighted[0];

  const handleApprove = async () => {
    if (!pendingItem) return;
    try {
      await updateStatus.mutateAsync({ id: pendingItem.id, status: 'active' });
      showToast('Challenge approved and now live.', 'success');
    } catch {
      showToast('Could not approve challenge.', 'error');
    }
  };

  const handleReject = async () => {
    if (!pendingItem) return;
    try {
      await updateStatus.mutateAsync({ id: pendingItem.id, status: 'completed' });
      showToast('Challenge request rejected.', 'success');
    } catch {
      showToast('Could not reject challenge.', 'error');
    }
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen pb-[108px]">
        <header className="px-4 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <button className="h-10 w-10 flex items-center justify-center text-slate-900" onClick={() => navigate(`/app/group/${id}`)}><ArrowLeft size={24} /></button>
            <h1 className="text-[20px] leading-[24px] font-black text-slate-900">{group.name}</h1>
            <button className="h-10 w-10 flex items-center justify-center text-[#4d637d]"><Settings size={24} /></button>
          </div>
        </header>

        <main className="px-4 pt-5 space-y-6">
          <section className="rounded-[24px] border border-[#f8d6be] bg-[#fff2e8] p-5 relative overflow-hidden">
            <span className="inline-block rounded-lg bg-[#ffd9bf] px-3 py-1 text-[12px] leading-[14px] tracking-[0.08em] uppercase font-bold text-primary">Active Group</span>
            <p className="mt-2 text-[14px] leading-[20px] text-[#60748f]">{group.memberCount.toLocaleString()} Members • Est. 2023</p>
            <span className="absolute right-6 top-8 text-5xl text-[#e8d9ce]">🧘</span>
          </section>

          <section>
            <div className="flex items-end justify-between">
              <h2 className="text-[18px] leading-[22px] font-black text-slate-900">Pending Approval <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-primary text-white text-[13px] align-middle">{pendingItems.length}</span></h2>
              <button className="text-[16px] leading-[20px] font-bold text-primary">View All</button>
            </div>

            <article className="mt-3 rounded-[24px] border border-slate-200 bg-white p-5">
              {pendingItem ? (
                <>
                  <div className="flex items-center gap-4">
                    <img src={pendingItem.coverImageUrl || group.coverImageUrl} alt={pendingItem.name} className="h-20 w-20 rounded-2xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[17px] leading-[22px] font-black text-slate-900 truncate">{pendingItem.name}</p>
                      <p className="mt-1 text-[14px] leading-[20px] text-[#60748f]">Requested by group member</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[13px] leading-[16px] text-[#95a5b9]">◔ Submitted 2 hours ago</p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button className="h-12 rounded-xl bg-primary text-white text-[16px] font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60" onClick={handleApprove} disabled={updateStatus.isPending}>
                      <CheckCircle2 size={20} /> Approve
                    </button>
                    <button className="h-12 rounded-xl border-2 border-primary text-primary text-[16px] font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60" onClick={handleReject} disabled={updateStatus.isPending}>
                      <XCircle size={20} /> Reject
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-[14px] leading-[20px] text-[#60748f]">No pending challenge approval requests right now.</p>
              )}
            </article>
          </section>

          <section>
            <h2 className="text-[18px] leading-[22px] font-black text-slate-900">Recent Activity</h2>
            <article className="mt-3 rounded-[24px] border border-slate-200 bg-white p-5 space-y-4">
              {[0, 1].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-slate-100" />
                  <div className="flex-1">
                    <div className="h-4 rounded-full bg-slate-100 w-4/5" />
                    <div className="mt-2 h-3 rounded-full bg-slate-100 w-3/5" />
                  </div>
                </div>
              ))}
            </article>
          </section>
        </main>
      </div>

      <GroupBottomNav active="groups" />
    </Screen>
  );
}

export default GroupChallengesHighlightedScreen;
