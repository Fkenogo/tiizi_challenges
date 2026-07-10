import { CalendarClock, Plus, User } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useGroup, useGroupMemberCount, useGroupMembershipStatus, useJoinGroup, useLeaveGroup } from '../../../hooks/useGroups';
import { db } from '../../../lib/firebase';
import { GroupHeroHeader } from './GroupHeroHeader';
import { GroupDetailsModal } from './GroupDetailsModal';
import { GroupDetailTabs } from './GroupDetailTabs';

type Props = {
  groupId: string;
  active: 'feed' | 'challenges' | 'members';
};

export function GroupSharedHeader({ groupId, active }: Props) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { data: group } = useGroup(groupId);
  const { data: memberCount = 0 } = useGroupMemberCount(groupId);
  const { data: membershipStatus = 'none' } = useGroupMembershipStatus(groupId);
  const [showDetails, setShowDetails] = useState(false);
  const joinGroup = useJoinGroup();
  const leaveGroup = useLeaveGroup();

  const { data: ownerDisplayName } = useQuery({
    queryKey: ['user-display-name', group?.ownerId],
    queryFn: async () => {
      if (!group?.ownerId) return null;
      const snap = await getDocs(query(collection(db, 'users'), where('uid', '==', group.ownerId)));
      if (!snap.empty) return (snap.docs[0].data() as { displayName?: string }).displayName ?? null;
      return null;
    },
    enabled: !!group?.ownerId,
    staleTime: 10 * 60 * 1000,
  });

  const canCreateChallenge =
    membershipStatus === 'joined' &&
    (group?.allowMemberChallenges !== false || group?.ownerId === user?.uid);

  const handleJoin = async () => {
    try {
      const result = await joinGroup.mutateAsync({ groupId });
      if (result.status === 'pending') {
        showToast('Join request sent for approval.', 'success');
        return;
      }
      showToast('Joined group.', 'success');
    } catch {
      showToast('Could not join group.', 'error');
    }
  };

  if (!group) return null;

  return (
    <>
      <GroupHeroHeader
        groupName={group.name}
        coverImageUrl={group.coverImageUrl}
        memberCount={memberCount}
        isPrivate={group.isPrivate ?? false}
        onBack={() => navigate('/app/groups')}
      />

      {/* Group info strip */}
      <div className="bg-white border-b border-slate-200 px-4 pt-3.5 pb-4">
        {group.description ? (
          <p className="text-[13px] leading-[19px] text-slate-600 line-clamp-2 mb-2.5">
            {group.description}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
          {group.createdAt && (
            <span className="flex items-center gap-1 text-[12px] text-slate-500">
              <CalendarClock size={12} className="text-slate-400 shrink-0" />
              Group since {new Date(group.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
          )}
          {ownerDisplayName && (
            <span className="flex items-center gap-1 text-[12px] text-slate-500">
              <User size={12} className="text-slate-400 shrink-0" />
              Admin: {ownerDisplayName}
            </span>
          )}
        </div>

        <button className="text-[13px] font-bold text-primary" onClick={() => setShowDetails(true)}>
          View Group Details →
        </button>

        {group.ownerId === user?.uid && (
          <button
            className="mt-3 w-full h-10 rounded-xl border border-slate-200 bg-white text-slate-700 text-[14px] font-semibold"
            onClick={() => navigate(`/app/group/${groupId}/edit`)}
          >
            Edit Group
          </button>
        )}
      </div>

      {/* Membership action row */}
      {membershipStatus === 'joined' && (
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center gap-2">
          <button className="h-10 px-5 rounded-xl bg-[#e9eff8] text-slate-900 text-[15px] font-semibold">
            ✓ Joined
          </button>
          <button
            className="h-10 px-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-[14px] font-semibold disabled:opacity-60"
            disabled={leaveGroup.isPending}
            onClick={async () => {
              try {
                await leaveGroup.mutateAsync(groupId);
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
          {canCreateChallenge && (
            <button
              className="h-10 px-4 rounded-xl bg-primary text-white text-[14px] font-semibold flex items-center gap-1.5 whitespace-nowrap"
              onClick={() => navigate(`/app/create-challenge?groupId=${groupId}`)}
            >
              <Plus size={15} />
              Create Challenge
            </button>
          )}
        </div>
      )}
      {membershipStatus === 'pending' && (
        <div className="px-4 py-3 bg-white border-b border-slate-200">
          <button className="h-10 px-5 rounded-xl bg-[#fff1e7] text-primary text-[15px] font-semibold">
            Pending Approval
          </button>
        </div>
      )}
      {membershipStatus === 'none' && group.status !== 'inactive' && (
        <div className="px-4 py-3 bg-white border-b border-slate-200">
          <button
            className="h-10 px-5 rounded-xl bg-primary text-white text-[15px] font-semibold disabled:opacity-60"
            onClick={handleJoin}
            disabled={joinGroup.isPending}
          >
            {joinGroup.isPending ? 'Joining...' : 'Join Group'}
          </button>
        </div>
      )}

      <GroupDetailTabs groupId={groupId} active={active} />

      {showDetails && (
        <GroupDetailsModal
          group={group}
          ownerDisplayName={ownerDisplayName ?? undefined}
          onClose={() => setShowDetails(false)}
        />
      )}
    </>
  );
}
