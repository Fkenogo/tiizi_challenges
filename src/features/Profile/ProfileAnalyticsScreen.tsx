import { ArrowLeft } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { LearnMoreLink } from '../../components/LearnMoreLink';
import { useSupportDonations } from '../../hooks/useDonations';
import { useUserAnalytics } from '../../hooks/useUserAnalytics';

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-[11px] uppercase font-bold tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-1 text-[20px] leading-[24px] font-black text-primary">{value}</p>
    </div>
  );
}

function SectionCard({
  title,
  children,
  onClick,
}: {
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] leading-[18px] font-bold text-slate-500 uppercase tracking-[0.08em]">{title}</h2>
        {onClick && (
          <button className="text-[13px] font-semibold text-primary" onClick={onClick}>
            View
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {children}
      </div>
    </section>
  );
}

function ProfileAnalyticsScreen() {
  const navigate = useNavigate();
  const { data: analytics } = useUserAnalytics();
  const { data: supportDonations = [] } = useSupportDonations();

  const logsThisWeek = (analytics?.fitnessLogsLast7d ?? 0) + (analytics?.wellnessLogsLast7d ?? 0);
  const logsThisMonth = analytics?.totalLogsLast30d ?? 0;
  const totalJoined = analytics?.totalChallengesJoinedCount ?? 0;
  const completed = analytics?.completedChallengesCount ?? 0;
  const ongoingChallenges = analytics?.ongoingChallengesCount ?? 0;

  const donationStats = useMemo(() => {
    const confirmed = supportDonations.filter((d) => d.status === 'confirmed');
    const totalKes = confirmed.reduce((sum, d) => sum + d.amountKes, 0);
    return {
      totalContributions: supportDonations.length,
      confirmedContributions: confirmed.length,
      totalConfirmedKes: totalKes,
    };
  }, [supportDonations]);

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen bg-slate-50 pb-[96px]">
        <header className="px-4 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate('/app/profile/settings')}>
            <ArrowLeft size={22} className="text-slate-900" />
          </button>
          <div className="flex flex-col items-center">
            <h1 className="text-[18px] leading-[22px] font-black text-slate-900">Reports & Analytics</h1>
            <LearnMoreLink section="analytics" />
          </div>
          <span className="w-10" />
        </header>

        <main className="px-4 py-4 space-y-4">
          <SectionCard title="Consistency">
            <StatTile label="Current Streak" value={analytics?.currentStreak ?? 0} />
            <StatTile label="Best Streak" value={analytics?.longestStreak ?? 0} />
            <StatTile label="Logs this week" value={logsThisWeek} />
            <StatTile label="Logs this month" value={logsThisMonth} />
          </SectionCard>

          <SectionCard title="Activity">
            <StatTile label="Fitness logs (30d)" value={analytics?.fitnessLogsLast30d ?? 0} />
            <StatTile label="Wellness logs (30d)" value={analytics?.wellnessLogsLast30d ?? 0} />
            <div className="col-span-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-[11px] uppercase font-bold tracking-[0.1em] text-slate-500">Most logged activity</p>
              <p className="mt-1 text-[16px] leading-[22px] font-black text-primary">
                {analytics?.mostLoggedActivityName ?? '—'}
              </p>
            </div>
          </SectionCard>

          <SectionCard title="Challenges" onClick={() => navigate('/app/challenges')}>
            <StatTile label="Ongoing" value={ongoingChallenges} />
            <StatTile label="Completed" value={completed} />
            <StatTile label="Total joined" value={totalJoined} />
          </SectionCard>

          <SectionCard title="Community" onClick={() => navigate('/app/groups')}>
            <StatTile label="Current Groups" value={analytics?.groupsCount ?? 0} />
            <StatTile label="Total Joined" value={analytics?.totalGroupsJoinedCount ?? 0} />
          </SectionCard>

          <SectionCard title="Donations & Support" onClick={() => navigate('/app/donate?trigger=manual')}>
            <StatTile label="Contributions" value={donationStats.totalContributions} />
            <StatTile label="Confirmed" value={donationStats.confirmedContributions} />
            <div className="col-span-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-[11px] uppercase font-bold tracking-[0.1em] text-slate-500">Total contributed</p>
              <p className="mt-1 text-[20px] leading-[24px] font-black text-primary">
                {donationStats.totalConfirmedKes > 0
                  ? `KES ${donationStats.totalConfirmedKes.toLocaleString()}`
                  : 'Not started yet'}
              </p>
            </div>
          </SectionCard>
        </main>

        <BottomNav active="profile" />
      </div>
    </Screen>
  );
}

export default ProfileAnalyticsScreen;
