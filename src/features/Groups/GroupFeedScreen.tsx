import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useGroupFeed } from '../../hooks/useGroupInsights';
import { setActiveGroupId } from '../../hooks/useActiveGroup';
import { useGroup, useGroupMembershipStatus } from '../../hooks/useGroups';
import { GroupBottomNav } from './components/GroupBottomNav';
import { GroupSharedHeader } from './components/GroupSharedHeader';
import { FeedCard } from './FeedCard';
import { useFeedLiveStats } from '../../hooks/useFeedLiveStats';
import { useFeedReactions } from '../../hooks/useFeedReactions';
import type { GroupActivityFeedSummary } from '../../types';

// Filters backed by real feed data fields:
//   source: 'workout' | 'wellness'
//   challengeType: 'collective' | 'competitive' | 'streak'
// Deferred (no feed data): 'engagement', 'cause_support'
type FeedFilter = 'all' | 'workout' | 'wellness' | 'collective' | 'competitive' | 'streak' | 'achievements';

const FILTER_CHIPS: { id: FeedFilter; label: string }[] = [
  { id: 'all',          label: 'All' },
  { id: 'workout',      label: 'Workouts' },
  { id: 'wellness',     label: 'Wellness' },
  { id: 'collective',   label: 'Collective' },
  { id: 'competitive',  label: 'Competitive' },
  { id: 'streak',       label: 'Streak' },
  { id: 'achievements', label: 'Achievements' },
];

function applyFilter(items: GroupActivityFeedSummary[], filter: FeedFilter): GroupActivityFeedSummary[] {
  if (filter === 'all') return items;
  if (filter === 'workout' || filter === 'wellness') return items.filter((i) => i.source === filter);
  if (filter === 'achievements') return items.filter((i) => i.feedItemType === 'milestone' || i.feedItemType === 'achievement');
  return items.filter((i) => i.challengeType === filter);
}

function GroupFeedScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: group } = useGroup(id);
  const { data: membershipStatus = 'none' } = useGroupMembershipStatus(id);
  const { data: feedItems = [] } = useGroupFeed(id);
  const { data: statsMap } = useFeedLiveStats(feedItems);
  const { query: reactionsQuery, setReaction, clearReaction } = useFeedReactions(feedItems);
  const [activeFilter, setActiveFilter] = useState<FeedFilter>('all');

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

  const canView = !group.isPrivate || membershipStatus === 'joined';
  const canEngage = membershipStatus === 'joined';

  if (!canView) {
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

  const filteredItems = applyFilter(feedItems, activeFilter);

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen bg-slate-50 pb-[96px]">
        <GroupSharedHeader groupId={id} active="feed" />

        <main className="pt-6 space-y-5">
          {/* Post composer */}
          <div className="px-4">
            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-[#fbe9d9] text-primary flex items-center justify-center">🗒️</div>
                <button className="h-11 flex-1 rounded-full bg-slate-100 text-left px-5 text-[15px] leading-[20px] text-[#61758f] disabled:opacity-60" disabled={!canEngage}>
                  {canEngage ? 'Share an update with the group...' : 'Join group to post updates'}
                </button>
              </div>
            </section>
          </div>

          {/* Filter chips */}
          <div
            className="flex gap-2 overflow-x-auto px-4 pb-0.5 scrollbar-none"
            role="tablist"
            aria-label="Feed filters"
          >
            {FILTER_CHIPS.map((chip) => (
              <button
                key={chip.id}
                role="tab"
                aria-selected={activeFilter === chip.id}
                className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-[12px] leading-[16px] font-bold transition-colors ${
                  activeFilter === chip.id
                    ? 'bg-primary text-white'
                    : 'border border-slate-200 bg-white text-[#4c627e]'
                }`}
                onClick={() => setActiveFilter(chip.id)}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Feed items */}
          <div className="px-4 space-y-5">
            {filteredItems.map((item) => (
              <FeedCard
                key={item.id}
                item={item}
                canEngage={canEngage}
                stats={statsMap?.get(item.id)}
                reactionSummary={reactionsQuery.data?.get(item.id)}
                onSetReaction={(reactionType) =>
                  setReaction.mutate({ feedItemId: item.id, groupId: item.groupId, reactionType })
                }
                onClearReaction={() => clearReaction.mutate({ feedItemId: item.id })}
              />
            ))}

            {/* Empty state: full feed is empty (no filter active) */}
            {feedItems.length === 0 && activeFilter === 'all' && (
              <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-[16px] leading-[22px] font-black text-slate-900">Nothing posted yet</p>
                <p className="mt-2 text-[13px] leading-[18px] text-slate-500">Log an activity or start a challenge to bring this group to life.</p>
                <div className="mt-4 flex gap-3 flex-wrap">
                  <button
                    className="h-10 rounded-xl bg-primary px-4 text-[13px] font-bold text-white"
                    onClick={() => navigate('/app/challenges')}
                  >
                    Browse Challenges
                  </button>
                  <button
                    className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-700"
                    onClick={() => navigate('/app/home')}
                  >
                    Log Activity
                  </button>
                </div>
              </article>
            )}

            {/* Empty state: filter has no results but feed has items */}
            {feedItems.length > 0 && filteredItems.length === 0 && (
              <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-[16px] leading-[22px] font-black text-slate-900">No results</p>
                <p className="mt-2 text-[13px] leading-[18px] text-slate-500">
                  No updates match this filter yet.
                </p>
                <button
                  className="mt-4 h-10 rounded-xl bg-primary px-4 text-[13px] font-bold text-white"
                  onClick={() => setActiveFilter('all')}
                >
                  Clear Filter
                </button>
              </article>
            )}
          </div>
        </main>
      </div>

      <GroupBottomNav active="groups" />
    </Screen>
  );
}

export default GroupFeedScreen;
