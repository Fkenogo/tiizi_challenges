import { ArrowLeft, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BottomNav, Screen } from '../../components/Layout';
import { LoadingSpinner } from '../../components/Layout/LoadingSpinner';
import { challengeService } from '../../services/challengeService';
import { useAuth } from '../../hooks/useAuth';
import { useGroup } from '../../hooks/useGroups';
import { isChallengeOngoing, isChallengeUpcoming, isChallengeCompletedOrExpired } from '../../utils/challengeLifecycle';

const isValidHttpImage = (value?: string) => !!value && /^https?:\/\//i.test(value);

type StatusFilter = 'ongoing' | 'upcoming' | 'completed';
type CategoryFilter = 'all' | 'wellness' | 'fitness';
type TypeFilter = 'all' | 'streak' | 'competitive' | 'collective';

const STATUS_OPTIONS: StatusFilter[] = ['ongoing', 'upcoming', 'completed'];
const STATUS_LABELS: Record<StatusFilter, string> = { ongoing: 'Ongoing', upcoming: 'Upcoming', completed: 'Completed' };
const CATEGORY_OPTIONS: CategoryFilter[] = ['all', 'wellness', 'fitness'];
const CATEGORY_LABELS: Record<CategoryFilter, string> = { all: 'All Categories', wellness: 'Wellness', fitness: 'Fitness' };
const TYPE_OPTIONS: TypeFilter[] = ['all', 'streak', 'competitive', 'collective'];
const TYPE_LABELS: Record<TypeFilter, string> = { all: 'All Types', streak: 'Streak', competitive: 'Competitive', collective: 'Collective' };

function ChipRow<T extends string>({
  options,
  labels,
  value,
  onChange,
}: {
  options: T[];
  labels: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={
            value === o
              ? 'h-8 shrink-0 px-3 rounded-full text-xs font-semibold bg-primary text-white'
              : 'h-8 shrink-0 px-3 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-600'
          }
        >
          {labels[o]}
        </button>
      ))}
    </div>
  );
}

function BrowseChallengesScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('groupId') ?? '';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ongoing');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const { data: group } = useGroup(groupId || undefined);

  const { data: groupChallenges = [], isLoading: isLoadingGroup, isError: isErrorGroup } = useQuery({
    queryKey: ['group-challenges-browse', groupId],
    enabled: !!user?.uid && !!groupId,
    queryFn: () => challengeService.getChallengesByGroup(groupId),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: allChallenges = [], isLoading: isLoadingAll, isError: isErrorAll } = useQuery({
    queryKey: ['browse-my-groups-challenges', user?.uid],
    enabled: !!user?.uid && !groupId,
    queryFn: () => challengeService.getChallengesForMyGroups(String(user!.uid)),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const baseChallenges = groupId ? groupChallenges : allChallenges;
  const isLoading = groupId ? isLoadingGroup : isLoadingAll;
  const isError = groupId ? isErrorGroup : isErrorAll;

  const now = Date.now();

  const filtered = useMemo(() => {
    return baseChallenges
      .filter((c) => {
        if (statusFilter === 'ongoing') return isChallengeOngoing(c, now);
        if (statusFilter === 'upcoming') return isChallengeUpcoming(c, now);
        if (statusFilter === 'completed') return isChallengeCompletedOrExpired(c, now);
        return true;
      })
      .filter((c) => {
        if (categoryFilter === 'wellness') return !!c.category && c.category !== 'fitness';
        if (categoryFilter === 'fitness') return !c.category || c.category === 'fitness';
        return true;
      })
      .filter((c) => {
        if (typeFilter !== 'all') return (c.challengeType ?? '') === typeFilter;
        return true;
      })
      .filter((c) => {
        const term = search.trim().toLowerCase();
        if (!term) return true;
        return (
          (c.name ?? '').toLowerCase().includes(term) ||
          (c.description ?? '').toLowerCase().includes(term)
        );
      })
      .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
  }, [baseChallenges, search, statusFilter, categoryFilter, typeFilter, now]);

  if (isLoading) {
    return <LoadingSpinner fullScreen label="Loading challenges..." />;
  }

  const title = group ? `${group.name} Challenges` : 'Browse Challenges';

  const emptyMessage = (() => {
    if (isError) return 'Could not load challenges. Check your connection and try again.';
    if (search.trim()) return `No challenges match "${search.trim()}".`;
    if (statusFilter === 'ongoing') return groupId ? 'No ongoing challenges in this group.' : 'No ongoing challenges right now.';
    if (statusFilter === 'upcoming') return groupId ? 'No upcoming challenges in this group.' : 'No upcoming challenges.';
    if (statusFilter === 'completed') return groupId ? 'No completed challenges in this group.' : 'No completed challenges.';
    if (categoryFilter !== 'all' || typeFilter !== 'all') return 'No challenges match the selected filters.';
    return 'No challenges available right now.';
  })();

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen bg-slate-50 pb-[96px]">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <button
              className="h-10 w-10 flex items-center justify-center"
              onClick={() => (groupId ? navigate(`/app/group/${groupId}`) : navigate('/app/challenges'))}
            >
              <ArrowLeft size={24} className="text-slate-900" />
            </button>
            <h1 className="st-page-title">{title}</h1>
          </div>
        </header>

        <main className="px-4 pb-4">
          <div className="mt-3 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search challenges..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm"
            />
          </div>

          <div className="mt-3 space-y-2">
            <ChipRow
              options={STATUS_OPTIONS}
              labels={STATUS_LABELS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            {!groupId && (
              <>
                <ChipRow
                  options={CATEGORY_OPTIONS}
                  labels={CATEGORY_LABELS}
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                />
                <ChipRow
                  options={TYPE_OPTIONS}
                  labels={TYPE_LABELS}
                  value={typeFilter}
                  onChange={setTypeFilter}
                />
              </>
            )}
          </div>

          <section className="mt-3 space-y-3">
            {filtered.map((item) => {
              const start = new Date(item.startDate);
              const end = new Date(item.endDate);
              const nowDate = new Date();
              const hasStarted = nowDate >= start;
              const msPerDay = 1000 * 60 * 60 * 24;
              const isCompleted = isChallengeCompletedOrExpired(item, now);
              const days = hasStarted
                ? Math.max(0, Math.ceil((end.getTime() - nowDate.getTime()) / msPerDay))
                : Math.max(0, Math.ceil((start.getTime() - nowDate.getTime()) / msPerDay));
              const daysLabel = isCompleted
                ? 'Ended'
                : hasStarted
                  ? `${days} Days Left`
                  : `Starts in ${days} Days`;

              return (
                <article key={item.id} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3">
                    <button
                      className="min-w-0 flex flex-1 items-center gap-3 text-left"
                      onClick={() => navigate(`/app/challenge/${item.id}${groupId ? `?groupId=${groupId}` : ''}`)}
                    >
                      {isValidHttpImage(item.coverImageUrl) ? (
                        <img
                          src={item.coverImageUrl}
                          alt={item.name}
                          className="h-[76px] w-[76px] rounded-xl object-cover flex-shrink-0"
                          style={{ minWidth: 76, minHeight: 76 }}
                        />
                      ) : (
                        <div
                          className="h-[76px] w-[76px] rounded-xl border border-slate-200 bg-slate-100 text-[10px] text-slate-500 flex items-center justify-center flex-shrink-0"
                          style={{ minWidth: 76, minHeight: 76 }}
                        >
                          No image
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] leading-[18px] font-black text-slate-900">{item.name || 'Challenge'}</p>
                        <p className="mt-0.5 text-[11px] leading-[15px] text-[#61758f] capitalize">{item.challengeType || 'challenge'}</p>
                        <p className="mt-0.5 text-[11px] leading-[15px] text-[#61758f]">
                          {(item.participantCount ?? 0).toLocaleString()} Participants
                        </p>
                        <p className={`mt-0.5 text-[12px] leading-[15px] font-semibold ${isCompleted ? 'text-slate-400' : 'text-primary'}`}>{daysLabel}</p>
                      </div>
                    </button>
                    <button
                      className="h-10 min-w-[64px] rounded-xl bg-primary px-3 text-white text-[13px] font-bold flex-shrink-0"
                      onClick={() => navigate(`/app/challenge/${item.id}${groupId ? `?groupId=${groupId}` : ''}`)}
                    >
                      View
                    </button>
                  </div>
                </article>
              );
            })}
          </section>

          {filtered.length === 0 && (
            <article className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
              {emptyMessage}
            </article>
          )}
        </main>

        <BottomNav active="challenges" />
      </div>
    </Screen>
  );
}

export default BrowseChallengesScreen;
