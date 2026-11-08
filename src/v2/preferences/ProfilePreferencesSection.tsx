import { useEffect, useRef, useState } from 'react';
import { V2Button, V2Card, V2ErrorState, V2Sheet } from '../components/V2Primitives';
import { GoalsPicker, InterestsPicker } from './PreferencePickers';
import { sameSelection } from './preferencesView';
import { useSaveV2Preferences, useV2Preferences } from './usePreferences';

type PreferenceCategory = 'interests' | 'goals';

/**
 * Profile preference summaries and their focused editors.
 * The existing server vocabulary, selection controls, limits and save mutation
 * remain the single source of truth; only the Profile presentation is compact.
 */
export function ProfilePreferencesSection({ uid }: { uid: string | null }) {
  const prefs = useV2Preferences();
  const save = useSaveV2Preferences();
  const data = prefs.data;
  const [interests, setInterests] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [editingCategory, setEditingCategory] = useState<PreferenceCategory | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Seed the draft from server truth once per member. Opening an editor also
  // refreshes its draft from the latest cached server value.
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (!data || !uid || seededFor.current === uid) return;
    seededFor.current = uid;
    setInterests(data.interestIds);
    setGoals(data.goalIds);
    setEditingCategory(null);
    setSaveError(null);
  }, [uid, data]);

  if (prefs.isLoading) return <V2Card><p className="text-sm text-slate-500">Loading your interests and goals…</p></V2Card>;
  if (prefs.isError || !data) {
    return (
      <V2Card>
        <V2ErrorState title="We couldn't load your interests and goals" onRetry={() => void prefs.refetch()} />
      </V2Card>
    );
  }

  const openEditor = (category: PreferenceCategory) => {
    setInterests(data.interestIds);
    setGoals(data.goalIds);
    setSaveError(null);
    setEditingCategory(category);
  };

  const closeEditor = () => {
    if (editingCategory === 'interests') setInterests(data.interestIds);
    if (editingCategory === 'goals') setGoals(data.goalIds);
    setSaveError(null);
    setEditingCategory(null);
  };

  const saveEditor = () => {
    if (!editingCategory) return;
    setSaveError(null);
    const selected = editingCategory === 'interests' ? interests : goals;
    const current = editingCategory === 'interests' ? data.interestIds : data.goalIds;
    if (sameSelection(selected, current)) {
      setEditingCategory(null);
      return;
    }
    const change = editingCategory === 'interests' ? { interestIds: interests } : { goalIds: goals };
    save.mutate(change, {
      onSuccess: () => setEditingCategory(null),
      onError: () => setSaveError("We couldn't save your changes. Please try again."),
    });
  };

  return (
    <>
      <V2Card>
        <h2 className="text-base font-black text-slate-900">Interests and Goals</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Private to you. They help show relevant Groups and Challenges first and never limit what you can join.
        </p>

        <PreferenceSummary
          title="Interests"
          summary={selectionSummary(data.interestIds, data.vocabulary.interests)}
          onEdit={() => openEditor('interests')}
        />
        <PreferenceSummary
          title="Goals"
          summary={selectionSummary(data.goalIds, data.vocabulary.goals)}
          onEdit={() => openEditor('goals')}
        />
      </V2Card>

      <V2Sheet
        open={editingCategory !== null}
        onClose={closeEditor}
        title={editingCategory === 'interests' ? 'Edit interests' : 'Edit goals'}
        variant="focused"
      >
        {editingCategory === 'interests' ? (
          <div className="space-y-4">
            <p className="text-sm leading-5 text-slate-600">
              Pick up to {data.limits.interests}. These help personalize relevance; everything stays open to you.
            </p>
            <InterestsPicker
              options={data.vocabulary.interests}
              selected={interests}
              max={data.limits.interests}
              onChange={setInterests}
              disabled={save.isPending}
            />
          </div>
        ) : editingCategory === 'goals' ? (
          <div className="space-y-4">
            <p className="text-sm leading-5 text-slate-600">
              Pick up to {data.limits.goals}. Goals only help personalize relevance.
            </p>
            <GoalsPicker
              options={data.vocabulary.goals}
              selected={goals}
              max={data.limits.goals}
              onChange={setGoals}
              disabled={save.isPending}
            />
          </div>
        ) : null}
        {saveError && <p role="alert" className="mt-4 text-sm font-bold text-red-700">{saveError}</p>}
        <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
          <V2Button onClick={saveEditor} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </V2Button>
          <V2Button variant="secondary" onClick={closeEditor} disabled={save.isPending}>
            Cancel
          </V2Button>
        </div>
      </V2Sheet>
    </>
  );
}

function PreferenceSummary({ title, summary, onEdit }: { title: string; summary: string; onEdit: () => void }) {
  return (
    <section className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3" aria-label={title}>
      <div className="min-w-0">
        <h3 className="text-sm font-black text-slate-900">{title}</h3>
        <p className="mt-0.5 break-words text-xs leading-5 text-slate-600">{summary}</p>
      </div>
      <V2Button variant="secondary" className="shrink-0" onClick={onEdit} aria-haspopup="dialog">
        Edit {title.toLowerCase()}
      </V2Button>
    </section>
  );
}

function selectionSummary<T extends { id: string; label: string }>(selectedIds: string[], options: readonly T[]): string {
  if (selectedIds.length === 0) return 'None selected';
  const labels = selectedIds
    .map((id) => options.find((option) => option.id === id)?.label)
    .filter((label): label is string => Boolean(label));
  const shown = labels.slice(0, 2);
  const remaining = selectedIds.length - shown.length;
  return `${selectedIds.length} selected${shown.length ? ` · ${shown.join(', ')}` : ''}${remaining > 0 ? ` +${remaining} more` : ''}`;
}
