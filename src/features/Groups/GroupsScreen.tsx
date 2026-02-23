import { Bell, Search, Users as UsersIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useChallenges } from '../../hooks/useChallenges';
import { useGroups, useJoinGroup, useMyGroups } from '../../hooks/useGroups';
import { getStoredActiveGroupId, setActiveGroupId } from '../../hooks/useActiveGroup';
import type { Group } from '../../types';
import { GroupBottomNav } from './components/GroupBottomNav';

const fallbackImage =
  'https://images.unsplash.com/photo-1486218119243-13883505764c?auto=format&fit=crop&w=1200&q=80';

type GroupTab = 'my' | 'discover' | 'invites';

function GroupCard({
  group,
  ctaLabel,
  onCta,
}: {
  group: Group;
  ctaLabel: string;
  onCta: (group: Group) => void;
}) {
  return (
    <article className="bg-white border border-slate-200 rounded-[24px] overflow-hidden shadow-sm">
      <button className="w-full text-left" onClick={() => onCta(group)}>
        <div className="relative overflow-hidden" style={{ height: 168, minHeight: 168, maxHeight: 168 }}>
          <img
            src={group.coverImageUrl || fallbackImage}
            alt={group.name}
            className="h-full w-full object-cover"
            style={{ display: 'block' }}
          />
          {!!group.activeChallenges && (
            <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-[11px] leading-[11px] font-black tracking-[0.08em] uppercase text-white">
              Active Now
            </span>
          )}
        </div>

        <div className="p-4 min-h-[130px]">
          <div className="flex items-start justify-between gap-2">
            <h2 className="min-w-0 flex-1 truncate text-[14px] leading-[19px] font-black text-slate-900">
              {group.name}
            </h2>
            <span className="text-slate-400">•••</span>
          </div>

            <p className="mt-2 line-clamp-2 text-[12px] leading-[18px] text-slate-600">
              {group.description || 'Join the community and stay consistent together.'}
            </p>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-4">
                <span className="text-[13px] leading-[18px] text-slate-500">
                  👥 {group.memberCount.toLocaleString()}
                </span>
                <span className="text-[13px] leading-[18px] font-semibold text-primary">
                  🏆 {group.activeChallenges ?? 0} {group.activeChallenges === 1 ? 'Challenge' : 'Challenges'}
                </span>
              </div>
            <span className="h-9 rounded-full bg-[#fff2e8] px-4 text-[13px] font-bold text-primary inline-flex items-center">
              {ctaLabel}
            </span>
          </div>
        </div>
      </button>
    </article>
  );
}

