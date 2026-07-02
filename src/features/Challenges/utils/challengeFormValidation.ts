export interface ChallengeFormValidationInput {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  challengeType: 'collective' | 'competitive' | 'streak';
  activities: Array<{
    query?: string;
    exerciseId?: string;
    activityId?: string;
    targetValue: string;
    unit: string;
  }>;
  requiredConsecutiveDays: string;
  durationDays: number | null;
  donationEnabled: boolean;
  causeName: string;
  causeDescription: string;
  contributionPhoneNumber: string;
  contributionCardUrl: string;
}

// Returns null if the form is valid, or the first error message to show.
export function validateChallengeForm(input: ChallengeFormValidationInput): string | null {
  if (!input.name.trim() || input.description.trim().length < 8) {
    return 'Add challenge name and description.';
  }

  if (!input.startDate || !input.endDate) {
    return 'Set a valid start and end date.';
  }
  if (new Date(input.endDate) < new Date(input.startDate)) {
    return 'Set a valid start and end date.';
  }

  const namedActivities = input.activities.filter(
    (a) => a.query?.trim() || a.exerciseId || a.activityId,
  );
  if (namedActivities.length === 0 || !namedActivities.some((a) => Number(a.targetValue) > 0)) {
    return 'Add at least one valid activity.';
  }
  for (const a of namedActivities) {
    if (Number(a.targetValue) <= 0) {
      return 'Each activity needs a target value greater than zero.';
    }
  }

  if (input.challengeType === 'collective') {
    const units = new Set(namedActivities.filter((a) => Number(a.targetValue) > 0).map((a) => a.unit));
    if (units.size > 1) {
      return 'Collective challenges require all activities to share the same unit.';
    }
  }

  if (input.challengeType === 'streak') {
    if (!input.requiredConsecutiveDays || Number(input.requiredConsecutiveDays) <= 0) {
      return 'Set the required consecutive days greater than zero.';
    }
    if (input.durationDays != null && Number(input.requiredConsecutiveDays) > input.durationDays) {
      return 'Required consecutive days cannot exceed the challenge duration.';
    }
  }

  if (input.donationEnabled) {
    if (!input.causeName.trim() || !input.causeDescription.trim()) {
      return 'Add cause name and description for Fitness + Cause.';
    }
    if (!input.contributionPhoneNumber.trim() && !input.contributionCardUrl.trim()) {
      return 'Provide a mobile number or card link for contributions.';
    }
  }

  return null;
}
