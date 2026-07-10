import { Bell, Search, Users as UsersIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useChallenges } from '../../hooks/useChallenges';
import { useGroups, useJoinGroup, useMyGroups } from '../../hooks/useGroups';
import { getStoredActiveGroupId, setActiveGroupId } from '../../hooks/useActiveGroup';
import type { Group } from '../../types';
import { isChallengeOngoing } from '../../utils/challengeLifecycle';
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
  const [coverSrc, setCoverSrc] = useState(group.coverImageUrl || fallbackImage);
  return (
    <article className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
      <button className="w-full text-left" onClick={() => onCta(group)}>
        <div className="relative h-[148px] overflow-hidden">
          <img
            src={coverSrc}
            alt={group.name}
            className="h-full w-full object-cover"
            onError={() => setCoverSrc(fallbackImage)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          {!!group.activeChallenges && (
            <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[10px] leading-[10px] font-black tracking-[0.06em] uppercase text-white">
              Active
            </span>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="min-w-0 flex-1 text-[14px] leading-[19px] font-black text-slate-900 line-clamp-1">
              {group.name}
            </h2>
            {group.groupType && (
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-500 capitalize">
                {group.groupType.replace(/-/g, ' ')}
              </span>
            )}
          </div>

          <p className="mt-1.5 line-clamp-2 text-[12px] leading-[17px] text-slate-500">
            {group.description || 'Stay consistent together.'}
          </p>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-slate-400">{group.memberCount.toLocaleString()} members</span>
              {(group.activeChallenges ?? 0) > 0 && (
                <span className="text-[12px] font-semibold text-primary">
                  {group.activeChallenges} active
                </span>
              )}
            </div>
            <span className="h-8 rounded-full bg-primary/10 px-3.5 text-[12px] font-bold text-primary inline-flex items-center">
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
  const location = useLocation();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [inviteCode, setInviteCode] = useState('');

  const { data: allGroups = [], isLoading } = useGroups();
  const { data: myGroups = [] } = useMyGroups();

  const requestedTab = (location.state as { tab?: GroupTab } | null)?.tab;
  // Start on requested tab if provided; otherwise 'my' until data loads
  const [tab, setTab] = useState<GroupTab>(requestedTab ?? 'my');
  // Once myGroups first resolves (not loading), auto-switch to discover if empty
  const [tabAutoSet, setTabAutoSet] = useState(!!requestedTab);
  useEffect(() => {
    if (isLoading || tabAutoSet) return;
    setTabAutoSet(true);
    if (!requestedTab) setTab(myGroups.length === 0 ? 'discover' : 'my');
  }, [isLoading, myGroups.length, requestedTab, tabAutoSet]);
  const { data: challenges = [] } = useChallenges();
  const joinGroup = useJoinGroup();

  const normalizedGroups = useMemo(() => {
    const challengeCountByGroup = new Map<string, number>();
    challenges.forEach((challenge) => {
      // Use isChallengeOngoing (same logic as GroupDetailScreen "Ongoing" tab):
      // must be within its date window AND not completed/expired/draft.
      // status === 'active' alone is insufficient — stale Firestore docs can have
      // status 'active' with an endDate already in the past.
      if (!challenge.groupId || !isChallengeOngoing(challenge)) return;
      challengeCountByGroup.set(challenge.groupId, (challengeCountByGroup.get(challenge.groupId) ?? 0) + 1);
    });
    const enrich = (group: Group) => ({
      ...group,
      activeChallenges: challengeCountByGroup.get(group.id) ?? 0,
    });
    return allGroups.map(enrich);
  }, [allGroups, challenges]);

  // Build a parallel enriched list for myGroups so both tabs use the same
  // active-only counts. myGroups comes from useMyGroups() and carries raw
  // Firestore activeChallenges (historical total) — never render it directly.
  const normalizedMyGroups = useMemo(() => {
    const byId = new Map(normalizedGroups.map((g) => [g.id, g]));
    return myGroups.map((group) => byId.get(group.id) ?? { ...group, activeChallenges: 0 });
  }, [myGroups, normalizedGroups]);

  const [discoverFilter, setDiscoverFilter] = useState<string>('all');
  const myGroupIds = new Set(myGroups.map((group) => group.id));
  const discoverGroups = normalizedGroups
    .filter((group) => !myGroupIds.has(group.id))
    .filter((group) => discoverFilter === 'all' || group.groupType === discoverFilter);

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

  const handleDiscoverCta = (group: Group) => {
    setActiveGroupId(group.id);
    navigate(`/app/group/${group.id}`);
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
    } catch (error) {
      console.warn('Invite join failed:', error);
      showToast('Could not process invite code.', 'error');
    }
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen bg-slate-50 pb-[96px]">
        <header className="px-4 pt-4 pb-0 border-b border-slate-200/70 bg-slate-50 sticky top-0 z-20">
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <UsersIcon size={18} className="text-primary" />
              <h1 className="st-page-title">Groups</h1>
            </div>
            <div className="flex items-center gap-1">
              <button className="h-9 w-9 flex items-center justify-center text-slate-600 rounded-full bg-slate-100"><Search size={16} /></button>
            </div>
          </div>

          <div className="flex items-end gap-6">
            <button className={`pb-2.5 text-[13px] leading-[16px] font-semibold border-b-2 transition-colors ${tab === 'my' ? 'text-primary border-primary' : 'text-slate-400 border-transparent'}`} onClick={() => setTab('my')}>My Groups</button>
            <button className={`pb-2.5 text-[13px] leading-[16px] font-semibold border-b-2 transition-colors ${tab === 'discover' ? 'text-primary border-primary' : 'text-slate-400 border-transparent'}`} onClick={() => setTab('discover')}>Discover</button>
            <button className={`pb-2.5 text-[13px] leading-[16px] font-semibold border-b-2 transition-colors ${tab === 'invites' ? 'text-primary border-primary' : 'text-slate-400 border-transparent'}`} onClick={() => setTab('invites')}>Invites</button>
          </div>
        </header>

        <main className="px-4 pt-4 space-y-3">
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
                normalizedMyGroups.map((group) => (
                  <GroupCard key={group.id} group={group} ctaLabel="View" onCta={openGroup} />
                ))
              )}
            </>
          )}

          {!isLoading && tab === 'discover' && (
            <>
              {/* Type filter chips */}
              <div className="-mx-4 overflow-x-auto px-4 pb-1">
                <div className="flex gap-2 pb-1" style={{ width: 'max-content' }}>
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'fitness', label: '💪 Fitness' },
                    { id: 'wellness', label: '🧘 Wellness' },
                    { id: 'mixed', label: '🌀 Mixed' },
                    { id: 'cause-based', label: '❤️ Cause-based' },
                    { id: 'workplace', label: '🏢 Workplace' },
                    { id: 'school', label: '🎓 School' },
                    { id: 'friends-family', label: '👨‍👩‍👧 Friends/Family' },
                    { id: 'community', label: '🏘️ Community' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      className={`h-8 rounded-full px-4 text-[13px] font-bold border shrink-0 transition ${discoverFilter === f.id ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-200'}`}
                      onClick={() => setDiscoverFilter(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {discoverGroups.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-[20px] p-5">
                  <p className="text-[16px] leading-[22px] text-slate-700">No other groups available right now.</p>
                </div>
              ) : (
                discoverGroups.map((group) => (
                  <GroupCard key={group.id} group={group} ctaLabel="View" onCta={handleDiscoverCta} />
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
