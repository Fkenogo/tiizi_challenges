import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useWellnessTemplate, useUpdateWellnessTemplate } from '../../../hooks/useWellnessTemplates';
import { useWellnessActivities } from '../../../hooks/useWellnessActivities';
import { wellnessTemplateService } from '../../../services/wellnessTemplateService';
import { readFileAsDataUrl, uploadImageFile } from '../../../services/imageUploadService';
import { validateChallengeForm } from '../../Challenges/utils/challengeFormValidation';
import { DEFAULT_AUTO_COMPLETE_ON_GROUP_TARGET, DEFAULT_STREAK_RESET_ON_MISS } from '../../Challenges/utils/challengeFormDefaults';
import { ChallengeBasicInfoSection } from '../../Challenges/components/ChallengeBasicInfoSection';
import { ChallengeEngineSettingsSection } from '../../Challenges/components/ChallengeEngineSettingsSection';
import { ChallengeActivitySection } from '../../Challenges/components/ChallengeActivitySection';
import type { ActivityRow } from '../../Challenges/components/ChallengeActivitySection';
import { AdminLayout } from '../layout/AdminLayout';
import type { WellnessActivity } from '../../../types/wellnessActivity';
import type { ChallengeType } from '../../Challenges/utils/challengeFormDefaults';

