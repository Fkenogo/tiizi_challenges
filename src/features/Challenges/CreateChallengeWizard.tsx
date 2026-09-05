import { ArrowLeft } from 'lucide-react';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { LearnMoreLink } from '../../components/LearnMoreLink';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useCreateChallenge } from '../../hooks/useChallenges';
import { useSuggestedChallengeTemplate } from '../../hooks/useChallengeTemplates';
import { useWellnessTemplate } from '../../hooks/useWellnessTemplates';
import { useExercises } from '../../hooks/useExercises';
import { useWellnessActivities } from '../../hooks/useWellnessActivities';
import { useGroupMembershipStatus, useMyGroups } from '../../hooks/useGroups';
import { isLikelyDirectImageUrl, isPersistableImageSource, isValidImageUrl, readFileAsDataUrl, uploadImageFile } from '../../services/imageUploadService';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../../lib/firebase';
import { groupService } from '../../services/groupService';
import { challengeTemplateService } from '../../services/challengeTemplateService';
import { wellnessTemplateService } from '../../services/wellnessTemplateService';
import type { Challenge } from '../../types';
import { ChallengeBasicInfoSection } from './components/ChallengeBasicInfoSection';
import { ChallengeTimelineSection } from './components/ChallengeTimelineSection';
import { ChallengeActivitySection } from './components/ChallengeActivitySection';
import { ChallengeEngineSettingsSection } from './components/ChallengeEngineSettingsSection';
import { ChallengeDonationSection } from './components/ChallengeDonationSection';
import { validateChallengeForm } from './utils/challengeFormValidation';
import { calculateInclusiveDurationDays } from './utils/challengeDuration';
import {
  DEFAULT_AUTO_COMPLETE_ON_GROUP_TARGET,
  DEFAULT_STREAK_RESET_ON_MISS,
  DURATION_FALLBACK_DAYS,
} from './utils/challengeFormDefaults';
import { DONATION_PAYLOAD_DISCLAIMER } from './utils/challengeFormCopy';
import type { WellnessActivity } from '../../types/wellnessActivity';
import { normalizeKnowledgeVersion } from '../../utils/knowledgeLifecycle';

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
  targetType?: 'daily' | 'cumulative';
  targetValue: string;
  unit: string;
  pointsPerCompletion?: number;
  dailyFrequency?: number;
  instructions?: string[];
};


function normalizeSearchTerm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isPermissionDenied(error: unknown): boolean {
  const maybeCode = (error as { code?: string } | null)?.code;
  const PERM_CODE = 'permission' + '-' + 'denied';
  return typeof maybeCode === 'string' && maybeCode.includes(PERM_CODE);
}

