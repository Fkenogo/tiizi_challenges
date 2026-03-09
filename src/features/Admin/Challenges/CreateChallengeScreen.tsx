import { Calendar, Camera, Plus, Search, Trash2, X } from 'lucide-react';
import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/Mobile';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useCreateSuggestedChallengeTemplate } from '../../../hooks/useChallengeTemplates';
import { useExercises } from '../../../hooks/useExercises';
import { useWellnessActivities } from '../../../hooks/useWellnessActivities';
import { isLikelyDirectImageUrl, isPersistableImageSource, isValidImageUrl, readFileAsDataUrl, uploadImageFile } from '../../../services/imageUploadService';
import { wellnessTemplateService } from '../../../services/wellnessTemplateService';
import { AdminLayout } from '../layout/AdminLayout';
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
  frequency?: 'daily' | 'weekly' | '3x-week' | 'custom';
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
  frequency?: 'daily' | 'weekly' | '3x-week' | 'custom';
  targetValue: number;
  unit: string;
  instructions?: string[];
  pointsPerCompletion?: number;
  dailyFrequency?: number;
};

const typeOptions: Array<{ id: ChallengeType; label: string }> = [
  { id: 'collective', label: 'Collective' },
  { id: 'competitive', label: 'Competitive' },
  { id: 'streak', label: 'Streak' },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toDurationDays(startDate: string, endDate: string) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
}

function CreateChallengeScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions } = useAdminPermissions(user?.uid);
  const createTemplateMutation = useCreateSuggestedChallengeTemplate();
  const { data: exercises = [], isLoading: isExercisesLoading, isError: isExercisesError } = useExercises();
  const [templateMode, setTemplateMode] = useState<'fitness' | 'wellness'>('fitness');
  const [wellnessPickerOpen, setWellnessPickerOpen] = useState(false);
  const [wellnessCategoryFilter, setWellnessCategoryFilter] = useState<'all' | WellnessActivity['category']>('all');
  const [wellnessSearch, setWellnessSearch] = useState('');
  const {
    data: wellnessActivities = [],
    isLoading: isWellnessLoading,
    isError: isWellnessError,
  } = useWellnessActivities({ category: wellnessCategoryFilter, search: wellnessSearch });
  const coverInputRef = useRef<HTMLInputElement>(null);

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

  const [donationEnabled, setDonationEnabled] = useState(false);
  const [causeName, setCauseName] = useState('');
  const [causeDescription, setCauseDescription] = useState('');
  const [targetAmountKes, setTargetAmountKes] = useState('');
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
    () => toDurationDays(startDate, endDate),
    [startDate, endDate],
  );

  const pickerResults = useMemo(() => {
    const q = normalize(pickerSearch);
    if (!q) return exercises.slice(0, 60);
    return exercises
      .filter((exercise) => normalize(exercise.name).includes(q) || normalize(exercise.tier_1).includes(q) || normalize(exercise.tier_2).includes(q))
      .slice(0, 60);
  }, [exercises, pickerSearch]);

  const canSaveTemplate = !!name.trim() && !!description.trim() && resolvedActivities.length > 0;

  const updateActivity = (index: number, patch: Partial<ActivityRow>) => {
    setActivities((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const addActivity = () => {
    setActivities((prev) => [...prev, { query: '', exerciseId: undefined, targetValue: '', unit: templateMode === 'wellness' ? 'count' : 'Reps' }]);
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
      pointsPerCompletion: activity.defaultPoints,
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
        showToast('Using local image preview. Upload depends on storage permissions.', 'info');
      } catch {
        showToast('Could not read selected image.', 'error');
      }
    } finally {
      setCoverImageUploadState('idle');
      if (event.target) event.target.value = '';
    }
  };

  const validateDonationBlock = () => {
    if (!donationEnabled) return true;
    if (!causeName.trim() || !causeDescription.trim()) {
      showToast('Add cause name and description for Fitness + Cause.', 'error');
      return false;
    }
    if (!contributionPhoneNumber.trim() && !contributionCardUrl.trim()) {
      showToast('Add at least one contribution channel (phone/card URL).', 'error');
      return false;
    }
    return true;
  };

  const donationPayload = donationEnabled
    ? {
        enabled: true,
        causeName: causeName.trim(),
        causeDescription: causeDescription.trim(),
        targetAmountKes: Number(targetAmountKes) || 0,
        contributionStartDate: contributionStartDate || undefined,
        contributionEndDate: contributionEndDate || undefined,
        contributionPhoneNumber: contributionPhoneNumber.trim() || undefined,
        contributionCardUrl: contributionCardUrl.trim() || undefined,
        disclaimer: 'Tiizi does not hold or manage funds. Contributions are coordinated by the group.',
      }
    : { enabled: false };

  const onSaveTemplate = async () => {
    if (!canSaveTemplate) return;
    if (!validateDonationBlock()) return;

    const normalizedCover = coverImageUrl.trim();
    const persistableCover = isPersistableImageSource(normalizedCover) ? normalizedCover : undefined;

    try {
      if (templateMode === 'wellness') {
        setIsSavingWellnessTemplate(true);
        const primaryCategory = (resolvedActivities[0]?.category as 'fasting' | 'hydration' | 'sleep' | 'mindfulness' | 'nutrition' | 'habits' | 'stress' | 'social' | undefined) ?? 'habits';
        const mergedBenefits = Array.from(new Set(resolvedActivities.flatMap((activity) => activity.benefits ?? [])));
        const mergedGuidelines = Array.from(new Set(resolvedActivities.flatMap((activity) => activity.guidelines ?? [])));
        const mergedWarnings = Array.from(new Set(resolvedActivities.flatMap((activity) => activity.warnings ?? [])));
        await wellnessTemplateService.createTemplate({
          category: primaryCategory,
          name: name.trim(),
          description: description.trim(),
          difficulty: 'beginner',
          type: challengeType,
          duration: challengeDurationDays ?? 30,
          coverImage: persistableCover,
          icon: '✨',
          color: '#FF6B00',
          activities: resolvedActivities.map((activity, index) => ({
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
            pointsPerCompletion: activity.pointsPerCompletion,
          })),
          benefits: mergedBenefits,
          guidelines: mergedGuidelines,
          warnings: mergedWarnings,
          isPublished: true,
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
          durationDays: challengeDurationDays ?? 30,
          difficultyLevel: 'beginner',
          coverImageUrl: persistableCover,
          activities: resolvedActivities,
          donation: donationPayload,
          isPublished: true,
        });
      }
      showToast('Suggested challenge template saved.', 'success');
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
          <div className="st-card border-dashed border-primary/40 p-4 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <Camera size={24} />
            </div>
            <p className="text-[16px] leading-[22px] font-bold text-slate-900 mt-3">Upload Challenge Cover</p>
            <p className="text-[13px] leading-[18px] text-slate-500 mt-1">Add a visual for your challenge</p>
            {coverImageUrl && (coverImageUrl.startsWith('data:image/') || isLikelyDirectImageUrl(coverImageUrl)) && (
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                <img src={coverImageUrl} alt="Challenge cover preview" className="h-28 w-full object-cover" />
              </div>
            )}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverFileSelected}
            />
            <button
              className="mt-4 h-11 rounded-xl bg-primary px-5 text-[14px] font-bold text-white disabled:opacity-60"
              onClick={() => coverInputRef.current?.click()}
              disabled={coverImageUploadState === 'uploading'}
            >
              {coverImageUploadState === 'uploading' ? 'Uploading image...' : 'Choose Image'}
            </button>
            <input
              className="st-input mt-3"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="Paste image URL"
            />
            {coverImageUrl.trim() && !isValidImageUrl(coverImageUrl) && !coverImageUrl.startsWith('data:image/') && (
              <p className="mt-2 text-[12px] leading-[16px] text-amber-600">Image URL should start with http:// or https://</p>
            )}
            {isValidImageUrl(coverImageUrl) && !isLikelyDirectImageUrl(coverImageUrl) && (
              <p className="mt-2 text-[12px] leading-[16px] text-amber-600">Album/page URL accepted (e.g. imgbb album links). Preview may not render unless the URL is a direct image file.</p>
            )}
          </div>

          <p className="st-section-title text-primary">Info</p>
          <div className="space-y-3">
            <div>
              <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Challenge Name</p>
              <input className="st-input mt-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 30 Day Shred" />
            </div>
            <div>
              <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Challenge Description</p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell everyone what this is about..."
                className="w-full h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[16px] leading-[22px] text-slate-700"
              />
            </div>
          </div>

          <p className="st-section-title text-primary">Template Mode</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              className={`h-11 rounded-full text-[12px] uppercase tracking-[0.1em] font-bold ${templateMode === 'fitness' ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
              onClick={() => setTemplateMode('fitness')}
            >
              Fitness
            </button>
            <button
              className={`h-11 rounded-full text-[12px] uppercase tracking-[0.1em] font-bold ${templateMode === 'wellness' ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
              onClick={() => setTemplateMode('wellness')}
            >
              Wellness
            </button>
          </div>

          <p className="st-section-title text-primary">Challenge Type</p>
          <div className="grid grid-cols-3 gap-2">
            {typeOptions.map((option) => (
              <button
                key={option.id}
                className={`h-11 rounded-full text-[12px] uppercase tracking-[0.1em] font-bold ${challengeType === option.id ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                onClick={() => setChallengeType(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <p className="st-section-title text-primary">Timeline</p>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Start Date</p>
              <div className="relative mt-2">
                <input className="st-input pr-10" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <Calendar size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
            <div>
              <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">End Date</p>
              <div className="relative mt-2">
                <input className="st-input pr-10" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                <Calendar size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
          </div>
          <div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
              <p className="text-[13px] leading-[18px] font-semibold text-primary">
                {challengeDurationDays
                  ? `Challenge Duration: ${challengeDurationDays} day${challengeDurationDays === 1 ? '' : 's'}`
                  : 'Select both dates to calculate challenge duration.'}
              </p>
            </div>
          </div>

          <div className="st-card p-4">
            <p className="st-section-title text-primary">Challenge Activities</p>
            {isExercisesLoading && templateMode === 'fitness' ? (
              <p className="mt-2 text-[12px] leading-[16px] text-slate-500">Loading exercise library...</p>
            ) : null}
            {isExercisesError && templateMode === 'fitness' ? (
              <p className="mt-2 text-[12px] leading-[16px] text-red-600">Could not load exercise library. Retry after refresh.</p>
            ) : null}
            {isWellnessLoading && templateMode === 'wellness' ? (
              <p className="mt-2 text-[12px] leading-[16px] text-slate-500">Loading wellness activity library...</p>
            ) : null}
            {isWellnessError && templateMode === 'wellness' ? (
              <p className="mt-2 text-[12px] leading-[16px] text-red-600">Could not load wellness activity library. Retry after refresh.</p>
            ) : null}
            {activities.map((activity, index) => (
              <div key={`activity-${index}`} className="mt-3 st-card p-3 border-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-[16px] leading-[20px] font-semibold text-slate-800">Activity {index + 1}</p>
                  {activities.length > 1 && (
                    <button className="text-[13px] font-bold text-red-500" onClick={() => removeActivity(index)}>
                      Remove
                    </button>
                  )}
                </div>

                <div className="relative mt-2">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="st-input pl-10"
                    placeholder={templateMode === 'wellness' ? 'Search wellness activities' : 'Search activities (e.g. Pushups)'}
                    list={`activity-exercises-${index}`}
                    value={activity.query}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (templateMode === 'wellness') {
                        const matched = wellnessActivities.find((item) => normalize(item.name) === normalize(value));
                        updateActivity(index, {
                          query: value,
                          exerciseId: undefined,
                          activityId: matched?.id,
                          activityType: matched?.activityType,
                          category: matched?.category,
                          difficulty: matched?.difficulty,
                          icon: matched?.icon,
                          description: matched?.description,
                          protocolSteps: matched?.protocolSteps,
                          instructions: matched?.protocolSteps,
                          benefits: matched?.benefits,
                          guidelines: matched?.guidelines,
                          warnings: matched?.warnings,
                          frequency: 'daily',
                          pointsPerCompletion: matched?.defaultPoints ?? activity.pointsPerCompletion ?? 10,
                          dailyFrequency: matched?.suggestedFrequency ?? activity.dailyFrequency ?? 1,
                          unit: matched?.defaultMetricUnit || activity.unit,
                          targetValue: matched ? String(matched.defaultTargetValue) : activity.targetValue,
                        });
                        return;
                      }
                      const matched = exercises.find((item) => normalize(item.name) === normalize(value));
                      updateActivity(index, { query: value, exerciseId: matched?.id, unit: matched?.metric.unit || activity.unit });
                    }}
                  />
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center"
                    onClick={() => {
                      if (templateMode === 'wellness') {
                        openWellnessPicker(index);
                        return;
                      }
                      setPickerIndex(index);
                      setPickerSearch(activity.query || '');
                    }}
                    aria-label={templateMode === 'wellness' ? 'Browse wellness activity library' : 'Browse exercise library'}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <datalist id={`activity-exercises-${index}`}>
                  {(templateMode === 'wellness' ? wellnessActivities : exercises).slice(0, 500).map((exercise) => (
                    <option key={exercise.id} value={exercise.name} />
                  ))}
                </datalist>

                <button
                  className="mt-2 text-[13px] leading-[18px] font-bold text-primary"
                  onClick={() => {
                    if (templateMode === 'wellness') {
                      openWellnessPicker(index);
                      return;
                    }
                    setPickerIndex(index);
                    setPickerSearch(activity.query || '');
                  }}
                >
                  {templateMode === 'wellness' ? 'Browse wellness activity library and add' : 'Browse exercise library and add'}
                </button>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[14px] leading-[18px] font-semibold text-slate-800">Target Value</p>
                    <input
                      className="st-input mt-2"
                      type="number"
                      min={0}
                      value={activity.targetValue}
                      onChange={(e) => updateActivity(index, { targetValue: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <p className="text-[14px] leading-[18px] font-semibold text-slate-800">Unit</p>
                    {templateMode === 'wellness' ? (
                      <input className="st-input mt-2" value={activity.unit} onChange={(e) => updateActivity(index, { unit: e.target.value })} placeholder="hours / ml / sessions" />
                    ) : (
                      <select className="st-input mt-2 appearance-none" value={activity.unit} onChange={(e) => updateActivity(index, { unit: e.target.value })}>
                        <option value="Reps">Reps</option>
                        <option value="Seconds">Seconds</option>
                        <option value="Minutes">Minutes</option>
                        <option value="Km">Km</option>
                        <option value="Kg">Kg</option>
                      </select>
                    )}
                  </div>
                </div>
                {templateMode === 'wellness' && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[14px] leading-[18px] font-semibold text-slate-800">Frequency</p>
                      <select
                        className="st-input mt-2 appearance-none"
                        value={activity.frequency ?? 'daily'}
                        onChange={(e) => updateActivity(index, { frequency: e.target.value as ActivityRow['frequency'] })}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="3x-week">3x / week</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <div>
                      <p className="text-[14px] leading-[18px] font-semibold text-slate-800">Points</p>
                      <input
                        className="st-input mt-2"
                        type="number"
                        min={0}
                        value={activity.pointsPerCompletion ?? 10}
                        onChange={(e) => updateActivity(index, { pointsPerCompletion: Number(e.target.value || 0) })}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}

            <button className="mt-4 w-full h-12 rounded-2xl border border-dashed border-primary/40 text-[15px] leading-[20px] font-bold text-primary flex items-center justify-center gap-2" onClick={addActivity}>
              <Plus size={16} /> Add Another Activity
            </button>
          </div>

          <div className="st-card p-4">
            <div className="flex items-center justify-between">
              <p className="st-section-title text-primary">Fitness + Cause</p>
              <button className={`st-toggle ${donationEnabled ? 'on' : ''}`} onClick={() => setDonationEnabled((prev) => !prev)}>
                <span />
              </button>
            </div>

            <p className="text-[12px] leading-[16px] text-slate-500 mt-1">Mark this challenge as a fundraising challenge.</p>

            {donationEnabled && (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Cause Name</p>
                  <input className="st-input mt-2" value={causeName} onChange={(e) => setCauseName(e.target.value)} placeholder="e.g. Community Health Fund" />
                </div>
                <div>
                  <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Cause Description</p>
                  <textarea
                    className="w-full h-20 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[16px] leading-[22px] text-slate-700"
                    value={causeDescription}
                    onChange={(e) => setCauseDescription(e.target.value)}
                    placeholder="Describe the cause and expected impact"
                  />
                </div>
                <div>
                  <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Target Contribution (KES, optional)</p>
                  <input className="st-input mt-2" type="number" min={0} value={targetAmountKes} onChange={(e) => setTargetAmountKes(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Contribution Start</p>
                    <input className="st-input mt-2" type="date" value={contributionStartDate} onChange={(e) => setContributionStartDate(e.target.value)} />
                  </div>
                  <div>
                    <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Contribution End</p>
                    <input className="st-input mt-2" type="date" value={contributionEndDate} onChange={(e) => setContributionEndDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Donate Here: Mobile Number</p>
                  <input className="st-input mt-2" value={contributionPhoneNumber} onChange={(e) => setContributionPhoneNumber(e.target.value)} placeholder="e.g. +2547XXXXXXXX" />
                </div>
                <div>
                  <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Donate Here: Card Link (optional)</p>
                  <input className="st-input mt-2" value={contributionCardUrl} onChange={(e) => setContributionCardUrl(e.target.value)} placeholder="https://..." />
                </div>
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-[16px] text-amber-800">
                  Tiizi does not hold or manage funds. Contributions are coordinated by the group. Donation-enabled challenges require super admin approval before going active.
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap pt-2">
            <button className="h-11 rounded-xl bg-slate-100 px-4 text-[14px] font-bold text-slate-700" onClick={() => navigate('/app/admin/challenges/active')}>
              Cancel
            </button>
            <button
              className="h-11 rounded-xl bg-primary px-4 text-[14px] font-bold text-white disabled:opacity-50"
              disabled={!permissions.canManageContent || !canSaveTemplate || createTemplateMutation.isPending || isSavingWellnessTemplate}
              onClick={onSaveTemplate}
            >
              {(createTemplateMutation.isPending || isSavingWellnessTemplate)
                ? 'Saving...'
                : templateMode === 'wellness'
                  ? 'Save Wellness Suggested Template'
                  : 'Save Suggested Template'}
            </button>
          </div>
        </div>
      </Card>

      {pickerIndex !== null && templateMode === 'fitness' && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-end">
          <div className="w-full max-w-mobile mx-auto rounded-t-3xl bg-white p-5 pb-7 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[18px] leading-[22px] font-black text-slate-900">Exercise Library</p>
                <p className="text-[13px] leading-[18px] text-slate-600">Select an exercise to add to Activity {pickerIndex + 1}</p>
              </div>
              <button className="h-9 w-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center" onClick={() => setPickerIndex(null)} aria-label="Close picker">
                <X size={18} />
              </button>
            </div>
            <div className="relative mt-3">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="st-input pl-10"
                placeholder="Search exercises"
                value={pickerSearch}
                onChange={(event) => setPickerSearch(event.target.value)}
              />
            </div>
            <div className="mt-3 space-y-2">
              {pickerResults.map((exercise) => (
                <button
                  key={exercise.id}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-left"
                  onClick={() => {
                    updateActivity(pickerIndex, {
                      query: exercise.name,
                      exerciseId: exercise.id,
                      unit: exercise.metric.unit || 'Reps',
                    });
                    setPickerIndex(null);
                  }}
                >
                  <p className="text-[14px] font-bold text-slate-900">{exercise.name}</p>
                  <p className="text-[12px] text-slate-500 mt-1">{exercise.tier_1} • {exercise.tier_2} • {exercise.difficulty}</p>
                </button>
              ))}
              {!isExercisesLoading && pickerResults.length === 0 ? (
                <p className="text-[13px] text-slate-500 px-1">No exercises found. Adjust search and try again.</p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {wellnessPickerOpen && templateMode === 'wellness' && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-end">
          <div className="w-full max-w-mobile mx-auto rounded-t-3xl bg-white p-5 pb-7 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[18px] leading-[22px] font-black text-slate-900">Wellness Activity Library</p>
                <p className="text-[13px] leading-[18px] text-slate-600">Select an activity to add to Activity {(pickerIndex ?? 0) + 1}</p>
              </div>
              <button className="h-9 w-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center" onClick={closeWellnessPicker} aria-label="Close picker">
                <X size={18} />
              </button>
            </div>
            <div className="relative mt-3">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="st-input pl-10"
                placeholder="Search wellness activities"
                value={wellnessSearch}
                onChange={(event) => setWellnessSearch(event.target.value)}
              />
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {(['all', 'fasting', 'hydration', 'sleep', 'mindfulness', 'nutrition', 'habits', 'stress', 'social'] as const).map((category) => (
                <button
                  key={category}
                  className={`h-9 rounded-full px-3 text-[12px] leading-[16px] font-semibold uppercase whitespace-nowrap ${wellnessCategoryFilter === category ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                  onClick={() => setWellnessCategoryFilter(category)}
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {wellnessActivities.map((activity) => (
                <button
                  key={activity.id}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-left"
                  onClick={() => pickWellnessActivity(activity)}
                >
                  <p className="text-[14px] font-bold text-slate-900">{activity.icon} {activity.name}</p>
                  <p className="text-[12px] text-slate-500 mt-1">{activity.category} • {activity.difficulty} • {activity.defaultTargetValue} {activity.defaultMetricUnit}</p>
                </button>
              ))}
              {!isWellnessLoading && wellnessActivities.length === 0 ? (
                <p className="text-[13px] text-slate-500 px-1">No wellness activities found. Adjust search and try again.</p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default CreateChallengeScreen;
