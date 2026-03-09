interface Challenge {
  id: string;
  name: string;
  members: string;
  imageUrl?: string;
  joined: boolean;
  daysLabel: string;
  actionLabel: 'Join' | 'View' | 'Log Workout' | 'Log Activity';
}

interface TrendingChallengesProps {
  challenges: Challenge[];
  onSelectChallenge?: (challengeId: string) => void;
}

export function TrendingChallenges({ challenges, onSelectChallenge }: TrendingChallengesProps) {
  const isValidHttpImage = (value?: string) => !!value && /^https?:\/\//i.test(value);

  return (
    <div className="-mx-4 overflow-x-auto px-4 hide-scrollbar">
      <div className="flex gap-3">
      {challenges.map(challenge => (
        <button key={challenge.id} className="w-[230px] shrink-0 rounded-2xl border border-slate-200 bg-white overflow-hidden text-left" onClick={() => onSelectChallenge?.(challenge.id)}>
          <div className="h-36 relative overflow-hidden bg-slate-200">
            {isValidHttpImage(challenge.imageUrl) ? (
              <img src={challenge.imageUrl} alt={challenge.name} className="h-full w-full object-cover" loading="lazy" decoding="async" />
            ) : (
              <div className="h-full w-full bg-slate-200" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
            <span className="absolute left-3 top-3 rounded-full bg-black/20 px-2.5 py-1 text-[11px] leading-[12px] font-semibold text-white">{challenge.daysLabel}</span>
            <span className="absolute left-3 bottom-3 text-[13px] leading-[16px] font-semibold text-white">👥 {challenge.members} joined</span>
          </div>
          <div className="p-3">
            <p className="text-[16px] leading-[20px] font-black text-slate-900 truncate">{challenge.name}</p>
            <p className="mt-1 text-[12px] leading-[16px] text-slate-500 truncate">
              {challenge.daysLabel === 'Completed'
                ? 'Challenge completed'
                : challenge.joined
                  ? 'You are participating'
                  : 'View details before joining'}
            </p>
            <span className="mt-2 inline-flex h-10 min-w-[104px] items-center justify-center rounded-lg bg-primary px-3 text-[13px] font-bold text-white">
              {challenge.actionLabel}
            </span>
          </div>
        </button>
      ))}
      </div>
    </div>
  );
}
