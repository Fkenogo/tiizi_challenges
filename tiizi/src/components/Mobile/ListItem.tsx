import React from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * ListItem - Mobile list row (most common mobile pattern)
 * 
 * Purpose:
 * - Consistent list item styling across app
 * - Icon + Text + Value/Badge + Chevron pattern
 * - Touch-friendly (48px minimum height for iOS HIG)
 * 
 * @example Settings menu
 * <Card variant="flat">
 *   <ListItem 
 *     icon={<Settings size={18} />} 
 *     title="Account Settings" 
 *     subtitle="Manage your profile"
 *     onClick={() => navigate('/settings')}
 *   />
 *   <ListItem 
 *     icon={<Lock size={18} />} 
 *     title="Privacy" 
 *   />
 * </Card>
 * 
 * @example Leaderboard
 * <Card variant="flat">
 *   <ListItem 
 *     icon={<img src={avatar} className="w-full h-full rounded-full" />}
 *     title="Sarah Jenkins"
 *     subtitle="🔥 12 day streak"
 *     value="12.5k"
 *     badge="🥇"
 *   />
 * </Card>
 * 
 * @example Exercise list
 * <ListItem
 *   icon={<span className="material-symbols-outlined">fitness_center</span>}
 *   title="Push-Ups"
 *   subtitle="Upper Body • Strength"
 *   badge="reps"
 *   onClick={() => navigate(`/exercises/push-ups`)}
 * />
 */
interface ListItemProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  value?: string | number;
  badge?: string;
  chevron?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ListItem({ 
  icon, 
  title, 
  subtitle, 
  value, 
  badge, 
  chevron = true,
  onClick,
  className = ''
}: ListItemProps) {
  return (
    <div 
      className={`
        flex items-center gap-3 py-3 px-4 
        border-b border-slate-100 last:border-0 
        min-h-[48px]
        ${onClick ? 'active:bg-slate-50 cursor-pointer' : ''} 
        ${className}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {/* Icon */}
      {icon && (
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
          {icon}
        </div>
      )}
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 truncate">{title}</p>
        {subtitle && (
          <p className="text-xs text-slate-500 truncate mt-0.5">{subtitle}</p>
        )}
      </div>
      
      {/* Right Side */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {badge && (
          <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-full">
            {badge}
          </span>
        )}
        {value !== undefined && (
          <span className="text-sm font-bold text-slate-900">
            {value}
          </span>
        )}
        {chevron && onClick && (
          <ChevronRight size={16} className="text-slate-400" />
        )}
      </div>
    </div>
  );
}
