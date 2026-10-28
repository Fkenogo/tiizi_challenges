import { useEffect, useState } from 'react';
import { V2Button, V2Card, V2ErrorState } from '../components/V2Primitives';
import { GoalsPicker, InterestsPicker } from './PreferencePickers';
import { sameSelection } from './preferencesView';
import { useSaveV2Preferences, useV2Preferences } from './usePreferences';

/**
 * TIIZI-FER-P1B-001 — Interests & Goals in Profile: view, add/remove, clear
 * all, save, and edit again later. Same canonical vocabulary and limits as
 * onboarding (both come from the server). Relevance-only: nothing here
 * limits what the member can join or do.
 */
export function ProfilePreferencesSection({ uid }: { uid: string | null }) {
  const prefs = useV2Preferences();
  const save = useSaveV2Preferences();
  const data = prefs.data;
  const [interests, setInterests] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // (Re)seed the editor from server truth whenever the member or saved state changes.
  useEffect(() => {
    if (data) { setInterests(data.interestIds); setGoals(data.goalIds); }
    setMessage(null);
  }, [uid, data?.interestIds.join(','), data?.goalIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (prefs.isLoading) return <V2Card><p className="text-sm text-slate-500">Loading your interests and goals…</p></V2Card>;
  if (prefs.isError || !data) {
    return (
      <V2Card>
        <V2ErrorState title="We couldn't load your interests and goals" onRetry={() => void prefs.refetch()} />
      </V2Card>
    );
  }

  const dirty = !sameSelection(interests, data.interestIds) || !sameSelection(goals, data.goalIds);
  const anySelected = interests.length > 0 || goals.length > 0;
  const submit = (nextInterests: string[], nextGoals: string[], okText: string) => {
    setMessage(null);
    save.mutate({ interestIds: nextInterests, goalIds: nextGoals }, {
      onSuccess: () => setMessage({ kind: 'ok', text: okText }),
      onError: () => setMessage({ kind: 'error', text: "We couldn't save your changes. Please try again." }),
    });
  };

  return (
    <V2Card>
      <h2 className="text-base font-black text-slate-900">Interests &amp; Goals</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Private to you. We use them to show the most relevant Groups and Challenges first — they never limit what you can join.
      </p>

      <h3 className="mt-4 text-sm font-black text-slate-900">Interests</h3>
      <div className="mt-2">
        <InterestsPicker options={data.vocabulary.interests} selected={interests} max={data.limits.interests} onChange={setInterests} disabled={save.isPending} />
      </div>

      <h3 className="mt-5 text-sm font-black text-slate-900">Goals</h3>
      <div className="mt-2">
        <GoalsPicker options={data.vocabulary.goals} selected={goals} max={data.limits.goals} onChange={setGoals} disabled={save.isPending} />
      </div>

      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={`mt-4 text-sm font-bold ${message.kind === 'error' ? 'text-red-700' : 'text-emerald-800'}`}>
          {message.text}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <V2Button disabled={!dirty || save.isPending} onClick={() => submit(interests, goals, 'Interests and goals saved.')}>
          {save.isPending ? 'Saving…' : 'Save'}
        </V2Button>
        <V2Button
          variant="secondary"
          disabled={save.isPending || !(anySelected || data.interestIds.length > 0 || data.goalIds.length > 0)}
          onClick={() => { setInterests([]); setGoals([]); submit([], [], 'Cleared. Nothing is selected.'); }}
        >
          Clear all
        </V2Button>
      </div>
    </V2Card>
  );
}
