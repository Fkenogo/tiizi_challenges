export const ACTIVITY_WRITE_LIMITS = {
  maxWorkoutValue: 10000,
  maxWorkoutDurationMinutes: 1440,
  maxWorkoutDurationSeconds: 86400,
  maxWorkoutDurationHours: 24,
  maxWellnessValue: 10000,
  maxWellnessDurationMinutes: 1440,
  maxWellnessDurationHours: 24,
  maxWellnessHydrationMl: 10000,
  maxWellnessPoints: 1000,
  maxWorkoutPoints: 10000,
  maxNotesLength: 500,
} as const;

function normalizedUnit(unit: string) {
  return unit.trim().toLowerCase();
}

export function maxWorkoutValueForUnit(unit: string): number {
  const normalized = normalizedUnit(unit);
  if (normalized === 'seconds' || normalized === 'second') return ACTIVITY_WRITE_LIMITS.maxWorkoutDurationSeconds;
  if (normalized === 'minutes' || normalized === 'minute') return ACTIVITY_WRITE_LIMITS.maxWorkoutDurationMinutes;
  if (normalized === 'hours' || normalized === 'hour') return ACTIVITY_WRITE_LIMITS.maxWorkoutDurationHours;
  return ACTIVITY_WRITE_LIMITS.maxWorkoutValue;
}

export function maxWellnessValueForUnit(unit: string): number {
  const normalized = normalizedUnit(unit);
  if (normalized === 'milliliters' || normalized === 'milliliter' || normalized === 'ml') {
    return ACTIVITY_WRITE_LIMITS.maxWellnessHydrationMl;
  }
  if (normalized === 'minutes' || normalized === 'minute') return ACTIVITY_WRITE_LIMITS.maxWellnessDurationMinutes;
  if (normalized === 'hours' || normalized === 'hour') return ACTIVITY_WRITE_LIMITS.maxWellnessDurationHours;
  return ACTIVITY_WRITE_LIMITS.maxWellnessValue;
}

export function assertSafeActivityValue(value: number, max: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Enter a valid ${label}.`);
  }
  if (value > max) {
    throw new Error(`${label} is too large for a single activity. Maximum allowed is ${max}.`);
  }
}

export function safeActivityNotes(notes?: string): string | undefined {
  const trimmed = notes?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, ACTIVITY_WRITE_LIMITS.maxNotesLength);
}
