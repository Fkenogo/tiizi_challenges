import { useState } from 'react';
import { type Choices, type ReconcileItem, type Side } from './templateAuthoringModel';

/**
 * TIIZI-FER-P5T-2-S3B — deliberate reconciliation after `template_draft_changed`.
 * There is no "overwrite" control: Apply stays disabled until every real
 * conflict has an explicit choice, and applying only prepares a combined draft
 * based on the server's current version; the author still has to save it.
 */
export function TemplateConflictPanel({
  items, choices, onChoose, lastEditedBy, lastEditedAt, onApply, onDiscard,
}: {
  items: ReconcileItem[];
  choices: Choices;
  onChoose: (key: string, side: Side) => void;
  lastEditedBy: string;
  lastEditedAt: string;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const needs = items.filter((item) => item.auto === null);
  const open = needs.filter((item) => choices[item.key] === undefined);
  const fields = items.filter((item) => item.kind === 'field');
  const activities = items.filter((item) => item.kind === 'activity');
  return (
    <section role="alert" aria-labelledby="conflict-title" className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <h2 id="conflict-title" className="text-sm font-black text-amber-900">This draft changed while you were editing</h2>
      <p className="mt-1 text-sm text-amber-900">
        Another save updated it (last edited by member {lastEditedBy.slice(0, 8)} at {new Date(lastEditedAt).toLocaleString()}). Your unsaved work is kept below.
        Decide what to keep, then apply; you will still need to save.
      </p>
      <p className="mt-2 text-xs font-bold text-amber-900" aria-live="polite">
        {open.length === 0 ? 'All differences are resolved.' : `${open.length} difference${open.length === 1 ? '' : 's'} need${open.length === 1 ? 's' : ''} your decision.`}
      </p>
      {[{ title: 'Details', rows: fields }, { title: 'Activities', rows: activities }].map((group) => group.rows.length === 0 ? null : (
        <div key={group.title} className="mt-3">
          <h3 className="text-xs font-black uppercase tracking-wide text-amber-900">{group.title}</h3>
          <ul className="mt-1 space-y-2">
            {group.rows.map((item) => {
              const chosen = item.auto ?? choices[item.key] ?? null;
              const label = item.label;
              return (
                <li key={item.key} data-conflict-key={item.key} className="rounded-xl border border-amber-200 bg-white p-3 text-xs">
                  <p className="font-bold text-slate-900">
                    {label}
                    {item.change ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">{item.change === 'added' ? 'Added by you' : item.change === 'removed' ? 'Removed by you' : 'Changed'}</span> : null}
                    {item.auto ? <span className="ml-2 text-[11px] font-semibold text-slate-500">{item.auto === 'mine' ? 'Only you changed this — keeping yours' : 'Only the server changed this — taking theirs'}</span> : null}
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {(['mine', 'theirs'] as const).map((side) => (
                      <label key={side} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 ${chosen === side ? 'border-orange-400 bg-orange-50' : 'border-slate-200'}`}>
                        <input
                          type="radio"
                          name={item.key}
                          checked={chosen === side}
                          disabled={item.auto !== null}
                          onChange={() => onChoose(item.key, side)}
                          aria-label={`${label}: keep ${side === 'mine' ? 'mine' : 'theirs'}`}
                        />
                        <span><span className="block font-bold text-slate-700">{side === 'mine' ? 'Mine' : 'Theirs (saved)'}</span><span className="block text-slate-600">{side === 'mine' ? item.mine : item.theirs}</span></span>
                      </label>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={onApply} disabled={open.length > 0} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Apply my decisions</button>
        {!confirming ? (
          <button type="button" onClick={() => setConfirming(true)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">Discard my changes…</button>
        ) : (
          <span role="group" aria-label="Confirm discard" className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs">
            <span className="font-bold text-red-800">Discard your unsaved changes and use the saved draft?</span>
            <button type="button" onClick={onDiscard} className="rounded-lg bg-red-700 px-3 py-1.5 font-bold text-white">Yes, discard mine</button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-bold text-slate-700">Keep reconciling</button>
          </span>
        )}
      </div>
    </section>
  );
}
