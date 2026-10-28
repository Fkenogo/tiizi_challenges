import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { V2Button, V2Card, V2ErrorState, V2LoadingState, V2Page, V2SectionHeader } from '../components/V2Primitives';
import { resolveV2NextPath } from '../auth/v2NextPath';
import { GoalsPicker, InterestsPicker } from './PreferencePickers';
import { afterPreferencesPath } from './preferencesView';
import { useSaveV2Preferences, useV2Preferences } from './usePreferences';

/**
 * TIIZI-FER-P1B-001 — personalization after sign-up (`/v2/preferences`).
 *
 * Two INDEPENDENT steps (Interests, then Goals). Each can be skipped; a skip
 * records the member's decision (an empty selection) so they are not asked
 * again, and never costs them anything: this is not a gate and no feature
 * depends on it. A side the member already decided is not shown again, and
 * Skip never erases an existing selection.
 */
type Step = 'interests' | 'goals';

export function V2PreferencesSetupScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const destination = afterPreferencesPath(resolveV2NextPath(params.get('next')));
  const prefs = useV2Preferences();
  const save = useSaveV2Preferences();
  const [step, setStep] = useState<Step | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const data = prefs.data;

  // Pick the first undecided step once, from server truth; if nothing is left, move on.
  useEffect(() => {
    if (!data || step !== null) return;
    if (!data.interestsDecided) { setStep('interests'); setInterests(data.interestIds); }
    else if (!data.goalsDecided) { setStep('goals'); setGoals(data.goalIds); }
    else navigate(destination, { replace: true });
  }, [data, step, navigate, destination]);

  if (prefs.isLoading || (data && step === null)) {
    return <V2Page><V2LoadingState label="Loading…" /></V2Page>;
  }
  if (prefs.isError || !data || step === null) {
    return (
      <V2Page>
        <V2ErrorState
          title="We couldn't load this step"
          message="You can carry on without it and set your interests and goals any time in your Profile."
          onRetry={() => void prefs.refetch()}
        />
        <V2Button variant="secondary" className="mt-4 w-full" onClick={() => navigate(destination, { replace: true })}>
          Continue without choosing
        </V2Button>
      </V2Page>
    );
  }

  const finishInterests = (chosen: string[] | null) => {
    setError(null);
    const afterSave = () => {
      if (data.goalsDecided) navigate(destination, { replace: true });
      else { setStep('goals'); setGoals(data.goalIds); }
    };
    // Skip on an already-decided side changes nothing (never erases a selection).
    if (chosen === null && data.interestsDecided) { afterSave(); return; }
    save.mutate({ interestIds: chosen ?? [] }, {
      onSuccess: afterSave,
      onError: () => setError("We couldn't save that. Please try again, or skip for now."),
    });
  };
  const finishGoals = (chosen: string[] | null) => {
    setError(null);
    if (chosen === null && data.goalsDecided) { navigate(destination, { replace: true }); return; }
    save.mutate({ goalIds: chosen ?? [] }, {
      onSuccess: () => navigate(destination, { replace: true }),
      onError: () => setError("We couldn't save that. Please try again, or skip for now."),
    });
  };

  const isInterests = step === 'interests';
  const selected = isInterests ? interests : goals;
  return (
    <V2Page>
      <V2SectionHeader
        eyebrow={isInterests ? 'Step 1 of 2' : 'Step 2 of 2'}
        title={isInterests ? 'What are you into?' : 'What are you working towards?'}
        description={isInterests
          ? 'Pick up to 5. We use this to show the Groups and Challenges most relevant to you first. Everything stays open to you either way.'
          : 'Pick up to 3. Like interests, this only helps us put the most relevant things first.'}
      />
      <V2Card>
        {isInterests ? (
          <InterestsPicker options={data.vocabulary.interests} selected={interests} max={data.limits.interests} onChange={setInterests} disabled={save.isPending} />
        ) : (
          <GoalsPicker options={data.vocabulary.goals} selected={goals} max={data.limits.goals} onChange={setGoals} disabled={save.isPending} />
        )}
      </V2Card>
      {error && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{error}</p>}
      <div className="mt-4 space-y-2">
        <V2Button
          className="w-full"
          disabled={save.isPending || selected.length === 0}
          onClick={() => (isInterests ? finishInterests(interests) : finishGoals(goals))}
        >
          {save.isPending ? 'Saving…' : isInterests ? 'Continue' : 'Save and explore'}
        </V2Button>
        <V2Button
          variant="ghost"
          className="w-full"
          disabled={save.isPending}
          onClick={() => (isInterests ? finishInterests(null) : finishGoals(null))}
        >
          Skip for now
        </V2Button>
      </div>
    </V2Page>
  );
}
