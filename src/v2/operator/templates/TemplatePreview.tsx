import { V2Card } from '../../components/V2Primitives';
import type { TemplatePreviewModel } from './templatePreviewModel';

/**
 * TIIZI-FER-P5T-2-S4 — read-only, illustrative member-style preview of a saved Template.
 * Renders a model only; it has no controls that change anything.
 */
export function TemplatePreview({ model }: { model: TemplatePreviewModel }) {
  return (
    <div aria-label="Template preview" data-template-preview className="space-y-3">
      <p role="note" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">
        Illustrative preview of the saved draft. Nothing is created: no Challenge, no participation, and members cannot see this.
      </p>
      <div className={`rounded-2xl bg-gradient-to-br p-5 text-white ${model.coverGradient}`}>
        {model.challengeTypeLabel ? <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider">{model.challengeTypeLabel}</span> : null}
        <h2 className="mt-2 text-2xl font-black">{model.title}</h2>
        {model.description ? <p className="mt-1 text-sm leading-6 text-white/90">{model.description}</p> : null}
      </div>

      {model.summary ? <V2Card><p className="text-sm leading-6 text-slate-700">{model.summary}</p></V2Card> : null}

      {model.tags.length > 0 ? (
        <ul aria-label="Interests" className="flex flex-wrap gap-2">
          {model.tags.map((tag) => <li key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{tag}</li>)}
        </ul>
      ) : null}

      <V2Card>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Duration</p>
        <p className="mt-0.5 text-sm font-bold text-slate-900">{model.durationDays === null ? 'Not set' : `${model.durationDays} days`}</p>
        {model.durationChoices.length > 0 ? (
          <p className="mt-1 text-xs text-slate-600">Members can choose: {model.durationChoices.map((days) => `${days} days`).join(', ')}</p>
        ) : null}
      </V2Card>

      <section aria-label="Activities in this Template" className="space-y-2">
        {model.activities.length === 0 ? <V2Card><p className="text-sm text-slate-600">No Activities chosen yet.</p></V2Card> : null}
        {model.activities.map((activity) => (
          <V2Card key={activity.identity}>
            <div data-preview-activity={activity.identity}>
              <p className="text-sm font-black text-slate-900">{activity.name}</p>
              <p className="mt-0.5 text-xs text-slate-600">
                {activity.metric}{activity.unit ? ` in ${activity.unit}` : ''}{activity.target !== null ? ` · target ${activity.target}${activity.unit ? ` ${activity.unit}` : ''}` : ''}
              </p>
              {activity.settings.length > 0 ? (
                <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">{activity.settings.map((line) => <li key={line}>{line}</li>)}</ul>
              ) : null}
            </div>
          </V2Card>
        ))}
      </section>

      <V2Card>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">What counts</p>
        <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-600">{model.whatCounts.map((line) => <li key={line}>• {line}</li>)}</ul>
      </V2Card>

      {model.gaps.length > 0 ? (
        <div role="status" aria-label="Still missing" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-bold">Not yet complete in the saved draft:</p>
          <ul className="list-disc pl-5">{model.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
        </div>
      ) : null}
    </div>
  );
}
