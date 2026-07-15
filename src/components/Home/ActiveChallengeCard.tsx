import { CheckCircle, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ActiveChallengeCardProps {
  challenge: {
    id: string;
    name: string;
    season: string;
    level: string;
    progress: number;
    progressLabel: string;
    secondaryLabel?: string;
    day: number;
    totalDays: number;
    groupId?: string;
    challengeType: 'collective' | 'competitive' | 'streak';
    actionLabel: 'Log Workout' | 'Log Activity';
    isUserCompleted?: boolean;
  };
}

export function ActiveChallengeCard({ challenge }: ActiveChallengeCardProps) {
  const navigate = useNavigate();
  const query = new URLSearchParams({ challengeId: challenge.id });
  if (challenge.groupId) query.set('groupId', challenge.groupId);

  const detailPath = `/app/challenges/${challenge.challengeType}?${query.toString()}`;
  // Log/Activity CTA goes directly to the unified logging screen, bypassing legacy dashboard screens.
  const logPath = `/app/workouts/select-activity?${query.toString()}`;

  return (
    <article className="rounded-2xl border border-[#0d1f3c]/60 bg-gradient-to-br from-[#0b1a3d] to-[#1e2d3f] p-5 text-white shadow-[0_6px_20px_rgba(15,23,42,0.22)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[16px] leading-[21px] font-black tracking-[-0.01em]">{challenge.name}</p>
          <p className="mt-0.5 text-[12px] leading-[16px] text-white/55 capitalize">{challenge.season}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {challenge.isUserCompleted && (
            <span className="flex items-center gap-1 rounded-full bg-primary/20 border border-primary/40 px-2 py-1 text-[10px] font-bold text-primary">
              <CheckCircle size={10} />
              Done
            </span>
          )}
          <span className="text-[11px] text-white/50 whitespace-nowrap">Day {challenge.day}/{challenge.totalDays}</span>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[12px] leading-[16px] font-medium text-white/70">{challenge.progressLabel}</p>
          <p className="text-[13px] leading-[16px] font-bold text-primary">{challenge.progress}%</p>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${challenge.progress}%` }} />
        </div>
        {challenge.secondaryLabel && (
          <p className="mt-1.5 text-[11px] leading-[15px] text-white/50">{challenge.secondaryLabel}</p>
        )}
      </div>
      {challenge.isUserCompleted ? (
        <button
          className="mt-4 h-11 w-full rounded-xl bg-white/10 border border-white/15 text-white text-[14px] font-bold"
          onClick={() => navigate(detailPath)}
        >
          View Challenge
        </button>
      ) : (
        <button
          className="mt-4 h-11 w-full rounded-xl bg-primary text-white text-[14px] font-bold"
          onClick={() => navigate(logPath)}
        >
          <span className="inline-flex items-center gap-1.5">
            <Plus size={16} />
            {challenge.actionLabel}
          </span>
        </button>
      )}
    </article>
  );
}
