import { ArrowLeft, Bookmark, MessageSquare, MoreHorizontal, Share2 } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useGroupFeed } from '../../hooks/useGroupInsights';
import { setActiveGroupId } from '../../hooks/useActiveGroup';
import { useGroup, useGroupMembershipStatus } from '../../hooks/useGroups';
import { GroupBottomNav } from './components/GroupBottomNav';
import { GroupDetailTabs } from './components/GroupDetailTabs';

const heroImage = 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1200&q=80';

function GroupFeedScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: group } = useGroup(id);
  const { data: membershipStatus = 'none' } = useGroupMembershipStatus(id);
  const { data: feedItems = [] } = useGroupFeed(id);

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
          <p className="text-[20px] leading-[24px] font-black text-slate-900">Group feed is members-only</p>
          <p className="mt-2 text-[14px] leading-[20px] text-[#61758f]">Join this group first to access feed posts and updates.</p>
          <button className="mt-4 h-12 rounded-xl bg-primary text-white px-5 font-bold" onClick={() => navigate(`/app/group/${id}`)}>Go to Group Detail</button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen pb-[96px]">
        <section className="relative h-[270px]">
          <img src={group.coverImageUrl || heroImage} alt={group.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/70" />

          <div className="absolute left-4 right-4 top-5 flex items-center justify-between">
            <button className="h-11 w-11 rounded-full bg-white/25 backdrop-blur text-white flex items-center justify-center" onClick={() => navigate('/app/groups')}><ArrowLeft size={22} /></button>
          </div>

          <div className="absolute left-4 right-4 bottom-4">
            <h1 className="text-[20px] leading-[24px] font-black text-white">{group.name}</h1>
            <div className="mt-2 flex gap-2">
              <span className="rounded-full border border-white/60 bg-black/35 px-3 py-1 text-[12px] leading-[14px] font-bold uppercase tracking-[0.08em] text-white">{group.isPrivate ? 'Private Group' : 'Public Group'}</span>
              <span className="rounded-full border border-white/60 bg-black/35 px-3 py-1 text-[12px] leading-[14px] font-bold uppercase tracking-[0.08em] text-white">{group.memberCount.toLocaleString()} Members</span>
            </div>
          </div>
        </section>

        <GroupDetailTabs groupId={id} active="feed" />

        <main className="px-4 pt-6 space-y-5">
          <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-[#fbe9d9] text-primary flex items-center justify-center">🗒️</div>
              <button className="h-11 flex-1 rounded-full bg-slate-100 text-left px-5 text-[15px] leading-[20px] text-[#61758f]">Share an update with the group...</button>
            </div>
          </section>

          {feedItems.map((item) => (
            <article key={item.id} className="rounded-[20px] border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-slate-200" />
                    <div>
                      <p className="text-[17px] leading-[22px] font-black text-slate-900">{item.author}</p>
                      <p className="text-[13px] leading-[16px] font-medium text-[#61758f]">◔ {item.time}</p>
                    </div>
                  </div>
                  <button className="h-8 w-8 text-[#9ca9bd]"><MoreHorizontal size={20} /></button>
                </div>

                <p className="mt-4 text-[15px] leading-[22px] text-[#171212]">{item.text}</p>

                {item.metric && (
                  <div className="mt-4 rounded-2xl border border-[#f7d5be] bg-[#fff8f2] p-4">
                    <p className="text-[11px] leading-[12px] uppercase tracking-[0.08em] font-bold text-primary">
                      {item.metric.label}
                    </p>
                    <p className="mt-1 text-[18px] leading-[22px] font-black text-slate-900">{item.metric.value}</p>
                  </div>
                )}

                {item.imageUrl && (
                  <img src={item.imageUrl} alt="feed media" className="mt-4 h-[220px] w-full rounded-xl object-cover" />
                )}
              </div>

              <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-[#4c627e]">
                <div className="flex items-center gap-5">
                  <button className="inline-flex items-center gap-2 text-[15px] leading-[18px] font-semibold"><MessageSquare size={16} /> Reply</button>
                </div>
                <div className="flex items-center gap-3">
                  <button><Share2 size={18} /></button>
                  <button><Bookmark size={18} /></button>
                </div>
              </div>
            </article>
          ))}

          {feedItems.length === 0 && (
            <article className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <p className="text-[18px] leading-[24px] font-black text-slate-900">No updates yet</p>
              <p className="mt-2 text-[14px] leading-[20px] text-[#61758f]">Group feed will populate as members log workouts and challenge progress.</p>
            </article>
          )}
        </main>
      </div>

      <GroupBottomNav active="groups" />
    </Screen>
  );
}

export default GroupFeedScreen;
