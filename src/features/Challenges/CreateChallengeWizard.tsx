import { ArrowLeft, Calendar, Camera, Plus, Search, X } from 'lucide-react';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useCreateChallenge } from '../../hooks/useChallenges';
import { useSuggestedChallengeTemplate } from '../../hooks/useChallengeTemplates';
import { useWellnessTemplate } from '../../hooks/useWellnessTemplates';
import { useExercises } from '../../hooks/useExercises';
import { useWellnessActivities } from '../../hooks/useWellnessActivities';
import { useGroupMembershipStatus, useMyGroups } from '../../hooks/useGroups';
import { isLikelyDirectImageUrl, isPersistableImageSource, isValidImageUrl, readFileAsDataUrl, uploadImageFile } from '../../services/imageUploadService';
import { groupService } from '../../services/groupService';
import type { Challenge } from '../../types';
import type { WellnessActivity } from '../../types/wellnessActivity';

type ChallengeType = 'collective' | 'competitive' | 'streak';

type ActivityRow = {
  query: string;
  exerciseId: string;
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
  pointsPerCompletion?: number;
  dailyFrequency?: number;
  instructions?: string[];
};

const typeOptions: Array<{ id: ChallengeType; label: string }> = [
  { id: 'collective', label: 'Collective' },
  { id: 'competitive', label: 'Competitive' },
  { id: 'streak', label: 'Streak' },
];

