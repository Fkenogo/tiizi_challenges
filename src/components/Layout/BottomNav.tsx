import type { ReactNode } from 'react';
import { Home, Plus, Trophy, User, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type NavItem = 'home' | 'groups' | 'challenges' | 'profile';

type Props = {
  active?: NavItem;
};

function NavItem({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`h-9 min-w-[56px] flex flex-col items-center justify-center transition-colors ${
        active ? 'text-primary' : 'text-slate-400'
      }`}
      onClick={onClick}
    >
      {icon}
      <span
        className={`text-[9px] leading-none mt-0.5 ${
          active ? 'font-semibold' : 'font-medium'
        }`}
      >
        {label}
      </span>
    </button>
  );
}

/**
 * BottomNav - Shared mobile bottom navigation component
 * 
 * Usage:
 * <BottomNav active="home" />
 * 
 * Routes:
 * - home: /app/home
 * - groups: /app/groups
 * - challenges: /app/challenges
 * - profile: /app/profile
 * - FAB (center): /app/quick-actions
 */
export function BottomNav({ active }: Props) {
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-mobile -translate-x-1/2 bg-white border-t border-slate-200 px-3 py-2">
      <div className="mx-auto max-w-mobile flex items-end justify-between">
        <NavItem
          label="Home"
          icon={<Home size={18} />}
          active={active === 'home'}
          onClick={() => navigate('/app/home')}
        />
        <NavItem
          label="Groups"
          icon={<Users size={18} />}
          active={active === 'groups'}
          onClick={() => navigate('/app/groups')}
        />
        <div className="-mt-6">
          <button
            className="h-14 w-14 rounded-full bg-primary text-white shadow-lg border-4 border-white flex items-center justify-center transition-transform active:scale-95"
            onClick={() => navigate('/app/quick-actions')}
          >
            <Plus size={28} />
          </button>
        </div>
        <NavItem
          label="Challenges"
          icon={<Trophy size={18} />}
          active={active === 'challenges'}
          onClick={() => navigate('/app/challenges')}
        />
        <NavItem
          label="Profile"
          icon={<User size={18} />}
          active={active === 'profile'}
          onClick={() => navigate('/app/profile')}
        />
      </div>
    </nav>
  );
}
