import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Flame, Heart, MessageSquare, Share2, Sparkles, Star, ThumbsUp, Trophy } from 'lucide-react';
import { FeedCommentSection } from './FeedCommentSection';
import type { FeedProgressSnapshot, GroupActivityFeedSummary } from '../../types';
import { formatSummaryRelativeTime } from '../../services/memberActivitySummaryService';
import type { FeedLiveStats } from '../../services/feedLiveStatsService';
import type { ReactionSummary, ReactionType } from '../../services/feedReactionService';

function daysRemaining(endDate?: string | null): number | null {
  if (!endDate) return null;
  const diff = Math.ceil((Date.parse(endDate) - Date.now()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : null;
}

function Avatar({ photoURL, name, userId }: { photoURL?: string; name?: string; userId: string }) {
  if (photoURL) {
    return <img src={photoURL} alt={name ?? 'Member'} className="h-11 w-11 rounded-full object-cover flex-shrink-0" />;
  }
  const seed = (name?.trim() || userId);
  const initials = seed.slice(0, 2).toUpperCase();
  return (
    <div className="h-11 w-11 rounded-full bg-[#fbe9d9] text-primary flex items-center justify-center text-[13px] font-black flex-shrink-0">
      {initials}
    </div>
  );
}

function TypeBadge({ type }: { type?: string | null }) {
  if (!type) return null;
  const config: Record<string, { label: string; cls: string }> = {
    collective: { label: 'Collective', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    competitive: { label: 'Competitive', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
    streak: { label: 'Streak', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  };
  const c = config[type] ?? { label: type, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] leading-[14px] font-bold uppercase tracking-[0.08em] ${c.cls}`}>
      {c.label}
    </span>
  );
}

function MilestoneBadge({ milestoneType }: { milestoneType?: string | null }) {
  if (!milestoneType) return null;
  const isTeam = milestoneType.startsWith('collective');
  const Icon = isTeam ? Trophy : Star;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] leading-[14px] font-bold uppercase tracking-[0.08em] text-amber-700">
      <Icon size={10} />
      {isTeam ? 'Team Milestone' : 'Achievement'}
    </span>
  );
}

function ActivityBox({ label, value }: { label?: string; value?: string }) {
  if (!label && !value) return null;
  return (
    <div className="mt-3 rounded-2xl border border-[#f7d5be] bg-[#fff8f2] p-3.5">
      {label && (
        <p className="text-[11px] leading-[12px] uppercase tracking-[0.08em] font-bold text-primary">{label}</p>
      )}
      {value && (
        <p className="mt-1 text-[17px] leading-[22px] font-black text-slate-900">{value}</p>
      )}
    </div>
  );
}


function handleShare(item: GroupActivityFeedSummary) {
  const text = `${item.authorName ?? 'A member'} logged ${item.valueLabel ?? ''} in ${item.challengeName ?? 'a challenge'} on Tiizi`;
  if (typeof navigator?.share === 'function') {
    navigator.share({ title: 'Tiizi Activity', text }).catch(() => {});
  } else if (navigator?.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

function StatsFallback() {
  return (
    <p className="mt-3 text-[13px] text-slate-400">Progress updates as the challenge moves.</p>
  );
}

// Renders from feedProgressSnapshot — the precomputed post-log state written by Cloud Functions.
// Preferred over live stats for new feed docs because the data is always available and accurate.
function SnapshotProgress({ snap }: { snap: FeedProgressSnapshot }) {
  const unitStr = snap.unit ? ` ${snap.unit}` : '';
  return (
    <div className="mt-3 space-y-1.5">
      {/* Collective: "Team progress: X / Y unit" + bar + remaining */}
      {snap.challengeType === 'collective' && (
        <>
          <p className="text-[13px] font-semibold text-slate-700">{snap.label}</p>
          {snap.percentComplete !== undefined && (
            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${snap.percentComplete}%` }} />
            </div>
          )}
          {snap.remainingValue !== undefined && snap.remainingValue > 0 && (
            <p className="text-[12px] text-slate-500">
              {snap.remainingValue.toLocaleString()}{unitStr} remaining
            </p>
          )}
        </>
      )}
      {/* Competitive: "Progress: X / Y unit" + leader context on second line */}
      {snap.challengeType === 'competitive' && (
        <>
          {snap.userCumulativeValue !== undefined && (
            <p className="text-[13px] font-semibold text-slate-700">
              Progress: {snap.userCumulativeValue.toLocaleString()}
              {snap.targetValue ? ` / ${snap.targetValue.toLocaleString()}${unitStr}` : unitStr}
            </p>
          )}
          <p className={`text-[12px] font-medium ${snap.isLeading ? 'text-primary' : 'text-slate-500'}`}>
            {snap.label}
          </p>
        </>
      )}
      {/* Streak: label only + daily target */}
      {snap.challengeType === 'streak' && (
        <>
          <p className="text-[13px] font-semibold text-slate-700">{snap.label}</p>
          {snap.dailyTarget !== undefined && (
            <p className="text-[12px] text-slate-500">
              Daily target: {snap.dailyTarget.toLocaleString()}{unitStr}
            </p>
          )}
        </>
      )}
      {snap.daysRemaining !== undefined && (
        <p className="text-[12px] text-slate-400">
          {snap.daysRemaining === 0 ? 'Challenge ends today' : `${snap.daysRemaining} day${snap.daysRemaining === 1 ? '' : 's'} left`}
        </p>
      )}
    </div>
  );
}

