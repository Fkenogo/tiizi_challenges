import { MessageSquare, Search } from 'lucide-react';
import { GroupSharedHeader } from './components/GroupSharedHeader';
import { useEffect, useMemo, useState } from 'react';
import type { GroupMemberItem } from '../../services/groupInsightsService';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useGroupMembers } from '../../hooks/useGroupInsights';
import { setActiveGroupId } from '../../hooks/useActiveGroup';
import { useGroup, useGroupMembershipStatus, useReportGroup } from '../../hooks/useGroups';
import { GroupBottomNav } from './components/GroupBottomNav';

function GroupMembersScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { data: group } = useGroup(id);
const { data: membershipStatus = 'none' } = useGroupMembershipStatus(id);
  const { data: members = [] } = useGroupMembers(id);
  const reportGroup = useReportGroup();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<GroupMemberItem | null>(null);

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

  if (group.isPrivate && membershipStatus !== 'joined') {
    return (
      <Screen className="st-page">
        <div className="mx-auto max-w-mobile px-4 pt-8">
          <p className="text-[20px] leading-[24px] font-black text-slate-900">Members list is members-only</p>
          <p className="mt-2 text-[14px] leading-[20px] text-[#61758f]">Join this group first to view the member roster.</p>
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
  const formatJoined = (iso?: string) => {
    if (!iso) return 'Joined recently';
    const joined = Date.parse(iso);
    if (Number.isNaN(joined)) return 'Joined recently';
    const deltaDays = Math.max(0, Math.floor((Date.now() - joined) / (1000 * 60 * 60 * 24)));
    if (deltaDays === 0) return 'Joined today';
    if (deltaDays === 1) return 'Joined yesterday';
    if (deltaDays < 30) return `Joined ${deltaDays} days ago`;
    const months = Math.floor(deltaDays / 30);
    if (months < 12) return `Joined ${months} month${months === 1 ? '' : 's'} ago`;
    const years = Math.floor(months / 12);
    return `Joined ${years} year${years === 1 ? '' : 's'} ago`;
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen bg-slate-50 pb-[96px]">
        <GroupSharedHeader groupId={id} active="members" />

        <main className="px-4 pt-6">
          <label className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 flex items-center gap-3 text-slate-400 text-[14px] leading-[20px] font-medium">
            <Search size={20} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search members..."
              className="h-full w-full bg-transparent text-[14px] leading-[20px] font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </label>

          <section className="mt-6">
            <h2 className="st-section-title mb-3">Organizers</h2>
            <div className="space-y-3">
              {admins.length === 0 && (
                <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <p className="text-[13px] leading-[18px] text-slate-500">No organizer profiles available yet.</p>
                </article>
              )}
              {admins.map((member) => (
                <article key={member.id} className="rounded-2xl border border-[#fde8d8] bg-white p-4 flex items-center justify-between gap-3 shadow-sm cursor-pointer active:bg-slate-50" onClick={() => setSelectedMember(member)}>
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 rounded-full bg-[#ffd9bf] border-2 border-primary" />
                    <div>
                      <p className="text-[15px] leading-[20px] font-black text-slate-900">{member.name}</p>
                      <p className="text-[12px] leading-[16px] text-slate-500">{formatJoined(member.joinedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-[#fff1e7] px-3 py-1 text-[12px] leading-[14px] font-bold text-primary">LEAD</span>
                    <button className="text-primary"><MessageSquare size={18} /></button>
                    {membershipStatus === 'joined' && user?.uid !== member.id ? (
                      <button
                        className="text-xs font-bold text-red-600"
                        onClick={async () => {
                          if (!id || !user?.uid) return;
                          const reason = 'Reported by member';
                          try {
                            await reportGroup.mutateAsync({
                              groupId: id,
                              reporterUid: user.uid,
                              reason,
                              reportType: 'member',
                              reportedUserId: member.id,
                            });
                            showToast('Member report sent to admin.', 'success');
                          } catch {
                            showToast('Could not send report.', 'error');
                          }
                        }}
                      >
                        Report
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-7 pb-6">
            <div className="flex items-end justify-between">
              <h2 className="st-section-title">Community Members</h2>
              <p className="text-[14px] leading-[18px] font-medium text-[#8ea1bb]">{others.length} total</p>
            </div>

            <div className="mt-4 space-y-3">
              {others.map((member) => (
                <article key={member.id} className="rounded-2xl border border-slate-100 bg-white px-4 py-3.5 flex items-center justify-between gap-3 shadow-sm cursor-pointer active:bg-slate-50" onClick={() => setSelectedMember(member)}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-14 w-14 rounded-full bg-[#ffd9bf]" />
                    <div className="min-w-0">
                      <p className="text-[15px] leading-[20px] font-black text-slate-900 truncate">{member.name}</p>
                      <p className="text-[12px] leading-[16px] uppercase tracking-[0.08em] font-semibold text-[#72849d]">{member.streak}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {membershipStatus === 'joined' && user?.uid !== member.id ? (
                      <button
                        className="text-xs font-bold text-red-600"
                        onClick={async () => {
                          if (!id || !user?.uid) return;
                          const reason = 'Reported by member';
                          try {
                            await reportGroup.mutateAsync({
                              groupId: id,
                              reporterUid: user.uid,
                              reason,
                              reportType: 'member',
                              reportedUserId: member.id,
                            });
                            showToast('Member report sent to admin.', 'success');
                          } catch {
                            showToast('Could not send report.', 'error');
                          }
                        }}
                      >
                        Report
                      </button>
                    ) : null}
                    <span className="text-[#d1dae6] text-[24px]">›</span>
                  </div>
                </article>
              ))}
            </div>

            <button className="mt-4 w-full h-14 rounded-full bg-[#f3f6fb] text-[#697d97] text-[14px] leading-[16px] tracking-[0.12em] uppercase font-bold">Load More Members</button>
          </section>
        </main>
      </div>

      {/* Member detail modal */}
      {selectedMember && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={() => setSelectedMember(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-mobile rounded-t-[28px] bg-white px-6 pt-6 pb-10 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-slate-200" />

            {/* Name + role */}
            <div className="flex items-center justify-between gap-3">
              <p className="text-[22px] leading-[28px] font-black text-slate-900">{selectedMember.name}</p>
              {selectedMember.role === 'Coach' ? (
                <span className="rounded-full bg-[#fff1e7] px-3 py-1 text-[12px] leading-[14px] font-bold text-primary">LEAD</span>
              ) : (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[12px] leading-[14px] font-semibold text-slate-600">Member</span>
              )}
            </div>

            {/* Stats */}
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-[14px] leading-[18px] font-semibold text-slate-500">Joined</p>
                <p className="text-[14px] leading-[18px] font-bold text-slate-900">{formatJoined(selectedMember.joinedAt)}</p>
              </div>
              {selectedMember.streak && (
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-[14px] leading-[18px] font-semibold text-slate-500">Streak</p>
                  <p className="text-[14px] leading-[18px] font-bold text-slate-900">{selectedMember.streak}</p>
                </div>
              )}
            </div>

            <button
              className="mt-6 w-full h-12 rounded-xl bg-slate-100 text-[15px] font-bold text-slate-700"
              onClick={() => setSelectedMember(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <GroupBottomNav active="groups" />
    </Screen>
  );
}

export default GroupMembersScreen;
