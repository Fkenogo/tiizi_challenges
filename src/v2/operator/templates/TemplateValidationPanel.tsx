import type { TemplateValidationIssue } from '../../../api/operatorTemplatesApi';
import { STEP_LABELS, displayedIssues, type IssueStep, type ValidationFailure, type ValidationRecord } from './templateValidationModel';

/**
 * TIIZI-FER-P5T-2-S4 — shows the SERVER's validation outcome for the saved draft.
 * It never computes validity; when the result no longer describes the draft on
 * screen it says so and withholds the success/failure verdict.
 */

export function activityLabel(issue: TemplateValidationIssue, names: string[]): string {
  return issue.activityIndex !== undefined && names[issue.activityIndex] ? `${names[issue.activityIndex]}: ` : '';
}

export function TemplateValidationPanel({
  record, stale, checking, failure, grouped, activityNames, onOpenStep,
}: {
  record: ValidationRecord | null;
  stale: boolean;
  checking: boolean;
  failure: ValidationFailure | null;
  grouped: Record<IssueStep, TemplateValidationIssue[]> | null;
  activityNames: string[];
  onOpenStep: (step: Exclude<IssueStep, 'general'>) => void;
}) {
  if (checking) return <p role="status" className="mb-3 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">Checking the saved draft…</p>;
  if (failure) {
    return (
      <div role="alert" data-validation-failure={failure.kind} className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        <p className="font-bold">Not checked</p>
        <p>{failure.message}</p>
      </div>
    );
  }
  if (!record || !grouped) return null;
  if (stale) {
    return (
      <p role="status" data-validation-state="stale" className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
        The last check no longer matches this draft. Use “Save and check” to check it again.
      </p>
    );
  }
  if (record.ok) {
    return <p role="status" data-validation-state="ok" className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">The saved draft passed the server check when it was checked, at {new Date(record.checkedAt).toLocaleTimeString()}. A later change by another author is caught when you next save. Publishing is a later step and is not available here.</p>;
  }
  const total = displayedIssues(record.issues).length;
  const steps = (Object.keys(grouped) as IssueStep[]).filter((step) => grouped[step].length > 0);
  return (
    <section role="alert" aria-label="Check results" data-validation-state="issues" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <p className="font-bold">The server found {total} {total === 1 ? 'issue' : 'issues'} in the saved draft</p>
      <ul className="mt-1 space-y-1">
        {steps.map((step) => (
          <li key={step}>
            <span className="font-bold">{STEP_LABELS[step]}</span>
            {step !== 'general' ? <button type="button" onClick={() => onOpenStep(step)} className="ml-2 text-xs font-bold underline">Go to step</button> : null}
            <ul className="list-disc pl-5 text-xs">{grouped[step].map((issue, index) => <li key={`${issue.code}-${index}`}>{activityLabel(issue, activityNames)}{issue.message}</li>)}</ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Issues for the step the author is on, shown beside the fields to change. */
export function StepIssues({ issues, stale, activityNames }: { issues: TemplateValidationIssue[]; stale: boolean; activityNames: string[] }) {
  if (issues.length === 0 || stale) return null;
  return (
    <ul aria-label="Server check issues for this step" data-step-issues className="list-disc rounded-xl bg-red-50 px-8 py-2 text-xs font-bold text-red-700">
      {issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{activityLabel(issue, activityNames)}{issue.message}</li>)}
    </ul>
  );
}