function CollectiveStats({ stats }: { stats?: FeedLiveStats }) {
  const total = stats?.teamTotal;
  const target = stats?.teamTarget;
  const unit = stats?.unit ?? '';
  if (total === undefined) return <StatsFallback />;
  const pct = target ? Math.min(100, Math.round((total / target) * 100)) : null;
  const suffix = unit ? ` ${unit}` : '';
  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-[13px] font-semibold text-slate-700">
        Progress: {total.toLocaleString()}{target ? ` / ${target.toLocaleString()}${suffix}` : suffix}
      </p>
      {target && pct !== null && (
        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      {target && (
        <p className="text-[12px] text-slate-500">
          {total >= target ? 'Target reached!' : `${(target - total).toLocaleString()}${suffix} remaining`}
        </p>
      )}
    </div>
  );
}

function CompetitiveStats({ stats }: { stats?: FeedLiveStats }) {
  const { posterScore, posterCumulativeValue, perPersonTarget, leaderScore, leaderName } = stats ?? {};
  const unit = stats?.unit ?? '';
  const progressValue = posterCumulativeValue ?? posterScore;
  if (progressValue === undefined) return <StatsFallback />;
  const isLeading = leaderScore !== undefined && (posterScore ?? 0) >= leaderScore;
  const delta = leaderScore !== undefined && posterScore !== undefined ? leaderScore - posterScore : null;
  const suffix = unit ? ` ${unit}` : '';
  return (
    <div className="mt-3 space-y-0.5">
      <p className="text-[13px] font-semibold text-slate-700">
        Progress: {progressValue.toLocaleString()}{perPersonTarget ? ` / ${perPersonTarget.toLocaleString()}${suffix}` : suffix}
      </p>
      {isLeading && <p className="text-[12px] text-primary font-semibold">Leading!</p>}
      {!isLeading && delta !== null && delta > 0 && (
        <p className="text-[12px] text-slate-500">
          {delta.toLocaleString()} pts behind {leaderName ?? 'leader'}
        </p>
      )}
    </div>
  );
}

function StreakStats({ stats }: { stats?: FeedLiveStats }) {
  const { currentStreak, streakDailyTarget } = stats ?? {};
  const unit = stats?.unit ?? '';
  if (currentStreak === undefined) return <StatsFallback />;
  return (
    <div className="mt-3 space-y-0.5">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
        <Flame size={13} className="text-primary flex-shrink-0" /> Day {currentStreak} streak
      </p>
      {streakDailyTarget !== undefined && (
        <p className="text-[12px] text-slate-500">
          Daily target: {streakDailyTarget.toLocaleString()}{unit ? ` ${unit}` : ''}
        </p>
      )}
    </div>
  );
}

const STORY_MAX_LINES = 4;
const STORY_LINE_HEIGHT_PX = 20;
const STORY_COLLAPSED_HEIGHT = STORY_MAX_LINES * STORY_LINE_HEIGHT_PX;

function StoryBlock({ story }: { story: string }) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setOverflows(el.scrollHeight > STORY_COLLAPSED_HEIGHT + 2);
  }, [story]);

  return (
    <div className="mt-3 border-l-[3px] border-primary rounded-r-[4px] pl-3">
      <p
        ref={ref}
        className="text-[14px] leading-[20px] text-slate-800 whitespace-pre-wrap break-words"
        style={expanded ? undefined : { maxHeight: `${STORY_COLLAPSED_HEIGHT}px`, overflow: 'hidden' }}
      >
        {story}
      </p>
      {overflows && (
        <button
          className="mt-1 text-[12px] font-semibold text-primary"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

const REACTION_CONFIG: { type: ReactionType; label: string; icon: React.ElementType }[] = [
  { type: 'like', label: 'Like', icon: Heart },
  { type: 'applaud', label: 'Applaud', icon: ThumbsUp },
  { type: 'inspired', label: 'Inspired', icon: Sparkles },
];

interface FeedCardProps {
  item: GroupActivityFeedSummary;
  canEngage: boolean;
  stats?: FeedLiveStats;
  reactionSummary?: ReactionSummary;
  onSetReaction?: (type: ReactionType) => void;
  onClearReaction?: () => void;
}

export function FeedCard({ item, canEngage, stats, reactionSummary, onSetReaction, onClearReaction }: FeedCardProps) {
  const [showComments, setShowComments] = useState(false);
  const days = daysRemaining(item.challengeEndDate);
  const time = formatSummaryRelativeTime(item.createdAt);
  const displayName = item.authorName?.trim() || `Member ${item.userId.slice(0, 6).toUpperCase()}`;

  return (
    <article className="rounded-[20px] border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="p-4">
        {/* Header: avatar + name + type badge + time */}
        <div className="flex items-start gap-3">
          <Avatar photoURL={item.userPhotoURL} name={item.authorName} userId={item.userId} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[15px] leading-[20px] font-black text-slate-900">{displayName}</p>
              {item.feedItemType === 'milestone' ? (
                <MilestoneBadge milestoneType={item.milestoneType} />
              ) : (
                <TypeBadge type={item.challengeType} />
              )}
            </div>
            <p className="mt-0.5 text-[12px] leading-[16px] font-medium text-[#61758f]">◔ {time}</p>
          </div>
        </div>

        {/* Challenge name */}
        {item.challengeName && (
          <p className="mt-3 text-[12px] leading-[16px] font-bold text-[#61758f] uppercase tracking-[0.06em] truncate">
            {item.challengeName}
          </p>
        )}

        {/* Milestone body OR activity body */}
        {item.feedItemType === 'milestone' ? (
          item.text && (
            <p className="mt-3 text-[17px] leading-[24px] font-black text-slate-900">{item.text}</p>
          )
        ) : (
          <>
            <ActivityBox label={item.activityLabel} value={item.valueLabel} />
            {/* Progress: prefer feedProgressSnapshot (precomputed by CF) for new docs;
                fall back to live stats for old docs without a snapshot. */}
            {item.feedProgressSnapshot
              ? <SnapshotProgress snap={item.feedProgressSnapshot} />
              : item.challengeType === 'collective'
                ? <CollectiveStats stats={stats} />
                : item.challengeType === 'competitive'
                  ? <CompetitiveStats stats={stats} />
                  : item.challengeType === 'streak'
                    ? <StreakStats stats={stats} />
                    : item.text && <p className="mt-3 text-[14px] leading-[20px] text-[#171212]">{item.text}</p>
            }
          </>
        )}

        {/* Activity story */}
        {item.feedItemType !== 'milestone' && item.story?.trim() && (
          <StoryBlock story={item.story.trim()} />
        )}

        {/* Days remaining — only when no feedProgressSnapshot (snapshot renders its own daysRemaining) */}
        {days !== null && !item.feedProgressSnapshot && (
          <p className="mt-2 text-[12px] leading-[16px] font-medium text-[#9ca9bd]">
            {days === 0 ? 'Challenge ends today' : `${days} day${days === 1 ? '' : 's'} left`}
          </p>
        )}
      </div>

      {/* Social actions */}
      <div className="px-4 py-3 border-t border-slate-200 flex items-center gap-3 text-[#4c627e]">
        {REACTION_CONFIG.map(({ type, label, icon: Icon }) => {
          const count = reactionSummary?.counts[type] ?? 0;
          const active = reactionSummary?.userReaction === type;
          return (
            <button
              key={type}
              className={`inline-flex items-center gap-1 text-[13px] leading-[16px] font-semibold disabled:opacity-40 transition-colors ${
                active ? 'text-primary' : 'text-[#4c627e]'
              }`}
              disabled={!canEngage}
              aria-label={label}
              aria-pressed={active}
              onClick={() => {
                if (!canEngage) return;
                if (active) onClearReaction?.();
                else onSetReaction?.(type);
              }}
            >
              <Icon size={14} className={active ? 'fill-primary' : ''} />
              {count > 0 ? count : label}
            </button>
          );
        })}
        <button
          className="inline-flex items-center gap-1.5 text-[13px] leading-[16px] font-semibold text-[#4c627e]"
          onClick={() => setShowComments((v) => !v)}
          aria-label="Comments"
          aria-expanded={showComments}
        >
          <MessageSquare size={14} />
          Reply
        </button>
        <button
          className="ml-auto inline-flex items-center justify-center text-[#4c627e]"
          onClick={() => handleShare(item)}
          aria-label="Share"
        >
          <Share2 size={16} />
        </button>
      </div>

      {showComments && (
        <FeedCommentSection
          feedItemId={item.id}
          groupId={item.groupId}
          canEngage={canEngage}
        />
      )}
    </article>
  );
}
