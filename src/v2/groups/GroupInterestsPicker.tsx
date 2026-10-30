import { useState } from 'react';
import { V2Button, V2TextInput } from '../components/V2Primitives';
import { GROUP_FOCUS_TAGS_MAX_COUNT, GROUP_FOCUS_TAG_MAX_LENGTH } from './groupDraft';
import {
  addCustomInterest,
  customInterests,
  toggleInterest,
  type GroupInterestOption,
} from './groupInterests';

/**
 * Structured Group Interests selector (TIIZI-FER-P4-001): governed chips by
 * domain plus at most one "other" Interest. Stored values outside the
 * vocabulary stay visible and removable; nothing is rewritten silently.
 */
export function GroupInterestsPicker({
  value,
  onChange,
  vocabulary,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  vocabulary: GroupInterestOption[];
}) {
  const [otherInput, setOtherInput] = useState('');
  const others = customInterests(value, vocabulary);
  const atCap = value.length >= GROUP_FOCUS_TAGS_MAX_COUNT;
  return (
    <fieldset>
      <legend className="text-sm font-bold text-slate-800">Group Interests</legend>
      <p className="mt-0.5 text-xs text-slate-500">What this Group is interested in. Select any that fit.</p>
      <div className="mt-3 space-y-3">
        {(['Fitness', 'Wellness'] as const).map((domain) => {
          const options = vocabulary.filter((option) => option.domain === domain);
          if (!options.length) return null;
          return (
            <div key={domain}>
              <p className="mb-1 text-xs font-bold text-slate-500">{domain}</p>
              <div className="flex flex-wrap gap-2">
                {options.map(({ label }) => {
                  const selected = value.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={selected}
                      disabled={!selected && atCap}
                      onClick={() => onChange(toggleInterest(value, label))}
                      className={`min-h-10 rounded-full border px-3 py-2 text-xs font-bold disabled:opacity-40 ${selected ? 'border-primary bg-orange-50 text-primary' : 'border-slate-200 bg-white text-slate-700'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {others.length > 0 && (
        <div className="mt-3" aria-label="Other Group Interests">
          <p className="mb-1 text-xs font-bold text-slate-500">Other</p>
          <div className="flex flex-wrap gap-2">
            {others.map((tag) => (
              <span key={tag} className="inline-flex min-h-10 max-w-full items-center gap-1 rounded-full border border-primary bg-orange-50 px-3 text-xs font-bold text-primary">
                <span className="min-w-0 break-words">{tag}</span>
                <button type="button" aria-label={`Remove ${tag}`} onClick={() => onChange(value.filter((entry) => entry !== tag))} className="px-1 font-black">×</button>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="mt-3 rounded-xl border border-dashed border-slate-300 p-3">
        <p className="text-xs font-bold text-slate-700">Other Group Interest (optional)</p>
        <p className="mt-1 text-[11px] text-slate-500">Add one Interest that is not listed.</p>
        <div className="mt-2 flex gap-2">
          <V2TextInput value={otherInput} onChange={setOtherInput} placeholder="Add one other Interest" maxLength={GROUP_FOCUS_TAG_MAX_LENGTH} />
          <V2Button
            variant="secondary"
            disabled={!otherInput.trim() || others.length > 0 || atCap}
            onClick={() => { onChange(addCustomInterest(value, otherInput, vocabulary)); setOtherInput(''); }}
          >
            Add
          </V2Button>
        </div>
      </div>
    </fieldset>
  );
}
