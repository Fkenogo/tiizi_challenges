import { DONATION_FULL_DISCLAIMER } from '../utils/challengeFormCopy';

const CAUSE_CURRENCIES = ['KES', 'RWF', 'UGX'] as const;
type CauseCurrency = (typeof CAUSE_CURRENCIES)[number];

interface ChallengeDonationSectionProps {
  donationEnabled: boolean;
  onDonationEnabledChange: (value: boolean) => void;
  causeName: string;
  onCauseNameChange: (value: string) => void;
  causeDescription: string;
  onCauseDescriptionChange: (value: string) => void;
  targetAmountKes: string;
  onTargetAmountKesChange: (value: string) => void;
  currency: CauseCurrency;
  onCurrencyChange: (value: CauseCurrency) => void;
  contributionStartDate: string;
  onContributionStartDateChange: (value: string) => void;
  contributionEndDate: string;
  onContributionEndDateChange: (value: string) => void;
  contributionPhoneNumber: string;
  onContributionPhoneNumberChange: (value: string) => void;
  contributionCardUrl: string;
  onContributionCardUrlChange: (value: string) => void;
  // Optional outer wrapper class, e.g. "st-form-max mt-4" in the Wizard.
  className?: string;
}

export type { CauseCurrency };

export function ChallengeDonationSection({
  donationEnabled,
  onDonationEnabledChange,
  causeName,
  onCauseNameChange,
  causeDescription,
  onCauseDescriptionChange,
  targetAmountKes,
  onTargetAmountKesChange,
  currency,
  onCurrencyChange,
  contributionStartDate,
  onContributionStartDateChange,
  contributionEndDate,
  onContributionEndDateChange,
  contributionPhoneNumber,
  onContributionPhoneNumberChange,
  contributionCardUrl,
  onContributionCardUrlChange,
  className,
}: ChallengeDonationSectionProps) {
  return (
    <div className={className}>
      <div className="st-card p-4">
        <div className="flex items-center justify-between">
          <p className="st-section-title text-primary">Fitness + Cause</p>
          <button
            className={`st-toggle ${donationEnabled ? 'on' : ''}`}
            onClick={() => onDonationEnabledChange(!donationEnabled)}
          >
            <span />
          </button>
        </div>

        <p className="text-[12px] leading-[16px] text-slate-500 mt-1">Mark this challenge as a fundraising challenge.</p>

        {donationEnabled && (
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
              <p className="text-[12px] leading-[18px] font-bold text-primary">Admin approval required</p>
              <p className="text-[12px] leading-[18px] text-slate-600 mt-0.5">
                Donation details (phone number and payment channels) require Tiizi admin review before they appear to participants. Your challenge can be submitted now, but contribution details stay hidden until approved.
              </p>
              <p className="text-[11px] leading-[16px] text-slate-500 mt-1">
                Tiizi does not hold cause funds. Contribution channels must be verified before approval.
              </p>
            </div>

            <div>
              <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Cause Name</p>
              <input
                className="st-input mt-2"
                value={causeName}
                onChange={(e) => onCauseNameChange(e.target.value)}
                placeholder="e.g. Community Health Fund"
              />
            </div>
            <div>
              <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Cause Description</p>
              <textarea
                className="w-full h-20 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[16px] leading-[22px] text-slate-700"
                value={causeDescription}
                onChange={(e) => onCauseDescriptionChange(e.target.value)}
                placeholder="Describe the cause and expected impact"
              />
            </div>

            <div>
              <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Currency</p>
              <div className="mt-2 flex gap-2">
                {CAUSE_CURRENCIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`h-10 flex-1 rounded-xl text-sm font-bold ${currency === c ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}
                    onClick={() => onCurrencyChange(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Target Contribution ({currency}, optional)</p>
              <input
                className="st-input mt-2"
                type="number"
                min={0}
                value={targetAmountKes}
                onChange={(e) => onTargetAmountKesChange(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Contribution Start</p>
                <input
                  className="st-input mt-2"
                  type="date"
                  value={contributionStartDate}
                  onChange={(e) => onContributionStartDateChange(e.target.value)}
                />
              </div>
              <div>
                <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Contribution End</p>
                <input
                  className="st-input mt-2"
                  type="date"
                  value={contributionEndDate}
                  onChange={(e) => onContributionEndDateChange(e.target.value)}
                />
              </div>
            </div>
            <div>
              <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Donate Here: Mobile Number</p>
              <input
                className="st-input mt-2"
                value={contributionPhoneNumber}
                onChange={(e) => onContributionPhoneNumberChange(e.target.value)}
                placeholder="e.g. +2507XXXXXXXX"
              />
            </div>
            <div>
              <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Donate Here: Card Link (optional)</p>
              <input
                className="st-input mt-2"
                value={contributionCardUrl}
                onChange={(e) => onContributionCardUrlChange(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-[16px] text-amber-800">
              {DONATION_FULL_DISCLAIMER}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
