import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { EmptyState } from '../../components/Mobile';
import { useCompletedChallengesForUser } from '../../hooks/useChallenges';
import { computeRequiredLogs } from '../../services/challengeCompletion';

function CompletedChallengesScreen() {
  const navigate = useNavigate();
  const { data: completed = [], isLoading } = useCompletedChallengesForUser(20);

  return (
    <Screen>
      <header className="sticky top-0 z-10 bg-white border-b border-slate-100 flex items-center gap-2 px-4 h-14">
        <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate('/app/profile')}>
          <ArrowLeft size={24} className="text-slate-900" />
        </button>
        <h1 className="st-page-title">Completed Challenges</h1>
      </header>

      <main className="px-4 py-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : completed.length === 0 ? (
          <EmptyState
            icon={<span className="text-3xl">🏆</span>}
            title="No completed challenges yet"
            message="Challenges you finish will appear here."
          />
        ) : (
          <ul className="space-y-3">
            {completed.map(({ challenge, membership }) => {
              const pct = Math.round(membership.completionRate);
              return (
                <li key={challenge.id}>
                  <button
                    className="w-full text-left rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-4"
                    onClick={() => navigate(`/app/challenge/${challenge.id}`)}
                  >
                    {challenge.coverImageUrl ? (
                      <img src={challenge.coverImageUrl} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                        <span className="text-xl">🏆</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{challenge.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {membership.activitiesCompleted} of {computeRequiredLogs(challenge.durationDays, challenge.activities?.length ?? 0)} logs
                        {membership.totalPoints > 0 ? ` • ${membership.totalPoints} pts` : ''}
                      </p>
                      <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="shrink-0">
                      <span className="text-xs font-bold text-green-600">{pct}%</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <BottomNav />
    </Screen>
  );
}

export default CompletedChallengesScreen;
