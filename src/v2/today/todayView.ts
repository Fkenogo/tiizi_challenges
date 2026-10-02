import type {
  V2TodayChallengeType,
  V2TodayJoinedChallenge,
  V2TodayProjection,
  V2TodayRequiredChallenge,
} from '../../api/todayApi';

/**
 * S5b — pure Today presentation logic.
 *
 * Everything here is presentation derived from the SERVER projection. No
 * function in this module derives domain truth: the governing day, streak
 * state, progress, ranking, and joinability are rendered as served. Device
 * time never determines a Challenge day.
 */

/** Human label for a Challenge type (member-facing vocabulary). */
export function challengeTypeLabel(type: V2TodayChallengeType): string {
  if (type === 'collective') return 'Together';
  if (type === 'competitive') return 'Race';
  return 'Streak';
}

/**
 * Contextual greeting. The time of day is taken from the SERVER clock
 * (`todayContext.serverNow`) expressed in the first authoritative Challenge
 * timezone when one exists — never from the device clock. The member's name
 * is used only when the caller already holds it.
 */
export function greetingFor(
  serverNow: string,
  timezone: string | null,
  displayName?: string | null,
): string {
  const hour = serverHour(serverNow, timezone);
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const name = displayName?.trim().split(/\s+/)[0];
  if (!name) return part;
  // The local Auth emulator cannot store a display name, so a preview identity
  // may fall back to its email local part. Present that as a name rather than a
  // dotted handle: "amara.okafor" -> "Amara".
  const readable = name.split(/[._-]+/)[0] ?? name;
  const titled = readable.charAt(0).toUpperCase() + readable.slice(1);
  return `${part}, ${titled}`;
}

/**
 * The server clock's hour in a Challenge timezone. Falls back to UTC when the
 * projection supplies no timezone context, so the greeting is always derived
 * from server-rendered data and never from the browser.
 */
export function serverHour(serverNow: string, timezone: string | null): number {
  const at = new Date(serverNow);
  if (Number.isNaN(at.getTime())) return 0;
  if (!timezone) return at.getUTCHours();
  try {
    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).format(at);
    const parsed = Number.parseInt(formatted, 10);
    return Number.isNaN(parsed) ? at.getUTCHours() : parsed % 24;
  } catch {
    return at.getUTCHours();
  }
}

/** The authoritative governing day to anchor the header, else null. */
export function governingDayFor(projection: V2TodayProjection): string | null {
  const first = projection.todayContext.timezoneContexts[0];
  if (first) return first.governingToday;
  return projection.requiredToday[0]?.governingToday
    ?? projection.joinedChallengeProgress[0]?.governingToday
    ?? null;
}

/** Friendly rendering of a governed calendar day (never a device-derived one). */
export function formatGoverningDay(day: string): string {
  const at = new Date(`${day}T12:00:00.000Z`);
  if (Number.isNaN(at.getTime())) return day;
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(at);
}

/** Friendly rendering of an authoritative lifecycle date. */
export function formatLifecycleDate(day: string): string {
  const at = new Date(`${day}T12:00:00.000Z`);
  if (Number.isNaN(at.getTime())) return day;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(at);
}

/** Compact number rendering for progress values. */
export function formatAmount(value: number | null, unit: string | null): string {
  if (value === null) return '—';
  const rendered = Number.isInteger(value) ? value.toLocaleString('en-GB') : String(value);
  return unit ? `${rendered} ${unit}` : rendered;
}

/** Completed-vs-total requirement counts for one Required Today card. */
export function requirementProgress(challenge: V2TodayRequiredChallenge): {
  completed: number;
  total: number;
  allComplete: boolean;
} {
  const total = challenge.requirements.length;
  const completed = challenge.requirements.filter((r) => r.state === 'completed').length;
  return { completed, total, allComplete: total > 0 && completed === total };
}

/** True when the projection carries nothing a member can act on or look at. */
export function isTodayEmpty(projection: V2TodayProjection): boolean {
  return projection.requiredToday.length === 0
    && projection.joinedChallengeProgress.length === 0
    && projection.groupChallengeOpportunities.length === 0
    && projection.upcoming.length === 0
    && projection.finalizedResults.length === 0;
}

/** Percentage for a progress bar, clamped for width only (values stay exact). */
export function progressPercent(value: number, target: number | null): number {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / target) * 100)));
}

/**
 * Initial presentation limit for growing Today sections (Your Challenges, In
 * your Groups, Coming up). Today stays a concise action-oriented home as
 * membership grows: the first two served items render, the rest wait behind
 * an explicit View more affordance. `Do today` is deliberately NOT limited —
 * required actions are never hidden to shorten the screen.
 */
export const TODAY_SECTION_LIMIT = 2;

/**
 * The items one growing section presents for local expansion state.
 * Presentation only: `slice` preserves the server-provided order exactly,
 * nothing is re-sorted, filtered, counted, or derived. The caller renders the
 * returned prefix and offers View more / Show less around it.
 */
export function visibleSectionItems<T>(items: readonly T[], expanded: boolean): T[] {
  if (expanded) return [...items];
  return items.slice(0, TODAY_SECTION_LIMIT);
}

/** Together progress line: shared total against the shared goal. */
export function togetherSummary(challenge: Extract<V2TodayJoinedChallenge, { challengeType: 'collective' }>): string {
  const { groupTotal, target, unit } = challenge.progress;
  return `${formatAmount(groupTotal, unit)} of ${formatAmount(target, unit)}`;
}

/** Race progress line for one Activity: own progress against own target. */
export function raceActivitySummary(activity: {
  memberProgress: number;
  targetValue: number;
  unit: string;
}): string {
  return `${formatAmount(activity.memberProgress, activity.unit)} of ${formatAmount(activity.targetValue, activity.unit)}`;
}

/**
 * What an opportunity card may offer. The projection always sets
 * `joinability: 'not_asserted'`, so Today must never render an unconditional
 * Join action; it offers discovery and defers joining to the governed
 * Challenge surface. This function exists so the rule is testable and cannot
 * be silently inverted by a future edit.
 */
export function opportunityAction(joinability: 'not_asserted'): 'discovery' {
  if (joinability !== 'not_asserted') {
    throw new Error('opportunityAction: unexpected joinability; the projection asserts none');
  }
  return 'discovery';
}

/** Upcoming boundary copy. `kind` is authoritative; no countdown is invented. */
export function upcomingSummary(item: { kind: 'starts' | 'ends'; lifecycleDate: string }): string {
  const when = formatLifecycleDate(item.lifecycleDate);
  return item.kind === 'starts' ? `Starts ${when}` : `Ends ${when}`;
}
