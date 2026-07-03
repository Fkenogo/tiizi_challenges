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
    <article className="rounded-[20px] border border-[#0c1f3e] bg-gradient-to-r from-[#0b1a3d] to-[#2f3d41] p-5 text-white shadow-[0_8px_18px_rgba(15,23,42,0.2)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[17px] leading-[22px] font-black tracking-[-0.01em]">{challenge.name}</p>
          <p className="mt-1 text-[14px] leading-[18px] text-white/70">{challenge.season} • {challenge.level}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {challenge.isUserCompleted && (
            <span className="flex items-center gap-1 rounded-full bg-primary/20 border border-primary/40 px-2.5 py-1 text-[11px] font-bold text-primary">
              <CheckCircle size={11} />
              Done
            </span>
          )}
          <p className="text-[14px] leading-[18px] text-white/70 whitespace-nowrap">Day {challenge.day} of {challenge.totalDays}</p>
        </div>
      </div>
      <div className="mt-3">
        <p className="text-[15px] leading-[20px] font-bold text-primary">{challenge.progressLabel}</p>
        <div className="mt-2 h-[14px] rounded-full bg-[#33435c] overflow-hidden p-[2px]">
          <div className="h-full rounded-full bg-primary" style={{ width: `${challenge.progress}%` }} />
        </div>
        {challenge.secondaryLabel && (
          <p className="mt-1.5 text-[12px] leading-[16px] text-white/60">{challenge.secondaryLabel}</p>
        )}
      </div>
      {challenge.isUserCompleted ? (
        <button
          className="mt-5 h-[56px] w-full rounded-[16px] bg-white/10 border border-white/20 text-white text-[16px] leading-[20px] font-black"
          onClick={() => navigate(detailPath)}
        >
          View Challenge
        </button>
      ) : (
        <button
          className="mt-5 h-[56px] w-full rounded-[16px] bg-primary text-white text-[16px] leading-[20px] font-black"
          onClick={() => navigate(logPath)}
        >
          <span className="inline-flex items-center gap-1">
            <Plus size={18} />
            {challenge.actionLabel}
          </span>
        </button>
      )}
    </article>
  );
}
