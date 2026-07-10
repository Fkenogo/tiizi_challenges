import { Calendar } from 'lucide-react';

interface ChallengeTimelineSectionProps {
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
  durationDays: number | null;
  // When true, date grid stacks on small screens (md:grid-cols-2). Default: always 2 cols.
  responsive?: boolean;
  // Optional wrapper class, e.g. "st-form-max" in the Wizard.
  className?: string;
}

export function ChallengeTimelineSection({
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  durationDays,
  responsive = false,
  className,
}: ChallengeTimelineSectionProps) {
  const gridCols = responsive ? 'md:grid-cols-2' : 'grid-cols-2';

  return (
    <div className={className}>
      <p className="mt-4 st-section-title text-primary">Timeline</p>
      <div className={`mt-2.5 grid ${gridCols} gap-3`}>
        <div>
          <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Start Date</p>
          <div className="relative mt-2">
            <input
              className="st-input pr-10"
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
            />
            <Calendar size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
          </div>
        </div>
        <div>
          <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">End Date</p>
          <div className="relative mt-2">
            <input
              className="st-input pr-10"
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
            />
            <Calendar size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
          </div>
        </div>
      </div>
      <div className="mt-2.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
        <p className="text-[13px] leading-[18px] font-semibold text-primary">
          {durationDays
            ? `Challenge Duration: ${durationDays} day${durationDays === 1 ? '' : 's'}`
            : 'Select both dates to calculate challenge duration.'}
        </p>
      </div>
    </div>
  );
}
