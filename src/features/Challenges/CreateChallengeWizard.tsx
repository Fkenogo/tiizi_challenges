import { ArrowLeft, Calendar, Camera, Plus, Search, X } from 'lucide-react';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useCreateChallenge } from '../../hooks/useChallenges';
import { useSuggestedChallengeTemplate } from '../../hooks/useChallengeTemplates';
import { useExercises } from '../../hooks/useExercises';
import { useGroups } from '../../hooks/useGroups';
import { isPersistableImageSource, isValidImageUrl, readFileAsDataUrl, uploadImageFile } from '../../services/imageUploadService';

type ChallengeType = 'collective' | 'competitive' | 'streak';

type ActivityRow = {
  query: string;
  exerciseId: string;
  targetValue: string;
  unit: string;
};

const typeOptions: Array<{ id: ChallengeType; label: string }> = [
  { id: 'collective', label: 'Collective' },
  { id: 'competitive', label: 'Competitive' },
  { id: 'streak', label: 'Streak' },
];

function normalizeSearchTerm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function CreateChallengeWizard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const groupId = params.get('groupId') ?? undefined;
  const templateId = params.get('templateId') ?? undefined;
  const initialType = (params.get('type') as ChallengeType | null) ?? 'collective';
  const { data: groups } = useGroups();
  const hasValidGroupId = !!groupId && !!groups?.some((group) => group.id === groupId);
  const activeGroupId = hasValidGroupId ? groupId : undefined;
  const { user } = useAuth();
  const { showToast } = useToast();
  const createChallenge = useCreateChallenge();
  const {
    data: exercises = [],
    isLoading: isExercisesLoading,
    isError: isExercisesError,
  } = useExercises();
  const { data: template } = useSuggestedChallengeTemplate(templateId);

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
  const [donationEnabled, setDonationEnabled] = useState(false);
  const [causeDescription, setCauseDescription] = useState('');
  const [targetDonation, setTargetDonation] = useState('500');
  const [templateApplied, setTemplateApplied] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (groupId && groups && !hasValidGroupId) {
      navigate('/app/create-challenge', { replace: true });
    }
  }, [groupId, groups, hasValidGroupId, navigate]);

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
    if (challengeType && challengeType !== 'collective') cleanParams.set('type', challengeType);
    const cleanQuery = cleanParams.toString();
    navigate(`/app/create-challenge${cleanQuery ? `?${cleanQuery}` : ''}`, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, groupId, templateId, challengeType, navigate, activities.length]);

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
      setCauseDescription(template.donation.causeDescription ?? '');
      setTargetDonation(String(template.donation.targetAmount ?? 0));
    }

    setTemplateApplied(true);
  }, [template, templateApplied, exercises]);

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

    const validActivities = activities
      .map((activity) => {
        if (activity.exerciseId && Number(activity.targetValue) > 0) return activity;
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

    try {
      const challenge = await createChallenge.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        createdBy: user.uid,
        groupId: activeGroupId,
        challengeType,
        startDate,
        endDate,
        coverImageUrl: persistableCover,
        exerciseIds: Array.from(new Set(validActivities.map((activity) => activity.exerciseId))),
        activities: validActivities.map((activity) => ({
          exerciseId: activity.exerciseId,
          exerciseName: exerciseById.get(activity.exerciseId)?.name ?? activity.query,
          targetValue: Number(activity.targetValue),
          unit: activity.unit,
        })),
        donation: donationEnabled
          ? {
              enabled: true,
              causeDescription: causeDescription.trim(),
              targetAmount: Number(targetDonation) || 0,
            }
          : {
              enabled: false,
            },
      });

      showToast('Challenge launched.', 'success');
      navigate(challengeRoute(challengeType, challenge.id));
    } catch {
      showToast('Failed to launch challenge.', 'error');
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
          {coverImageUrl.startsWith('data:image/') && !isPersistableImageSource(coverImageUrl) && (
            <p className="mt-2 text-[12px] leading-[16px] text-amber-600">Selected image is too large. Use a smaller file or paste an image URL.</p>
          )}
        </div>

        <p className="st-form-max mt-4 st-section-title text-primary">Info</p>
        <div className="st-form-max mt-2.5 space-y-3.5">
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
            {isExercisesLoading && (
              <p className="mt-2 text-[12px] leading-[16px] text-slate-500">Loading exercise library...</p>
            )}
            {isExercisesError && (
              <p className="mt-2 text-[12px] leading-[16px] text-red-500">Could not load exercises. Please retry.</p>
            )}
            {!isExercisesLoading && !isExercisesError && exercises.length === 0 && (
              <p className="mt-2 text-[12px] leading-[16px] text-amber-600">No exercises available yet. Load catalog exercises first.</p>
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
                      placeholder="Search activities (e.g. Pushups)"
                      value={activity.query}
                      onFocus={() => setActiveSearchRow(index)}
                      onBlur={() => window.setTimeout(() => setActiveSearchRow((current) => (current === index ? null : current)), 120)}
                      onChange={(e) => {
                        setActiveSearchRow(index);
                        updateActivity(index, { query: e.target.value, exerciseId: '' });
                      }}
                    />
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center"
                      onClick={() => openActivityPicker(index)}
                      aria-label="Open exercise picker"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  <button
                    className="mt-2 text-[13px] leading-[18px] font-bold text-primary"
                    onClick={() => openActivityPicker(index)}
                  >
                    Browse exercise library
                  </button>

                  {showSuggestions && filtered.length > 0 && (
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
                  {showSuggestions && filtered.length === 0 && (
                    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[12px] leading-[16px] text-slate-500">No matches. Try another activity name.</p>
                    </div>
                  )}

                  {!!activity.exerciseId && (
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
                      <select className="st-input mt-2 appearance-none" value={activity.unit} onChange={(e) => updateActivity(index, { unit: e.target.value })}>
                        <option value="Reps">Reps</option>
                        <option value="Seconds">Seconds</option>
                        <option value="Minutes">Minutes</option>
                        <option value="Km">Km</option>
                        <option value="Kg">Kg</option>
                      </select>
                    </div>
                  </div>
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
            <p className="st-section-title text-primary">Info</p>
            <button className={`st-toggle ${donationEnabled ? 'on' : ''}`} onClick={() => setDonationEnabled((prev) => !prev)}>
              <span />
            </button>
          </div>

          <p className="text-[12px] leading-[16px] text-slate-500 mt-1">Raise money for a charity</p>

          {donationEnabled && (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Cause Description</p>
                <input className="st-input mt-2" value={causeDescription} onChange={(e) => setCauseDescription(e.target.value)} placeholder="e.g. Save the Oceans Foundation" />
              </div>
              <div>
                <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Target Total Donation ($)</p>
                <input className="st-input mt-2" type="number" min={0} value={targetDonation} onChange={(e) => setTargetDonation(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <button className="st-form-max st-btn-primary mt-6" disabled={createChallenge.isPending} onClick={handleLaunch}>
          {createChallenge.isPending ? 'Launching...' : 'Launch Challenge'}
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
    </Screen>
  );
}

export default CreateChallengeWizard;
