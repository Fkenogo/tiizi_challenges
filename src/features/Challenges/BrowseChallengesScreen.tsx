import { ArrowLeft, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BottomNav, Screen } from '../../components/Layout';
import { LoadingSpinner } from '../../components/Layout/LoadingSpinner';
import { challengeService } from '../../services/challengeService';
import { useAuth } from '../../hooks/useAuth';
import { useGroups } from '../../hooks/useGroups';

const isValidHttpImage = (value?: string) => !!value && /^https?:\/\//i.test(value);
const localDateKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

function BrowseChallengesScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const { data: allChallenges = [], isLoading: isLoadingChallenges } = useQuery({
    queryKey: ['all-challenges-catalog', user?.uid],
    enabled: !!user?.uid,
    queryFn: () => challengeService.getVisibleChallengesForUser(String(user?.uid), { statuses: ['active', 'completed'] }),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const { data: groups = [], isLoading: isLoadingGroups } = useGroups();

  const publicBrowseChallenges = useMemo(() => {
    const groupIndex = new Map(groups.map((group) => [group.id, group]));
    return allChallenges
      .filter((challenge) => {
        const challengeGroup = groupIndex.get(challenge.groupId);
        return !!challengeGroup && !challengeGroup.isPrivate;
      })
      .filter((challenge) => {
        const term = search.trim().toLowerCase();
        if (!term) return true;
        return (
          challenge.name.toLowerCase().includes(term)
          || challenge.description.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
  }, [allChallenges, groups, search]);

  if (isLoadingChallenges || isLoadingGroups) {
    return <LoadingSpinner fullScreen label="Loading public challenges..." />;
  }

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen bg-slate-50 pb-[96px]">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate('/app/challenges')}>
              <ArrowLeft size={24} className="text-slate-900" />
            </button>
            <h1 className="st-page-title">Browse Challenges</h1>
          </div>
        </header>

        <main className="px-4">
          <div className="mt-2 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search public challenges..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm"
            />
          </div>

          <p className="mt-3 text-xs text-slate-500">
            You can view public challenge details. To participate, join the challenge’s group first.
          </p>

          <section className="mt-3 space-y-3">
            {publicBrowseChallenges.map((item) => {
              const start = new Date(item.startDate);
              const end = new Date(item.endDate);
              const now = new Date();
              const hasStarted = localDateKey(now) >= localDateKey(start);
              const msPerDay = 1000 * 60 * 60 * 24;
              const days = hasStarted
                ? Math.max(0, Math.ceil((end.getTime() - now.getTime()) / msPerDay))
                : Math.max(0, Math.ceil((start.getTime() - now.getTime()) / msPerDay));
              const daysLabel = hasStarted ? `${days} Days Left` : `Starts in ${days} Days`;

              return (
                <article key={item.id} className="rounded-[18px] border border-slate-200 bg-white p-3 overflow-hidden">
                  <div className="flex items-center gap-3">
                    <button
                      className="min-w-0 flex flex-1 items-center gap-3 text-left"
                      onClick={() => navigate(`/app/challenge/${item.id}`)}
                    >
                      {isValidHttpImage(item.coverImageUrl) ? (
                        <img
                          src={item.coverImageUrl}
                          alt={item.name}
                          className="h-[76px] w-[76px] rounded-[12px] object-cover flex-shrink-0"
                          style={{ minWidth: 76, minHeight: 76 }}
                        />
                      ) : (
                        <div
                          className="h-[76px] w-[76px] rounded-[12px] border border-slate-200 bg-slate-100 text-[10px] text-slate-500 flex items-center justify-center flex-shrink-0"
                          style={{ minWidth: 76, minHeight: 76 }}
                        >
                          No image
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] leading-[18px] font-black text-slate-900">{item.name || 'Challenge'}</p>
                        <p className="mt-1 truncate text-[11px] leading-[15px] text-[#61758f]">👥 {(item.participantCount ?? 0).toLocaleString()} Participants</p>
                        <p className="mt-1 text-[12px] leading-[15px] text-primary font-semibold">{daysLabel}</p>
                      </div>
                    </button>
                    <button
                      className="h-10 min-w-[86px] rounded-xl bg-primary px-0 text-white text-[14px] font-bold flex-shrink-0"
                      onClick={() => navigate(`/app/challenge/${item.id}`)}
                    >
                      View
                    </button>
                  </div>
                </article>
              );
            })}
          </section>

          {publicBrowseChallenges.length === 0 && (
            <article className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
              No public challenges available right now.
            </article>
          )}
        </main>

        <BottomNav active="challenges" />
      </div>
    </Screen>
  );
}

export default BrowseChallengesScreen;
