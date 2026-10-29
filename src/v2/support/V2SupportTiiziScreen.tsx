import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { V2Card, V2Page, V2SectionHeader } from '../components/V2Primitives';
import { SUPPORT_TIIZI } from './supportTiiziContent';

/**
 * TIIZI-FER-P8A-001 — Support Tiizi (placeholder-complete, non-transactional).
 *
 * Information and local, non-persisted choices only: no network call, no
 * storage, no payment, copy or messaging action. Selections are never saved or
 * sent; real details arrive only with a later authorized package (P8b).
 */
const CHOICE =
  'min-h-11 rounded-xl border px-4 py-2.5 text-left text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

function ChoiceGroup({
  label,
  hint,
  options,
  value,
  onChange,
  first = false,
}: {
  label: string;
  hint: string;
  options: ReadonlyArray<{ id: string; label: string }>;
  value: string | null;
  onChange: (id: string | null) => void;
  first?: boolean;
}) {
  return (
    <fieldset className={first ? '' : 'mt-5'}>
      <legend className="text-base font-black text-slate-900">{label}</legend>
      <p className="mt-0.5 text-xs leading-5 text-slate-500">{hint}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const on = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? null : option.id)}
              className={`${CHOICE} ${on ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function V2SupportTiiziScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [amount, setAmount] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<string | null>(null);
  const picked = [
    SUPPORT_TIIZI.amounts.find((a) => a.id === amount)?.label,
    SUPPORT_TIIZI.frequencies.find((f) => f.id === frequency)?.label.toLowerCase(),
  ].filter(Boolean);

  // Back returns to wherever the member came from; a direct visit falls back to Profile.
  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate('/v2/profile'));

  return (
    <V2Page>
      <button
        type="button"
        onClick={goBack}
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ArrowLeft size={16} aria-hidden /> {SUPPORT_TIIZI.back}
      </button>
      <V2SectionHeader eyebrow="Profile" title={SUPPORT_TIIZI.title} description={SUPPORT_TIIZI.lead} />

      <div className="mt-4 space-y-4">
        <V2Card>
          <p className="text-sm leading-6 text-slate-700">{SUPPORT_TIIZI.about}</p>
        </V2Card>

        <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          {SUPPORT_TIIZI.status}
        </div>

        <V2Card>
          <ChoiceGroup
            label={SUPPORT_TIIZI.amountsHeading}
            hint={SUPPORT_TIIZI.amountsHint}
            options={SUPPORT_TIIZI.amounts}
            value={amount}
            onChange={setAmount}
            first
          />
          <ChoiceGroup
            label={SUPPORT_TIIZI.frequencyHeading}
            hint={SUPPORT_TIIZI.frequencyHint}
            options={SUPPORT_TIIZI.frequencies}
            value={frequency}
            onChange={setFrequency}
          />
          <p aria-live="polite" className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
            {picked.length > 0 ? `${picked.join(', ')}. ` : ''}
            {SUPPORT_TIIZI.previewNote}
          </p>
        </V2Card>

        <V2Card>
          <h2 className="text-base font-black text-slate-900">{SUPPORT_TIIZI.detailsHeading}</h2>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{SUPPORT_TIIZI.detailsIntro}</p>
          <dl className="mt-3 divide-y divide-slate-100">
            {SUPPORT_TIIZI.placeholders.map((row) => (
              <div key={row.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5">
                <dt className="text-sm font-bold text-slate-700">{row.label}</dt>
                <dd className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">{SUPPORT_TIIZI.placeholderMark}</dd>
              </div>
            ))}
          </dl>
        </V2Card>
      </div>
    </V2Page>
  );
}