function EditWellnessTemplateScreen() {
  const { id: templateId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data: template, isLoading: isTemplateLoading } = useWellnessTemplate(templateId);
  const updateMutation = useUpdateWellnessTemplate();

  // Wellness picker state — matches CreateChallengeScreen pattern exactly
  const [wellnessPickerOpen, setWellnessPickerOpen] = useState(false);
  const [wellnessCategoryFilter, setWellnessCategoryFilter] = useState<'all' | WellnessActivity['category']>('all');
  const [wellnessSearch, setWellnessSearch] = useState('');
  const {
    data: wellnessActivities = [],
    isLoading: isWellnessLoading,
    isError: isWellnessError,
  } = useWellnessActivities({ category: wellnessCategoryFilter, search: wellnessSearch });

  // Form state
  const [initialized, setInitialized] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverImageUploadState, setCoverImageUploadState] = useState<'idle' | 'uploading'>('idle');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [challengeType, setChallengeType] = useState<ChallengeType>('streak');
  const [duration, setDuration] = useState('21');
  const [activities, setActivities] = useState<ActivityRow[]>([
    { query: '', exerciseId: undefined, targetValue: '', unit: 'count', frequency: 'daily' },
  ]);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [groupCumulativeTarget, setGroupCumulativeTarget] = useState('');
  const [autoCompleteOnGroupTarget, setAutoCompleteOnGroupTarget] = useState(DEFAULT_AUTO_COMPLETE_ON_GROUP_TARGET);
  const [requiredConsecutiveDays, setRequiredConsecutiveDays] = useState('');
  const [streakResetOnMiss, setStreakResetOnMiss] = useState(DEFAULT_STREAK_RESET_ON_MISS);
  const [isBusy, setIsBusy] = useState(false);

  // Pre-populate from loaded template
  useEffect(() => {
    if (!template || initialized) return;
    setCoverImageUrl(template.coverImage ?? '');
    setName(template.name);
    setDescription(template.description);
    setChallengeType(template.type as ChallengeType);
    setDuration(String(template.duration ?? 21));
    if (template.activities.length > 0) {
      setActivities(template.activities.map((a) => ({
        query: a.name,
        exerciseId: undefined,
        activityId: a.activityId,
        activityType: 'wellness',
        description: a.description,
        category: a.category,
        difficulty: a.difficulty,
        icon: a.icon,
        frequency: a.frequency ?? 'daily',
        targetValue: String(a.targetValue),
        unit: a.metricUnit || 'count',
        dailyFrequency: a.dailyFrequency ?? 1,
        pointsPerCompletion: a.pointsPerCompletion ?? 10,
        protocolSteps: a.protocolSteps,
        benefits: a.benefits,
        guidelines: a.guidelines,
        warnings: a.warnings,
        instructions: a.protocolSteps,
      })));
    }
    if (template.groupCumulativeTarget != null) setGroupCumulativeTarget(String(template.groupCumulativeTarget));
    if (template.autoCompleteOnGroupTarget != null) setAutoCompleteOnGroupTarget(template.autoCompleteOnGroupTarget);
    if (template.requiredConsecutiveDays != null) setRequiredConsecutiveDays(String(template.requiredConsecutiveDays));
    if (template.streakResetOnMiss != null) setStreakResetOnMiss(template.streakResetOnMiss);
    setInitialized(true);
  }, [template, initialized]);

  // Activity CRUD — matches CreateChallengeScreen pattern
  const updateActivity = (index: number, patch: Partial<ActivityRow>) => {
    setActivities((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };
  const addActivity = () => {
    setActivities((prev) => [...prev, { query: '', exerciseId: undefined, targetValue: '', unit: 'count', frequency: 'daily' }]);
  };

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

  // Wellness picker handlers — identical to CreateChallengeScreen
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

  const handleCoverFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setCoverImageUploadState('uploading');
      const url = await uploadImageFile(file, 'challenge-covers', user?.uid);
      setCoverImageUrl(url);
      showToast('Challenge cover uploaded.', 'success');
    } catch {
      try {
        setCoverImageUrl(await readFileAsDataUrl(file));
        showToast('Using local image preview. Upload will depend on storage permissions.', 'info');
      } catch {
        showToast('Could not read selected image.', 'error');
      }
    } finally {
      setCoverImageUploadState('idle');
      if (event.target) event.target.value = '';
    }
  };

  // Resolved activities for payload — identical logic to CreateChallengeScreen wellness branch
  const resolvedActivities = useMemo(() => {
    const out: Array<{
      activityId: string;
      order: number;
      activityType: string;
      name: string;
      description?: string;
      category?: string;
      difficulty?: string;
      icon?: string;
      instructions?: string[];
      protocolSteps?: string[];
      benefits?: string[];
      guidelines?: string[];
      warnings?: string[];
      metricUnit: string;
      targetValue: number;
      frequency: NonNullable<ActivityRow['frequency']>;
      dailyFrequency: number;
      pointsPerCompletion: number;
    }> = [];
    activities.forEach((item, index) => {
      if (!item.activityId || Number(item.targetValue) <= 0) return;
      out.push({
        activityId: item.activityId,
        order: index + 1,
        activityType: item.activityType ?? 'wellness',
        name: item.query.trim(),
        description: item.description,
        category: item.category,
        difficulty: item.difficulty,
        icon: item.icon,
        protocolSteps: item.protocolSteps,
        benefits: item.benefits,
        guidelines: item.guidelines,
        warnings: item.warnings,
        instructions: item.instructions,
        metricUnit: item.unit || 'count',
        targetValue: Number(item.targetValue),
        frequency: item.frequency ?? 'daily',
        dailyFrequency: item.dailyFrequency ?? 1,
        pointsPerCompletion: item.pointsPerCompletion ?? 10,
      });
    });
    return out;
  }, [activities]);

  // Shared validation input
  const validationInput = useMemo(() => ({
    name,
    description,
    startDate: '2000-01-01',
    endDate: '2000-12-31',
    challengeType,
    activities: activities.map((a) => ({
      query: a.query,
      activityId: a.activityId,
      targetValue: a.targetValue,
      unit: a.unit,
    })),
    requiredConsecutiveDays,
    durationDays: Number(duration) || null,
    donationEnabled: false,
    causeName: '',
    causeDescription: '',
    contributionPhoneNumber: '',
    contributionCardUrl: '',
  }), [name, description, challengeType, activities, requiredConsecutiveDays, duration]);

  const canSave = !validateChallengeForm(validationInput);

  const onSaveDraft = async () => {
    const err = validateChallengeForm(validationInput);
    if (err) { showToast(err, 'error'); return; }
    if (!templateId) return;
    setIsBusy(true);
    const finalActivities = challengeType !== 'streak' ? resolvedActivities.slice(0, 1) : resolvedActivities;
    try {
      await updateMutation.mutateAsync({
        templateId,
        payload: {
          name: name.trim(),
          description: description.trim(),
          type: challengeType,
          duration: Number(duration) || 21,
          activities: finalActivities,
          ...(challengeType === 'collective'
            ? { groupCumulativeTarget: Number(finalActivities[0]?.targetValue ?? 0), autoCompleteOnGroupTarget }
            : {}),
          ...(challengeType === 'streak' && Number(requiredConsecutiveDays) > 0
            ? { requiredConsecutiveDays: Number(requiredConsecutiveDays), streakResetOnMiss }
            : {}),
        },
      });
      showToast('Template saved as draft.', 'success');
      navigate('/app/admin/challenges/templates');
    } catch {
      showToast('Could not save template.', 'error');
    } finally {
      setIsBusy(false);
    }
  };

  const onSaveAndPublish = async () => {
    const err = validateChallengeForm(validationInput);
    if (err) { showToast(err, 'error'); return; }
    if (!templateId) return;
    setIsBusy(true);
    const finalActivities = challengeType !== 'streak' ? resolvedActivities.slice(0, 1) : resolvedActivities;
    try {
      await updateMutation.mutateAsync({
        templateId,
        payload: {
          name: name.trim(),
          description: description.trim(),
          type: challengeType,
          duration: Number(duration) || 21,
          activities: finalActivities,
          ...(challengeType === 'collective'
            ? { groupCumulativeTarget: Number(finalActivities[0]?.targetValue ?? 0), autoCompleteOnGroupTarget }
            : {}),
          ...(challengeType === 'streak' && Number(requiredConsecutiveDays) > 0
            ? { requiredConsecutiveDays: Number(requiredConsecutiveDays), streakResetOnMiss }
            : {}),
        },
      });
      await wellnessTemplateService.publishTemplate(templateId, user?.uid ?? '');
      showToast('Template saved and published.', 'success');
      navigate('/app/admin/challenges/templates');
    } catch {
      showToast('Could not publish template.', 'error');
    } finally {
      setIsBusy(false);
    }
  };

  if (isTemplateLoading) return <LoadingSpinner fullScreen label="Loading template…" />;
  if (!template) return (
    <AdminLayout title="Edit Wellness Template" permissions={permissions}>
      <Card><p className="text-sm text-slate-700">Template not found.</p></Card>
    </AdminLayout>
  );

  return (
    <AdminLayout title={`Edit — ${template.name}`} permissions={permissions}>
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
            isWellnessMode={true}
            onModeChange={() => { /* locked to wellness */ }}
            challengeType={challengeType}
            onTypeChange={handleTypeChange}
          />

          {/* Duration — wellness templates use a fixed day count, not start/end dates */}
          <div>
            <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Duration (days)</p>
            <input
              className="st-input mt-2"
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 21"
            />
            <p className="mt-1 text-[12px] leading-[16px] text-slate-500">How many days this template runs when a group starts it.</p>
          </div>

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

          <ChallengeActivitySection
            isWellnessMode={true}
            challengeType={challengeType}
            activities={activities}
            onUpdateActivity={updateActivity}
            onAddActivity={addActivity}
            onRemoveActivity={removeActivity}
            exercises={[]}
            isExercisesLoading={false}
            isExercisesError={false}
            wellnessActivities={wellnessActivities}
            isWellnessActivitiesLoading={isWellnessLoading}
            isWellnessActivitiesError={isWellnessError}
            fitnessPicker={false}
            fitnessPickerIndex={null}
            fitnessPickerSearch=""
            onFitnessPickerSearchChange={() => {}}
            fitnessPickerExercises={[]}
            onOpenFitnessPicker={() => {}}
            onCloseFitnessPicker={() => {}}
            onPickFitnessExercise={() => {}}
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

          {/* Version info */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 space-y-0.5">
            <p>Version <span className="font-bold text-slate-700">{template.version}</span> → saving will create version <span className="font-bold text-slate-700">{(template.version ?? 1) + 1}</span></p>
            <p>Editing this template does <strong>not</strong> modify challenges already created from it.</p>
            <p>Status: <span className="font-bold capitalize text-slate-700">{template.status}</span> · Used {template.usageCount ?? 0} time{(template.usageCount ?? 0) !== 1 ? 's' : ''}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap pt-2">
            <button className="h-11 rounded-xl bg-slate-100 px-4 text-[14px] font-bold text-slate-700" onClick={() => navigate('/app/admin/challenges/templates')}>Cancel</button>
            <button
              className="h-11 rounded-xl border border-primary px-4 text-[14px] font-bold text-primary disabled:opacity-50"
              disabled={!permissions.canManageContent || !canSave || isBusy}
              onClick={onSaveDraft}
            >
              {isBusy ? 'Saving…' : 'Save as Draft'}
            </button>
            <button
              className="h-11 rounded-xl bg-primary px-4 text-[14px] font-bold text-white disabled:opacity-50"
              disabled={!permissions.canManageContent || !canSave || isBusy}
              onClick={onSaveAndPublish}
            >
              {isBusy ? 'Publishing…' : 'Save & Publish'}
            </button>
          </div>
        </div>
      </Card>
    </AdminLayout>
  );
}

export default EditWellnessTemplateScreen;
