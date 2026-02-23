import { useNavigate } from 'react-router-dom';

interface OngoingChallengeCardProps {
  item: {
    id: string;
    name: string;
    participants: string;
    daysLeft: string;
    image: string;
    challengeType: 'collective' | 'competitive' | 'streak';
  };
  groupId?: string;
}

function challengeRoute(item: OngoingChallengeCardProps['item'], groupId?: string) {
  const query = new URLSearchParams({ challengeId: item.id });
  if (groupId) query.set('groupId', groupId);
  return `/app/challenges/${item.challengeType}?${query.toString()}`;
}

const fallbackImage = 'https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?auto=format&fit=crop&w=1000&q=80';

export function OngoingChallengeCard({ item, groupId }: OngoingChallengeCardProps) {
  const navigate = useNavigate();

  return (
    <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-2">
      <div className="flex items-center gap-2">
        <img
          src={item.image}
          alt={item.name}
          className="h-12 w-12 rounded-lg object-cover"
          onError={(event) => {
            event.currentTarget.src = fallbackImage;
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 truncate">{item.name}</p>
          <p className="text-[10px] text-slate-500">👥 {item.participants}</p>
        </div>
        <button
          className="h-9 w-16 rounded-lg bg-primary text-white text-xs font-semibold"
          onClick={() => navigate(challengeRoute(item, groupId))}
        >
          Join
        </button>
      </div>
    </article>
  );
}
