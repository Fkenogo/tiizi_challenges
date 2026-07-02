import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useSuggestedChallengeTemplate, useUpdateTemplate, usePublishTemplate } from '../../../hooks/useChallengeTemplates';
import { useExercises } from '../../../hooks/useExercises';
import { isLikelyDirectImageUrl, isPersistableImageSource, isValidImageUrl, readFileAsDataUrl, uploadImageFile } from '../../../services/imageUploadService';
import { AdminLayout } from '../layout/AdminLayout';
import { ChallengeActivitySection } from '../../Challenges/components/ChallengeActivitySection';
import type { ActivityRow } from '../../Challenges/components/ChallengeActivitySection';
import type { CatalogExercise } from '../../../types';

type ChallengeType = 'collective' | 'competitive' | 'streak';

const typeOptions: Array<{ id: ChallengeType; label: string }> = [
  { id: 'collective', label: 'Collective' },
  { id: 'competitive', label: 'Competitive' },
  { id: 'streak', label: 'Streak' },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function EditChallengeTemplateScreen() {
  const { id: templateId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data: template, isLoading: isTemplateLoading } = useSuggestedChallengeTemplate(templateId);
  const updateMutation = useUpdateTemplate();
  const publishMutation = usePublishTemplate();
  const { data: exercises = [], isLoading: isExercisesLoading, isError: isExercisesError } = useExercises();
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [initialized, setInitialized] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverImageUploadState, setCoverImageUploadState] = useState<'idle' | 'uploading'>('idle');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [challengeType, setChallengeType] = useState<ChallengeType>('collective');
  const [durationDays, setDurationDays] = useState('30');
  const [difficultyLevel, setDifficultyLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [activities, setActivities] = useState<ActivityRow[]>([{ query: '', exerciseId: undefined, targetValue: '', unit: 'Reps' }]);
  const [groupCumulativeTarget, setGroupCumulativeTarget] = useState('');
  const [autoCompleteOnGroupTarget, setAutoCompleteOnGroupTarget] = useState(true);
  const [requiredConsecutiveDays, setRequiredConsecutiveDays] = useState('');
  const [streakResetOnMiss, setStreakResetOnMiss] = useState(true);

  // Fitness picker state
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerTier, setPickerTier] = useState('All');

  // Pre-populate from loaded template
  useEffect(() => {
    if (!template || initialized) return;
    setCoverImageUrl(template.coverImageUrl ?? '');
    setName(template.name);
    setDescription(template.description);
    setChallengeType(template.challengeType);
    setDurationDays(String(template.durationDays));
    setDifficultyLevel(template.difficultyLevel ?? 'beginner');
    if (template.activities.length > 0) {
      setActivities(template.activities.map((a) => ({
        query: a.exerciseName,
        exerciseId: a.exerciseId,
        targetValue: String(a.targetValue),
        unit: a.unit,
      })));
    }
    if (template.groupCumulativeTarget != null) setGroupCumulativeTarget(String(template.groupCumulativeTarget));
    if (template.autoCompleteOnGroupTarget != null) setAutoCompleteOnGroupTarget(template.autoCompleteOnGroupTarget);
    if (template.requiredConsecutiveDays != null) setRequiredConsecutiveDays(String(template.requiredConsecutiveDays));
    if (template.streakResetOnMiss != null) setStreakResetOnMiss(template.streakResetOnMiss);
    setInitialized(true);
  }, [template, initialized]);

  const exerciseById = useMemo(
    () => new Map(exercises.map((item) => [item.id, item])),
    [exercises],
  );

  const resolvedActivities = useMemo(() => {
    const out: Array<{ exerciseId?: string; exerciseName: string; targetValue: number; unit: string }> = [];
    activities.forEach((item) => {
      const query = normalize(item.query);
      const direct = item.exerciseId ? exerciseById.get(item.exerciseId) : null;
      const matched = direct ?? exercises.find((e) => {
        const n = normalize(e.name);
        return n === query || n.includes(query) || query.includes(n);
      });
      if (!matched || Number(item.targetValue) <= 0) return;
      out.push({ exerciseId: matched.id, exerciseName: matched.name, targetValue: Number(item.targetValue), unit: item.unit || matched.metric.unit || 'Reps' });
    });
    return out;
  }, [activities, exerciseById, exercises]);

  const activityTierOptions = useMemo(
    () => ['All', ...Array.from(new Set(exercises.map((e) => e.tier_1))).slice(0, 6)],
    [exercises],
  );

  const pickerExercises = useMemo(() => {
    const q = normalize(pickerSearch);
    return exercises
      .filter((e) => {
        const tierMatch = pickerTier === 'All' || e.tier_1 === pickerTier;
        if (!tierMatch) return false;
        if (!q) return true;
        return normalize(e.name).includes(q) || normalize(e.tier_1).includes(q) || normalize(e.tier_2).includes(q);
      })
      .slice(0, 60);
  }, [exercises, pickerSearch, pickerTier]);

  const canSave = !!name.trim() && !!description.trim() && resolvedActivities.length > 0;

  const updateActivity = (index: number, patch: Partial<ActivityRow>) =>
    setActivities((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));

  const addActivity = () =>
    setActivities((prev) => [...prev, { query: '', exerciseId: undefined, targetValue: '', unit: 'Reps' }]);

  const handleTypeChange = (newType: ChallengeType) => {
    if (newType !== 'streak' && activities.length > 1) {
      setActivities((prev) => [prev[0]]);
    }
    setChallengeType(newType);
  };

  const removeActivity = (index: number) => {
    if (activities.length === 1) return;
    setActivities((prev) => prev.filter((_, idx) => idx !== index));
  };

  const openFitnessPicker = (index: number) => {
    setPickerIndex(index);
    setPickerSearch(activities[index]?.query ?? '');
    setPickerTier('All');
  };

  const closeFitnessPicker = () => {
    setPickerIndex(null);
    setPickerSearch('');
    setPickerTier('All');
  };

  const pickFitnessExercise = (exercise: CatalogExercise) => {
    if (pickerIndex === null) return;
    updateActivity(pickerIndex, {
      query: exercise.name,
      exerciseId: exercise.id,
      unit: exercise.metric.unit || 'Reps',
    });
    closeFitnessPicker();
  };

  const handleCoverFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setCoverImageUploadState('uploading');
      const url = await uploadImageFile(file, 'challenge-covers', user?.uid);
      setCoverImageUrl(url);
      showToast('Cover uploaded.', 'success');
    } catch {
      try {
        setCoverImageUrl(await readFileAsDataUrl(file));
      } catch {
        showToast('Could not read selected image.', 'error');
      }
    } finally {
      setCoverImageUploadState('idle');
      if (event.target) event.target.value = '';
    }
  };

  const buildPayload = () => {
    const persistableCover = isPersistableImageSource(coverImageUrl.trim()) ? coverImageUrl.trim() : undefined;
    return {
      name: name.trim(),
      description: description.trim(),
      challengeType,
      durationDays: Number(durationDays) || 30,
      difficultyLevel,
      coverImageUrl: persistableCover,
      activities: resolvedActivities,
      ...(challengeType === 'collective' && Number(groupCumulativeTarget) > 0 ? {
        groupCumulativeTarget: Number(groupCumulativeTarget),
        autoCompleteOnGroupTarget,
      } : {}),
      ...(challengeType === 'streak' && Number(requiredConsecutiveDays) > 0 ? {
        requiredConsecutiveDays: Number(requiredConsecutiveDays),
        streakResetOnMiss,
      } : {}),
    };
  };

  const onSaveDraft = async () => {
    if (!canSave || !templateId) return;
    try {
      await updateMutation.mutateAsync({ templateId, payload: buildPayload() });
      showToast('Template saved as draft.', 'success');
      navigate('/app/admin/challenges/templates');
    } catch {
      showToast('Could not save template.', 'error');
    }
  };

  const onSaveAndPublish = async () => {
    if (!canSave || !templateId) return;
    try {
      await updateMutation.mutateAsync({ templateId, payload: buildPayload() });
      await publishMutation.mutateAsync(templateId);
      showToast('Template saved and published.', 'success');
      navigate('/app/admin/challenges/templates');
    } catch {
      showToast('Could not publish template.', 'error');
    }
  };

  if (isTemplateLoading) return <LoadingSpinner fullScreen label="Loading template…" />;
  if (!template) return (
    <AdminLayout title="Edit Template" permissions={permissions}>
      <Card><p className="text-sm text-slate-700">Template not found.</p></Card>
    </AdminLayout>
  );

  const isBusy = updateMutation.isPending || publishMutation.isPending;

  return (
    <AdminLayout title={`Edit Template — ${template.name}`} permissions={permissions}>
      <Card>
        <div className="space-y-4">
          {/* Cover */}
          <div className="st-card border-dashed border-primary/40 p-4 text-center">
            {coverImageUrl && (coverImageUrl.startsWith('data:image/') || isLikelyDirectImageUrl(coverImageUrl)) && (
              <div className="mb-3 overflow-hidden rounded-xl border border-slate-200">
                <img src={coverImageUrl} alt="Cover preview" className="h-28 w-full object-cover" />
              </div>
            )}
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverFileSelected} />
            <button
              className="h-10 rounded-xl bg-primary px-4 text-[13px] font-bold text-white disabled:opacity-60"
              onClick={() => coverInputRef.current?.click()}
              disabled={coverImageUploadState === 'uploading'}
            >
              {coverImageUploadState === 'uploading' ? 'Uploading…' : 'Change Cover Image'}
            </button>
            <input className="st-input mt-2" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="Or paste image URL" />
            {coverImageUrl.trim() && !isValidImageUrl(coverImageUrl) && !coverImageUrl.startsWith('data:image/') && (
              <p className="mt-1 text-[12px] text-amber-600">URL should start with http:// or https://</p>
            )}
          </div>

          {/* Info */}
          <p className="st-section-title text-primary">Info</p>
          <div className="space-y-3">
            <div>
              <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Template Name</p>
              <input className="st-input mt-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 30 Day Shred" />
            </div>
            <div>
              <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Description</p>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell everyone what this is about…" className="w-full h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[16px] leading-[22px] text-slate-700" />
            </div>
          </div>

          {/* Challenge Type */}
          <p className="st-section-title text-primary">Challenge Type</p>
          <div className="grid grid-cols-3 gap-2">
            {typeOptions.map((option) => (
              <button key={option.id} className={`h-11 rounded-full text-[12px] uppercase tracking-[0.1em] font-bold ${challengeType === option.id ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-700'}`} onClick={() => handleTypeChange(option.id)}>
                {option.label}
              </button>
            ))}
          </div>

          {/* Difficulty & Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Difficulty</p>
              <select className="st-input mt-2 appearance-none" value={difficultyLevel} onChange={(e) => setDifficultyLevel(e.target.value as typeof difficultyLevel)}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Duration (days)</p>
              <input className="st-input mt-2" type="number" min={1} value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
            </div>
          </div>

          {/* Engine-specific config */}
          {challengeType === 'collective' && (
            <>
              <p className="st-section-title text-primary">Collective Settings</p>
              <div className="space-y-3">
                <div>
                  <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Group Cumulative Target</p>
                  <input className="st-input mt-2" type="number" min={0} value={groupCumulativeTarget} onChange={(e) => setGroupCumulativeTarget(e.target.value)} placeholder="e.g. 10000" />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[14px] leading-[18px] font-semibold text-slate-800">Auto-complete on target</p>
                  <button className={`st-toggle ${autoCompleteOnGroupTarget ? 'on' : ''}`} onClick={() => setAutoCompleteOnGroupTarget((p) => !p)}><span /></button>
                </div>
              </div>
            </>
          )}
          {challengeType === 'streak' && (
            <>
              <p className="st-section-title text-primary">Streak Settings</p>
              <div className="space-y-3">
                <div>
                  <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Required Consecutive Days</p>
                  <input className="st-input mt-2" type="number" min={1} value={requiredConsecutiveDays} onChange={(e) => setRequiredConsecutiveDays(e.target.value)} placeholder="e.g. 30" />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[14px] leading-[18px] font-semibold text-slate-800">Streak resets on missed day</p>
                  <button className={`st-toggle ${streakResetOnMiss ? 'on' : ''}`} onClick={() => setStreakResetOnMiss((p) => !p)}><span /></button>
                </div>
              </div>
            </>
          )}

          {/* Activities */}
          <ChallengeActivitySection
            isWellnessMode={false}
            challengeType={challengeType}
            activities={activities}
            onUpdateActivity={updateActivity}
            onAddActivity={addActivity}
            onRemoveActivity={removeActivity}
            exercises={exercises}
            isExercisesLoading={isExercisesLoading}
            isExercisesError={isExercisesError}
            wellnessActivities={[]}
            isWellnessActivitiesLoading={false}
            isWellnessActivitiesError={false}
            fitnessPicker={pickerIndex !== null}
            fitnessPickerIndex={pickerIndex}
            fitnessPickerSearch={pickerSearch}
            onFitnessPickerSearchChange={setPickerSearch}
            fitnessPickerExercises={pickerExercises}
            fitnessPickerTierOptions={activityTierOptions}
            fitnessPickerTier={pickerTier}
            onFitnessPickerTierChange={setPickerTier}
            onOpenFitnessPicker={openFitnessPicker}
            onCloseFitnessPicker={closeFitnessPicker}
            onPickFitnessExercise={pickFitnessExercise}
            wellnessPickerOpen={false}
            wellnessPickerIndex={null}
            wellnessPickerSearch=""
            onWellnessPickerSearchChange={() => {}}
            wellnessPickerCategoryFilter="all"
            onWellnessPickerCategoryFilterChange={() => {}}
            isWellnessPickerLoading={false}
            onOpenWellnessPicker={() => {}}
            onCloseWellnessPicker={() => {}}
            onPickWellnessActivity={() => {}}
          />

          {/* Version info */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 space-y-0.5">
            <p>Version <span className="font-bold text-slate-700">{template.version}</span> → saving will create version <span className="font-bold text-slate-700">{template.version + 1}</span></p>
            <p>Editing this template does <strong>not</strong> modify any challenges already created from it.</p>
            <p>Status: <span className="font-bold capitalize text-slate-700">{template.status}</span> · Usage: {template.usageCount} challenge{template.usageCount !== 1 ? 's' : ''} created</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap pt-2">
            <button className="h-11 rounded-xl bg-slate-100 px-4 text-[14px] font-bold text-slate-700" onClick={() => navigate('/app/admin/challenges/templates')}>Cancel</button>
            <button className="h-11 rounded-xl border border-primary px-4 text-[14px] font-bold text-primary disabled:opacity-50" disabled={!permissions.canManageContent || !canSave || isBusy} onClick={onSaveDraft}>
              {updateMutation.isPending && !publishMutation.isPending ? 'Saving…' : 'Save as Draft'}
            </button>
            <button className="h-11 rounded-xl bg-primary px-4 text-[14px] font-bold text-white disabled:opacity-50" disabled={!permissions.canManageContent || !canSave || isBusy} onClick={onSaveAndPublish}>
              {isBusy && publishMutation.isPending ? 'Publishing…' : 'Save & Publish'}
            </button>
          </div>
        </div>
      </Card>
    </AdminLayout>
  );
}

export default EditChallengeTemplateScreen;