function CreateChallengeWizard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const groupId = params.get('groupId') ?? undefined;
  const templateId = params.get('templateId') ?? undefined;
  const wellnessTemplateId = params.get('wellnessTemplateId') ?? undefined;
  const initialType = (params.get('type') as ChallengeType | null) ?? 'collective';
  const { data: myGroups = [] } = useMyGroups();
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const activeGroupId = selectedGroupId || undefined;
  const { data: membershipStatus = 'none' } = useGroupMembershipStatus(activeGroupId);
  const { user } = useAuth();
  const { showToast } = useToast();
  const createChallenge = useCreateChallenge();
  const {
    data: exercises = [],
    isLoading: isExercisesLoading,
    isError: isExercisesError,
  } = useExercises();
  const { data: template } = useSuggestedChallengeTemplate(templateId);
  const { data: wellnessTemplate } = useWellnessTemplate(wellnessTemplateId);
  const [wellnessCategoryFilter, setWellnessCategoryFilter] = useState<'all' | WellnessActivity['category']>('all');
  const [wellnessSearch, setWellnessSearch] = useState('');
  const {
    data: wellnessActivities = [],
    isLoading: isWellnessActivitiesLoading,
    isError: isWellnessActivitiesError,
  } = useWellnessActivities({
    category: wellnessCategoryFilter,
    search: wellnessSearch,
  });

  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverImageUploadState, setCoverImageUploadState] = useState<'idle' | 'uploading'>('idle');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [challengeType, setChallengeType] = useState<ChallengeType>(initialType);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activities, setActivities] = useState<ActivityRow[]>([{ query: '', exerciseId: undefined, targetValue: '', unit: 'Reps' }]);
  const [pickerRowIndex, setPickerRowIndex] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerTier, setPickerTier] = useState('All');
  const [wellnessPickerOpen, setWellnessPickerOpen] = useState(false);
  const [donationEnabled, setDonationEnabled] = useState(false);
  const [causeName, setCauseName] = useState('');
  const [causeDescription, setCauseDescription] = useState('');
  const [targetDonation, setTargetDonation] = useState('');
  const [donationCurrency, setDonationCurrency] = useState<'KES' | 'RWF' | 'UGX'>('KES');
  const [contributionStartDate, setContributionStartDate] = useState('');
  const [contributionEndDate, setContributionEndDate] = useState('');
  const [contributionPhone, setContributionPhone] = useState('');
  const [contributionCardUrl, setContributionCardUrl] = useState('');
  const [templateApplied, setTemplateApplied] = useState(false);
  const [wellnessTemplateApplied, setWellnessTemplateApplied] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [stepError, setStepError] = useState('');
  // v2 engine fields — always written for new challenges
  const [groupCumulativeTarget, setGroupCumulativeTarget] = useState('');
  const [autoCompleteOnGroupTarget, setAutoCompleteOnGroupTarget] = useState(DEFAULT_AUTO_COMPLETE_ON_GROUP_TARGET);
  const [requiredConsecutiveDays, setRequiredConsecutiveDays] = useState('');
  const [streakResetOnMiss, setStreakResetOnMiss] = useState(DEFAULT_STREAK_RESET_ON_MISS);
  const [challengeCategory, setChallengeCategory] = useState<'fitness' | 'wellness' | 'fasting' | 'hydration' | 'sleep' | 'mindfulness' | 'nutrition' | 'habits' | 'stress' | 'social' | 'movement' | 'health-monitoring'>('fitness');
  useEffect(() => {
    if (!groupId) return;
    if (myGroups.some((group) => group.id === groupId)) {
      setSelectedGroupId(groupId);
      return;
    }
    navigate('/app/create-challenge', { replace: true });
  }, [groupId, myGroups, navigate]);

  useEffect(() => {
    const selectedExerciseId = params.get('selectedExerciseId');
    const selectedExerciseName = params.get('selectedExerciseName');
    const selectedExerciseUnit = params.get('selectedExerciseUnit');
    const selectedRowRaw = params.get('selectedRow');
    if (!selectedExerciseId || !selectedExerciseName) return;

    const selectedRow = Number(selectedRowRaw ?? 0);
    const targetIndex = Number.isNaN(selectedRow)
      ? 0
      : Math.max(0, Math.min(selectedRow, activities.length - 1));
    updateActivity(targetIndex, {
      exerciseId: selectedExerciseId,
      query: selectedExerciseName,
      unit: selectedExerciseUnit || activities[targetIndex]?.unit || 'Reps',
    });

    const cleanParams = new URLSearchParams();
    if (groupId) cleanParams.set('groupId', groupId);
    if (templateId) cleanParams.set('templateId', templateId);
    if (wellnessTemplateId) cleanParams.set('wellnessTemplateId', wellnessTemplateId);
    if (challengeType && challengeType !== 'collective') cleanParams.set('type', challengeType);
    const cleanQuery = cleanParams.toString();
    navigate(`/app/create-challenge${cleanQuery ? `?${cleanQuery}` : ''}`, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, groupId, templateId, wellnessTemplateId, challengeType, navigate, activities.length]);

  // Pre-populate first activity when landing from ExerciseDetailScreen via ?exerciseId=<id>
  const exerciseIdParam = params.get('exerciseId') ?? undefined;
  const exercisePrefillAppliedRef = useRef(false);
  useEffect(() => {
    if (!exerciseIdParam || exercises.length === 0 || exercisePrefillAppliedRef.current) return;
    const match = exercises.find((e) => e.id === exerciseIdParam);
    if (!match) return;
    exercisePrefillAppliedRef.current = true;
    const isIso = match.holdBased === true || match.movementType === 'isometric';
    const prefillUnit = isIso
      ? (match.metric.unit === 'minutes' ? 'Minutes' : 'Seconds')
      : (match.metric.unit ? match.metric.unit.charAt(0).toUpperCase() + match.metric.unit.slice(1) : 'Reps');
    setActivities([{ query: match.name, exerciseId: match.id, targetValue: '', unit: prefillUnit }]);
  }, [exerciseIdParam, exercises]);

  // Pre-populate first activity when landing from WellnessActivityDetailScreen via ?wellnessActivityId=<id>
  const wellnessActivityIdParam = params.get('wellnessActivityId') ?? undefined;
  const wellnessPrefillAppliedRef = useRef(false);
  useEffect(() => {
    if (!wellnessActivityIdParam || wellnessActivities.length === 0 || wellnessPrefillAppliedRef.current) return;
    const match = wellnessActivities.find((a) => a.id === wellnessActivityIdParam);
    if (!match) return;
    wellnessPrefillAppliedRef.current = true;
    setChallengeCategory(match.category);
    setActivities([{
      query: match.name,
      exerciseId: undefined,
      activityId: match.id,
      activityType: match.activityType,
      description: match.description,
      category: match.category,
      difficulty: match.difficulty,
      icon: match.icon,
      protocolSteps: match.protocolSteps,
      benefits: match.benefits,
      guidelines: match.guidelines,
      warnings: match.warnings,
      targetValue: String(match.defaultTargetValue),
      unit: match.defaultMetricUnit,
      frequency: 'daily',
      dailyFrequency: match.suggestedFrequency,
    }]);
  }, [wellnessActivityIdParam, wellnessActivities]);

  useEffect(() => {
    if (!template || templateApplied) return;

    const today = new Date();
    const start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + (template.durationDays || DURATION_FALLBACK_DAYS));
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    setCoverImageUrl(template.coverImageUrl ?? '');
    setName(template.name);
    setDescription(template.description);
    setChallengeType(template.challengeType);
    setStartDate(start);
    setEndDate(end);

    if (template.activities.length > 0) {
      setActivities(template.activities.map((activity) => {
        const matched = exercises.find((exercise) => exercise.name.toLowerCase() === activity.exerciseName.toLowerCase());
        return {
        query: activity.exerciseName,
        exerciseId: activity.exerciseId ?? matched?.id ?? undefined,
        targetValue: String(activity.targetValue || ''),
        unit: activity.unit || 'Reps',
      };}));
    }

    if (template.donation?.enabled) {
      setDonationEnabled(true);
      setCauseName(template.donation.causeName ?? '');
      setCauseDescription(template.donation.causeDescription ?? '');
      setTargetDonation(String(template.donation.targetAmountKes ?? 0));
      if (template.donation.currency === 'RWF' || template.donation.currency === 'UGX') {
        setDonationCurrency(template.donation.currency);
      }
      setContributionStartDate(template.donation.contributionStartDate ?? '');
      setContributionEndDate(template.donation.contributionEndDate ?? '');
      setContributionPhone(template.donation.contributionPhoneNumber ?? '');
      setContributionCardUrl(template.donation.contributionCardUrl ?? '');
    }

    // Apply engine-specific fields stored in template
    if (template.groupCumulativeTarget != null && template.groupCumulativeTarget > 0) {
      setGroupCumulativeTarget(String(template.groupCumulativeTarget));
    }
    if (template.autoCompleteOnGroupTarget != null) {
      setAutoCompleteOnGroupTarget(template.autoCompleteOnGroupTarget);
    }
    if (template.requiredConsecutiveDays != null && template.requiredConsecutiveDays > 0) {
      setRequiredConsecutiveDays(String(template.requiredConsecutiveDays));
    }
    if (template.streakResetOnMiss != null) {
      setStreakResetOnMiss(template.streakResetOnMiss);
    }

    setTemplateApplied(true);
  }, [template, templateApplied, exercises]);

  useEffect(() => {
    if (!wellnessTemplate || wellnessTemplateApplied || templateId) return;

    const today = new Date();
    const start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const endDateFromDuration = new Date(today);
    endDateFromDuration.setDate(today.getDate() + (wellnessTemplate.duration || 21));
    const end = `${endDateFromDuration.getFullYear()}-${String(endDateFromDuration.getMonth() + 1).padStart(2, '0')}-${String(endDateFromDuration.getDate()).padStart(2, '0')}`;

    setCoverImageUrl(wellnessTemplate.coverImage ?? '');
    setName(wellnessTemplate.name);
    setDescription(wellnessTemplate.description);
    setChallengeType(wellnessTemplate.type as ChallengeType);
    setChallengeCategory(wellnessTemplate.category);
    setStartDate(start);
    setEndDate(end);
    setActivities(wellnessTemplate.activities.map((activity) => ({
      query: activity.name,
      exerciseId: undefined,
      activityId: activity.activityId,
      activityType: activity.activityType,
      description: activity.description,
      category: activity.category,
      difficulty: activity.difficulty,
      icon: activity.icon,
      protocolSteps: activity.protocolSteps,
      benefits: activity.benefits,
      guidelines: activity.guidelines,
      warnings: activity.warnings,
      targetValue: String(activity.targetValue || ''),
      unit: activity.metricUnit || 'count',
      frequency: activity.frequency ?? 'daily',
      dailyFrequency: activity.dailyFrequency,
      instructions: activity.instructions ?? activity.protocolSteps,
    })));

    // Engine-specific fields — same parity as fitness template apply
    if (wellnessTemplate.groupCumulativeTarget != null && wellnessTemplate.groupCumulativeTarget > 0) {
      setGroupCumulativeTarget(String(wellnessTemplate.groupCumulativeTarget));
    }
    if (wellnessTemplate.autoCompleteOnGroupTarget != null) {
      setAutoCompleteOnGroupTarget(wellnessTemplate.autoCompleteOnGroupTarget);
    }
    if (wellnessTemplate.requiredConsecutiveDays != null && wellnessTemplate.requiredConsecutiveDays > 0) {
      setRequiredConsecutiveDays(String(wellnessTemplate.requiredConsecutiveDays));
    }
    if (wellnessTemplate.streakResetOnMiss != null) {
      setStreakResetOnMiss(wellnessTemplate.streakResetOnMiss);
    }

    setWellnessTemplateApplied(true);
  }, [wellnessTemplate, wellnessTemplateApplied, templateId]);

  const exerciseById = useMemo(
    () => new Map(exercises.map((exercise) => [exercise.id, exercise])),
    [exercises],
  );
  const wellnessById = useMemo(
    () => new Map(wellnessActivities.map((activity) => [activity.id, activity])),
    [wellnessActivities],
  );
  const challengeDurationDays = useMemo(
    () => calculateInclusiveDurationDays(startDate, endDate),
    [startDate, endDate],
  );
  const isWellnessMode = challengeCategory !== 'fitness';

  const handleCoverFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setCoverImageUploadState('uploading');
      const uploadedUrl = await uploadImageFile(file, 'challenge-covers', user?.uid);
      setCoverImageUrl(uploadedUrl);
      showToast('Challenge cover uploaded.', 'success');
    } catch (error) {
      console.warn('Challenge cover upload failed:', error);
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

  const updateActivity = (index: number, patch: Partial<ActivityRow>) => {
    setActivities((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  };

  const openActivityPicker = (index: number) => {
    setPickerRowIndex(index);
    setPickerSearch(activities[index]?.query ?? '');
    setPickerTier('All');
  };

  const closeActivityPicker = () => {
    setPickerRowIndex(null);
    setPickerSearch('');
    setPickerTier('All');
  };

  const pickExerciseForActivity = (
    exerciseId: string,
    exerciseName: string,
    exerciseUnit: string,
    holdBased?: boolean,
    movementType?: string,
  ) => {
    if (pickerRowIndex === null) return;
    const isIsometric = holdBased === true || movementType === 'isometric';
    const resolvedUnit = isIsometric
      ? (exerciseUnit === 'minutes' ? 'Minutes' : 'Seconds')
      : (exerciseUnit ? exerciseUnit.charAt(0).toUpperCase() + exerciseUnit.slice(1) : activities[pickerRowIndex]?.unit || 'Reps');
    updateActivity(pickerRowIndex, {
      exerciseId,
      query: exerciseName,
      unit: resolvedUnit,
    });
    closeActivityPicker();
  };

  const addActivity = () => {
    const nextIndex = activities.length;
    setActivities((prev) => [...prev, { query: '', exerciseId: undefined, targetValue: '', unit: isWellnessMode ? 'count' : 'Reps' }]);
    if (isWellnessMode) {
      setPickerRowIndex(nextIndex);
      setWellnessPickerOpen(true);
      setWellnessSearch('');
      setWellnessCategoryFilter('all');
    } else {
      setPickerRowIndex(nextIndex);
      setPickerSearch('');
      setPickerTier('All');
    }
  };

  const openWellnessActivityPicker = (index: number) => {
    setPickerRowIndex(index);
    setWellnessPickerOpen(true);
    setWellnessSearch('');
    setWellnessCategoryFilter('all');
  };

  const closeWellnessActivityPicker = () => {
    setWellnessPickerOpen(false);
    setWellnessSearch('');
    setWellnessCategoryFilter('all');
  };

  const pickWellnessActivityForRow = (activity: WellnessActivity) => {
    if (pickerRowIndex === null) return;
    updateActivity(pickerRowIndex, {
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
      targetValue: String(activity.defaultTargetValue),
      unit: activity.defaultMetricUnit,
      frequency: 'daily',
      dailyFrequency: activity.suggestedFrequency,
      instructions: activity.protocolSteps,
    });
    closeWellnessActivityPicker();
    setPickerRowIndex(null);
  };

  const removeActivity = (index: number) => {
    if (activities.length === 1) return;
    setActivities((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleTypeChange = (newType: ChallengeType) => {
    if (newType !== 'streak' && activities.length > 1) {
      setActivities((prev) => [prev[0]]);
    }
    setChallengeType(newType);
  };

  const challengeRoute = (type: ChallengeType, id: string) => {
    const qs = new URLSearchParams();
    qs.set('challengeId', id);
    if (activeGroupId) qs.set('groupId', activeGroupId);
    return `/app/challenges/${type}?${qs.toString()}`;
  };

  const activityTierOptions = useMemo(
    () => ['All', ...Array.from(new Set(exercises.map((exercise) => exercise.tier_1))).slice(0, 6)],
    [exercises],
  );

  const pickerExercises = useMemo(() => {
    const term = normalizeSearchTerm(pickerSearch);
    return exercises
      .filter((exercise) => {
        const tierMatch = pickerTier === 'All' || exercise.tier_1 === pickerTier;
        if (!tierMatch) return false;
        if (!term) return true;
        const normalizedName = normalizeSearchTerm(exercise.name);
        const normalizedTier = normalizeSearchTerm(exercise.tier_1);
        const normalizedTier2 = normalizeSearchTerm(exercise.tier_2);
        return normalizedName.includes(term) || normalizedTier.includes(term) || normalizedTier2.includes(term);
      });
  }, [exercises, pickerSearch, pickerTier]);

  const handleLaunch = async () => {
    if (isLaunching || createChallenge.isPending) return;
    setIsLaunching(true);

    try {
    if (!user?.uid) {
      showToast('Please sign in to create a challenge.', 'error');
      return;
    }

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
      contributionPhoneNumber: contributionPhone,
      contributionCardUrl,
    });
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    const normalizedCover = coverImageUrl.trim();
    const persistableCover = isPersistableImageSource(normalizedCover) ? normalizedCover : undefined;
    if (normalizedCover && !persistableCover) {
      showToast('Cover image preview kept locally. Challenge will launch without saving that image source.', 'info');
    }

    if (!activeGroupId) {
      showToast('Join or select a group before creating a challenge.', 'error');
      return;
    }
    const liveMembershipStatus = await groupService.getMembershipStatus(activeGroupId, user.uid);
    if (liveMembershipStatus !== 'joined' && liveMembershipStatus !== 'active') {
      await groupService.joinGroup(activeGroupId, user.uid).catch(() => null);
      const refreshedMembershipStatus = await groupService.getMembershipStatus(activeGroupId, user.uid);
      if (refreshedMembershipStatus !== 'joined' && refreshedMembershipStatus !== 'active') {
        showToast('Join this group before creating a challenge.', 'error');
        navigate(`/app/group/${activeGroupId}`);
        return;
      }
    }

    const validActivities = activities
      .map((activity, index) => {
        if (isWellnessMode) {
          if (!activity.activityId || Number(activity.targetValue) <= 0) return null;
          return activity;
        }
        if (activity.exerciseId && Number(activity.targetValue) > 0) return activity;
        if (wellnessTemplateId && activity.query.trim() && Number(activity.targetValue) > 0) {
          return {
            ...activity,
            activityId: activity.activityId || `wellness:${index + 1}`,
            activityType: activity.activityType || 'habit',
            category: activity.category || challengeCategory,
            difficulty: activity.difficulty || 'beginner',
            unit: activity.unit || 'count',
          };
        }
        const query = normalizeSearchTerm(activity.query);
        const matched = exercises.find(
          (exercise) => {
            const normalizedName = normalizeSearchTerm(exercise.name);
            return (
              normalizedName === query
              || normalizedName.includes(query)
              || query.includes(normalizedName)
            );
          },
        );
        if (!matched || Number(activity.targetValue) <= 0) return null;
        return { ...activity, exerciseId: matched.id, unit: activity.unit || matched.metric.unit };
      })
      .filter((item): item is ActivityRow => !!item);
    if (validActivities.length === 0) {
      showToast('Add at least one valid activity.', 'error');
      return;
    }
    // Collective and Competitive support exactly one activity; cap to first if stale state slipped through.
    const finalActivities = challengeType !== 'streak' ? validActivities.slice(0, 1) : validActivities;
    try {
      const payload = {
        category: (isWellnessMode ? 'wellness' : challengeCategory) as Challenge['category'],
        name: name.trim(),
        description: description.trim(),
        createdBy: user.uid,
        groupId: activeGroupId,
        challengeType,
        startDate,
        endDate,
        coverImageUrl: persistableCover,
        exerciseIds: Array.from(
          new Set(finalActivities
            .map((activity) => activity.exerciseId)
            .filter((exerciseId): exerciseId is string => !!exerciseId && exerciseById.has(exerciseId))),
        ),
        activities: finalActivities.map((activity) => ({
          exerciseId: activity.exerciseId || undefined,
          activityId: activity.activityId || undefined,
          activityType: activity.activityType || undefined,
          // P1-4: preserve the canonical Knowledge version this Challenge was
          // created from (normalized: legacy records without versions count as 1).
          knowledgeVersion: normalizeKnowledgeVersion(
            activity.exerciseId
              ? exerciseById.get(activity.exerciseId)?.knowledgeVersion
              : wellnessById.get(activity.activityId ?? '')?.knowledgeVersion,
          ),
          exerciseName: activity.exerciseId ? (exerciseById.get(activity.exerciseId)?.name ?? activity.query) : activity.query,
          description: activity.description,
          category: activity.category,
          difficulty: activity.difficulty,
          icon: activity.icon,
          targetValue: Number(activity.targetValue),
          unit: activity.unit,
          instructions: activity.instructions,
          protocolSteps: activity.protocolSteps,
          benefits: activity.benefits,
          guidelines: activity.guidelines,
          warnings: activity.warnings,
          frequency: activity.frequency,
          dailyFrequency: activity.dailyFrequency,
          targetType: activity.targetType,
        })),
        donation: donationEnabled
          ? {
              enabled: true,
              causeName: causeName.trim(),
              causeDescription: causeDescription.trim(),
              targetAmountKes: Number(targetDonation) || 0,
              currency: donationCurrency,
              contributionStartDate: contributionStartDate || undefined,
              contributionEndDate: contributionEndDate || undefined,
              contributionPhoneNumber: contributionPhone.trim() || undefined,
              contributionCardUrl: contributionCardUrl.trim() || undefined,
              disclaimer: DONATION_PAYLOAD_DISCLAIMER,
            }
          : {
              enabled: false,
            },
        // Explicit durationDays prevents the backend from re-deriving it via date subtraction,
        // eliminating any risk of off-by-one from timezone-shifted ISO strings.
        durationDays: challengeDurationDays ?? undefined,
        // v2 engine — always set on new challenges
        engineVersion: 'v2' as const,
        ...(challengeType === 'collective'
          ? {
              groupCumulativeTarget: Number(finalActivities[0]?.targetValue ?? 0),
              autoCompleteOnGroupTarget,
            }
          : {}),
        ...(challengeType === 'streak'
          ? {
              requiredConsecutiveDays: Number(requiredConsecutiveDays),
              streakResetOnMiss,
            }
          : {}),
      };

      const createChallengeCallable = httpsCallable<Record<string, unknown>, { challenge: { id: string } }>(
        getFunctions(app, 'us-central1'),
        'createChallengeWithCreatorMembership',
      );
      const callableResult = await createChallengeCallable(payload as Record<string, unknown>);
      const challenge = callableResult.data.challenge;

      if (payload.donation?.enabled) {
        showToast('Challenge submitted for platform review before going active.', 'success');
      } else {
        showToast('Challenge launched.', 'success');
      }
      // Fire-and-forget: increment usage count on the source template (if any)
      if (templateId) challengeTemplateService.incrementUsageCount(templateId).catch(() => null);
      if (wellnessTemplateId) wellnessTemplateService.incrementUsageCount(wellnessTemplateId).catch(() => null);
      navigate(challengeRoute(challengeType, challenge.id));
    } catch (error) {
      console.warn('Challenge launch failed:', error);
      const message = error instanceof Error ? error.message : 'Failed to launch challenge.';
      showToast(message, 'error');
    }
    } finally {
      setIsLaunching(false);
    }
  };

  const stepLabels: string[] = [
    'Type',
    challengeType === 'collective' ? 'Settings' : challengeType === 'streak' ? 'Streak' : 'Configure',
    'Activities',
    'Review',
  ];

  function advanceStep() {
    setStepError('');
    if (wizardStep === 1) {
      if (!name.trim()) { setStepError('Challenge name is required.'); return; }
      if (!description.trim() || description.trim().length < 8) { setStepError('Description must be at least 8 characters.'); return; }
      if (!selectedGroupId) { setStepError('Please select a group.'); return; }
      setWizardStep(2);
    } else if (wizardStep === 2) {
      if (!startDate || !endDate) { setStepError('Set start and end dates.'); return; }
      if (new Date(endDate) < new Date(startDate)) { setStepError('End date must be after start date.'); return; }
      if (challengeType === 'streak' && (!requiredConsecutiveDays || Number(requiredConsecutiveDays) <= 0)) { setStepError('Set the required consecutive days for this streak challenge.'); return; }
      setWizardStep(3);
    } else if (wizardStep === 3) {
      if (!activities.some((a) => a.exerciseId || a.activityId)) { setStepError('Add at least one activity.'); return; }
      setWizardStep(4);
    }
  }

  function goBack() {
    setStepError('');
    if (wizardStep > 1) setWizardStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
    else navigate(`/app/challenges${activeGroupId ? `?groupId=${activeGroupId}` : ''}`);
  }

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe">
        <header className="flex items-center justify-between">
          <button className="h-10 w-10 flex items-center justify-center" onClick={goBack}>
            <ArrowLeft size={28} className="text-slate-900" />
          </button>
          <div className="flex flex-col items-center">
            <h1 className="st-page-title text-slate-900">New Challenge</h1>
            <LearnMoreLink section="wizard" label="How this works" />
          </div>
          <span className="w-10" />
        </header>

        {/* Template entry point — only shown when no template is already active */}
        {!template && !wellnessTemplate && (
          <div className="st-form-max mt-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-[13px] font-bold text-slate-700">Not sure where to start?</p>
              <p className="text-[12px] text-slate-500 mt-0.5">Browse ready-made challenge templates</p>
            </div>
            <div className="flex flex-col items-end gap-1 ml-3 flex-shrink-0">
              <button
                className="h-8 rounded-full bg-primary px-4 text-[12px] font-bold text-white"
                onClick={() => navigate(selectedGroupId ? `/app/challenges/suggested?groupId=${selectedGroupId}` : '/app/challenges/suggested')}
              >
                Fitness →
              </button>
              <button
                className="h-8 rounded-full bg-emerald-600 px-4 text-[12px] font-bold text-white"
                onClick={() => navigate('/app/challenges/wellness')}
              >
                Wellness →
              </button>
            </div>
          </div>
        )}

        {!!template && (
          <div className="st-form-max mt-3 st-card border-primary/30 bg-primary/5 p-4">
            <p className="text-[12px] leading-[16px] tracking-[0.08em] uppercase font-bold text-primary">Using Suggested Template</p>
            <p className="text-[16px] leading-[22px] font-bold text-slate-900 mt-1">{template.name}</p>
            <p className="text-[13px] leading-[18px] text-slate-600 mt-1">Fields are prefilled. You can edit before launching.</p>
          </div>
        )}
        {!template && !!wellnessTemplate && (
          <div className="st-form-max mt-3 st-card border-emerald-300 bg-emerald-50 p-4">
            <p className="text-[12px] leading-[16px] tracking-[0.08em] uppercase font-bold text-emerald-700">Using Wellness Template</p>
            <p className="text-[16px] leading-[22px] font-bold text-slate-900 mt-1">{wellnessTemplate.name}</p>
            <p className="text-[13px] leading-[18px] text-slate-600 mt-1">Protocol activities are prefilled. You can customize before launch.</p>
          </div>
        )}

        {/* Step progress indicator */}
        <div className="st-form-max mt-4">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex-1">
                <div className={`h-1.5 rounded-full transition-colors ${s <= wizardStep ? 'bg-primary' : 'bg-slate-200'}`} />
                <p className={`mt-1.5 text-[9px] font-bold uppercase tracking-wide text-center ${s === wizardStep ? 'text-primary' : s < wizardStep ? 'text-slate-400' : 'text-slate-300'}`}>
                  {stepLabels[s - 1]}
                </p>
              </div>
            ))}
          </div>
        </div>

        {wizardStep === 1 && (<>
        <ChallengeBasicInfoSection
          className="st-form-max mt-3"
          coverImageUrl={coverImageUrl}
          coverImageUploadState={coverImageUploadState}
          onCoverFileChange={handleCoverFileSelected}
          onCoverUrlChange={setCoverImageUrl}
          afterCoverSlot={
            <div>
              <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Group</p>
              <select
                className="st-input mt-2 appearance-none"
                value={selectedGroupId}
                onChange={(event) => setSelectedGroupId(event.target.value)}
              >
                <option value="">Select group to post challenge</option>
                {myGroups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
              {myGroups.length === 0 && (
                <p className="mt-2 text-[12px] leading-[16px] text-slate-500">Join a group first to launch this challenge.</p>
              )}
            </div>
          }
          name={name}
          onNameChange={setName}
          description={description}
          onDescriptionChange={setDescription}
          isWellnessMode={isWellnessMode}
          onModeChange={(mode) => setChallengeCategory(mode)}
          challengeType={challengeType}
          onTypeChange={handleTypeChange}
        />
        </>)}

        {wizardStep === 2 && (<>
        {name.trim() && (
          <div className="st-form-max mt-4 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 flex items-center gap-2 flex-wrap">
            <p className="text-[13px] font-black text-slate-900 flex-1 min-w-0 truncate">{name.trim()}</p>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold flex-shrink-0 ${challengeType === 'collective' ? 'bg-blue-100 text-blue-700' : challengeType === 'competitive' ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700'}`}>
              {challengeType === 'collective' ? '👥 Collective' : challengeType === 'competitive' ? '🏆 Competitive' : '🔥 Streak'}
            </span>
          </div>
        )}
        <ChallengeEngineSettingsSection
          className="st-form-max"
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
          className="st-form-max"
          startDate={startDate}
          onStartDateChange={setStartDate}
          endDate={endDate}
          onEndDateChange={setEndDate}
          durationDays={challengeDurationDays}
        />
        </>)}

        {wizardStep === 3 && (<>
        {name.trim() && (
          <div className="st-form-max mt-4 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 flex items-center gap-2 flex-wrap">
            <p className="text-[13px] font-black text-slate-900 flex-1 min-w-0 truncate">{name.trim()}</p>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${challengeType === 'collective' ? 'bg-blue-100 text-blue-700' : challengeType === 'competitive' ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700'}`}>
                {challengeType === 'collective' ? '👥 Collective' : challengeType === 'competitive' ? '🏆 Competitive' : '🔥 Streak'}
              </span>
              {challengeDurationDays != null && <span className="text-[10px] text-slate-500">{challengeDurationDays}d</span>}
            </div>
          </div>
        )}
        <ChallengeActivitySection
          className="st-form-max mt-4"
          isWellnessMode={isWellnessMode}
          challengeType={challengeType}
          activities={activities}
          onUpdateActivity={updateActivity}
          onAddActivity={addActivity}
          onRemoveActivity={removeActivity}
          exercises={exercises}
          isExercisesLoading={isExercisesLoading}
          isExercisesError={isExercisesError}
          wellnessActivities={wellnessActivities}
          isWellnessActivitiesLoading={isWellnessActivitiesLoading}
          isWellnessActivitiesError={isWellnessActivitiesError}
          fitnessPicker={pickerRowIndex !== null}
          fitnessPickerIndex={pickerRowIndex}
          fitnessPickerSearch={pickerSearch}
          onFitnessPickerSearchChange={setPickerSearch}
          fitnessPickerExercises={pickerExercises}
          fitnessPickerTierOptions={activityTierOptions}
          fitnessPickerTier={pickerTier}
          onFitnessPickerTierChange={setPickerTier}
          onOpenFitnessPicker={openActivityPicker}
          onCloseFitnessPicker={closeActivityPicker}
          onPickFitnessExercise={(exercise) => pickExerciseForActivity(exercise.id, exercise.name, exercise.metric.unit, exercise.holdBased, exercise.movementType)}
          wellnessPickerOpen={wellnessPickerOpen}
          wellnessPickerIndex={pickerRowIndex}
          wellnessPickerSearch={wellnessSearch}
          onWellnessPickerSearchChange={setWellnessSearch}
          wellnessPickerCategoryFilter={wellnessCategoryFilter}
          onWellnessPickerCategoryFilterChange={setWellnessCategoryFilter}
          isWellnessPickerLoading={isWellnessActivitiesLoading}
          onOpenWellnessPicker={openWellnessActivityPicker}
          onCloseWellnessPicker={closeWellnessActivityPicker}
          onPickWellnessActivity={pickWellnessActivityForRow}
          onNavigateToExercise={(exerciseId) => navigate(`/app/exercises/${exerciseId}`)}
        />

        <ChallengeDonationSection
          className="st-form-max mt-4"
          donationEnabled={donationEnabled}
          onDonationEnabledChange={setDonationEnabled}
          causeName={causeName}
          onCauseNameChange={setCauseName}
          causeDescription={causeDescription}
          onCauseDescriptionChange={setCauseDescription}
          targetAmountKes={targetDonation}
          onTargetAmountKesChange={setTargetDonation}
          currency={donationCurrency}
          onCurrencyChange={setDonationCurrency}
          contributionStartDate={contributionStartDate}
          onContributionStartDateChange={setContributionStartDate}
          contributionEndDate={contributionEndDate}
          onContributionEndDateChange={setContributionEndDate}
          contributionPhoneNumber={contributionPhone}
          onContributionPhoneNumberChange={setContributionPhone}
          contributionCardUrl={contributionCardUrl}
          onContributionCardUrlChange={setContributionCardUrl}
        />
        </>)}

        {wizardStep === 4 && (<>
        {name.trim() && challengeType && (
          <div className="st-form-max mt-6 space-y-3">
            {/* Header */}
            <div className="st-card border-primary/30 bg-primary/5 p-4">
              <p className="text-[12px] leading-[16px] tracking-[0.08em] uppercase font-bold text-primary">Challenge Review</p>
              <p className="text-[17px] leading-[22px] font-black text-slate-900 mt-1">{name.trim()}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-bold ${
                  challengeType === 'collective' ? 'bg-blue-100 text-blue-700'
                  : challengeType === 'competitive' ? 'bg-amber-100 text-amber-700'
                  : 'bg-orange-100 text-orange-700'
                }`}>
                  {challengeType === 'collective' && '👥'}
                  {challengeType === 'competitive' && '🏆'}
                  {challengeType === 'streak' && '🔥'}
                  {' '}{challengeType.charAt(0).toUpperCase() + challengeType.slice(1)}
                </span>
                {challengeDurationDays != null && challengeDurationDays > 0 && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[12px] font-bold text-slate-600">{challengeDurationDays} days</span>
                )}
              </div>
            </div>

            {/* How it works */}
            <div className="st-card p-4">
              <p className="text-[12px] leading-[16px] tracking-[0.08em] uppercase font-bold text-slate-500 mb-3">How it works</p>
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[12px] font-semibold text-slate-500">How you complete it</p>
                  <p className="text-[12px] text-slate-800 text-right max-w-[180px]">
                    {challengeType === 'collective' && 'Group reaches shared cumulative target'}
                    {challengeType === 'competitive' && 'Each member hits per-activity targets'}
                    {challengeType === 'streak' && 'Log the required activity every day'}
                  </p>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[12px] font-semibold text-slate-500">Who wins</p>
                  <p className="text-[12px] text-slate-800 text-right max-w-[180px]">
                    {challengeType === 'collective' && 'Team succeeds together'}
                    {challengeType === 'competitive' && 'Highest completion % wins'}
                    {challengeType === 'streak' && 'Longest streak / first to complete required streak'}
                  </p>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[12px] font-semibold text-slate-500">Rankings</p>
                  <p className="text-[12px] text-slate-800 text-right max-w-[180px]">
                    {challengeType === 'collective' && 'Ranked by contribution'}
                    {challengeType === 'competitive' && 'Ranked by completion %'}
                    {challengeType === 'streak' && 'Ranked by current streak'}
                  </p>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[12px] font-semibold text-slate-500">Scoring</p>
                  <p className="text-[12px] text-slate-800 text-right max-w-[180px]">
                    {challengeType === 'collective' && 'Points per contribution toward team goal'}
                    {challengeType === 'competitive' && 'Points scale with proximity to target'}
                    {challengeType === 'streak' && 'Points per consistent day logged'}
                  </p>
                </div>
              </div>
            </div>

            {/* Type-specific settings */}
            {challengeType === 'collective' && groupCumulativeTarget && Number(groupCumulativeTarget) > 0 && (
              <div className="st-card p-4">
                <p className="text-[12px] leading-[16px] tracking-[0.08em] uppercase font-bold text-slate-500 mb-3">Collective Settings</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-semibold text-slate-500">Group target</p>
                    <p className="text-[12px] font-black text-slate-900">
                      {Number(groupCumulativeTarget).toLocaleString()} {activities[0]?.unit}{activities[0]?.query ? ` of ${activities[0].query}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-semibold text-slate-500">Auto-complete on target</p>
                    <p className="text-[12px] font-black text-slate-900">{autoCompleteOnGroupTarget ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>
            )}

            {challengeType === 'streak' && requiredConsecutiveDays && Number(requiredConsecutiveDays) > 0 && (
              <div className="st-card p-4">
                <p className="text-[12px] leading-[16px] tracking-[0.08em] uppercase font-bold text-slate-500 mb-3">Streak Settings</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-semibold text-slate-500">Required streak</p>
                    <p className="text-[12px] font-black text-slate-900">{requiredConsecutiveDays} days in a row</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-semibold text-slate-500">On missed day</p>
                    <p className="text-[12px] font-black text-slate-900">{streakResetOnMiss ? 'Streak resets to 0' : 'Streak pauses'}</p>
                  </div>
                  {activities.filter((a) => a.exerciseId || a.activityId).map((a, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <p className="text-[12px] font-semibold text-slate-500 truncate max-w-[160px]">{a.query || a.exerciseId || `Activity ${i + 1}`}</p>
                      <p className="text-[12px] font-black text-slate-900">{a.targetValue || '—'} {a.unit} / day</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {challengeType === 'competitive' && activities.some((a) => a.targetValue && Number(a.targetValue) > 0) && (
              <div className="st-card p-4">
                <p className="text-[12px] leading-[16px] tracking-[0.08em] uppercase font-bold text-slate-500 mb-3">Competitive Targets</p>
                <div className="space-y-1.5">
                  {activities.filter((a) => a.exerciseId).map((a, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <p className="text-[12px] text-slate-600 truncate max-w-[200px]">{a.query || a.exerciseId}</p>
                      <p className="text-[12px] font-bold text-slate-900">{a.targetValue || '—'} {a.unit}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Launch readiness checklist */}
        <div className="st-form-max mt-4 st-card p-4">
          <p className="text-[12px] leading-[16px] tracking-[0.08em] uppercase font-bold text-slate-500 mb-3">Ready to launch?</p>
          <div className="space-y-2">
            {([
              { ok: !!name.trim(), label: 'Challenge name set' },
              { ok: !!selectedGroupId, label: 'Group selected' },
              { ok: !!startDate && !!endDate && endDate >= startDate, label: 'Dates configured' },
              { ok: activities.some((a) => a.exerciseId || a.activityId), label: 'At least one activity' },
              ...(challengeType === 'collective' ? [{ ok: activities.some((a) => Number(a.targetValue) > 0), label: 'Group target set' }] : []),
              ...(challengeType === 'streak' ? [{ ok: !!requiredConsecutiveDays && Number(requiredConsecutiveDays) > 0, label: 'Streak days set' }] : []),
            ] as { ok: boolean; label: string }[]).map(({ ok, label }) => (
              <div key={label} className="flex items-center gap-2">
                <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${ok ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                  {ok ? '✓' : '○'}
                </span>
                <p className={`text-[13px] leading-[18px] ${ok ? 'text-slate-800' : 'text-slate-400'}`}>{label}</p>
              </div>
            ))}
          </div>
        </div>
        </>)}

        {stepError && (
          <p className="st-form-max mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] leading-[18px] text-red-700 font-semibold">{stepError}</p>
        )}

        {wizardStep < 4 ? (
          <button
            type="button"
            className="st-form-max st-btn-primary mt-6"
            onClick={advanceStep}
          >
            Next: {stepLabels[wizardStep]}
          </button>
        ) : (
          <button
            type="button"
            className="st-form-max st-btn-primary mt-6 disabled:opacity-60"
            disabled={createChallenge.isPending || isLaunching || !activeGroupId}
            onClick={handleLaunch}
          >
            {(createChallenge.isPending || isLaunching)
              ? 'Launching...'
              : !activeGroupId
                ? 'Select Group to Launch'
                : 'Launch Challenge'}
          </button>
        )}
      </div>

    </Screen>
  );
}

export default CreateChallengeWizard;
