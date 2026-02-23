import { ArrowRight, Route } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Screen, Section } from '../../components/Layout';
import { Card } from '../../components/Mobile';
import { useAuth } from '../../hooks/useAuth';
import { useAdminAccess } from '../../hooks/useAdminAccess';

const flows = [
  { title: 'Welcome Flow', subtitle: 'Onboarding welcome native screen', path: '/app/welcome' },
  { title: 'Auth Flow', subtitle: 'Login -> Signup -> Home', path: '/app/login' },
  { title: 'Exercise Flow', subtitle: 'Library -> Detail -> Start', path: '/app/exercises' },
  { title: 'Group Flow', subtitle: 'Groups -> Group Detail -> Join/Create', path: '/app/groups' },
  { title: 'Group Highlights', subtitle: 'Group challenge highlighted native flow', path: '/app/groups' },
  { title: 'Challenge Flow', subtitle: 'Challenges -> Detail -> Create', path: '/app/challenges' },
  { title: 'Suggested Challenges', subtitle: 'Challenges -> suggested native route', path: '/app/challenges/suggested' },
  { title: 'Challenge Preview', subtitle: 'Challenges -> preview native route', path: '/app/challenges/preview' },
  { title: 'Competitive Challenge', subtitle: 'Competitive challenge native route', path: '/app/challenges/competitive' },
  { title: 'Collective Challenge', subtitle: 'Collective challenge native route', path: '/app/challenges/collective' },
  { title: 'Streak Challenge', subtitle: 'Streak challenge native route', path: '/app/challenges/streak' },
  { title: 'Profile Flow', subtitle: 'Profile -> Settings -> Logout', path: '/app/profile' },
  { title: 'Profile Setup', subtitle: 'Completion / interests / privacy native screens', path: '/app/profile/completion' },
  { title: 'Personal Info', subtitle: 'Profile personal information screen', path: '/app/profile/personal-info' },
  { title: 'Group Deep Flow', subtitle: 'Group feed / members / leaderboard native routes', path: '/app/groups' },
  { title: 'Notifications', subtitle: 'Home bell -> native notifications', path: '/app/notifications' },
  { title: 'Support Flow', subtitle: 'Profile donation -> native donate screen', path: '/app/donate' },
  { title: 'Share Flow', subtitle: 'Challenge card -> native share', path: '/app/share' },
  { title: 'Admin Flow', subtitle: 'Dashboard -> Moderation -> Approved routes', path: '/app/admin/dashboard' },
  { title: 'Quick Actions', subtitle: 'Central actions and missing links', path: '/app/quick-actions' },
];

function FlowHubScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdminAccess(user?.uid);
  const visibleFlows = isAdmin ? flows : flows.filter((flow) => flow.title !== 'Admin Flow');

  return (
    <Screen>
      <Section title="User Flows" spacing="normal">
        {visibleFlows.map((flow) => (
          <Card key={flow.title} interactive onClick={() => navigate(flow.path)}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Route size={18} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900">{flow.title}</p>
                <p className="text-xs text-slate-500">{flow.subtitle}</p>
              </div>
              <ArrowRight size={16} className="text-slate-400" />
            </div>
          </Card>
        ))}
      </Section>
    </Screen>
  );
}

export default FlowHubScreen;
