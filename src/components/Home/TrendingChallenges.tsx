interface Challenge {
  id: string;
  name: string;
  members: string;
  gradient: string;
}

interface TrendingChallengesProps {
  challenges: Challenge[];
  onSelectChallenge?: (challengeId: string) => void;
}

export function TrendingChallenges({ challenges, onSelectChallenge }: TrendingChallengesProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {challenges.map(challenge => (
        <button key={challenge.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden text-left" onClick={() => onSelectChallenge?.(challenge.id)}>
          <div className={`h-40 bg-gradient-to-br ${challenge.gradient} relative`}>
            <span className="absolute left-3 bottom-3 text-[13px] leading-[16px] font-semibold text-white">👥 {challenge.members} joined</span>
          </div>
          <div className="p-3">
            <p className="text-[16px] leading-[20px] font-black text-slate-900 truncate">{challenge.name}</p>
            <p className="mt-1 text-[14px] leading-[18px] text-slate-500 truncate">Consistency is key to life.</p>
          </div>
        </button>
      ))}
    </div>
  );
}
