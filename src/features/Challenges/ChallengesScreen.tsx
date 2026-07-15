import { Search } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Screen, BottomNav } from '../../components/Layout';
import { LearnMoreLink } from '../../components/LearnMoreLink';
import { useChallenges } from '../../hooks/useChallenges';
import { useJoinChallenge } from '../../hooks/useChallenges';
import { useChallengeTemplates } from '../../hooks/useChallengeTemplates';
import { LoadingSpinner } from '../../components/Layout/LoadingSpinner';
import { useQuery } from '@tanstack/react-query';
import { challengeService } from '../../services/challengeService';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useGroups, useMyGroups } from '../../hooks/useGroups';
import { useWellnessTemplates } from '../../hooks/useWellnessTemplates';
import { isChallengeOngoing } from '../../utils/challengeLifecycle';

type ChallengeCardType = 'collective' | 'competitive' | 'streak';

const isValidHttpImage = (value?: string) => !!value && /^https?:\/\//i.test(value);
const localDateKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

function ChallengesScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const groupId = params.get('groupId') ?? undefined;
  const { showToast } = useToast();
  const { data: challengeData = [], isLoading: isLoadingChallenges } = useChallenges();
  const { data: allChallenges = [] } = useQuery({
    queryKey: ['all-challenges-catalog', user?.uid],
    enabled: !!user?.uid,
    queryFn: () => challengeService.getVisibleChallengesForUser(String(user?.uid), { statuses: ['active'] }),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const { data: groups = [] } = useGroups();
  const { data: myGroups = [] } = useMyGroups();
  const effectiveGroupId = useMemo(
    () => (groupId && myGroups.some((group) => group.id === groupId) ? groupId : undefined),
    [groupId, myGroups],
  );
  const joinChallenge = useJoinChallenge();
  const { data: templateData = [], isLoading: isLoadingTemplates } = useChallengeTemplates();
  const { data: wellnessTemplateData = [], isLoading: isLoadingWellnessTemplates } = useWellnessTemplates();
  const visibleChallenges = useMemo(
    () => challengeData.filter((challenge) => isChallengeOngoing(challenge) && (!effectiveGroupId || challenge.groupId === effectiveGroupId)),
    [challengeData, effectiveGroupId],
  );
  const browseChallenges = useMemo(() => {
    const groupIndex = new Map(groups.map((group) => [group.id, group]));
    const myGroupIds = new Set(myGroups.map((group) => group.id));
    return allChallenges
      .filter((challenge) => isChallengeOngoing(challenge))
      .filter((challenge) => !myGroupIds.has(challenge.groupId))
      .filter((challenge) => {
        const challengeGroup = groupIndex.get(challenge.groupId);
        return !!challengeGroup && !challengeGroup.isPrivate;
      })
      .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
  }, [allChallenges, groups, myGroups]);

  const { data: membershipIndex = new Map<string, string>() } = useQuery({
    queryKey: ['challenge-memberships-index', user?.uid],
    enabled: !!user?.uid,
    queryFn: async () => {
      if (!user?.uid) return new Map<string, string>();
      return challengeService.getUserChallengeMembershipIndex(user.uid);
    },
    staleTime: 30 * 1000,
  });

  const ongoingCards = useMemo(() => {
    return visibleChallenges
      .slice(0, 3)
      .map((item) => {
        const start = new Date(item.startDate);
        const end = new Date(item.endDate);
        const now = new Date();
        const hasStarted = localDateKey(now) >= localDateKey(start);
        const msPerDay = 1000 * 60 * 60 * 24;
        const days = hasStarted
          ? Math.max(0, Math.ceil((end.getTime() - now.getTime()) / msPerDay))
          : Math.max(0, Math.ceil((start.getTime() - now.getTime()) / msPerDay));
        const membershipStatus = membershipIndex.get(item.id);
        const isJoined = membershipStatus === 'active' || membershipStatus === 'completed';
        return {
          id: item.id,
          name: item.name,
          participants: item.participantCount ?? 0,
          daysLabel: hasStarted ? `${days} Days Left` : `Starts in ${days} Days`,
          hasStarted,
          isJoined,
          imageUrl: isValidHttpImage(item.coverImageUrl) ? item.coverImageUrl : undefined,
          challengeType: (item.challengeType ?? 'collective') as ChallengeCardType,
          isWellness: !!item.category && item.category !== 'fitness',
        };
      });
  }, [visibleChallenges, membershipIndex]);

  const browseCards = useMemo(() => {
    return browseChallenges
      .slice(0, 6)
      .map((item) => {
        const start = new Date(item.startDate);
        const end = new Date(item.endDate);
        const now = new Date();
        const hasStarted = localDateKey(now) >= localDateKey(start);
        const msPerDay = 1000 * 60 * 60 * 24;
        const days = hasStarted
          ? Math.max(0, Math.ceil((end.getTime() - now.getTime()) / msPerDay))
          : Math.max(0, Math.ceil((start.getTime() - now.getTime()) / msPerDay));
        return {
          id: item.id,
          name: item.name,
          participants: item.participantCount ?? 0,
          daysLabel: hasStarted ? `${days} Days Left` : `Starts in ${days} Days`,
          imageUrl: isValidHttpImage(item.coverImageUrl) ? item.coverImageUrl : undefined,
        };
      });
  }, [browseChallenges]);
  const querySuffix = effectiveGroupId ? `?groupId=${effectiveGroupId}` : '';

  const handleJoinChallenge = async (challengeId: string, _challengeType: ChallengeCardType) => {
    try {
      await joinChallenge.mutateAsync(challengeId);
      const qs = effectiveGroupId ? `?groupId=${effectiveGroupId}` : '';
      navigate(`/app/challenge/${challengeId}${qs}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not join challenge.';
      showToast(msg, 'error');
    }
  };

  if (isLoadingChallenges || isLoadingTemplates || isLoadingWellnessTemplates) {
    return <LoadingSpinner fullScreen label="Loading Challenges..." />;
  }

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen bg-slate-50 pb-[96px]">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-slate-50 px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="st-page-title">Challenges</h1>
              <LearnMoreLink section="challenges" />
            </div>
            <button
              className="h-9 w-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center"
              onClick={() => navigate(`/app/challenges/suggested${querySuffix}`)}
            >
              <Search size={18} />
            </button>
          </div>
        </header>

        <main className="px-4 pt-5 space-y-7">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="st-section-title">Fitness Challenges</h2>
              <button
                className="text-[13px] font-semibold text-primary"
                onClick={() => navigate(`/app/challenges/suggested${querySuffix}`)}
              >
                See all
              </button>
            </div>

            <div className="-mx-4 overflow-x-auto px-4 hide-scrollbar">
              <div className="flex gap-3 pb-1">
                {templateData.slice(0, 6).map((item) => {
                  const challengeTypeLabel =
                    item.tag?.trim()
                    || (item.challengeType ? item.challengeType.toUpperCase() : 'TEMPLATE');
                  return (
                  <article key={item.id} className="w-[240px] shrink-0 rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
                      <div className="relative h-[152px]">
                        {isValidHttpImage(item.coverImageUrl) ? (
                          <img
                            src={item.coverImageUrl}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-400 text-[12px] font-semibold">
                            No image
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/75 via-slate-900/20 to-transparent" />
                        <span className="absolute left-3 top-3 rounded-full bg-primary/90 px-2.5 py-1 text-[10px] leading-[10px] tracking-[0.06em] font-bold uppercase text-white">
                          {challengeTypeLabel}
                        </span>
                        <div className="absolute inset-x-3 bottom-3">
                          <p className="text-[14px] leading-[18px] font-black text-white">{item.name}</p>
                          <button
                            className="mt-2 h-9 w-full rounded-xl border border-white/30 bg-white/15 backdrop-blur-sm text-white text-[12px] font-semibold"
                            onClick={() =>
                              navigate(
                                `/app/challenges/suggested?previewTemplateId=${item.id}${
                                  effectiveGroupId ? `&groupId=${effectiveGroupId}` : ''
                                }`,
                              )
                            }
                          >
                            Preview
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

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="st-section-title">Wellness Templates</h2>
              <button
                className="text-[13px] font-semibold text-primary"
                onClick={() => navigate(`/app/challenges/wellness${querySuffix}`)}
              >
                See all
              </button>
            </div>

            <div className="-mx-4 overflow-x-auto px-4 hide-scrollbar">
              <div className="flex gap-3 pb-1">
                {wellnessTemplateData.slice(0, 8).map((item) => (
                  <article key={item.id} className="w-[200px] shrink-0 rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
                    <button
                      className="w-full text-left"
                      onClick={() => navigate(`/app/challenges/wellness/${item.id}${effectiveGroupId ? `?groupId=${effectiveGroupId}` : ''}`)}
                    >
                      {isValidHttpImage(item.coverImage) ? (
                        <div className="relative h-[112px] overflow-hidden">
                          <img src={item.coverImage} alt={item.name} className="h-full w-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent" />
                          <span className="absolute left-2.5 bottom-2 rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-bold uppercase text-white/90">{item.category}</span>
                        </div>
                      ) : (
                        <div className="h-[80px] flex items-center justify-center bg-slate-100">
                          <span className="text-2xl">{item.icon ?? '✨'}</span>
                        </div>
                      )}
                      <div className="p-3">
                        <p className="text-[13px] leading-[17px] font-black text-slate-900">{item.name}</p>
                        <p className="mt-0.5 text-[11px] leading-[14px] text-slate-400">{item.duration} days · {item.difficulty}</p>
                        <span className="mt-2.5 inline-flex h-8 min-w-[80px] items-center justify-center rounded-lg bg-primary px-3 text-[11px] font-bold text-white">
                          Preview
                        </span>
                      </div>
                    </button>
                  </article>
                ))}
              </div>
            </div>

            {wellnessTemplateData.length === 0 && (
              <article className="rounded-xl border border-slate-100 bg-white p-3 text-[12px] text-slate-400 shadow-sm">
                No wellness templates published yet.
              </article>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="st-section-title">Ongoing Challenges</h2>
              <button
                className="text-[13px] font-semibold text-primary"
                onClick={() => navigate(`/app/challenges/browse${querySuffix}`)}
              >
                See all
              </button>
            </div>

            <div className="space-y-2.5">
              {ongoingCards.slice(0, 3).map((item) => {
                return (
                  <article key={item.id} className="rounded-2xl border border-slate-100 bg-white p-3 overflow-hidden shadow-sm">
                    <div className="flex items-center gap-3">
                      <button
                        className="min-w-0 flex flex-1 items-center gap-3 text-left"
                        onClick={() => navigate(`/app/challenge/${item.id}${effectiveGroupId ? `?groupId=${effectiveGroupId}` : ''}`)}
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-16 w-16 rounded-xl object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-xl bg-slate-100 flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] leading-[18px] font-bold text-slate-900">{item.name || 'Challenge'}</p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-400">{item.participants.toLocaleString()} participants</p>
                          <p className="mt-0.5 text-[11px] font-semibold text-primary">{item.daysLabel}</p>
                        </div>
                      </button>
                      <button
                        className="h-9 min-w-[88px] rounded-xl bg-primary px-3 text-white text-[12px] font-bold flex-shrink-0 whitespace-nowrap"
                        onClick={() => {
                          if (item.isJoined) {
                            if (item.hasStarted) {
                              const qs = new URLSearchParams({ challengeId: item.id });
                              if (effectiveGroupId) qs.set('groupId', effectiveGroupId);
                              navigate(`/app/workouts/select-activity?${qs.toString()}`);
                              return;
                            }
                          }
                          navigate(`/app/challenge/${item.id}${effectiveGroupId ? `?groupId=${effectiveGroupId}` : ''}`);
                        }}
                        disabled={joinChallenge.isPending}
                      >
                        {item.isJoined
                          ? (item.hasStarted ? (item.isWellness ? 'Log Activity' : 'Log Workout') : 'View')
                          : 'Join'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            {ongoingCards.length === 0 && (
              <article className="rounded-xl border border-slate-100 bg-white p-3 text-[12px] text-slate-400 shadow-sm">
                No active challenges for your group yet.
              </article>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="st-section-title">Browse Challenges</h2>
              <button
                className="text-[13px] font-semibold text-primary"
                onClick={() => navigate('/app/challenges/browse')}
              >
                See all
              </button>
            </div>

            <div className="space-y-2.5">
              {browseCards.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-100 bg-white p-3 overflow-hidden shadow-sm">
                  <div className="flex items-center gap-3">
                    <button
                      className="min-w-0 flex flex-1 items-center gap-3 text-left"
                      onClick={() => navigate(`/app/challenge/${item.id}`)}
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-16 w-16 rounded-xl object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-xl bg-slate-100 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] leading-[18px] font-bold text-slate-900">{item.name || 'Challenge'}</p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-400">{item.participants.toLocaleString()} participants</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-primary">{item.daysLabel}</p>
                      </div>
                    </button>
                    <button
                      className="h-9 min-w-[56px] rounded-xl bg-slate-100 px-4 text-slate-700 text-[12px] font-bold flex-shrink-0"
                      onClick={() => navigate(`/app/challenge/${item.id}`)}
                    >
                      View
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {browseCards.length === 0 && (
              <article className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <button
                  className="w-full text-left text-[12px] text-primary font-semibold"
                  onClick={() => navigate(`/app/challenges/browse${querySuffix}`)}
                >
                  Browse all available challenges →
                </button>
              </article>
            )}
          </section>

          <section>
            <h2 className="st-section-title mb-3">Activities Library</h2>
            <div className="flex gap-3">
              <button
                className="flex-1 rounded-2xl bg-primary/8 border border-primary/15 px-4 py-3.5 text-left"
                onClick={() => navigate('/app/exercises')}
              >
                <span className="block text-[13px] leading-[17px] font-bold text-slate-900">Exercise Library</span>
                <span className="block text-[11px] leading-[15px] text-slate-500 mt-0.5">Technique &amp; form</span>
              </button>
              <button
                className="flex-1 rounded-2xl bg-primary/8 border border-primary/15 px-4 py-3.5 text-left"
                onClick={() => navigate('/app/wellness-activities')}
              >
                <span className="block text-[13px] leading-[17px] font-bold text-slate-900">Wellness Library</span>
                <span className="block text-[11px] leading-[15px] text-slate-500 mt-0.5">Mindfulness &amp; habits</span>
              </button>
            </div>
          </section>
        </main>
      </div>

      <BottomNav active="challenges" />
    </Screen>
  );
}

export default ChallengesScreen;
