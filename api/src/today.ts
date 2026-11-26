/** S5a member-scoped Today read model. This composes existing Challenge reads;
 * it owns no lifecycle, participation, progress, or joinability authority. */
import type { FastifyInstance } from 'fastify';
import { authenticatedMember } from './auth.js';
import type { Db } from './db.js';
import { listVisibleChallenges, type ChallengeReadDeps } from './challengeReads.js';
import { dayInTimezone } from './activityEvents.js';
import { canonicalActivityIdentity, getGoverningVersionsForChallenges } from './challengeConfigs.js';
import type { GroupMembershipAuthority } from './groupMembershipAuthority.js';
import type { MediaRouteDeps } from './mediaRoutes.js';
import { API_PREFIX } from './apiPrefix.js';

export interface TodayRouteDeps extends Omit<Partial<ChallengeReadDeps>, 'now'> {
  groupMembershipAuthority?: GroupMembershipAuthority;
  mediaDeps?: MediaRouteDeps;
  now?: () => Date;
}

const addLocalCalendarDays = (day: string, count: number): string => {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
};
/**
 * Canonical member Challenge detail surface. This is the current V2 browser
 * route, never the archived Product V1 shell: the V1 exclusion boundary
 * forbids the V2 runtime (and any V2-issued navigation target) from reaching
 * `/app/*`. See `AGENTS.md` §1.3 and `scripts/boundaryGuard/guard.mjs`.
 */
const detailPath = (id: string) => `/v2/challenges/${id}`;

