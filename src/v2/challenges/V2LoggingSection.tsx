import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { V2ActivityResult, V2ChallengeDetail } from '../../api/v2ChallengeApi';
import { fetchKnowledgeByCode, fetchKnowledgeById } from '../../api/knowledgeApi';
import {
  buildV2ActivityPayload,
  mapV2ApiError,
  newClientKey,
} from '../../services/v2ActivityPayload';
import { V2Button, V2Card, V2Field, V2Select, V2TextInput } from '../components/V2Primitives';
import { useLogActivityV2 } from './useChallengeCreation';
import { loggingViewFor, type S3bLoggableChoice } from './loggingView';

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

function choiceLabel(choice: S3bLoggableChoice): string {
  const variant = choice.activityVariant ? ` (${choice.activityVariant})` : '';
  return `${choice.canonicalKey}${variant} — target ${choice.targetValue} ${choice.unit}`;
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * S3b — Challenge activity logging section.
 *
 * Binds the existing governed activity-application seam
 * (`POST /v1/challenges/:id/activity`) to the V2 Challenge detail.
 * Rendered ONLY where canonical state permits submission (joined +
 * open + configured activities, via `loggingViewFor`);
 * otherwise renders nothing — the participation section already speaks
 * for not-joined/read-only states.
 *
 * Eligible choices derive from the governing configuration already on
 * the detail read; the member supplies only the amount and when it
 * happened. The unit/kind/variant travel locked from the chosen
 * configuration — never edited, never invented. The server alone
 * decides acceptance/rejection, scores server-side, and replays
 * idempotent duplicates; this component renders that authoritative
 * outcome honestly and never manufactures score/progress.
 *
 * Idempotency: ONE client_key per intentional entry (created with the
 * form, reused across retries of THAT submission). Infrastructure
 * failures offer Retry with the same key; governed rejections offer a
 * fresh entry (new key) because resubmitting changed facts under the
 * rejected key would conflict.
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
  const [localError, setLocalError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<V2ActivityResult | null>(null);
  const [denial, setDenial] = useState<{ message: string; retryable: boolean; code?: string } | null>(null);

  if (view.kind === 'hidden') return null;
  const choices = view.choices;
  const selected: S3bLoggableChoice = choices.find((c) => c.optionId === optionId) ?? choices[0];

  const startFreshEntry = () => {
    setAccepted(null);
    setDenial(null);
    setLocalError(null);
    setClientKey(newClientKey());
  };

  const submit = async (reuseKey: string) => {
    setLocalError(null);
    setDenial(null);
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
    let payload;
    try {
      payload = buildV2ActivityPayload({
        activityKind: selected.activityKind,
        canonicalKey: selected.canonicalKey,
        activityVariant: selected.activityVariant,
        value,
        unit: selected.unit,
        occurredAt,
        clientKey: reuseKey,
      });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'This entry is not valid.');
      return;
    }
    try {
      const result = await log.mutateAsync({ challengeId: detail.challengeId, payload });
      setAccepted(result);
    } catch (error) {
      setDenial(mapV2ApiError(error));
    }
  };

  const handleSubmit = () => void submit(clientKey);
  const handleRetry = () => void submit(clientKey);

  return (
    <V2Card>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        Log activity
      </p>

      {accepted ? (
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
          <div className="mt-3">
            <V2Button variant="secondary" onClick={startFreshEntry}>
              Log another
            </V2Button>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          <V2Field
            label="Activity"
            hint="Only what the Challenge counts is offered here."
          >
            <V2Select
              value={selected.optionId}
              onChange={setOptionId}
              options={choices.map((choice) => ({ value: choice.optionId, label: choiceLabel(choice) }))}
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
      )}

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