function GroupsScreen() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState<GroupTab>('my');
  const [inviteCode, setInviteCode] = useState('');

  const { data: allGroups = [], isLoading } = useGroups();
  const { data: myGroups = [] } = useMyGroups();
  const { data: challenges = [] } = useChallenges();
  const joinGroup = useJoinGroup();

  const normalizedGroups = useMemo(() => {
    const activeCountByGroup = new Map<string, number>();
    challenges.forEach((challenge) => {
      if (!challenge.groupId || challenge.status !== 'active') return;
      activeCountByGroup.set(challenge.groupId, (activeCountByGroup.get(challenge.groupId) ?? 0) + 1);
    });
    return allGroups.map((group) => ({
      ...group,
      activeChallenges: activeCountByGroup.get(group.id) ?? 0,
    }));
  }, [allGroups, challenges]);

  const myGroupIds = new Set(myGroups.map((group) => group.id));
  const discoverGroups = normalizedGroups.filter((group) => !myGroupIds.has(group.id));

  useEffect(() => {
    if (myGroups.length === 0) return;
    const active = getStoredActiveGroupId();
    if (!active) {
      setActiveGroupId(myGroups[0].id);
    }
  }, [myGroups]);

  const openGroup = (group: Group) => {
    setActiveGroupId(group.id);
    navigate(`/app/group/${group.id}`);
  };

  const handleDiscoverCta = async (group: Group) => {
    if (!user?.uid) {
      showToast('Please sign in first.', 'error');
      return;
    }

    try {
      const result = await joinGroup.mutateAsync({ groupId: group.id });
      if (!result) {
        showToast('Unable to join group.', 'error');
        return;
      }
      setActiveGroupId(group.id);
      if (result.status === 'pending') {
        showToast('Join request sent. Await admin approval.', 'success');
        setTab('invites');
        return;
      }
      showToast('Joined group.', 'success');
      navigate(`/app/group/${group.id}`);
    } catch {
      showToast('Could not join group.', 'error');
    }
  };

  const handleInviteJoin = async () => {
    if (!inviteCode.trim()) return;
    try {
      const result = await joinGroup.mutateAsync({ inviteCode: inviteCode.trim().toUpperCase() });
      if (!result) {
        showToast('Invite code not found.', 'error');
        return;
      }
      setActiveGroupId(result.group.id);
      if (result.status === 'pending') {
        showToast('Request submitted. Waiting for admin approval.', 'success');
        return;
      }
      showToast('Joined via invite.', 'success');
      navigate(`/app/group/${result.group.id}`);
    } catch {
      showToast('Could not process invite code.', 'error');
    }
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen pb-[108px]">
        <header className="px-4 pt-4 pb-2 border-b border-slate-200 bg-slate-50 sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-primary text-lg">◉</span>
              <h1 className="text-[18px] leading-[22px] font-black text-slate-900">Your Groups</h1>
            </div>
            <div className="flex items-center gap-1">
              <button className="h-8 w-8 flex items-center justify-center text-slate-800"><Search size={16} /></button>
              <button className="h-8 w-8 flex items-center justify-center text-slate-800"><Bell size={16} /></button>
            </div>
          </div>

          <div className="mt-3 flex items-end gap-5 border-b border-slate-200">
            <button className={`pb-2 text-[14px] leading-[18px] font-semibold border-b-2 ${tab === 'my' ? 'text-primary border-primary' : 'text-slate-500 border-transparent'}`} onClick={() => setTab('my')}>My Groups</button>
            <button className={`pb-2 text-[14px] leading-[18px] font-semibold border-b-2 ${tab === 'discover' ? 'text-primary border-primary' : 'text-slate-500 border-transparent'}`} onClick={() => setTab('discover')}>Discover</button>
            <button className={`pb-2 text-[14px] leading-[18px] font-semibold border-b-2 ${tab === 'invites' ? 'text-primary border-primary' : 'text-slate-500 border-transparent'}`} onClick={() => setTab('invites')}>Invites</button>
          </div>
        </header>

        <main className="px-4 pt-3 space-y-3">
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="h-20 rounded-2xl bg-white border border-slate-200 animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && tab === 'my' && (
            <>
              {myGroups.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-4">
                  <h2 className="text-base font-bold text-slate-900">No groups yet</h2>
                  <p className="text-xs text-slate-500 mt-1">Join a group or create your own to start challenges.</p>
                  <div className="mt-3 flex gap-2">
                    <button className="h-9 flex-1 rounded-lg bg-primary text-white text-sm font-semibold" onClick={() => navigate('/app/create-group')}>Create</button>
                    <button className="h-9 flex-1 rounded-lg border border-slate-200 text-sm font-medium text-slate-700" onClick={() => setTab('discover')}>Find Groups</button>
                  </div>
                </div>
              ) : (
                myGroups.map((group) => (
                  <GroupCard key={group.id} group={group} ctaLabel="View" onCta={openGroup} />
                ))
              )}
            </>
          )}

          {!isLoading && tab === 'discover' && (
            <>
              {discoverGroups.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-[20px] p-5">
                  <p className="text-[16px] leading-[22px] text-slate-700">No other groups available right now.</p>
                </div>
              ) : (
                discoverGroups.map((group) => (
                  <GroupCard key={group.id} group={group} ctaLabel={group.isPrivate || group.requireAdminApproval ? 'Request' : 'Join'} onCta={handleDiscoverCta} />
                ))
              )}
            </>
          )}

          {!isLoading && tab === 'invites' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <h2 className="text-base font-bold text-slate-900">Join with Invite</h2>
              <p className="text-xs text-slate-500 mt-1">Enter a group code to join directly.</p>
              <input
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                placeholder="e.g. EARLY-BIRDS"
                className="mt-3 w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 uppercase"
              />
              <button className="mt-3 w-full h-10 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-60" disabled={!inviteCode.trim() || joinGroup.isPending} onClick={handleInviteJoin}>
                {joinGroup.isPending ? 'Joining...' : 'Join Group'}
              </button>
              <p className="mt-2 text-[10px] text-slate-500">For private groups, your request remains pending until admin approval.</p>
            </div>
          )}
        </main>
      </div>

      <GroupBottomNav active="groups" />
    </Screen>
  );
}

export default GroupsScreen;
