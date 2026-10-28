import type { V2GoalOption, V2InterestOption } from '../../api/preferencesApi';
import { atLimit, groupInterestsByDomain, toggleSelection } from './preferencesView';

/**
 * TIIZI-FER-P1B-001 — shared selection controls (onboarding and Profile).
 * Chips are toggle buttons (aria-pressed). At the limit the unselected chips
 * are disabled with a visible explanation; nothing here ever blocks browsing
 * or participation — preferences are relevance-only.
 */

function chipClass(selected: boolean, disabled: boolean) {
  return `rounded-full px-3 py-2 text-sm font-bold ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
    selected
      ? 'bg-primary text-white ring-primary'
      : disabled
        ? 'bg-slate-50 text-slate-300 ring-slate-100'
        : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
  }`;
}

function Count({ selected, max, noun }: { selected: number; max: number; noun: string }) {
  return (
    <p className="text-xs font-bold text-slate-500" aria-live="polite">
      {selected} of {max} {noun} chosen{selected >= max ? ' — remove one to choose another' : ''}
    </p>
  );
}

export function InterestsPicker({
  options, selected, max, onChange, disabled,
}: {
  options: readonly V2InterestOption[];
  selected: readonly string[];
  max: number;
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const full = atLimit(selected, max);
  return (
    <div className="space-y-4">
      <Count selected={selected.length} max={max} noun="interests" />
      {groupInterestsByDomain(options).map((group) => (
        <fieldset key={group.domain} className="min-w-0">
          <legend className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{group.domain}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {group.items.map((option) => {
              const on = selected.includes(option.id);
              const blocked = !on && full;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={on}
                  disabled={disabled || blocked}
                  onClick={() => onChange(toggleSelection(selected, option.id, max))}
                  className={chipClass(on, blocked)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export function GoalsPicker({
  options, selected, max, onChange, disabled,
}: {
  options: readonly V2GoalOption[];
  selected: readonly string[];
  max: number;
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const full = atLimit(selected, max);
  return (
    <div className="space-y-3">
      <Count selected={selected.length} max={max} noun="goals" />
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const on = selected.includes(option.id);
          const blocked = !on && full;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={on}
              disabled={disabled || blocked}
              onClick={() => onChange(toggleSelection(selected, option.id, max))}
              className={chipClass(on, blocked)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
