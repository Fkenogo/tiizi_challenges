import { ArrowLeft, MessageSquare, MoreHorizontal, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useGroupMembers } from '../../hooks/useGroupInsights';
import { setActiveGroupId } from '../../hooks/useActiveGroup';
import { useGroup, useGroupMembershipStatus } from '../../hooks/useGroups';
import { GroupBottomNav } from './components/GroupBottomNav';
import { GroupDetailTabs } from './components/GroupDetailTabs';

function GroupMembersScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: group } = useGroup(id);
  const { data: membershipStatus = 'none' } = useGroupMembershipStatus(id);
  const { data: members = [] } = useGroupMembers(id);
  const [searchTerm, setSearchTerm] = useState('');

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
          <p className="text-[20px] leading-[24px] font-black text-slate-900">Members list is members-only</p>
          <p className="mt-2 text-[14px] leading-[20px] text-[#61758f]">Join this group first to view member roster and admin contacts.</p>
          <button className="mt-4 h-12 rounded-xl bg-primary text-white px-5 font-bold" onClick={() => navigate(`/app/group/${id}`)}>Go to Group Detail</button>
        </div>
      </Screen>
    );
  }

  const filteredMembers = useMemo(() => {
    if (!searchTerm.trim()) return members;
    const normalized = searchTerm.trim().toLowerCase();
    return members.filter((member) => member.name.toLowerCase().includes(normalized));
  }, [members, searchTerm]);

  const admins = filteredMembers.filter((member) => member.role === 'Coach');
  const others = filteredMembers.filter((member) => member.role !== 'Coach');

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen pb-[96px]">
        <header className="px-4 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <button className="h-10 w-10 rounded-full bg-[#e6edf7] text-[#4d637d] flex items-center justify-center" onClick={() => navigate(`/app/group/${id}`)}><ArrowLeft size={22} /></button>
            <h1 className="text-[20px] leading-[24px] font-black text-slate-900">{group.name}</h1>
            <button className="h-10 w-10 rounded-full bg-[#e6edf7] text-[#4d637d] flex items-center justify-center"><MoreHorizontal size={20} /></button>
          </div>

          <p className="mt-2 text-[14px] leading-[20px] text-[#61758f]">{group.memberCount.toLocaleString()} members • Active daily</p>
          <span className="mt-2 inline-block rounded-full bg-[#fff1e7] px-3 py-1 text-[12px] leading-[14px] font-semibold text-primary">Community Group</span>
        </header>

        <GroupDetailTabs groupId={id} active="members" />

        <main className="px-4 pt-6">
          <label className="h-14 rounded-full border border-slate-200 bg-white px-4 flex items-center gap-3 text-[#8da0ba] text-[15px] leading-[20px] font-medium">
            <Search size={20} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search members..."
              className="h-full w-full bg-transparent text-[15px] leading-[20px] font-medium text-slate-700 placeholder:text-[#8da0ba] focus:outline-none"
            />
          </label>

          <section className="mt-6">
            <h2 className="text-[18px] leading-[22px] font-black text-slate-900">Admins</h2>
            <div className="mt-4 space-y-3">
              {admins.length === 0 && (
                <article className="rounded-[20px] border border-slate-200 bg-white p-4">
                  <p className="text-[14px] leading-[20px] text-[#61758f]">No admin profiles available yet.</p>
                </article>
              )}
              {admins.map((member) => (
                <article key={member.id} className="rounded-[22px] border border-[#f8d6bd] bg-white p-4 flex items-center justify-between gap-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 rounded-full bg-[#ffd9bf] border-2 border-primary" />
                    <div>
                      <p className="text-[17px] leading-[22px] font-black text-slate-900">{member.name}</p>
                      <p className="text-[13px] leading-[16px] text-[#61758f]">Joined 1 year ago</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-[#fff1e7] px-3 py-1 text-[12px] leading-[14px] font-bold text-primary">ADMIN</span>
                    <button className="text-primary"><MessageSquare size={18} /></button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-7 pb-6">
            <div className="flex items-end justify-between">
              <h2 className="text-[18px] leading-[22px] font-black text-slate-900">Community Members</h2>
              <p className="text-[14px] leading-[18px] font-medium text-[#8ea1bb]">{others.length} total</p>
            </div>

            <div className="mt-4 space-y-3">
              {others.map((member) => (
                <article key={member.id} className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 flex items-center justify-between gap-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-14 w-14 rounded-full bg-[#ffd9bf]" />
                    <div className="min-w-0">
                      <p className="text-[17px] leading-[22px] font-black text-slate-900 truncate">{member.name}</p>
                      <p className="text-[12px] leading-[16px] uppercase tracking-[0.08em] font-semibold text-[#72849d]">{member.streak}</p>
                    </div>
                  </div>
                  <span className="text-[#d1dae6] text-[24px]">›</span>
                </article>
              ))}
            </div>

            <button className="mt-4 w-full h-14 rounded-full bg-[#f3f6fb] text-[#697d97] text-[14px] leading-[16px] tracking-[0.12em] uppercase font-bold">Load More Members</button>
          </section>
        </main>
      </div>

      <GroupBottomNav active="groups" />
    </Screen>
  );
}

export default GroupMembersScreen;
