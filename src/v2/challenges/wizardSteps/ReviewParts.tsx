import type { ComposerChallengeType } from '../../../api/challengeCreationApi';
import { V2Card } from '../../components/V2Primitives';
import { whatCountsExplanation } from '../challengeCreationDraft';

export function ReviewCard({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <V2Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-0.5 text-sm font-bold text-slate-900">{value}</p>
        </div>
        <button type="button" onClick={onEdit} className="text-xs font-bold text-primary hover:underline">
          Edit
        </button>
      </div>
    </V2Card>
  );
}

/** The "What counts" explainer card shared by every Review presentation. */
export function WhatCountsExplanation({ challengeType }: { challengeType: ComposerChallengeType | null }) {
  return (
    <V2Card>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">What counts</p>
      <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-600">
        {whatCountsExplanation(challengeType).map((line) => (
          <li key={line}>• {line}</li>
        ))}
      </ul>
    </V2Card>
  );
}

export function PreviewStatus<TStep extends string>({
  state,
  issues,
  onEditStep,
}: {
  state: 'idle' | 'checking' | 'valid' | 'invalid';
  issues: ReadonlyArray<{ code: string; friendly: string; step: TStep }> | null;
  onEditStep: (step: TStep) => void;
}) {
  if (state === 'checking') {
    return (
      <V2Card className="bg-slate-50">
        <p className="text-sm font-bold text-slate-600">Checking your Challenge…</p>
      </V2Card>
    );
  }
  if (state === 'valid') {
    return (
      <V2Card className="border-emerald-200 bg-emerald-50">
        <p className="text-sm font-bold text-emerald-800">
          Everything checks out. You can create this Challenge.
        </p>
      </V2Card>
    );
  }
  if (state === 'invalid' && issues && issues.length > 0) {
    return (
      <V2Card className="border-red-200 bg-red-50">
        <p className="text-sm font-black text-red-800">Let us fix these before creating</p>
        <ul className="mt-2 space-y-2">
          {issues.map((issue, index) => (
            <li key={`${issue.code}-${index}`} className="text-sm leading-6 text-red-800">
              <span>{issue.friendly}</span>{' '}
              <button
                type="button"
                onClick={() => onEditStep(issue.step)}
                className="font-bold underline"
              >
                Go to step
              </button>
            </li>
          ))}
        </ul>
      </V2Card>
    );
  }
  return null;
}
