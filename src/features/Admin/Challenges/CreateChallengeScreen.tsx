import { ChangeEvent, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/Mobile';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useCreateSuggestedChallengeTemplate } from '../../../hooks/useChallengeTemplates';
import { useExercises } from '../../../hooks/useExercises';
import { useWellnessActivities } from '../../../hooks/useWellnessActivities';
import { isPersistableImageSource, readFileAsDataUrl, uploadImageFile } from '../../../services/imageUploadService';
import { wellnessTemplateService } from '../../../services/wellnessTemplateService';
import { AdminLayout } from '../layout/AdminLayout';
import { ChallengeBasicInfoSection } from '../../Challenges/components/ChallengeBasicInfoSection';
import { ChallengeTimelineSection } from '../../Challenges/components/ChallengeTimelineSection';
import { ChallengeActivitySection } from '../../Challenges/components/ChallengeActivitySection';
import { ChallengeEngineSettingsSection } from '../../Challenges/components/ChallengeEngineSettingsSection';
import { ChallengeDonationSection } from '../../Challenges/components/ChallengeDonationSection';
import { validateChallengeForm } from '../../Challenges/utils/challengeFormValidation';
import { calculateInclusiveDurationDays } from '../../Challenges/utils/challengeDuration';
import {
  DEFAULT_AUTO_COMPLETE_ON_GROUP_TARGET,
  DEFAULT_STREAK_RESET_ON_MISS,
  DEFAULT_TEMPLATE_MODE,
  DURATION_FALLBACK_DAYS,
} from '../../Challenges/utils/challengeFormDefaults';
import { DONATION_PAYLOAD_DISCLAIMER } from '../../Challenges/utils/challengeFormCopy';
import type { CatalogExercise } from '../../../types';
import type { WellnessActivity } from '../../../types/wellnessActivity';

type ChallengeType = 'collective' | 'competitive' | 'streak';

type ActivityRow = {
  query: string;
  exerciseId?: string;
  activityId?: string;
  activityType?: string;
  description?: string;
  category?: string;
  difficulty?: string;
  icon?: string;
  protocolSteps?: string[];
  benefits?: string[];
  guidelines?: string[];
  warnings?: string[];
  frequency?: 'daily' | 'weekly' | '2x-week' | '3x-week' | '5x-week' | 'custom';
  targetValue: string;
  unit: string;
  instructions?: string[];
  pointsPerCompletion?: number;
  dailyFrequency?: number;
};

type ResolvedActivity = {
  exerciseId?: string;
  activityId?: string;
  activityType?: string;
  exerciseName: string;
  description?: string;
  category?: string;
  difficulty?: string;
  icon?: string;
  protocolSteps?: string[];
  benefits?: string[];
  guidelines?: string[];
  warnings?: string[];
  frequency?: 'daily' | 'weekly' | '2x-week' | '3x-week' | '5x-week' | 'custom';
  targetValue: number;
  unit: string;
  instructions?: string[];
  pointsPerCompletion?: number;
  dailyFrequency?: number;
};


function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}


function CreateChallengeScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions } = useAdminPermissions(user?.uid);
  const createTemplateMutation = useCreateSuggestedChallengeTemplate();
  const { data: exercises = [], isLoading: isExercisesLoading, isError: isExercisesError } = useExercises();
  const [templateMode, setTemplateMode] = useState<'fitness' | 'wellness'>(DEFAULT_TEMPLATE_MODE);
  const [wellnessPickerOpen, setWellnessPickerOpen] = useState(false);
  const [wellnessCategoryFilter, setWellnessCategoryFilter] = useState<'all' | WellnessActivity['category']>('all');
  const [wellnessSearch, setWellnessSearch] = useState('');
  const {
    data: wellnessActivities = [],
    isLoading: isWellnessLoading,
    isError: isWellnessError,
  } = useWellnessActivities({ category: wellnessCategoryFilter, search: wellnessSearch });
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverImageUploadState, setCoverImageUploadState] = useState<'idle' | 'uploading'>('idle');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [challengeType, setChallengeType] = useState<ChallengeType>('collective');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activities, setActivities] = useState<ActivityRow[]>([
    { query: '', exerciseId: undefined, targetValue: '', unit: 'Reps' },
  ]);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerTier, setPickerTier] = useState('All');
  const [groupCumulativeTarget, setGroupCumulativeTarget] = useState('');
  const [autoCompleteOnGroupTarget, setAutoCompleteOnGroupTarget] = useState(DEFAULT_AUTO_COMPLETE_ON_GROUP_TARGET);
  const [requiredConsecutiveDays, setRequiredConsecutiveDays] = useState('');
  const [streakResetOnMiss, setStreakResetOnMiss] = useState(DEFAULT_STREAK_RESET_ON_MISS);

  const [donationEnabled, setDonationEnabled] = useState(false);
  const [causeName, setCauseName] = useState('');
  const [causeDescription, setCauseDescription] = useState('');
  const [targetAmountKes, setTargetAmountKes] = useState('');
  const [donationCurrency, setDonationCurrency] = useState<'KES' | 'RWF' | 'UGX'>('KES');
  const [contributionStartDate, setContributionStartDate] = useState('');
  const [contributionEndDate, setContributionEndDate] = useState('');
  const [contributionPhoneNumber, setContributionPhoneNumber] = useState('');
  const [contributionCardUrl, setContributionCardUrl] = useState('');
  const [isSavingWellnessTemplate, setIsSavingWellnessTemplate] = useState(false);

  const exerciseById = useMemo(
    () => new Map(exercises.map((item) => [item.id, item])),
    [exercises],
  );

  const resolvedActivities = useMemo<ResolvedActivity[]>(() => {
    if (templateMode === 'wellness') {
      const out: ResolvedActivity[] = [];
      activities.forEach((item) => {
        if (!item.activityId || Number(item.targetValue) <= 0) return;
        out.push({
          activityId: item.activityId,
          activityType: item.activityType,
          exerciseName: item.query,
          description: item.description,
          category: item.category,
          difficulty: item.difficulty,
          icon: item.icon,
          protocolSteps: item.protocolSteps,
          benefits: item.benefits,
          guidelines: item.guidelines,
          warnings: item.warnings,
          frequency: item.frequency ?? 'daily',
          pointsPerCompletion: item.pointsPerCompletion ?? 10,
          dailyFrequency: item.dailyFrequency ?? 1,
          instructions: item.instructions,
          targetValue: Number(item.targetValue),
          unit: item.unit || 'count',
        });
      });
      return out;
    }
    const out: ResolvedActivity[] = [];
    activities.forEach((item) => {
      const query = normalize(item.query);
      const direct = item.exerciseId ? exerciseById.get(item.exerciseId) : null;
      const matched =
        direct
        ?? exercises.find((exercise) => {
          const normalizedName = normalize(exercise.name);
          return normalizedName === query || normalizedName.includes(query) || query.includes(normalizedName);
        });
      if (!matched || Number(item.targetValue) <= 0) return;
      out.push({
        exerciseId: matched.id,
        exerciseName: matched.name,
        targetValue: Number(item.targetValue),
        unit: item.unit || matched.metric.unit || 'Reps',
      });
    });
    return out;
  }, [activities, exerciseById, exercises]);

  const challengeDurationDays = useMemo(
    () => calculateInclusiveDurationDays(startDate, endDate),
    [startDate, endDate],
  );

  const activityTierOptions = useMemo(
    () => ['All', ...Array.from(new Set(exercises.map((e) => e.tier_1))).slice(0, 6)],
    [exercises],
  );

  const pickerExercises = useMemo(() => {
    const q = normalize(pickerSearch);
    return exercises
      .filter((exercise) => {
        const tierMatch = pickerTier === 'All' || exercise.tier_1 === pickerTier;
        if (!tierMatch) return false;
        if (!q) return true;
        return normalize(exercise.name).includes(q) || normalize(exercise.tier_1).includes(q) || normalize(exercise.tier_2).includes(q);
      })
      .slice(0, 60);
  }, [exercises, pickerSearch, pickerTier]);

  const canSaveTemplate = !!name.trim() && description.trim().length >= 8 && resolvedActivities.length > 0;

  const updateActivity = (index: number, patch: Partial<ActivityRow>) => {
    setActivities((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const addActivity = () => {
    setActivities((prev) => [...prev, { query: '', exerciseId: undefined, targetValue: '', unit: templateMode === 'wellness' ? 'count' : 'Reps' }]);
  };

  const handleTypeChange = (newType: ChallengeType) => {
    if (newType !== 'streak' && activities.length > 1) {
      setActivities((prev) => [prev[0]]);
    }
    setChallengeType(newType);
  };

  const openActivityPicker = (index: number) => {
    setPickerIndex(index);
    setPickerSearch(activities[index]?.query ?? '');
    setPickerTier('All');
  };

  const closeActivityPicker = () => {
    setPickerIndex(null);
    setPickerSearch('');
    setPickerTier('All');
  };

  const pickExerciseForActivity = (exercise: CatalogExercise) => {
    if (pickerIndex === null) return;
    const isIsometric = exercise.holdBased === true || exercise.movementType === 'isometric';
    const raw = exercise.metric.unit;
    const unit = isIsometric
      ? (raw === 'minutes' ? 'Minutes' : 'Seconds')
      : (raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Reps');
    updateActivity(pickerIndex, {
      query: exercise.name,
      exerciseId: exercise.id,
      unit,
    });
    closeActivityPicker();
  };

  const openWellnessPicker = (index: number) => {
    setPickerIndex(index);
    setWellnessPickerOpen(true);
    setWellnessCategoryFilter('all');
    setWellnessSearch('');
  };

  const closeWellnessPicker = () => {
    setWellnessPickerOpen(false);
    setWellnessCategoryFilter('all');
    setWellnessSearch('');
    setPickerIndex(null);
  };

  const pickWellnessActivity = (activity: WellnessActivity) => {
    if (pickerIndex === null) return;
    updateActivity(pickerIndex, {
      query: activity.name,
      exerciseId: undefined,
      activityId: activity.id,
      activityType: activity.activityType,
      description: activity.description,
      category: activity.category,
      difficulty: activity.difficulty,
      icon: activity.icon,
      protocolSteps: activity.protocolSteps,
      benefits: activity.benefits,
      guidelines: activity.guidelines,
      warnings: activity.warnings,
      frequency: 'daily',
      targetValue: String(activity.defaultTargetValue),
      unit: activity.defaultMetricUnit,
      instructions: activity.protocolSteps,
      dailyFrequency: activity.suggestedFrequency,
    });
    closeWellnessPicker();
  };

  const removeActivity = (index: number) => {
    if (activities.length === 1) return;
    setActivities((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCoverFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setCoverImageUploadState('uploading');
      const uploadedUrl = await uploadImageFile(file, 'challenge-covers', user?.uid);
      setCoverImageUrl(uploadedUrl);
      showToast('Challenge cover uploaded.', 'success');
    } catch (error) {
      console.error('Challenge cover upload failed:', error);
      try {
        const fallbackDataUrl = await readFileAsDataUrl(file);
        setCoverImageUrl(fallbackDataUrl);
        showToast('Using local image preview. Upload will depend on storage permissions.', 'info');
      } catch {
        showToast('Could not read selected image.', 'error');
      }
    } finally {
      setCoverImageUploadState('idle');
      if (event.target) event.target.value = '';
    }
  };

  const donationPayload = donationEnabled
    ? {
        enabled: true,
        causeName: causeName.trim(),
        causeDescription: causeDescription.trim(),
        targetAmountKes: Number(targetAmountKes) || 0,
        currency: donationCurrency,
        contributionStartDate: contributionStartDate || undefined,
        contributionEndDate: contributionEndDate || undefined,
        contributionPhoneNumber: contributionPhoneNumber.trim() || undefined,
        contributionCardUrl: contributionCardUrl.trim() || undefined,
        disclaimer: DONATION_PAYLOAD_DISCLAIMER,
      }
    : { enabled: false };

  const onSaveTemplate = async (publish = false) => {
    const validationError = validateChallengeForm({
      name,
      description,
      startDate,
      endDate,
      challengeType,
      activities,
      requiredConsecutiveDays,
      durationDays: challengeDurationDays,
      donationEnabled,
      causeName,
      causeDescription,
      contributionPhoneNumber,
      contributionCardUrl,
    });
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    const normalizedCover = coverImageUrl.trim();
    const persistableCover = isPersistableImageSource(normalizedCover) ? normalizedCover : undefined;

    // Collective and Competitive support exactly one activity; cap to first.
    const finalActivities = challengeType !== 'streak' ? resolvedActivities.slice(0, 1) : resolvedActivities;

    try {
      if (templateMode === 'wellness') {
        setIsSavingWellnessTemplate(true);
        const primaryCategory = (finalActivities[0]?.category as 'fasting' | 'hydration' | 'sleep' | 'mindfulness' | 'nutrition' | 'habits' | 'stress' | 'social' | undefined) ?? 'habits';
        const mergedBenefits = Array.from(new Set(finalActivities.flatMap((activity) => activity.benefits ?? [])));
        const mergedGuidelines = Array.from(new Set(finalActivities.flatMap((activity) => activity.guidelines ?? [])));
        const mergedWarnings = Array.from(new Set(finalActivities.flatMap((activity) => activity.warnings ?? [])));
        await wellnessTemplateService.createTemplate({
          category: primaryCategory,
          name: name.trim(),
          description: description.trim(),
          difficulty: 'beginner',
          type: challengeType,
          duration: challengeDurationDays ?? DURATION_FALLBACK_DAYS,
          coverImage: persistableCover,
          icon: '✨',
          color: '#FF6B00',
          activities: finalActivities.map((activity, index) => ({
            activityId: activity.activityId ?? `wellness-${index + 1}`,
            order: index + 1,
            activityType: activity.activityType ?? 'habit',
            name: activity.exerciseName ?? `Activity ${index + 1}`,
            description: activity.description,
            category: activity.category,
            difficulty: activity.difficulty,
            icon: activity.icon,
            instructions: activity.instructions,
            protocolSteps: activity.protocolSteps,
            benefits: activity.benefits,
            guidelines: activity.guidelines,
            warnings: activity.warnings,
            metricUnit: activity.unit,
            targetValue: activity.targetValue,
            frequency: activity.frequency,
            dailyFrequency: activity.dailyFrequency,
          })),
          benefits: mergedBenefits,
          guidelines: mergedGuidelines,
          warnings: mergedWarnings,
          isPublished: publish,
          // Engine-specific fields — same as fitness templates
          ...(challengeType === 'collective' ? {
            groupCumulativeTarget: Number(finalActivities[0]?.targetValue ?? 0),
            autoCompleteOnGroupTarget,
          } : {}),
          ...(challengeType === 'streak' && Number(requiredConsecutiveDays) > 0 ? {
            requiredConsecutiveDays: Number(requiredConsecutiveDays),
            streakResetOnMiss,
          } : {}),
        });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['admin-challenge-templates'] }),
          queryClient.invalidateQueries({ queryKey: ['wellness-templates'] }),
        ]);
      } else {
        await createTemplateMutation.mutateAsync({
          category: 'fitness',
          name: name.trim(),
          description: description.trim(),
          challengeType,
          durationDays: challengeDurationDays ?? DURATION_FALLBACK_DAYS,
          difficultyLevel: 'beginner',
          coverImageUrl: persistableCover,
          ...(challengeType === 'collective' ? {
            groupCumulativeTarget: Number(finalActivities[0]?.targetValue ?? 0),
            autoCompleteOnGroupTarget,
          } : {}),
          ...(challengeType === 'streak' && Number(requiredConsecutiveDays) > 0 ? {
            requiredConsecutiveDays: Number(requiredConsecutiveDays),
            streakResetOnMiss,
          } : {}),
          activities: finalActivities,
          donation: donationPayload,
          isPublished: publish,
        });
      }
      showToast(publish ? 'Template published.' : 'Template saved as draft.', 'success');
      navigate('/app/admin/challenges/templates');
    } catch (error) {
      console.error('Save template failed:', error);
      showToast('Could not save template.', 'error');
    } finally {
      setIsSavingWellnessTemplate(false);
    }
  };

  return (
    <AdminLayout title="Create Challenge / Template" permissions={permissions}>
      <Card>
        <div className="space-y-4">
          <ChallengeBasicInfoSection
            coverImageUrl={coverImageUrl}
            coverImageUploadState={coverImageUploadState}
            onCoverFileChange={handleCoverFileSelected}
            onCoverUrlChange={setCoverImageUrl}
            name={name}
            onNameChange={setName}
            description={description}
            onDescriptionChange={setDescription}
            isWellnessMode={templateMode === 'wellness'}
            onModeChange={(mode) => setTemplateMode(mode)}
            challengeType={challengeType}
            onTypeChange={handleTypeChange}
          />

          <ChallengeEngineSettingsSection
            challengeType={challengeType}
            groupCumulativeTarget={groupCumulativeTarget}
            onGroupCumulativeTargetChange={setGroupCumulativeTarget}
            autoCompleteOnGroupTarget={autoCompleteOnGroupTarget}
            onAutoCompleteOnGroupTargetChange={setAutoCompleteOnGroupTarget}
            requiredConsecutiveDays={requiredConsecutiveDays}
            onRequiredConsecutiveDaysChange={setRequiredConsecutiveDays}
            streakResetOnMiss={streakResetOnMiss}
            onStreakResetOnMissChange={setStreakResetOnMiss}
          />

          <ChallengeTimelineSection
            startDate={startDate}
            onStartDateChange={setStartDate}
            endDate={endDate}
            onEndDateChange={setEndDate}
            durationDays={challengeDurationDays}
            responsive
          />

          <ChallengeActivitySection
            isWellnessMode={templateMode === 'wellness'}
            challengeType={challengeType}
            activities={activities}
            onUpdateActivity={updateActivity}
            onAddActivity={addActivity}
            onRemoveActivity={removeActivity}
            exercises={exercises}
            isExercisesLoading={isExercisesLoading}
            isExercisesError={isExercisesError}
            wellnessActivities={wellnessActivities}
            isWellnessActivitiesLoading={isWellnessLoading}
            isWellnessActivitiesError={isWellnessError}
            fitnessPicker={pickerIndex !== null}
            fitnessPickerIndex={pickerIndex}
            fitnessPickerSearch={pickerSearch}
            onFitnessPickerSearchChange={setPickerSearch}
            fitnessPickerExercises={pickerExercises}
            fitnessPickerTierOptions={activityTierOptions}
            fitnessPickerTier={pickerTier}
            onFitnessPickerTierChange={setPickerTier}
            onOpenFitnessPicker={openActivityPicker}
            onCloseFitnessPicker={closeActivityPicker}
            onPickFitnessExercise={pickExerciseForActivity}
            wellnessPickerOpen={wellnessPickerOpen}
            wellnessPickerIndex={pickerIndex}
            wellnessPickerSearch={wellnessSearch}
            onWellnessPickerSearchChange={setWellnessSearch}
            wellnessPickerCategoryFilter={wellnessCategoryFilter}
            onWellnessPickerCategoryFilterChange={setWellnessCategoryFilter}
            isWellnessPickerLoading={isWellnessLoading}
            onOpenWellnessPicker={openWellnessPicker}
            onCloseWellnessPicker={closeWellnessPicker}
            onPickWellnessActivity={pickWellnessActivity}
          />

          <ChallengeDonationSection
            donationEnabled={donationEnabled}
            onDonationEnabledChange={setDonationEnabled}
            causeName={causeName}
            onCauseNameChange={setCauseName}
            causeDescription={causeDescription}
            onCauseDescriptionChange={setCauseDescription}
            targetAmountKes={targetAmountKes}
            onTargetAmountKesChange={setTargetAmountKes}
            currency={donationCurrency}
            onCurrencyChange={setDonationCurrency}
            contributionStartDate={contributionStartDate}
            onContributionStartDateChange={setContributionStartDate}
            contributionEndDate={contributionEndDate}
            onContributionEndDateChange={setContributionEndDate}
            contributionPhoneNumber={contributionPhoneNumber}
            onContributionPhoneNumberChange={setContributionPhoneNumber}
            contributionCardUrl={contributionCardUrl}
            onContributionCardUrlChange={setContributionCardUrl}
          />

          <div className="flex gap-2 flex-wrap pt-2">
            <button className="h-11 rounded-xl bg-slate-100 px-4 text-[14px] font-bold text-slate-700" onClick={() => navigate('/app/admin/challenges/active')}>
              Cancel
            </button>
            <button
              className="h-11 rounded-xl border border-primary px-4 text-[14px] font-bold text-primary disabled:opacity-50"
              disabled={!permissions.canManageContent || !canSaveTemplate || createTemplateMutation.isPending || isSavingWellnessTemplate}
              onClick={() => onSaveTemplate(false)}
            >
              {(createTemplateMutation.isPending || isSavingWellnessTemplate) ? 'Saving…' : 'Save as Draft'}
            </button>
            <button
              className="h-11 rounded-xl bg-primary px-4 text-[14px] font-bold text-white disabled:opacity-50"
              disabled={!permissions.canManageContent || !canSaveTemplate || createTemplateMutation.isPending || isSavingWellnessTemplate}
              onClick={() => onSaveTemplate(true)}
            >
              {(createTemplateMutation.isPending || isSavingWellnessTemplate) ? 'Publishing…' : 'Save & Publish'}
            </button>
          </div>
        </div>
      </Card>

    </AdminLayout>
  );
}

export default CreateChallengeScreen;
