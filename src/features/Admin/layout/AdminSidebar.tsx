import { BarChart3, BellRing, BookOpen, CircleDollarSign, Dumbbell, LayoutDashboard, Settings, ShieldCheck, Trophy, Users, UsersRound, LucideIcon, FileText } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { AdminPermissions } from '../../../services/adminAccessService';
import { AdminDensity } from '../../../hooks/useAdminDensity';

type NavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  visible: (permissions: AdminPermissions) => boolean;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    label: 'Dashboard',
    items: [{ label: 'Overview', path: '/app/admin/dashboard', icon: LayoutDashboard, visible: (p) => p.canAccessAdmin }],
  },
  {
    label: 'Content',
    items: [
      { label: 'Challenges', path: '/app/admin/challenges/pending', icon: Trophy, visible: (p) => p.canModerateChallenges },
      { label: 'Templates', path: '/app/admin/challenges/templates', icon: Trophy, visible: (p) => p.canModerateChallenges },
      { label: 'Active Challenges', path: '/app/admin/challenges/active', icon: Trophy, visible: (p) => p.canModerateChallenges },
      { label: 'Exercises', path: '/app/admin/exercises', icon: Dumbbell, visible: (p) => p.canManageExercises },
      { label: 'Books', path: '/app/admin/content/books', icon: BookOpen, visible: (p) => p.canManageContent },
      { label: 'Interests & Goals', path: '/app/admin/content/interests-goals', icon: FileText, visible: (p) => p.canManageContent },
      { label: 'Notifications', path: '/app/admin/content/notifications', icon: BellRing, visible: (p) => p.canManageNotifications },
    ],
  },
  {
    label: 'Manage',
    items: [
      { label: 'Users', path: '/app/admin/users', icon: Users, visible: (p) => p.canManageUsers },
      { label: 'Support Tickets', path: '/app/admin/users/support-tickets', icon: BellRing, visible: (p) => p.canManageUsers },
      { label: 'Groups', path: '/app/admin/groups', icon: UsersRound, visible: (p) => p.canManageGroups },
      { label: 'Group Moderation', path: '/app/admin/groups/moderation', icon: UsersRound, visible: (p) => p.canModerateGroups },
      { label: 'Donations', path: '/app/admin/donations/campaigns', icon: CircleDollarSign, visible: (p) => p.canManageDonations },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { label: 'Overview', path: '/app/admin/analytics', icon: BarChart3, visible: (p) => p.canViewAnalytics },
      { label: 'User Growth', path: '/app/admin/analytics/user-growth', icon: BarChart3, visible: (p) => p.canViewUserGrowthAnalytics },
      { label: 'Engagement', path: '/app/admin/analytics/engagement', icon: BarChart3, visible: (p) => p.canViewEngagementAnalytics },
      { label: 'Revenue', path: '/app/admin/analytics/revenue', icon: BarChart3, visible: (p) => p.canViewRevenueAnalytics },
    ],
  },
  {
    label: 'Settings',
    items: [{ label: 'System Settings', path: '/app/admin/settings', icon: Settings, visible: (p) => p.canManageSettings }],
  },
];

export function AdminSidebar({ permissions, density }: { permissions: AdminPermissions; density: AdminDensity }) {
  const location = useLocation();
  const visibleSections = navSections
    .map((section) => ({ ...section, items: section.items.filter((item) => item.visible(permissions)) }))
    .filter((section) => section.items.length > 0);

  return (
    <aside className={`admin-sidebar ${density === 'compact' ? 'w-64' : 'w-72'} border-r border-slate-800 bg-slate-950 text-white min-h-[100dvh] p-4 sticky top-0 overflow-y-auto`}>
      <div className="h-12 px-2 flex items-center gap-2 border-b border-slate-800 mb-4">
        <ShieldCheck size={18} className="text-primary" />
        <span className="text-base font-black tracking-wide">Tiizi Admin</span>
      </div>
      <nav className="space-y-4">
        {visibleSections.map((section) => (
          <div key={section.label}>
            <p className="px-2 mb-2 text-[11px] uppercase tracking-wider font-bold text-slate-400">{section.label}</p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`h-10 px-3 rounded-lg flex items-center gap-2 text-sm font-bold ${
                      active ? 'bg-primary text-white' : 'text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
