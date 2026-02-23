import { useNavigate } from 'react-router-dom';

type Props = {
  groupId: string;
  active: 'feed' | 'challenges' | 'members' | 'leaderboard';
};

const tabs: Array<{ key: Props['active']; label: string; path: (groupId: string) => string }> = [
  { key: 'feed', label: 'Feed', path: (groupId) => `/app/group/${groupId}/feed` },
  { key: 'challenges', label: 'Challenges', path: (groupId) => `/app/group/${groupId}` },
  { key: 'members', label: 'Members', path: (groupId) => `/app/group/${groupId}/members` },
  { key: 'leaderboard', label: 'Leaderboard', path: (groupId) => `/app/group/${groupId}/leaderboard` },
];

export function GroupDetailTabs({ groupId, active }: Props) {
  const navigate = useNavigate();

  return (
    <div className="border-y border-slate-200 bg-white px-4">
      <div className="mx-auto max-w-mobile">
        <div className="grid grid-cols-4 items-stretch">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`h-14 w-full min-w-0 border-b-[3px] px-1 text-center text-[12px] leading-[16px] font-semibold whitespace-nowrap ${
                active === tab.key ? 'text-primary border-primary' : 'text-slate-500 border-transparent'
              }`}
              onClick={() => navigate(tab.path(groupId))}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