function normalizeSearchTerm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isPermissionDenied(error: unknown): boolean {
  const maybeCode = (error as { code?: string } | null)?.code;
  return typeof maybeCode === 'string' && maybeCode.includes('permission-denied');
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
  const [activities, setActivities] = useState<ActivityRow[]>([{ query: '', exerciseId: '', targetValue: '', unit: 'Reps' }]);
  const [activeSearchRow, setActiveSearchRow] = useState<number | null>(null);
  const [pickerRowIndex, setPickerRowIndex] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerTier, setPickerTier] = useState('All');
  const [wellnessPickerOpen, setWellnessPickerOpen] = useState(false);
  const [donationEnabled, setDonationEnabled] = useState(false);
  const [causeName, setCauseName] = useState('');
  const [causeDescription, setCauseDescription] = useState('');
  const [targetDonation, setTargetDonation] = useState('');
  const [contributionStartDate, setContributionStartDate] = useState('');
  const [contributionEndDate, setContributionEndDate] = useState('');
  const [contributionPhone, setContributionPhone] = useState('');
  const [contributionCardUrl, setContributionCardUrl] = useState('');
  const [templateApplied, setTemplateApplied] = useState(false);
  const [wellnessTemplateApplied, setWellnessTemplateApplied] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [challengeCategory, setChallengeCategory] = useState<'fitness' | 'wellness' | 'fasting' | 'hydration' | 'sleep' | 'mindfulness' | 'nutrition' | 'habits' | 'stress' | 'social'>('fitness');
  const coverInputRef = useRef<HTMLInputElement>(null);

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
    setActiveSearchRow(null);

    const cleanParams = new URLSearchParams();
    if (groupId) cleanParams.set('groupId', groupId);
    if (templateId) cleanParams.set('templateId', templateId);
    if (wellnessTemplateId) cleanParams.set('wellnessTemplateId', wellnessTemplateId);
    if (challengeType && challengeType !== 'collective') cleanParams.set('type', challengeType);
    const cleanQuery = cleanParams.toString();
    navigate(`/app/create-challenge${cleanQuery ? `?${cleanQuery}` : ''}`, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, groupId, templateId, wellnessTemplateId, challengeType, navigate, activities.length]);

  useEffect(() => {
    if (!template || templateApplied) return;

    const today = new Date();
    const start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + (template.durationDays || 30));
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
        exerciseId: activity.exerciseId ?? matched?.id ?? '',
        targetValue: String(activity.targetValue || ''),
        unit: activity.unit || 'Reps',
      };}));
    }

    if (template.donation?.enabled) {
      setDonationEnabled(true);
      setCauseName(template.donation.causeName ?? '');
      setCauseDescription(template.donation.causeDescription ?? '');
      setTargetDonation(String(template.donation.targetAmountKes ?? 0));
      setContributionStartDate(template.donation.contributionStartDate ?? '');
      setContributionEndDate(template.donation.contributionEndDate ?? '');
      setContributionPhone(template.donation.contributionPhoneNumber ?? '');
      setContributionCardUrl(template.donation.contributionCardUrl ?? '');
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
      exerciseId: '',
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
      pointsPerCompletion: activity.pointsPerCompletion,
      dailyFrequency: activity.dailyFrequency,
      instructions: activity.instructions ?? activity.protocolSteps,
    })));

    setWellnessTemplateApplied(true);
  }, [wellnessTemplate, wellnessTemplateApplied, templateId]);

  const exerciseById = useMemo(
    () => new Map(exercises.map((exercise) => [exercise.id, exercise])),
    [exercises],
  );
  const challengeDurationDays = useMemo(() => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
  }, [startDate, endDate]);
  const isWellnessMode = challengeCategory !== 'fitness';

  const handleCoverUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCoverImageUrl(event.target.value);
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

  const pickExerciseForActivity = (exerciseId: string, exerciseName: string, exerciseUnit: string) => {
    if (pickerRowIndex === null) return;
    updateActivity(pickerRowIndex, {
      exerciseId,
      query: exerciseName,
      unit: exerciseUnit || activities[pickerRowIndex]?.unit || 'Reps',
    });
    setActiveSearchRow(null);
    closeActivityPicker();
  };

  const addActivity = () => {
    const nextIndex = activities.length;
    setActivities((prev) => [...prev, { query: '', exerciseId: '', targetValue: '', unit: 'Reps' }]);
    setPickerRowIndex(nextIndex);
    setPickerSearch('');
    setPickerTier('All');
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
      exerciseId: '',
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
      pointsPerCompletion: activity.defaultPoints,
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

    if (!name.trim() || description.trim().length < 8) {
      showToast('Add challenge name and description.', 'error');
      return;
    }

    const normalizedCover = coverImageUrl.trim();
    const persistableCover = isPersistableImageSource(normalizedCover) ? normalizedCover : undefined;
    if (normalizedCover && !persistableCover) {
      showToast('Cover image preview kept locally. Challenge will launch without saving that image source.', 'info');
    }

    if (!startDate || !endDate || new Date(endDate) < new Date(startDate)) {
      showToast('Set a valid start and end date.', 'error');
      return;
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
    if (donationEnabled) {
      if (!causeName.trim() || !causeDescription.trim()) {
        showToast('Add cause name and description for Fitness + Cause.', 'error');
        return;
      }
      if (!contributionPhone.trim() && !contributionCardUrl.trim()) {
        showToast('Provide a mobile number or card link for contributions.', 'error');
        return;
      }
    }

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
          new Set(validActivities
            .map((activity) => activity.exerciseId)
            .filter((exerciseId): exerciseId is string => !!exerciseId && exerciseById.has(exerciseId))),
        ),
        activities: validActivities.map((activity) => ({
          exerciseId: activity.exerciseId || undefined,
          activityId: activity.activityId || undefined,
          activityType: activity.activityType || undefined,
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
          pointsPerCompletion: activity.pointsPerCompletion,
          dailyFrequency: activity.dailyFrequency,
        })),
        donation: donationEnabled
          ? {
              enabled: true,
              causeName: causeName.trim(),
              causeDescription: causeDescription.trim(),
              targetAmountKes: Number(targetDonation) || 0,
              contributionStartDate: contributionStartDate || undefined,
              contributionEndDate: contributionEndDate || undefined,
              contributionPhoneNumber: contributionPhone.trim() || undefined,
              contributionCardUrl: contributionCardUrl.trim() || undefined,
              disclaimer: 'Tiizi does not hold or manage funds. Contributions are coordinated by the group.',
            }
          : {
              enabled: false,
            },
      };

      let challenge;
      try {
        challenge = await createChallenge.mutateAsync(payload);
      } catch (error) {
        if (!isPermissionDenied(error)) throw error;
        // Retry once; best-effort membership refresh for edge cases.
        await groupService.joinGroup(activeGroupId, user.uid).catch(() => null);
        challenge = await createChallenge.mutateAsync(payload);
      }

      if (payload.donation?.enabled) {
        showToast('Challenge submitted for super admin approval before going active.', 'success');
      } else {
        showToast('Challenge launched.', 'success');
      }
      navigate(challengeRoute(challengeType, challenge.id));
    } catch (error) {
      console.error('Challenge launch failed:', error);
      const message = error instanceof Error ? error.message : 'Failed to launch challenge.';
      showToast(message, 'error');
    }
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe">
        <header className="flex items-center justify-between">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate(`/app/challenges${activeGroupId ? `?groupId=${activeGroupId}` : ''}`)}>
            <ArrowLeft size={28} className="text-slate-900" />
          </button>
          <h1 className="st-page-title text-slate-900">New Challenge</h1>
          <span className="w-10" />
        </header>

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

        <div className="st-form-max mt-3 st-card border-dashed border-primary/40 p-4 text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
            <Camera size={24} />
          </div>
          <p className="text-[16px] leading-[22px] font-bold text-slate-900 mt-3">Upload Challenge Cover</p>
          <p className="text-[13px] leading-[18px] text-slate-500 mt-1">Add a visual for your challenge</p>
          {coverImageUrl && (
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
            onChange={handleCoverUrlChange}
            placeholder="Paste image URL"
          />
          {coverImageUrl.trim() && !isValidImageUrl(coverImageUrl) && !coverImageUrl.startsWith('data:image/') && (
            <p className="mt-2 text-[12px] leading-[16px] text-amber-600">Image URL should start with http:// or https://</p>
          )}
          {isValidImageUrl(coverImageUrl) && !isLikelyDirectImageUrl(coverImageUrl) && (
            <p className="mt-2 text-[12px] leading-[16px] text-amber-600">
              This looks like a page/album link. Use a direct image URL so the cover can render correctly.
            </p>
          )}
          {coverImageUrl.startsWith('data:image/') && !isPersistableImageSource(coverImageUrl) && (
            <p className="mt-2 text-[12px] leading-[16px] text-amber-600">Selected image is too large. Use a smaller file or paste an image URL.</p>
          )}
        </div>

        <p className="st-form-max mt-4 st-section-title text-primary">Info</p>
        <div className="st-form-max mt-2.5 space-y-3.5">
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

        <p className="st-form-max mt-4 st-section-title text-primary">Challenge Type</p>
        <div className="st-form-max mt-2.5 grid grid-cols-3 gap-2">
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

        <p className="st-form-max mt-4 st-section-title text-primary">Timeline</p>
        <div className="st-form-max mt-2.5 grid grid-cols-2 gap-3">
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
        <div className="st-form-max mt-2.5">
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
            <p className="text-[13px] leading-[18px] font-semibold text-primary">
              {challengeDurationDays
                ? `Challenge Duration: ${challengeDurationDays} day${challengeDurationDays === 1 ? '' : 's'}`
                : 'Select both dates to calculate challenge duration.'}
            </p>
          </div>
        </div>

        <div className="st-form-max mt-4">
          <div className="st-card p-4">
            <p className="st-section-title text-primary">Challenge Activities</p>
            {isExercisesLoading && !isWellnessMode && (
              <p className="mt-2 text-[12px] leading-[16px] text-slate-500">Loading exercise library...</p>
            )}
            {isExercisesError && !isWellnessMode && (
              <p className="mt-2 text-[12px] leading-[16px] text-red-500">Could not load exercises. Please retry.</p>
            )}
            {!isExercisesLoading && !isExercisesError && exercises.length === 0 && !isWellnessMode && (
              <p className="mt-2 text-[12px] leading-[16px] text-amber-600">No exercises available yet. Load catalog exercises first.</p>
            )}
            {isWellnessMode && isWellnessActivitiesLoading && (
              <p className="mt-2 text-[12px] leading-[16px] text-slate-500">Loading wellness activity library...</p>
            )}
            {isWellnessMode && isWellnessActivitiesError && (
              <p className="mt-2 text-[12px] leading-[16px] text-red-500">Could not load wellness activities. Please retry.</p>
            )}
            {isWellnessMode && !isWellnessActivitiesLoading && !isWellnessActivitiesError && wellnessActivities.length === 0 && (
              <p className="mt-2 text-[12px] leading-[16px] text-amber-600">No wellness activities available yet. Seed the wellness activity library.</p>
            )}

          {activities.map((activity, index) => {
            const normalizedQuery = normalizeSearchTerm(activity.query);
            const filtered = exercises
                .filter((exercise) => {
                  const normalizedName = normalizeSearchTerm(exercise.name);
                  return (
                    normalizedName.includes(normalizedQuery)
                    || normalizedQuery.includes(normalizedName)
                  );
                })
                .slice(0, 5);
              const showSuggestions = activeSearchRow === index;

              return (
                <div key={`activity-${index}`} className="mt-3 st-card p-3 border-slate-200">
                  <div className="flex items-center justify-between">
                    <p className="text-[16px] leading-[20px] font-semibold text-slate-800">Activity {index + 1}</p>
                    {activities.length > 1 && (
                      <button className="text-[13px] font-bold text-red-500" onClick={() => removeActivity(index)}>
                        Remove
                      </button>
                    )}
                  </div>

                  <label className="sr-only" htmlFor={`activity-search-${index}`}>Search activities</label>
                  <div className="relative mt-2">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id={`activity-search-${index}`}
                      className="st-input pl-10"
                      placeholder={isWellnessMode ? 'Search wellness activities' : 'Search activities (e.g. Pushups)'}
                      value={activity.query}
                      onFocus={() => {
                        if (!isWellnessMode) setActiveSearchRow(index);
                      }}
                      onBlur={() => {
                        if (!isWellnessMode) {
                          window.setTimeout(() => setActiveSearchRow((current) => (current === index ? null : current)), 120);
                        }
                      }}
                      onChange={(e) => {
                        if (!isWellnessMode) setActiveSearchRow(index);
                        updateActivity(index, {
                          query: e.target.value,
                          exerciseId: '',
                          ...(isWellnessMode ? { activityId: '' } : {}),
                        });
                      }}
                    />
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center"
                      onClick={() => {
                        if (isWellnessMode) {
                          openWellnessActivityPicker(index);
                          return;
                        }
                        openActivityPicker(index);
                      }}
                      aria-label={isWellnessMode ? 'Open wellness activity picker' : 'Open exercise picker'}
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  <button
                    className="mt-2 text-[13px] leading-[18px] font-bold text-primary"
                    onClick={() => {
                      if (isWellnessMode) {
                        openWellnessActivityPicker(index);
                        return;
                      }
                      openActivityPicker(index);
                    }}
                  >
                    {isWellnessMode ? 'Browse wellness activity library' : 'Browse exercise library'}
                  </button>

                  {showSuggestions && filtered.length > 0 && !isWellnessMode && (
                    <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden">
                      {filtered.map((exercise) => (
                        <button
                          key={`${index}-${exercise.id}`}
                          className="w-full text-left px-3 py-2 border-b last:border-b-0 border-slate-100 text-[14px] leading-[18px] font-semibold text-slate-700"
                          onMouseDown={(event) => event.preventDefault()}
                          onPointerDown={(event) => event.preventDefault()}
                          onClick={() => {
                            updateActivity(index, { query: exercise.name, exerciseId: exercise.id, unit: exercise.metric.unit });
                            setActiveSearchRow(null);
                          }}
                        >
                          {exercise.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {showSuggestions && filtered.length === 0 && !isWellnessMode && (
                    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[12px] leading-[16px] text-slate-500">No matches. Try another activity name.</p>
                    </div>
                  )}

                  {!!activity.exerciseId && !isWellnessMode && (
                    <button
                      className="mt-2 text-[13px] font-bold text-primary"
                      onClick={() => navigate(`/app/exercises/${activity.exerciseId}`)}
                    >
                      View exercise detail
                    </button>
                  )}

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
                      {isWellnessMode ? (
                        <input
                          className="st-input mt-2"
                          value={activity.unit}
                          onChange={(e) => updateActivity(index, { unit: e.target.value })}
                          placeholder="hours / ml / servings"
                        />
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
                  {isWellnessMode && (
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
                  {isWellnessMode && (
                    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[12px] leading-[16px] text-slate-700 font-semibold">{activity.icon ?? '✨'} {activity.category ?? 'wellness'} • {activity.difficulty ?? 'beginner'}</p>
                      {activity.description && (
                        <p className="mt-1 text-[12px] leading-[16px] text-slate-500">{activity.description}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <button className="mt-4 w-full h-12 rounded-2xl border border-dashed border-primary/40 text-[15px] leading-[20px] font-bold text-primary flex items-center justify-center gap-2" onClick={addActivity}>
              <Plus size={16} /> Add Another Activity
            </button>
          </div>
        </div>

        <div className="st-form-max mt-4 st-card p-4">
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
                <input className="st-input mt-2" type="number" min={0} value={targetDonation} onChange={(e) => setTargetDonation(e.target.value)} />
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
                <input className="st-input mt-2" value={contributionPhone} onChange={(e) => setContributionPhone(e.target.value)} placeholder="e.g. +2547XXXXXXXX" />
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
      </div>

      {pickerRowIndex !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/50">
          <div className="relative mx-auto h-full w-full max-w-[375px]">
            <div className="absolute inset-x-0 bottom-0 rounded-t-[20px] bg-[#f7f9fc] pb-6 pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.2)]">
              <div className="mx-auto h-1.5 w-16 rounded-full bg-slate-300" />
              <div className="st-form-max mt-3 flex items-center justify-between">
                <div>
                  <p className="st-section-title">Exercise Library</p>
                  <p className="st-body">Pick an exercise to add to this activity</p>
                </div>
                <button className="h-9 w-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center" onClick={closeActivityPicker}>
                  <X size={18} />
                </button>
              </div>

              <div className="st-form-max mt-3 relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="st-input pl-10"
                  value={pickerSearch}
                  onChange={(event) => setPickerSearch(event.target.value)}
                  placeholder="Search exercises..."
                />
              </div>

              <div className="st-form-max mt-3 flex gap-2 overflow-x-auto pb-1">
                {activityTierOptions.map((tier) => (
                  <button
                    key={tier}
                    className={`h-9 min-w-[72px] px-3 rounded-full text-[12px] leading-[16px] font-semibold whitespace-nowrap ${pickerTier === tier ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                    onClick={() => setPickerTier(tier)}
                  >
                    {tier}
                  </button>
                ))}
              </div>

              <div className="st-form-max mt-3 max-h-[46vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                {pickerExercises.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-[16px] leading-[22px] font-semibold text-slate-800">No exercises found</p>
                    <p className="mt-1 text-[13px] leading-[18px] text-slate-500">Try a different search term or category.</p>
                  </div>
                ) : (
                  pickerExercises.map((exercise) => (
                    <button
                      key={`picker-${exercise.id}`}
                      className="w-full border-b last:border-b-0 border-slate-100 px-4 py-3 flex items-center justify-between gap-3 text-left"
                      onClick={() => pickExerciseForActivity(exercise.id, exercise.name, exercise.metric.unit)}
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

      {wellnessPickerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/55">
          <div className="mx-auto h-full w-full max-w-mobile bg-[#f7f9fc] pb-6">
            <div className="st-form-max pt-4 flex items-center justify-between">
              <div>
                <p className="st-section-title">Wellness Activity Library</p>
                <p className="st-body">Select activities and customize targets</p>
              </div>
              <button
                className="h-9 w-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center"
                onClick={closeWellnessActivityPicker}
              >
                <X size={18} />
              </button>
            </div>

            <div className="st-form-max mt-3 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="st-input pl-10"
                value={wellnessSearch}
                onChange={(event) => setWellnessSearch(event.target.value)}
                placeholder="Search wellness activities..."
              />
            </div>

            <div className="st-form-max mt-3 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
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

            <div className="st-form-max mt-3 max-h-[66vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white">
              {wellnessActivities.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-[16px] leading-[22px] font-semibold text-slate-800">No wellness activities found</p>
                  <p className="mt-1 text-[13px] leading-[18px] text-slate-500">Try another category or search term.</p>
                </div>
              ) : (
                wellnessActivities.map((activity) => (
                  <button
                    key={`wellness-${activity.id}`}
                    className="w-full border-b last:border-b-0 border-slate-100 px-4 py-3 text-left"
                    onClick={() => pickWellnessActivityForRow(activity)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[16px] leading-[22px] font-semibold text-slate-900 truncate">{activity.icon} {activity.name}</p>
                        <p className="text-[12px] leading-[16px] text-slate-500 truncate">
                          {activity.category} • {activity.difficulty} • {activity.defaultTargetValue} {activity.defaultMetricUnit}
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
    </Screen>
  );
}

export default CreateChallengeWizard;
