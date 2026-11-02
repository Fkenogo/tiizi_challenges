-- Member-owned reminder dismissal timestamps. Eligibility is computed by the
-- preferences API from these timestamps and current selection state.
ALTER TABLE member_preferences
  ADD COLUMN interests_reminder_dismissed_at TIMESTAMPTZ,
  ADD COLUMN goals_reminder_dismissed_at TIMESTAMPTZ;
