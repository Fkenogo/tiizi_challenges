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
      <div className="flex gap-3 pb-1">
        {challenges.map(challenge => (
          <button key={challenge.id} className="w-[220px] shrink-0 rounded-2xl border border-slate-100 bg-white overflow-hidden text-left shadow-sm" onClick={() => onSelectChallenge?.(challenge.id)}>
            <div className="h-[120px] relative overflow-hidden bg-slate-200">
              {isValidHttpImage(challenge.imageUrl) ? (
                <img src={challenge.imageUrl} alt={challenge.name} className="h-full w-full object-cover" loading="lazy" decoding="async" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-slate-200 to-slate-300" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <span className="absolute left-2.5 top-2.5 rounded-full bg-black/25 backdrop-blur-sm px-2 py-0.5 text-[10px] leading-[14px] font-semibold text-white">{challenge.daysLabel}</span>
              <span className="absolute left-2.5 bottom-2.5 text-[11px] leading-[14px] font-medium text-white/90">👥 {challenge.members}</span>
            </div>
            <div className="p-3">
              <p className="text-[14px] leading-[19px] font-black text-slate-900 truncate">{challenge.name}</p>
              <p className="mt-0.5 text-[11px] leading-[15px] text-slate-400 truncate">
                {challenge.joined ? 'Participating' : 'Tap to view details'}
              </p>
              <span className="mt-2.5 inline-flex h-8 min-w-[88px] items-center justify-center rounded-lg bg-primary px-3 text-[12px] font-bold text-white">
                {challenge.actionLabel}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
