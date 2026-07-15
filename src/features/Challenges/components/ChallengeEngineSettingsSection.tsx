type ChallengeType = 'collective' | 'competitive' | 'streak';

interface ChallengeEngineSettingsSectionProps {
  challengeType: ChallengeType;

  // Collective
  groupCumulativeTarget: string;
  onGroupCumulativeTargetChange: (value: string) => void;
  autoCompleteOnGroupTarget: boolean;
  onAutoCompleteOnGroupTargetChange: (value: boolean) => void;

  // Streak
  requiredConsecutiveDays: string;
  onRequiredConsecutiveDaysChange: (value: string) => void;
  streakResetOnMiss: boolean;
  onStreakResetOnMissChange: (value: boolean) => void;

  // Optional wrapper class applied to heading + content (Wizard: "st-form-max")
  className?: string;
}

export function ChallengeEngineSettingsSection({
  challengeType,
  groupCumulativeTarget,
  onGroupCumulativeTargetChange,
  autoCompleteOnGroupTarget,
  onAutoCompleteOnGroupTargetChange,
  requiredConsecutiveDays,
  onRequiredConsecutiveDaysChange,
  streakResetOnMiss,
  onStreakResetOnMissChange,
  className,
}: ChallengeEngineSettingsSectionProps) {
  if (challengeType === 'collective') {
    return (
      <>
        <p className={`mt-4 st-section-title text-primary${className ? ` ${className}` : ''}`}>Collective Settings</p>
        <div className={`mt-2.5 space-y-3.5${className ? ` ${className}` : ''}`}>
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-[12px] leading-[16px] font-semibold text-blue-800">💡 Group target is derived automatically</p>
            <p className="text-[12px] leading-[16px] text-blue-700 mt-0.5">The group cumulative target is set to the activity's target value. Configure the activity in the next step.</p>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div>
              <p className="text-[14px] leading-[18px] font-semibold text-slate-800">Auto-complete when target is reached</p>
              <p className="text-[12px] leading-[16px] text-slate-500 mt-0.5">Mark all members complete the moment the group total hits the target.</p>
            </div>
            <button
              className={`st-toggle ${autoCompleteOnGroupTarget ? 'on' : ''}`}
              onClick={() => onAutoCompleteOnGroupTargetChange(!autoCompleteOnGroupTarget)}
            >
              <span />
            </button>
          </div>
        </div>
      </>
    );
  }

  if (challengeType === 'streak') {
    return (
      <>
        <p className={`mt-4 st-section-title text-primary${className ? ` ${className}` : ''}`}>Streak Settings</p>
        <div className={`mt-2.5 space-y-3.5${className ? ` ${className}` : ''}`}>
          <div>
            <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">Required Consecutive Days</p>
            <p className="text-[12px] leading-[16px] text-slate-500 mt-1">How many days <strong>in a row</strong> a member must log to complete this challenge. This is separate from the overall challenge duration.</p>
            <input
              className="st-input mt-2"
              type="number"
              min={1}
              value={requiredConsecutiveDays}
              onChange={(e) => onRequiredConsecutiveDaysChange(e.target.value)}
              placeholder="e.g. 7"
            />
          </div>
          <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
            <p className="text-[12px] leading-[16px] font-semibold text-orange-800">💡 Activity target = daily amount</p>
            <p className="text-[12px] leading-[16px] text-orange-700 mt-0.5">The target value you set for each activity is the amount required <strong>per day</strong> — not a total. For example, 40 lunges per day or 10,000 steps per day.</p>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div>
              <p className="text-[14px] leading-[18px] font-semibold text-slate-800">Reset streak on missed day</p>
              <p className="text-[12px] leading-[16px] text-slate-500 mt-0.5">If off, a missed day pauses the streak without resetting it to zero.</p>
            </div>
            <button
              className={`st-toggle ${streakResetOnMiss ? 'on' : ''}`}
              onClick={() => onStreakResetOnMissChange(!streakResetOnMiss)}
            >
              <span />
            </button>
          </div>
        </div>
      </>
    );
  }

  // competitive
  return (
    <>
      <p className={`mt-4 st-section-title text-primary${className ? ` ${className}` : ''}`}>Competitive Settings</p>
      <div className={`mt-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3${className ? ` ${className}` : ''}`}>
        <p className="text-[14px] leading-[18px] font-semibold text-slate-800">Individual cumulative targets</p>
        <p className="text-[12px] leading-[16px] text-slate-500 mt-0.5">Each activity's target value below is the cumulative amount each member must log to complete that activity. The member who finishes first — or has the highest completion rate at the end — wins.</p>
      </div>
    </>
  );
}
