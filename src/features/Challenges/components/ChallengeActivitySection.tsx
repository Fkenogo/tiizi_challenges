import { Plus, Search, X } from 'lucide-react';
import type { CatalogExercise } from '../../../types';
import type { WellnessActivity, WellnessCategory } from '../../../types/wellnessActivity';

export type ActivityFrequency = 'daily' | 'weekly' | '2x-week' | '3x-week' | '5x-week' | 'custom';

export interface ActivityRow {
  query: string;
  exerciseId?: string;
  activityId?: string;
  activityType?: string;
  description?: string;
  category?: string;
  difficulty?: string;
  icon?: string;
  frequency?: ActivityFrequency;
  targetValue: string;
  unit: string;
  pointsPerCompletion?: number;
  dailyFrequency?: number;
  protocolSteps?: string[];
  benefits?: string[];
  guidelines?: string[];
  warnings?: string[];
  instructions?: string[];
}

const WELLNESS_CATEGORIES = [
  'all', 'movement', 'hydration', 'sleep', 'mindfulness',
  'nutrition', 'fasting', 'habits', 'stress', 'social', 'health-monitoring',
] as const;

function wellnessCategoryLabel(cat: string): string {
  if (cat === 'health-monitoring') return 'Health';
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

interface ChallengeActivitySectionProps {
  isWellnessMode: boolean;
  challengeType: 'collective' | 'competitive' | 'streak';

  // Activity list
  activities: ActivityRow[];
  onUpdateActivity: (index: number, patch: Partial<ActivityRow>) => void;
  onAddActivity: () => void;
  onRemoveActivity: (index: number) => void;

  // Exercise library
  exercises: CatalogExercise[];
  isExercisesLoading: boolean;
  isExercisesError: boolean;

  // Wellness library
  wellnessActivities: WellnessActivity[];
  isWellnessActivitiesLoading: boolean;
  isWellnessActivitiesError: boolean;

  // Fitness picker modal
  fitnessPicker: boolean;
  fitnessPickerIndex: number | null;
  fitnessPickerSearch: string;
  onFitnessPickerSearchChange: (value: string) => void;
  fitnessPickerExercises: CatalogExercise[];
  fitnessPickerTierOptions?: string[];
  fitnessPickerTier?: string;
  onFitnessPickerTierChange?: (tier: string) => void;
  onOpenFitnessPicker: (index: number) => void;
  onCloseFitnessPicker: () => void;
  onPickFitnessExercise: (exercise: CatalogExercise) => void;

  // Wellness picker modal
  wellnessPickerOpen: boolean;
  wellnessPickerIndex: number | null;
  wellnessPickerSearch: string;
  onWellnessPickerSearchChange: (value: string) => void;
  wellnessPickerCategoryFilter: string;
  onWellnessPickerCategoryFilterChange: (cat: 'all' | WellnessCategory) => void;
  isWellnessPickerLoading: boolean;
  onOpenWellnessPicker: (index: number) => void;
  onCloseWellnessPicker: () => void;
  onPickWellnessActivity: (activity: WellnessActivity) => void;

  // Optional: navigate to exercise detail page (Wizard only)
  onNavigateToExercise?: (exerciseId: string) => void;

  // Optional wrapper class, e.g. "st-form-max mt-4" in the Wizard
  className?: string;
}

export function ChallengeActivitySection({
  isWellnessMode,
  challengeType,
  activities,
  onUpdateActivity,
  onAddActivity,
  onRemoveActivity,
  exercises,
  isExercisesLoading,
  isExercisesError,
  wellnessActivities,
  isWellnessActivitiesLoading,
  isWellnessActivitiesError,
  fitnessPicker,
  fitnessPickerIndex,
  fitnessPickerSearch,
  onFitnessPickerSearchChange,
  fitnessPickerExercises,
  fitnessPickerTierOptions,
  fitnessPickerTier,
  onFitnessPickerTierChange,
  onOpenFitnessPicker,
  onCloseFitnessPicker,
  onPickFitnessExercise,
  wellnessPickerOpen,
  wellnessPickerIndex,
  wellnessPickerSearch,
  onWellnessPickerSearchChange,
  wellnessPickerCategoryFilter,
  onWellnessPickerCategoryFilterChange,
  isWellnessPickerLoading,
  onOpenWellnessPicker,
  onCloseWellnessPicker,
  onPickWellnessActivity,
  onNavigateToExercise,
  className,
}: ChallengeActivitySectionProps) {
  function openPicker(index: number) {
    if (isWellnessMode) { onOpenWellnessPicker(index); return; }
    onOpenFitnessPicker(index);
  }

  return (
    <>
      <div className={className}>
        <div className="st-card p-4">
          <p className="st-section-title text-primary">Challenge Activities</p>

          {isExercisesLoading && !isWellnessMode && (
            <p className="mt-2 text-[12px] leading-[16px] text-slate-500">Loading exercise library…</p>
          )}
          {isExercisesError && !isWellnessMode && (
            <p className="mt-2 text-[12px] leading-[16px] text-red-500">Could not load exercises. Please retry.</p>
          )}
          {!isExercisesLoading && !isExercisesError && exercises.length === 0 && !isWellnessMode && (
            <p className="mt-2 text-[12px] leading-[16px] text-amber-600">No exercises available yet. Load catalog exercises first.</p>
          )}
          {isWellnessMode && isWellnessActivitiesLoading && (
            <p className="mt-2 text-[12px] leading-[16px] text-slate-500">Loading activity library…</p>
          )}
          {isWellnessMode && isWellnessActivitiesError && (
            <p className="mt-2 text-[12px] leading-[16px] text-red-500">Could not load activities. Please retry.</p>
          )}
          {isWellnessMode && !isWellnessActivitiesLoading && !isWellnessActivitiesError && wellnessActivities.length === 0 && (
            <p className="mt-2 text-[12px] leading-[16px] text-amber-600">No activities available yet. Add wellness activities in the admin library.</p>
          )}

          {activities.map((activity, index) => (
            <div key={`activity-${index}`} className="mt-3 st-card p-3 border-slate-200">
              <div className="flex items-center justify-between">
                <p className="text-[16px] leading-[20px] font-semibold text-slate-800">Activity {index + 1}</p>
                {activities.length > 1 && (
                  <button className="text-[13px] font-bold text-red-500" onClick={() => onRemoveActivity(index)}>
                    Remove
                  </button>
                )}
              </div>

              {/* Tap-to-pick trigger — read-only, opens Activity Library */}
              <label className="sr-only" htmlFor={`activity-search-${index}`}>
                {isWellnessMode ? 'Choose a wellness activity' : 'Choose an exercise'}
              </label>
              <div className="relative mt-2">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id={`activity-search-${index}`}
                  className="st-input pl-10 cursor-pointer"
                  readOnly
                  placeholder={isWellnessMode ? 'Tap to choose a wellness activity' : 'Tap to choose an exercise'}
                  value={activity.query}
                  onClick={() => openPicker(index)}
                />
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center"
                  onClick={() => openPicker(index)}
                  aria-label={isWellnessMode ? 'Open wellness activity library' : 'Open exercise library'}
                >
                  <Plus size={16} />
                </button>
              </div>

              {!!activity.exerciseId && !isWellnessMode && onNavigateToExercise && (
                <button
                  className="mt-2 text-[13px] font-bold text-primary"
                  onClick={() => onNavigateToExercise(activity.exerciseId!)}
                >
                  View exercise detail
                </button>
              )}

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[14px] leading-[18px] font-semibold text-slate-800">
                    {challengeType === 'streak' ? 'Daily Target' : 'Target Value'}
                  </p>
                  {challengeType === 'streak' && (
                    <p className="text-[11px] leading-[14px] text-slate-500 mt-0.5">Amount required per day</p>
                  )}
                  <input
                    className="st-input mt-2"
                    type="number"
                    min={0}
                    value={activity.targetValue}
                    onChange={(e) => onUpdateActivity(index, { targetValue: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <p className="text-[14px] leading-[18px] font-semibold text-slate-800">Unit</p>
                  {isWellnessMode ? (
                    <input
                      className="st-input mt-2"
                      value={activity.unit}
                      onChange={(e) => onUpdateActivity(index, { unit: e.target.value })}
                      placeholder="hours / ml / servings"
                    />
                  ) : (
                    <select className="st-input mt-2 appearance-none" value={activity.unit} onChange={(e) => onUpdateActivity(index, { unit: e.target.value })}>
                      <option value="Reps">Reps</option>
                      <option value="Seconds">Seconds</option>
                      <option value="Minutes">Minutes</option>
                      <option value="Km">Km</option>
                      <option value="Kg">Kg</option>
                    </select>
                  )}
                </div>
              </div>

              {isWellnessMode && (activity.icon || activity.category || activity.description) && (
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  {(activity.icon || activity.category) && (
                    <p className="text-[12px] leading-[16px] text-slate-700 font-semibold">
                      {activity.icon} {activity.category}
                    </p>
                  )}
                  {activity.description && (
                    <p className="mt-1 text-[12px] leading-[16px] text-slate-500">{activity.description}</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {challengeType === 'streak' && (
            <button
              className="mt-4 w-full h-12 rounded-2xl border border-dashed border-primary/40 text-[15px] leading-[20px] font-bold text-primary flex items-center justify-center gap-2"
              onClick={onAddActivity}
            >
              <Plus size={16} /> Add Another Activity
            </button>
          )}
        </div>
      </div>

      {/* Fitness exercise picker modal */}
      {fitnessPicker && fitnessPickerIndex !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/50">
          <div className="relative mx-auto h-full w-full max-w-[375px]">
            <div className="absolute inset-x-0 bottom-0 rounded-t-[20px] bg-[#f7f9fc] pb-6 pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.2)]">
              <div className="mx-auto h-1.5 w-16 rounded-full bg-slate-300" />
              <div className="st-form-max mt-3 flex items-center justify-between">
                <div>
                  <p className="st-section-title">Exercise Library</p>
                  <p className="st-body">Pick an exercise to add to this activity</p>
                </div>
                <button
                  className="h-9 w-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center"
                  onClick={onCloseFitnessPicker}
                  aria-label="Close exercise picker"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="st-form-max mt-3 relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="st-input pl-10"
                  value={fitnessPickerSearch}
                  onChange={(event) => onFitnessPickerSearchChange(event.target.value)}
                  placeholder="Search exercises…"
                />
              </div>

              {fitnessPickerTierOptions && fitnessPickerTierOptions.length > 0 && onFitnessPickerTierChange && (
                <div className="st-form-max mt-3 flex gap-2 overflow-x-auto pb-1">
                  {fitnessPickerTierOptions.map((tier) => (
                    <button
                      key={tier}
                      className={`h-9 min-w-[72px] px-3 rounded-full text-[12px] leading-[16px] font-semibold whitespace-nowrap ${fitnessPickerTier === tier ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                      onClick={() => onFitnessPickerTierChange(tier)}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              )}

              <div className="st-form-max mt-3 max-h-[46vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                {fitnessPickerExercises.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-[16px] leading-[22px] font-semibold text-slate-800">No exercises found</p>
                    <p className="mt-1 text-[13px] leading-[18px] text-slate-500">Try a different search term or category.</p>
                  </div>
                ) : (
                  fitnessPickerExercises.map((exercise) => (
                    <button
                      key={`picker-${exercise.id}`}
                      className="w-full border-b last:border-b-0 border-slate-100 px-4 py-3 flex items-center justify-between gap-3 text-left"
                      onClick={() => onPickFitnessExercise(exercise)}
                    >
                      <div className="min-w-0">
                        <p className="text-[16px] leading-[22px] font-semibold text-slate-900 truncate">{exercise.name}</p>
                        <p className="text-[12px] leading-[16px] text-slate-500 truncate">
                          {exercise.tier_1} • {exercise.tier_2} • {exercise.metric.unit}
                        </p>
                      </div>
                      <span className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0">
                        <Plus size={16} />
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wellness activity picker modal */}
      {wellnessPickerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/55">
          <div className="mx-auto h-full w-full max-w-mobile bg-[#f7f9fc] pb-6">
            <div className="st-form-max pt-4 flex items-center justify-between">
              <div>
                <p className="st-section-title">Activity Library</p>
                <p className="st-body">Pick an activity and set your target</p>
              </div>
              <button
                className="h-9 w-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center"
                onClick={onCloseWellnessPicker}
                aria-label="Close activity picker"
              >
                <X size={18} />
              </button>
            </div>

            <div className="st-form-max mt-3 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="st-input pl-10"
                value={wellnessPickerSearch}
                onChange={(event) => onWellnessPickerSearchChange(event.target.value)}
                placeholder="Search activities…"
              />
            </div>

            <div className="st-form-max mt-3 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {WELLNESS_CATEGORIES.map((category) => (
                <button
                  key={category}
                  className={`h-9 rounded-full px-3 text-[12px] leading-[16px] font-semibold uppercase whitespace-nowrap ${wellnessPickerCategoryFilter === category ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                  onClick={() => onWellnessPickerCategoryFilterChange(category)}
                >
                  {wellnessCategoryLabel(category)}
                </button>
              ))}
            </div>

            <div className="st-form-max mt-3 max-h-[66vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white">
              {isWellnessPickerLoading ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-[13px] leading-[18px] text-slate-500">Loading…</p>
                </div>
              ) : wellnessActivities.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-[16px] leading-[22px] font-semibold text-slate-800">No activities found</p>
                  <p className="mt-1 text-[13px] leading-[18px] text-slate-500">Try another category or search term.</p>
                </div>
              ) : (
                wellnessActivities.map((activity) => (
                  <button
                    key={`wellness-${activity.id}`}
                    className="w-full border-b last:border-b-0 border-slate-100 px-4 py-3 text-left"
                    onClick={() => onPickWellnessActivity(activity)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[16px] leading-[22px] font-semibold text-slate-900 truncate">{activity.icon} {activity.name}</p>
                        <p className="text-[12px] leading-[16px] text-slate-500 truncate">
                          {activity.category} • {activity.defaultTargetValue} {activity.defaultMetricUnit}
                        </p>
                        <p className="mt-1 text-[12px] leading-[16px] text-slate-600 line-clamp-2">{activity.description}</p>
                      </div>
                      <span className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0">
                        <Plus size={16} />
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
