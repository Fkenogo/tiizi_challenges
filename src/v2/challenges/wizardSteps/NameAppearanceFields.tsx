import type { ReactNode } from 'react';
import { V2Field, V2TextArea, V2TextInput } from '../../components/V2Primitives';
import { CHALLENGE_COVER_IDS, challengeCoverGradient, challengeCoverLabel } from '../challengeCovers';
import type { NameAppearanceState } from './stepStates';

/**
 * Reusable "Name & Appearance" fields: title, description and background.
 * Hosting, Support and Social Cause are NOT here (member-only, composed by
 * the member Wizard). `intro` is the composition's lead-in copy.
 */
export function NameAppearanceFields({
  state,
  onUpdate,
  intro,
}: {
  state: NameAppearanceState;
  onUpdate: (patch: Partial<NameAppearanceState>) => void;
  intro: ReactNode;
}) {
  return (
    <>
      {intro}
      <V2Field label="Challenge title"><V2TextInput value={state.title} onChange={(title) => onUpdate({ title })} placeholder="e.g. Sunrise walking streak" /></V2Field>
    <V2Field label="Description" hint="Optional. Explain what this Challenge means to your Group."><V2TextArea value={state.description} onChange={(description) => onUpdate({ description })} placeholder="Add a short description…" /></V2Field>
    <fieldset><legend className="mb-2 text-sm font-bold text-slate-900">Challenge background</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{CHALLENGE_COVER_IDS.map((cover) => <button key={cover} type="button" aria-pressed={state.coverId === cover} onClick={() => onUpdate({ coverId: cover })} className={`overflow-hidden rounded-xl border text-left ${state.coverId === cover ? 'border-orange-500 ring-2 ring-orange-300' : 'border-slate-200'}`}><span className={`block h-16 bg-gradient-to-br ${challengeCoverGradient(cover)}`} /><span className="block px-2 py-1.5 text-xs font-bold">{challengeCoverLabel(cover)}</span></button>)}</div></fieldset>
    </>
  );
}
