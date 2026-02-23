import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ActiveChallengeCardProps {
  challenge: {
    id: string;
    name: string;
    season: string;
    level: string;
    progress: number;
    day: number;
    totalDays: number;
    groupId?: string;
    challengeType: 'collective' | 'competitive' | 'streak';
  };
}

export function ActiveChallengeCard({ challenge }: ActiveChallengeCardProps) {
  const navigate = useNavigate();
  const query = new URLSearchParams({ challengeId: challenge.id });
  if (challenge.groupId) query.set('groupId', challenge.groupId);

  return (
    <article className="rounded-[20px] border border-[#0c1f3e] bg-gradient-to-r from-[#0b1a3d] to-[#2f3d41] p-5 text-white shadow-[0_8px_18px_rgba(15,23,42,0.2)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[17px] leading-[22px] font-black tracking-[-0.01em]">{challenge.name}</p>
          <p className="mt-1 text-[14px] leading-[18px] text-white/70">{challenge.season} • {challenge.level}</p>
        </div>
        <p className="text-[14px] leading-[18px] text-white/70 whitespace-nowrap">Day {challenge.day} of {challenge.totalDays}</p>
      </div>
      <div className="mt-3">
        <p className="text-[15px] leading-[20px] font-bold text-primary">{challenge.progress}% Complete</p>
        <div className="mt-2 h-[14px] rounded-full bg-[#33435c] overflow-hidden p-[2px]">
          <div className="h-full rounded-full bg-primary" style={{ width: `${challenge.progress}%` }} />
        </div>
      </div>
      <button
        className="mt-5 h-[56px] w-full rounded-[16px] bg-primary text-white text-[16px] leading-[20px] font-black"
        onClick={() => navigate(`/app/challenges/${challenge.challengeType}?${query.toString()}`)}
      >
        <span className="inline-flex items-center gap-1">
          <Plus size={18} />
          Log Workout
        </span>
      </button>
    </article>
  );
}
