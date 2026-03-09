import { Search } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Screen, BottomNav } from '../../components/Layout';
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
    () => challengeData.filter((challenge) => challenge.status === 'active' && (!effectiveGroupId || challenge.groupId === effectiveGroupId)),
    [challengeData, effectiveGroupId],
  );
  const browseChallenges = useMemo(() => {
    const groupIndex = new Map(groups.map((group) => [group.id, group]));
    const myGroupIds = new Set(myGroups.map((group) => group.id));
    return allChallenges
      .filter((challenge) => challenge.status === 'active')
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

  const handleJoinChallenge = async (challengeId: string, challengeType: ChallengeCardType) => {
    try {
      await joinChallenge.mutateAsync(challengeId);
      const query = new URLSearchParams({ challengeId });
      if (effectiveGroupId) query.set('groupId', effectiveGroupId);
      navigate(`/app/challenges/${challengeType}?${query.toString()}`);
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
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 pt-4 pb-2">
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
                    item.tag?.trim()
                    || (item.challengeType ? item.challengeType.toUpperCase() : 'TEMPLATE');
                  return (
                  <article key={item.id} className="w-[270px] shrink-0 rounded-[18px] border border-slate-200 bg-white overflow-hidden">
                      <div className="relative" style={{ height: 210, minHeight: 210, maxHeight: 210 }}>
                        {isValidHttpImage(item.coverImageUrl) ? (
                          <img
                            src={item.coverImageUrl}
                            alt={item.name}
                            className="h-full w-full object-cover"
                            style={{ display: 'block' }}
                          />
                        ) : (
                          <div className="h-full w-full bg-slate-200 flex items-center justify-center text-slate-500 text-[12px] font-semibold">
                            No cover image
                          </div>
                        )}
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
                                  effectiveGroupId ? `&groupId=${effectiveGroupId}` : ''
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
              <h2 className="st-section-title">Wellness Templates</h2>
              <button
                className="text-[14px] leading-[18px] font-semibold text-primary"
                onClick={() => navigate(`/app/challenges/wellness${querySuffix}`)}
              >
                View All
              </button>
            </div>

            <div className="mt-3 -mx-4 overflow-x-auto px-4 hide-scrollbar">
              <div className="flex gap-3">
                {wellnessTemplateData.slice(0, 8).map((item) => (
                  <article key={item.id} className="w-[220px] shrink-0 rounded-[18px] border border-slate-200 bg-white p-3">
                    <button
                      className="w-full text-left"
                      onClick={() => navigate(`/app/challenges/wellness/${item.id}${effectiveGroupId ? `?groupId=${effectiveGroupId}` : ''}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xl">{item.icon ?? '✨'}</span>
                        <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600">{item.category}</span>
                      </div>
                      <p className="mt-2 text-[14px] leading-[18px] font-black text-slate-900">{item.name}</p>
                      <p className="mt-1 text-[11px] leading-[15px] text-slate-500">{item.duration} days • {item.difficulty}</p>
                      <span className="mt-3 inline-flex h-9 min-w-[96px] items-center justify-center rounded-lg bg-primary px-3 text-[12px] font-bold text-white">
                        Preview
                      </span>
                    </button>
                  </article>
                ))}
              </div>
            </div>

            {wellnessTemplateData.length === 0 && (
              <article className="mt-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
                No wellness templates published yet.
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
                return (
                  <article key={item.id} className="rounded-[18px] border border-slate-200 bg-white p-3 overflow-hidden">
                    <div className="flex items-center gap-3">
                      <button
                        className="min-w-0 flex flex-1 items-center gap-3 text-left"
                        onClick={() => navigate(`/app/challenge/${item.id}${effectiveGroupId ? `?groupId=${effectiveGroupId}` : ''}`)}
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
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
                          <p className="mt-1 truncate text-[11px] leading-[15px] text-[#61758f]">👥 {item.participants.toLocaleString()} Participants</p>
                          <p className="mt-1 text-[12px] leading-[15px] text-primary font-semibold">{item.daysLabel}</p>
                        </div>
                      </button>
                      <button
                        className="h-10 min-w-[86px] rounded-xl bg-primary px-0 text-white text-[14px] font-bold flex-shrink-0"
                        onClick={() => {
                          if (item.isJoined) {
                            if (item.hasStarted) {
                              const qs = new URLSearchParams({ challengeId: item.id });
                              if (effectiveGroupId) qs.set('groupId', effectiveGroupId);
                              navigate(`/app/workouts/select-activity?${qs.toString()}`);
                              return;
                            }
                            navigate(`/app/challenge/${item.id}${effectiveGroupId ? `?groupId=${effectiveGroupId}` : ''}`);
                            return;
                          }
                          handleJoinChallenge(item.id, item.challengeType);
                        }}
                        disabled={joinChallenge.isPending}
                      >
                        {joinChallenge.isPending
                          ? 'Joining...'
                          : item.isJoined
                          ? (item.hasStarted ? (item.isWellness ? 'Log Activity' : 'Log Workout') : 'View')
                          : 'Join'}
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

          <section className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="st-section-title">Browse Challenges</h2>
              <button
                className="text-[14px] leading-[18px] font-semibold text-primary"
                onClick={() => navigate('/app/challenges/browse')}
              >
                View All
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {browseCards.map((item) => (
                <article key={item.id} className="rounded-[18px] border border-slate-200 bg-white p-3 overflow-hidden">
                  <div className="flex items-center gap-3">
                    <button
                      className="min-w-0 flex flex-1 items-center gap-3 text-left"
                      onClick={() => navigate(`/app/challenge/${item.id}`)}
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
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
                        <p className="mt-1 truncate text-[11px] leading-[15px] text-[#61758f]">👥 {item.participants.toLocaleString()} Participants</p>
                        <p className="mt-1 text-[12px] leading-[15px] text-primary font-semibold">{item.daysLabel}</p>
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
              ))}
            </div>

            {browseCards.length === 0 && (
              <article className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
                No public challenges available to browse yet.
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