export async function getTodayProjection(db: Db, memberId: string, deps: TodayRouteDeps = {}) {
  const now = deps.now?.() ?? new Date();
  const readDeps: ChallengeReadDeps = {
    groupMembershipAuthority: deps.groupMembershipAuthority ?? {
      async resolveGroupMembershipAuthority() { throw new Error('Group authority unavailable'); },
    },
    now,
    groupStore: deps.groupStore,
    mediaDeps: deps.mediaDeps,
  };
  const summaries = await listVisibleChallenges(db, memberId, readDeps);
  const joined = summaries.filter((row) => row.myParticipation?.status === 'active');
  const active = joined.filter((row) => row.status === 'active' && !row.finalized
    && row.governingToday >= row.startDate && row.governingToday <= row.endDate);
  // Streak action requirements and Race finish targets require immutable
  // configured terms. Together totals and goals are already complete in the
  // list projection, so no detail read is needed for Together.
  const configuredProgress = active.filter((row) => row.challengeType === 'streak' || row.challengeType === 'competitive');
  const configs = await getGoverningVersionsForChallenges(
    db,
    configuredProgress.map((row) => ({ challengeId: row.challengeId, version: row.currentConfigVersion })),
  );
  const streaks = active.filter((row) => row.challengeType === 'streak');
  const requiredToday = streaks.map((row) => {
    const config = configs.get(row.challengeId)!;
    const state = row.myParticipation!.progress;
    const dayState = state.dayStates[row.governingToday];
    const completed = new Set(dayState?.activities ?? []);
    const requirements = config.activities.map((activity, index) => {
      const identity = canonicalActivityIdentity(activity.canonical_key, activity.activity_variant);
      return {
        activity: identity,
        ...(row.activities[index]?.name ? { label: row.activities[index].name } : {}),
        targetValue: activity.target_value,
        unit: activity.unit,
        state: completed.has(identity) ? 'completed' as const : 'pending' as const,
      };
    });
    return {
      challengeId: row.challengeId, title: row.title, challengeType: row.challengeType,
      group: { groupId: row.groupId, name: row.groupName }, lifecycleState: row.status,
      governingToday: row.governingToday, timezone: row.timezone, detailPath: detailPath(row.challengeId),
      coverImage: row.coverImage,
      requirements,
      streak: {
        currentStreak: state.currentStreak, bestStreak: state.bestStreak,
        daysCompleted: state.daysCompleted, lastCompletedDay: state.lastCompletedDay,
        completionStatus: state.completionStatus, dayState: dayState ?? null,
      },
    };
  });

  const joinedChallengeProgress = active.map((row) => {
    const progress = row.myParticipation!.progress;
    const config = configs.get(row.challengeId);
    const base = {
      challengeId: row.challengeId, title: row.title, challengeType: row.challengeType,
      group: { groupId: row.groupId, name: row.groupName }, lifecycleState: row.status,
      governingToday: row.governingToday, timezone: row.timezone, startDate: row.startDate,
      endDate: row.endDate, detailPath: detailPath(row.challengeId),
      coverImage: row.coverImage,
    };
    if (row.challengeType === 'collective') return { ...base, progress: {
      groupTotal: row.collectiveTotal, target: row.goalValue, unit: row.goalUnit,
      goalReached: row.collectiveGoalReached, memberContribution: progress.cumulativeTotal,
    } };
    if (row.challengeType === 'competitive') return { ...base, progress: {
      completionStatus: progress.completionStatus,
      completedAt: progress.completedAt, finalPosition: row.finalized ? progress.finalPosition : null,
      activities: (config?.activities ?? []).map((activity, index) => ({
        activity: canonicalActivityIdentity(activity.canonical_key, activity.activity_variant),
        ...(row.activities[index]?.name ? { label: row.activities[index].name } : {}),
        memberProgress: progress.cumulativeValues[canonicalActivityIdentity(activity.canonical_key, activity.activity_variant)] ?? 0,
        targetValue: activity.target_value, unit: activity.unit,
      })),
    } };
    return { ...base, progress: {
      currentStreak: progress.currentStreak, bestStreak: progress.bestStreak,
      daysCompleted: progress.daysCompleted, completionStatus: progress.completionStatus,
    } };
  });

  const opportunities = summaries.filter((row) => row.myParticipation?.status !== 'active'
    && row.status !== 'ended' && !row.finalized && row.governingToday <= row.endDate)
    .map((row) => ({ challengeId: row.challengeId, title: row.title, challengeType: row.challengeType,
      group: { groupId: row.groupId, name: row.groupName }, lifecycleState: row.status,
      startDate: row.startDate, endDate: row.endDate, timezone: row.timezone,
      governingToday: row.governingToday, activities: row.activities, detailPath: detailPath(row.challengeId),
      coverImage: row.coverImage,
      joinability: 'not_asserted' as const }));
  const upcoming = summaries.flatMap((row) => {
    const horizon = addLocalCalendarDays(row.governingToday, 7);
    const kind = row.startDate > row.governingToday && row.startDate <= horizon ? 'starts'
      : row.endDate >= row.governingToday && row.endDate <= horizon ? 'ends' : null;
    if (!kind || row.status === 'ended' || row.finalized
      || (row.myParticipation?.status !== 'active' && !opportunities.some((x) => x.challengeId === row.challengeId))) return [];
    return [{ challengeId: row.challengeId, title: row.title, kind, lifecycleDate: kind === 'starts' ? row.startDate : row.endDate,
      timezone: row.timezone, detailPath: detailPath(row.challengeId), coverImage: row.coverImage }];
  });
  const finalizedResults = joined.filter((row) => row.finalized).map((row) => ({
    challengeId: row.challengeId, title: row.title, finalized: true as const, detailPath: detailPath(row.challengeId),
  }));
  const timezoneContexts = active.map((row) => ({ challengeId: row.challengeId, timezone: row.timezone, governingToday: dayInTimezone(now, row.timezone) }));
  return {
    todayContext: { serverNow: now.toISOString(), activeChallengeCount: active.length, timezoneContexts },
    requiredToday,
    joinedChallengeProgress,
    groupChallengeOpportunities: opportunities,
    upcoming,
    finalizedResults,
    unsupportedSections: {
      invitations: { available: false, disposition: 'deferred' },
      communityMoments: { available: false, disposition: 'deferred' },
      notifications: { available: false, disposition: 'deferred' },
    },
    // Provenance: all activity/streak values come from the existing Challenge
    // detail and own participation derived rows; no day-end instant is emitted.
    projection: { authority: 'existing_challenge_reads', countdown: 'omitted_boundary_equivalence_unproven' },
  };
}

export function registerTodayRoutes(app: FastifyInstance, db: Db, deps: TodayRouteDeps = {}): void {
  app.get(`${API_PREFIX}/today`, async (request) => {
    const member = authenticatedMember(request);
    return getTodayProjection(db, member.memberId, deps);
  });
}
