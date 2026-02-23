import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/Mobile';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useCreateAdminChallenge } from '../../../hooks/useAdminChallenges';
import { useCreateSuggestedChallengeTemplate } from '../../../hooks/useChallengeTemplates';
import { AdminLayout } from '../layout/AdminLayout';

function CreateChallengeScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions } = useAdminPermissions(user?.uid);
  const createMutation = useCreateAdminChallenge();
  const createTemplateMutation = useCreateSuggestedChallengeTemplate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [challengeType, setChallengeType] = useState<'collective' | 'competitive' | 'streak'>('collective');
  const [difficultyLevel, setDifficultyLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [durationDays, setDurationDays] = useState('30');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [tag, setTag] = useState('trending');
  const [popularityText, setPopularityText] = useState('2.4k joined');
  const [activityName, setActivityName] = useState('Burpees');
  const [activityTarget, setActivityTarget] = useState('150');
  const [activityUnit, setActivityUnit] = useState('Reps');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const canPublish = !!name.trim() && !!startDate && !!endDate && !!user?.uid;
  const canSaveTemplate = !!name.trim() && !!description.trim() && !!activityName.trim();

  const onCreate = async () => {
    if (!canPublish || !user?.uid) return;
    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        challengeType,
        startDate,
        endDate,
        createdBy: user.uid,
      });
      showToast('Challenge created and published.', 'success');
      navigate('/app/admin/challenges/active');
    } catch {
      showToast('Could not create challenge.', 'error');
    }
  };

  const onSaveTemplate = async () => {
    if (!canSaveTemplate) return;
    try {
      await createTemplateMutation.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        challengeType,
        durationDays: Number(durationDays) || 30,
        difficultyLevel,
        coverImageUrl: coverImageUrl.trim() || undefined,
        tag: tag.trim() || undefined,
        popularityText: popularityText.trim() || undefined,
        activities: [
          {
            exerciseName: activityName.trim(),
            targetValue: Number(activityTarget) || 0,
            unit: activityUnit,
          },
        ],
        isPublished: true,
      });
      showToast('Suggested challenge template saved.', 'success');
      navigate('/app/admin/challenges/templates');
    } catch {
      showToast('Could not save template.', 'error');
    }
  };

  return (
    <AdminLayout title="Create Challenge / Template" permissions={permissions}>
      <Card>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-500">Name</label>
            <input className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="30-Day Core Blast" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">Challenge Type</label>
            <select className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={challengeType} onChange={(e) => setChallengeType(e.target.value as 'collective' | 'competitive' | 'streak')}>
              <option value="collective">Collective</option>
              <option value="competitive">Competitive</option>
              <option value="streak">Streak</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500">Difficulty</label>
            <select className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={difficultyLevel} onChange={(e) => setDifficultyLevel(e.target.value as 'beginner' | 'intermediate' | 'advanced')}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">Duration (Days)</label>
            <input className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" type="number" min={1} value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-bold text-slate-500">Description</label>
            <textarea className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-24" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Challenge details and goals" />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-bold text-slate-500">Cover Image URL</label>
            <input className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://..." />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500">Template Tag</label>
            <input className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="trending / hardcore" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">Popularity Text</label>
            <input className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={popularityText} onChange={(e) => setPopularityText(e.target.value)} placeholder="2.4k joined" />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500">Template Activity</label>
            <input className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={activityName} onChange={(e) => setActivityName(e.target.value)} placeholder="Burpees" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">Target</label>
            <input className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" type="number" min={1} value={activityTarget} onChange={(e) => setActivityTarget(e.target.value)} placeholder="150" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">Unit</label>
            <select className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={activityUnit} onChange={(e) => setActivityUnit(e.target.value)}>
              <option value="Reps">Reps</option>
              <option value="Minutes">Minutes</option>
              <option value="Seconds">Seconds</option>
              <option value="Km">Km</option>
              <option value="Kg">Kg</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500">Start Date (Live publish)</label>
            <input type="date" className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">End Date (Live publish)</label>
            <input type="date" className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 flex gap-2 flex-wrap">
          <button className="h-10 px-3 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/admin/challenges/active')}>Cancel</button>
          <button
            className="h-10 px-3 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50"
            disabled={!permissions.canApproveChallenges || !canPublish || createMutation.isPending}
            onClick={onCreate}
          >
            {createMutation.isPending ? 'Creating...' : 'Publish Live Challenge'}
          </button>
          <button
            className="h-10 px-3 rounded-lg border border-primary text-primary text-sm font-bold disabled:opacity-50"
            disabled={!permissions.canManageContent || !canSaveTemplate || createTemplateMutation.isPending}
            onClick={onSaveTemplate}
          >
            {createTemplateMutation.isPending ? 'Saving...' : 'Save Suggested Template'}
          </button>
        </div>
      </Card>
    </AdminLayout>
  );
}

export default CreateChallengeScreen;
