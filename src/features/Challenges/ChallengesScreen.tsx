import { Search } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Screen, BottomNav } from '../../components/Layout';
import { useChallenges } from '../../hooks/useChallenges';
import { useChallengeTemplates } from '../../hooks/useChallengeTemplates';
import { LoadingSpinner } from '../../components/Layout/LoadingSpinner';
import { useQuery } from '@tanstack/react-query';
import { workoutService } from '../../services/workoutService';

type ChallengeCardType = 'collective' | 'competitive' | 'streak';

const isValidHttpImage = (value?: string) => !!value && /^https?:\/\//i.test(value);

function ChallengesScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const groupId = params.get('groupId') ?? undefined;
  const { data: challengeData = [], isLoading: isLoadingChallenges } = useChallenges();
  const { data: templateData = [], isLoading: isLoadingTemplates } = useChallengeTemplates();
  const visibleChallenges = useMemo(
    () => challengeData.filter((challenge) => challenge.status === 'active' && (!groupId || challenge.groupId === groupId)),
    [challengeData, groupId],
  );

  const { data: challengeStats = new Map<string, number>() } = useQuery({
    queryKey: ['challenge-participant-stats', visibleChallenges.map((c) => c.id).join(',')],
    enabled: visibleChallenges.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        visibleChallenges.map(async (challenge) => {
          const workouts = await workoutService.getWorkoutsByChallenge(challenge.id).catch(() => []);
          return [challenge.id, new Set(workouts.map((workout) => workout.userId)).size] as const;
        }),
      );
      return new Map<string, number>(entries);
    },
    staleTime: 30 * 1000,
  });

  const ongoingCards = useMemo(() => {
    return visibleChallenges
      .slice(0, 3)
      .map((item) => {
        const end = new Date(item.endDate);
        const now = new Date();
        const days = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        return {
          id: item.id,
          name: item.name,
          participants: challengeStats.get(item.id) ?? 0,
          daysLeft: `${days} Days Left`,
          image: isValidHttpImage(item.coverImageUrl)
            ? item.coverImageUrl!
            : 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1000&q=80',
          challengeType: (item.challengeType ?? 'collective') as ChallengeCardType,
        };
      });
  }, [visibleChallenges, challengeStats]);
  const querySuffix = groupId ? `?groupId=${groupId}` : '';

  if (isLoadingChallenges || isLoadingTemplates) {
    return <LoadingSpinner fullScreen label="Loading Challenges..." />;
  }

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen bg-slate-50 pb-[96px]">
        <header className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between">
            <h1 className="st-page-title">Challenges</h1>
            <button
              className="h-11 w-11 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center"
              onClick={() => navigate(`/app/challenges/suggested${querySuffix}`)}
            >
              <Search size={22} />
            </button>
          </div>
        </header>

        <main className="px-4">
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="st-section-title">Suggested Templates</h2>
              <button
                className="text-[14px] leading-[18px] font-semibold text-primary"
                onClick={() => navigate(`/app/challenges/suggested${querySuffix}`)}
              >
                View All
              </button>
            </div>

            <div className="mt-3 -mx-4 overflow-x-auto px-4 hide-scrollbar">
              <div className="flex gap-3">
                {templateData.slice(0, 6).map((item) => {
                  const challengeTypeLabel =
                    item.challengeType === 'competitive'
                      ? 'Advanced'
                      : item.challengeType === 'streak'
                        ? 'Beginner'
                        : 'Intermediate';
                  return (
                  <article key={item.id} className="w-[270px] shrink-0 rounded-[18px] border border-slate-200 bg-white overflow-hidden">
                      <div className="relative" style={{ height: 210, minHeight: 210, maxHeight: 210 }}>
                        <img
                          src={
                            isValidHttpImage(item.coverImageUrl)
                              ? item.coverImageUrl!
                              :
                            'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1000&q=80'
                          }
                          alt={item.name}
                          className="h-full w-full object-cover"
                          style={{ display: 'block' }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/15 to-transparent" />
                        <span className="absolute left-3 top-3 rounded-lg border border-primary/50 bg-primary/15 px-3 py-1 text-[11px] leading-[11px] tracking-[0.08em] font-bold uppercase text-primary">
                          {challengeTypeLabel}
                        </span>
                        <div className="absolute inset-x-3 bottom-3">
                          <p className="text-[16px] leading-[20px] font-black text-white">{item.name}</p>
                          <button
                            className="mt-2 h-11 w-full rounded-xl border border-white/40 bg-white/10 text-white text-[14px] font-semibold"
                            onClick={() =>
                              navigate(
                                `/app/challenges/suggested?previewTemplateId=${item.id}${
                                  groupId ? `&groupId=${groupId}` : ''
                                }`,
                              )
                            }
                          >
                            Preview Template
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
            {templateData.length === 0 && (
              <article className="mt-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
                No suggested templates published yet.
              </article>
            )}
          </section>

          <section className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="st-section-title">Ongoing Challenges</h2>
              <button
                className="text-[14px] leading-[18px] font-semibold text-primary"
                onClick={() => navigate(`/app/challenges/suggested${querySuffix}`)}
              >
                View All
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {ongoingCards.slice(0, 3).map((item) => {
                const query = new URLSearchParams({ challengeId: item.id });
                if (groupId) query.set('groupId', groupId);
                return (
                  <article key={item.id} className="rounded-[18px] border border-slate-200 bg-white p-3 overflow-hidden">
                    <div className="flex items-center gap-3">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-[76px] w-[76px] rounded-[12px] object-cover flex-shrink-0"
                        style={{ minWidth: 76, minHeight: 76 }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] leading-[18px] font-black text-slate-900">{item.name || 'Challenge'}</p>
                        <p className="mt-1 truncate text-[11px] leading-[15px] text-[#61758f]">👥 {item.participants.toLocaleString()} Participants</p>
                        <p className="mt-1 text-[12px] leading-[15px] text-primary font-semibold">{item.daysLeft}</p>
                      </div>
                      <button
                        className="h-10 min-w-[86px] rounded-xl bg-primary px-0 text-white text-[14px] font-bold flex-shrink-0"
                        onClick={() => navigate(`/app/challenges/${item.challengeType}?${query.toString()}`)}
                      >
                        Join
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            {ongoingCards.length === 0 && (
              <article className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
                No active challenges for your group yet.
              </article>
            )}
          </section>

          <section className="mt-5">
            <button className="w-full rounded-[18px] bg-primary px-4 py-4 text-white text-center" onClick={() => navigate('/app/exercises')}>
              <span className="block text-[16px] leading-[20px] font-bold">Browse Exercise Library</span>
              <span className="block text-[12px] leading-[16px] text-white/85 mt-1">
                Master your technique before you participate
              </span>
            </button>
          </section>
        </main>
      </div>

      <BottomNav active="challenges" />
    </Screen>
  );
}

export default ChallengesScreen;
