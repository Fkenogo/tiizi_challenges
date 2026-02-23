import { ArrowLeft, MoreVertical } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useGroupLeaderboard } from '../../hooks/useGroupInsights';
import { setActiveGroupId } from '../../hooks/useActiveGroup';
import { useGroup, useGroupMembershipStatus } from '../../hooks/useGroups';
import { GroupBottomNav } from './components/GroupBottomNav';
import { GroupDetailTabs } from './components/GroupDetailTabs';

const coverImage = 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80';

function GroupLeaderboardScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: group } = useGroup(id);
  const { data: membershipStatus = 'none' } = useGroupMembershipStatus(id);
  const { data: leaderboard = [] } = useGroupLeaderboard(id);

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
          <p className="text-[20px] leading-[24px] font-black text-slate-900">Leaderboard is members-only</p>
          <p className="mt-2 text-[14px] leading-[20px] text-[#61758f]">Join this group first to view rankings and challenge points.</p>
          <button className="mt-4 h-12 rounded-xl bg-primary text-white px-5 font-bold" onClick={() => navigate(`/app/group/${id}`)}>Go to Group Detail</button>
        </div>
      </Screen>
    );
  }

  const podium = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen pb-[96px]">
        <header className="px-4 py-4 bg-white border-b border-slate-200">
          <div className="flex items-center justify-between">
            <button className="h-10 w-10 flex items-center justify-center text-slate-900" onClick={() => navigate(`/app/group/${id}`)}><ArrowLeft size={24} /></button>
            <h1 className="text-[20px] leading-[24px] font-black text-slate-900">{group.name}</h1>
            <button className="h-10 w-10 flex items-center justify-center text-slate-900"><MoreVertical size={24} /></button>
          </div>
        </header>

        <section className="relative h-[220px] overflow-hidden">
          <img src={group.coverImageUrl || coverImage} alt={group.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-black/20" />
          <div className="absolute left-4 bottom-4 right-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[22px] leading-[26px] font-black text-white">Top Performers</h2>
              <p className="text-[14px] leading-[18px] text-white/90">Global rankings for this month</p>
            </div>
            <button className="h-10 px-4 rounded-xl bg-[#e9eff8] text-slate-900 text-[14px] font-bold" onClick={() => navigate(`/app/group/${id}`)}>
              Group Details
            </button>
          </div>
        </section>

        <GroupDetailTabs groupId={id} active="leaderboard" />

        <main className="px-4 pt-6">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-end justify-center gap-4 text-center">
              {podium.map((entry, index) => (
                <div key={entry.rank} className={index === 0 ? 'order-2' : index === 1 ? 'order-1' : 'order-3'}>
                  <div className={`mx-auto rounded-full border-4 ${index === 0 ? 'h-24 w-24 border-primary' : 'h-16 w-16 border-[#f5c79f]'} bg-slate-200`} />
                  <p className="mt-2 text-[15px] leading-[20px] font-black text-slate-900">{entry.name}</p>
                  <p className="text-[13px] leading-[16px] font-bold text-primary">{entry.score.toLocaleString()} pts</p>
                  <span className={`inline-block mt-1 rounded-full px-2 py-1 text-[11px] leading-[12px] font-bold ${index === 0 ? 'bg-primary text-white' : 'bg-[#8fa0b6] text-white'}`}>
                    {index === 0 ? 'Winner' : index === 1 ? '2nd' : '3rd'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {rest.length === 0 && <p className="text-[14px] leading-[20px] text-[#61758f]">More member rankings will appear after activity is logged.</p>}
            {rest.map((entry) => (
              <article key={entry.rank} className={`rounded-[22px] border p-4 flex items-center justify-between shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${entry.rank === 12 ? 'bg-[#fff7f1] border-[#f8c8a7]' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center gap-3">
                  <span className="w-7 text-[16px] leading-[20px] font-bold text-[#8da1ba]">{entry.rank}</span>
                  <div className="h-10 w-10 rounded-full bg-slate-200" />
                  <p className="text-[15px] leading-[20px] font-bold text-slate-900">{entry.name}</p>
                </div>
                <p className="text-[20px] leading-[24px] font-black text-primary">{entry.score}<span className="text-[12px] text-[#9aacbf] ml-1">XP</span></p>
              </article>
            ))}
          </div>
        </main>
      </div>

      <GroupBottomNav active="groups" />
    </Screen>
  );
}

export default GroupLeaderboardScreen;
