import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { V2ActivityResult, V2ChallengeDetail } from '../../api/v2ChallengeApi';
import { fetchKnowledgeByCode, fetchKnowledgeById } from '../../api/knowledgeApi';
import {
  buildS3bActivityPayload,
  mapV2ApiError,
  newClientKey,
} from '../../services/v2ActivityPayload';
import { V2Button, V2Card, V2Field, V2Select, V2TextInput } from '../components/V2Primitives';
import { useLogActivityV2 } from './useChallengeCreation';
import {
  choiceOptionLabel,
  isNewEntryAllowed,
  loggingViewFor,
  NO_CONFIGURED_ACTIVITIES_COPY,
  shouldShowAcceptedResult,
  type S3bLoggableChoice,
} from './loggingView';
import {
  deriveSubmitKey,
  factsForSubmit,
  type LoggingAttempt,
} from './loggingIntent';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ChoiceName({ canonicalKey }: { canonicalKey: string }) {
  const query = useQuery({
    queryKey: ['v2-activity-name', canonicalKey],
    queryFn: () =>
      UUID_RE.test(canonicalKey)
        ? fetchKnowledgeById(canonicalKey)
        : fetchKnowledgeByCode(canonicalKey),
    enabled: !!canonicalKey,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  if (query.isLoading) return <span className="text-slate-400">Activity…</span>;
  return <span>{query.data?.name ?? 'Activity'}</span>;
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * S3b — Challenge activity logging section (CORR-001).
 *
 * Binds the existing governed activity-application seam
 * (`POST /v1/challenges/:id/activity`) to the V2 Challenge detail.
 *
 * CORR-001 corrections:
 * - The S3b payload NEVER sends a client-derived `occurred_day`; the
 *   server derives the governing day from `occurred_at` + Challenge
 *   timezone and the accepted result's `occurredDay` is displayed.
 * - One idempotency key per immutable intent: the key is derived at
 *   submit time from fact equality against the last attempt (same facts
 *   → same key; any fact change → new key before submission).
 * - An authoritative accepted result already received stays visible even
 *   if the refetched Challenge becomes ended/finalized; ended state only
 *   gates NEW submissions, never the rendered outcome.
 *
 * Rendered ONLY where canonical state permits submission (joined +
 * open + configured activities, via `loggingViewFor`); a joined
 * Challenge with zero configured activities renders an honest empty
 * state; otherwise renders nothing — the participation section already
 * speaks for not-joined/read-only states.
 *
 * Eligible choices derive from the governing configuration already on
 * the detail read; the member supplies only the amount and when it
 * happened. The unit/kind/variant travel locked from the chosen
 * configuration — never edited, never invented. The server alone
 * decides acceptance/rejection, scores server-side, and replays
 * idempotent duplicates; this component renders that authoritative
 * outcome honestly and never manufactures score/progress.
 *
 * Strictly S3b: the accepted confirmation shows only the immediate
 * recorded entry (amount, awarded points, day, duplicate notice). No
 * wider Challenge-state views live here — those belong to later slices.
 */
export function V2LoggingSection({ detail }: { detail: V2ChallengeDetail }) {
  const view = loggingViewFor(detail);
  const log = useLogActivityV2();
  const [optionId, setOptionId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [when, setWhen] = useState(() => toDatetimeLocalValue(new Date()));
  const [clientKey, setClientKey] = useState(() => newClientKey());
  const [lastAttempt, setLastAttempt] = useState<LoggingAttempt | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<V2ActivityResult | null>(null);
  const [denial, setDenial] = useState<{ message: string; retryable: boolean; code?: string } | null>(null);

  const showAccepted = shouldShowAcceptedResult(accepted);
  const allowNewEntry = isNewEntryAllowed(detail);

  // An authoritative outcome already received stays rendered even when the
  // refetched read no longer permits new logging (e.g. the accepted entry
  // ended the Challenge). Only a fresh loggable read permits new input.
  // No progress state is preserved — only the server-returned result.
  if (view.kind === 'hidden' && !showAccepted) return null;

  // Bounded honest empty state: joined but nothing is configured to log.
  if (view.kind === 'empty' && !showAccepted) {
    return (
      <V2Card>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Log activity
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{NO_CONFIGURED_ACTIVITIES_COPY}</p>
      </V2Card>
    );
  }

  const choices: S3bLoggableChoice[] =
    view.kind === 'loggable' ? view.choices : [];
  const selected: S3bLoggableChoice | undefined =
    choices.find((c) => c.optionId === optionId) ?? choices[0];

  const startFreshEntry = () => {
    // CORR-001 "Log another": deliberately re-establish a new-entry intent
    // so stale amount/time cannot be resubmitted identically under a fresh
    // key. Amount clears, time resets to now, key + attempt reset together.
    setAccepted(null);
    setDenial(null);
    setLocalError(null);
    setAmount('');
    setWhen(toDatetimeLocalValue(new Date()));
    setOptionId(null);
    setLastAttempt(null);
    setClientKey(newClientKey());
  };

  const submit = async () => {
    setLocalError(null);
    setDenial(null);
    if (!selected) {
      setLocalError('This Challenge currently has no activities available to log.');
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setLocalError('Enter an amount greater than zero.');
      return;
    }
    const occurredAt = new Date(when);
    if (Number.isNaN(occurredAt.getTime())) {
      setLocalError('Enter a valid date and time for this entry.');
      return;
    }
    const currentFacts = factsForSubmit({
      canonicalKey: selected.canonicalKey,
      activityVariant: selected.activityVariant,
      activityKind: selected.activityKind,
      value,
      unit: selected.unit,
      occurredAt,
    });
    // One key per immutable intent: unchanged facts reuse the last key
    // (retry/replay converge); ANY changed fact mints a new key BEFORE
    // submission so a corrected entry never conflicts with the old key.
    const derived = deriveSubmitKey({ currentFacts, draftKey: clientKey, lastAttempt });
    if (!derived.reused && lastAttempt !== null) {
      setClientKey(derived.key);
    }
    const submitKey = derived.key;
    let payload;
    try {
      // S3b never sends occurred_day: the server derives the governing day.
      payload = buildS3bActivityPayload({
        activityKind: selected.activityKind,
        canonicalKey: selected.canonicalKey,
        activityVariant: selected.activityVariant,
        value,
        unit: selected.unit,
        occurredAt,
        clientKey: submitKey,
      });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'This entry is not valid.');
      return;
    }
    try {
      const result = await log.mutateAsync({ challengeId: detail.challengeId, payload });
      setLastAttempt({ key: submitKey, facts: currentFacts });
      setAccepted(result);
    } catch (error) {
      // Record the attempt so a same-facts retry reuses the key while a
      // corrected-facts resubmit mints a new one.
      setLastAttempt({ key: submitKey, facts: currentFacts });
      setDenial(mapV2ApiError(error));
    }
  };

  const handleSubmit = () => void submit();
  const handleRetry = () => void submit();

  // Accepted outcome: always rendered once received, even when the
  // Challenge has since ended. New-entry controls appear ONLY while the
  // current read still permits logging.
  if (showAccepted && accepted) {
    return (
      <V2Card>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Log activity
        </p>
        <div className="mt-2" role="status">
          <p className="text-sm font-black text-slate-900">
            {accepted.duplicate ? 'Already recorded.' : 'Recorded.'}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {accepted.value} {accepted.unit} counted for this Challenge.
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Points awarded: {accepted.pointsAwarded} · Day: {accepted.occurredDay}
          </p>
          {accepted.duplicate && (
            <p className="mt-1 text-sm leading-6 text-slate-600">
              No duplicate was created.
            </p>
          )}
          {!allowNewEntry && (
            <p className="mt-1 text-sm leading-6 text-slate-600">
              This Challenge is no longer open for new entries.
            </p>
          )}
          {allowNewEntry && (
            <div className="mt-3">
              <V2Button variant="secondary" onClick={startFreshEntry}>
                Log another
              </V2Button>
            </div>
          )}
        </div>
      </V2Card>
    );
  }

  if (view.kind !== 'loggable' || !selected) return null;

  return (
    <V2Card>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        Log activity
      </p>

      <div className="mt-2 space-y-3">
        <V2Field
          label="Activity"
          hint="Only what the Challenge counts is offered here."
        >
          <V2Select
            value={selected.optionId}
            onChange={setOptionId}
            options={choices.map((choice) => ({ value: choice.optionId, label: choiceOptionLabel(choice) }))}
          />
        </V2Field>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-sm font-bold text-slate-900">
            <ChoiceName canonicalKey={selected.canonicalKey} />
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            Target {selected.targetValue} {selected.unit}
            {selected.activityVariant ? ` · ${selected.activityVariant}` : ''}
          </p>
        </div>
        <V2Field label={`Amount (${selected.unit})`} hint="Enter how much you did.">
          <V2TextInput
            type="number"
            min="0"
            value={amount}
            onChange={(next) => { setAmount(next); setLocalError(null); }}
            placeholder={`e.g. ${selected.targetValue}`}
          />
        </V2Field>
        <V2Field label="When" hint="The Challenge timezone decides which day this counts for.">
          <input
            type="datetime-local"
            value={when}
            onChange={(event) => { setWhen(event.target.value); setLocalError(null); }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary"
          />
        </V2Field>
        <div>
          <V2Button onClick={handleSubmit} disabled={log.isPending}>
            {log.isPending ? 'Recording…' : 'Log activity'}
          </V2Button>
        </div>
      </div>

      {localError && (
        <div role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          <p>{localError}</p>
        </div>
      )}

      {denial && !accepted && (
        <div
          role="alert"
          className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
        >
          <p>{denial.message}</p>
          {denial.code && (
            <p className="mt-0.5 font-mono text-[11px] opacity-70">Code: {denial.code}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {denial.retryable ? (
              <V2Button variant="secondary" onClick={handleRetry} disabled={log.isPending}>
                {log.isPending ? 'Retrying…' : 'Retry'}
              </V2Button>
            ) : (
              <V2Button variant="secondary" onClick={startFreshEntry}>
                Start a new entry
              </V2Button>
            )}
          </div>
        </div>
      )}
    </V2Card>
  );
}
