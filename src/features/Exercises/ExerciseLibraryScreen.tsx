import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, SlidersHorizontal } from 'lucide-react';
import { useExerciseFilterOptions, useExercises, useExerciseSearch } from '../../hooks/useExercises';
import { useChallenges } from '../../hooks/useChallenges';
import { useGroups } from '../../hooks/useGroups';
import { BottomNav, Screen } from '../../components/Layout';
import { EmptyState, LoadingSpinner } from '../../components/Mobile';
import { challengePresets } from '../../data/challengePresets';

function difficultyDots(level: string) {
  const value = level === 'Beginner' ? 2 : level === 'Intermediate' ? 3 : 4;
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: 5 }).map((_, idx) => (
        <span
          key={`dot-${idx}`}
          className={`h-2.5 w-2.5 rounded-full ${idx < value ? 'bg-primary' : 'bg-slate-300'}`}
        />
      ))}
    </div>
  );
}

function ExerciseLibraryScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const challengeId = params.get('challengeId') ?? undefined;
  const groupId = params.get('groupId') ?? undefined;
  const selectionMode = params.get('selectFor') === 'challenge';
  const returnTo = params.get('returnTo') ?? '/app/create-challenge';
  const selectedRow = params.get('selectedRow') ?? '0';
  const templateId = params.get('templateId') ?? undefined;
  const initialType = params.get('type') ?? undefined;

  const { data: challenges } = useChallenges();
  const { data: groups } = useGroups();

  const hasValidChallengeId = !!challengeId && (
    !!challenges?.some((challenge) => challenge.id === challengeId) ||
    challengePresets.some((challenge) => challenge.id === challengeId)
  );
  const activeChallengeId = hasValidChallengeId ? challengeId : undefined;
  const challengeGroupId = challenges?.find((challenge) => challenge.id === activeChallengeId)?.groupId;
  const hasValidGroupId = !!groupId && !!groups?.some((group) => group.id === groupId);
  const activeGroupId = challengeGroupId ?? (hasValidGroupId ? groupId : undefined);

  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('All');
  const shouldSearch = searchTerm.trim().length >= 2;
  const allExercisesQuery = useExercises();
  const browseQuery = useExercises(tierFilter !== 'All' ? { tier1: tierFilter } : undefined);
  const searchQuery = useExerciseSearch(searchTerm.trim());

  const optionsQuery = useExerciseFilterOptions();
  const tierOptions = useMemo(() => ['All', ...(optionsQuery.data?.tier1 ?? [])], [optionsQuery.data?.tier1]);
  const categoryExercises = browseQuery.data ?? [];
  const allExercises = allExercisesQuery.data ?? [];
  const fallbackToAllByTier = !shouldSearch && tierFilter !== 'All' && categoryExercises.length === 0 && allExercises.length > 0;
  const exercises = shouldSearch ? (searchQuery.data ?? []) : (fallbackToAllByTier ? allExercises : categoryExercises);
  const fallbackSuggestions = useMemo(() => (allExercisesQuery.data ?? []).slice(0, 8), [allExercisesQuery.data]);
  const isLoading = shouldSearch ? searchQuery.isLoading : (browseQuery.isLoading || allExercisesQuery.isLoading);
  const error = shouldSearch ? searchQuery.error : browseQuery.error;

  const handleExerciseClick = (exerciseId: string, exerciseName: string, exerciseUnit: string) => {
    if (selectionMode) {
      const query = new URLSearchParams();
      query.set('selectedExerciseId', exerciseId);
      query.set('selectedExerciseName', exerciseName);
      query.set('selectedExerciseUnit', exerciseUnit);
      query.set('selectedRow', selectedRow);
      if (groupId) query.set('groupId', groupId);
      if (templateId) query.set('templateId', templateId);
      if (initialType) query.set('type', initialType);
      navigate(`${returnTo}?${query.toString()}`);
      return;
    }

    navigate(`/app/exercises/${exerciseId}${activeChallengeId ? `?challengeId=${activeChallengeId}${activeGroupId ? `&groupId=${activeGroupId}` : ''}` : ''}`);
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[96px]">
        <header className="px-3 pt-3 flex items-center justify-between">
          <button className="h-8 w-8 flex items-center justify-center" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} className="text-slate-900" />
          </button>
          <h1 className="text-base font-bold text-slate-900">Exercises</h1>
          <button className="h-8 w-8 flex items-center justify-center">
            <SlidersHorizontal size={18} className="text-slate-900" />
          </button>
        </header>

        <div className="px-3 mt-2 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search exercises..."
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm"
          />
        </div>

        {selectionMode && (
          <div className="px-3 mt-2">
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <p className="text-[12px] leading-[16px] font-semibold text-primary">
                Select an exercise to add to your challenge activity.
              </p>
            </div>
          </div>
        )}

        <div className="px-3 mt-2 flex gap-2 overflow-x-auto pb-1">
          {tierOptions.slice(0, 6).map((tier) => (
            <button
              key={tier}
              className={`h-9 min-w-[72px] px-3 rounded-full text-xs font-semibold whitespace-nowrap ${tierFilter === tier ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
              onClick={() => setTierFilter(tier)}
            >
              {tier}
            </button>
          ))}
        </div>

        <div className="px-3 mt-2 space-y-2">
          {isLoading && (
            <div className="py-8">
              <LoadingSpinner label="Loading exercises..." />
            </div>
          )}

          {!isLoading && error && (
            <EmptyState
              icon={<Search size={36} />}
              title="Error loading exercises"
              message="Please try again."
              className="min-h-[36vh]"
            />
          )}

          {!isLoading && !error && exercises.length === 0 && (
            <>
              <EmptyState
                icon={<Search size={36} />}
                title="No exercises found"
                message={shouldSearch ? 'Try a different search term.' : 'No exercises available right now.'}
                className="min-h-[28vh]"
              />
              {shouldSearch && fallbackSuggestions.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] leading-[16px] font-semibold text-slate-700">Try these instead</p>
                    <button className="text-[12px] leading-[16px] font-semibold text-primary" onClick={() => setSearchTerm('')}>
                      Clear search
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {fallbackSuggestions.map((exercise) => (
                      <button
                        key={`fallback-${exercise.id}`}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] leading-[16px] font-medium text-slate-700"
                        onClick={() => setSearchTerm(exercise.name)}
                      >
                        {exercise.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!isLoading && !error && fallbackToAllByTier && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
              <p className="text-[12px] leading-[16px] font-semibold text-primary">
                No results in {tierFilter}. Showing full library instead.
              </p>
            </div>
          )}

          {!isLoading && !error && exercises.map((exercise, idx) => (
            <button
              key={exercise.id}
              className="w-full bg-white border border-slate-200 rounded-xl p-2 text-left"
              onClick={() => handleExerciseClick(exercise.id, exercise.name, exercise.metric.unit)}
            >
              <div className="flex items-start gap-2">
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={
                      idx % 2 === 0
                        ? 'https://images.unsplash.com/photo-1534367610401-9f5ed68180aa?auto=format&fit=crop&w=500&q=80'
                        : 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=500&q=80'
                    }
                    alt={exercise.name}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{exercise.name}</p>
                    <span className={`${idx % 2 === 0 ? 'text-primary' : 'text-slate-300'} text-lg leading-none`}>♥</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{exercise.musclesTargeted.slice(0, 2).join(', ') || exercise.tier_1}</p>

                  <div className="mt-2 flex items-center gap-1">
                    <span className="text-[9px] font-medium text-slate-400 uppercase">Difficulty</span>
                    {difficultyDots(exercise.difficulty)}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <BottomNav active={activeChallengeId ? 'challenges' : 'home'} />
    </Screen>
  );
}

export default ExerciseLibraryScreen;
