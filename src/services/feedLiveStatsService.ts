import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { GroupActivityFeedSummary } from '../types';

export type FeedLiveStats = {
  // Collective
  teamTotal?: number;
  teamTarget?: number;
  // Competitive
  posterScore?: number;
  posterCumulativeValue?: number;
  perPersonTarget?: number;
  leaderScore?: number;
  leaderName?: string;
  // Streak
  currentStreak?: number;
  streakDailyTarget?: number;
  // Shared
  unit?: string;
};

function num(data: Record<string, unknown>, key: string): number | undefined {
  const v = data[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function firstActivityUnit(data: Record<string, unknown>): string | undefined {
  const acts = data.activities;
  if (!Array.isArray(acts) || acts.length === 0) return undefined;
  const u = acts[0]?.unit;
  return typeof u === 'string' && u ? u : undefined;
}

function firstActivityTarget(data: Record<string, unknown>): number | undefined {
  const acts = data.activities;
  if (!Array.isArray(acts) || acts.length === 0) return undefined;
  const t = acts[0]?.targetValue;
  return typeof t === 'number' && Number.isFinite(t) && t > 0 ? t : undefined;
}

class FeedLiveStatsService {
  private async fetchCollective(
    challengeIds: string[],
  ): Promise<Map<string, { total: number; target?: number; unit?: string }>> {
    if (challengeIds.length === 0) return new Map();

    const [summarySnaps, challengeSnaps] = await Promise.all([
      Promise.all(challengeIds.map((id) => getDoc(doc(db, 'challengeActivitySummaries', id)))),
      Promise.all(challengeIds.map((id) => getDoc(doc(db, 'challenges', id)))),
    ]);

    const out = new Map<string, { total: number; target?: number; unit?: string }>();
    challengeIds.forEach((id, i) => {
      const summary = summarySnaps[i];
      if (!summary.exists()) return;
      const sd = summary.data() as Record<string, unknown>;
      const total = num(sd, 'totalValue');
      if (total === undefined) return;

      let target: number | undefined;
      let unit: string | undefined;
      if (challengeSnaps[i].exists()) {
        const cd = challengeSnaps[i].data() as Record<string, unknown>;
        const t = num(cd, 'groupCumulativeTarget');
        if (t && t > 0) target = t;
        unit = firstActivityUnit(cd);
      }
      out.set(id, { total, target, unit });
    });
    return out;
  }

  private async fetchCompetitive(
    entries: { challengeId: string; groupId: string; userId: string }[],
  ): Promise<Map<string, { posterScore?: number; posterCumulativeValue?: number; perPersonTarget?: number; unit?: string; leaderScore?: number; leaderName?: string }>> {
    if (entries.length === 0) return new Map();

    const uniqueChallenges = new Map<string, { groupId: string }>();
    for (const e of entries) {
      if (!uniqueChallenges.has(e.challengeId)) {
        uniqueChallenges.set(e.challengeId, { groupId: e.groupId });
      }
    }
    const challengeIds = [...uniqueChallenges.keys()];

    const [leaderResults, posterSnaps, challengeSnaps, memberSnaps] = await Promise.all([
      Promise.all(
        challengeIds.map((challengeId) => {
          const { groupId } = uniqueChallenges.get(challengeId)!;
          return getDocs(
            query(
              collection(db, 'challengeLeaderboards'),
              where('challengeId', '==', challengeId),
              where('groupId', '==', groupId),
              orderBy('score', 'desc'),
              limit(1),
            ),
          ).then((snap) => ({ challengeId, snap }));
        }),
      ),
      Promise.all(
        entries.map((e) =>
          getDoc(doc(db, 'challengeLeaderboards', `${e.challengeId}_${e.userId}`)).then((snap) => ({
            key: `${e.challengeId}_${e.userId}`,
            challengeId: e.challengeId,
            snap,
          })),
        ),
      ),
      Promise.all(challengeIds.map((id) => getDoc(doc(db, 'challenges', id)))),
      Promise.all(
        entries.map((e) =>
          getDoc(doc(db, 'challengeMembers', `${e.challengeId}_${e.userId}`)).then((snap) => ({
            key: `${e.challengeId}_${e.userId}`,
            snap,
          })),
        ),
      ),
    ]);

    const leaderByChallenge = new Map<string, { score: number; name?: string }>();
    for (const { challengeId, snap } of leaderResults) {
      if (!snap.empty) {
        const d = snap.docs[0].data() as Record<string, unknown>;
        const score = num(d, 'score');
        if (score !== undefined) {
          leaderByChallenge.set(challengeId, {
            score,
            name: typeof d.displayName === 'string' ? d.displayName : undefined,
          });
        }
      }
    }

    const challengeInfoById = new Map<string, { perPersonTarget?: number; unit?: string }>();
    challengeIds.forEach((id, i) => {
      if (!challengeSnaps[i].exists()) return;
      const cd = challengeSnaps[i].data() as Record<string, unknown>;
      challengeInfoById.set(id, {
        perPersonTarget: firstActivityTarget(cd),
        unit: firstActivityUnit(cd),
      });
    });

    const memberCumulativeByKey = new Map<string, number | undefined>();
    for (const { key, snap } of memberSnaps) {
      if (!snap.exists()) continue;
      const d = snap.data() as Record<string, unknown>;
      memberCumulativeByKey.set(key, num(d, 'cumulativeLoggedValue'));
    }

    const out = new Map<string, { posterScore?: number; posterCumulativeValue?: number; perPersonTarget?: number; unit?: string; leaderScore?: number; leaderName?: string }>();
    for (const { key, challengeId, snap } of posterSnaps) {
      if (!snap.exists()) continue;
      const d = snap.data() as Record<string, unknown>;
      const posterScore = num(d, 'score');
      const leader = leaderByChallenge.get(challengeId);
      const info = challengeInfoById.get(challengeId);
      out.set(key, {
        posterScore,
        posterCumulativeValue: memberCumulativeByKey.get(key),
        perPersonTarget: info?.perPersonTarget,
        unit: info?.unit,
        leaderScore: leader?.score,
        leaderName: leader?.name,
      });
    }
    return out;
  }

  private async fetchStreak(
    entries: { challengeId: string; userId: string }[],
  ): Promise<Map<string, { currentStreak?: number; streakDailyTarget?: number; unit?: string }>> {
    if (entries.length === 0) return new Map();

    const uniqueChallengeIds = [...new Set(entries.map((e) => e.challengeId))];

    const [memberSnaps, challengeSnaps] = await Promise.all([
      Promise.all(
        entries.map((e) =>
          getDoc(doc(db, 'challengeMembers', `${e.challengeId}_${e.userId}`)).then((snap) => ({
            key: `${e.challengeId}_${e.userId}`,
            challengeId: e.challengeId,
            snap,
          })),
        ),
      ),
      Promise.all(uniqueChallengeIds.map((id) => getDoc(doc(db, 'challenges', id)))),
    ]);

    const challengeInfoById = new Map<string, { dailyTarget?: number; unit?: string }>();
    uniqueChallengeIds.forEach((id, i) => {
      if (!challengeSnaps[i].exists()) return;
      const cd = challengeSnaps[i].data() as Record<string, unknown>;
      challengeInfoById.set(id, {
        dailyTarget: firstActivityTarget(cd),
        unit: firstActivityUnit(cd),
      });
    });

    const out = new Map<string, { currentStreak?: number; streakDailyTarget?: number; unit?: string }>();
    for (const { key, challengeId, snap } of memberSnaps) {
      if (!snap.exists()) continue;
      const d = snap.data() as Record<string, unknown>;
      const info = challengeInfoById.get(challengeId);
      out.set(key, {
        currentStreak: num(d, 'currentStreak'),
        streakDailyTarget: info?.dailyTarget,
        unit: info?.unit,
      });
    }
    return out;
  }

  async getStatsMap(items: GroupActivityFeedSummary[]): Promise<Map<string, FeedLiveStats>> {
    const collectiveIds = new Set<string>();
    const compEntries = new Map<string, { challengeId: string; groupId: string; userId: string }>();
    const streakKeys = new Map<string, { challengeId: string; userId: string }>();

    for (const item of items) {
      if (!item.challengeId) continue;
      if (item.challengeType === 'collective') {
        collectiveIds.add(item.challengeId);
      } else if (item.challengeType === 'competitive') {
        const k = `${item.challengeId}_${item.userId}`;
        if (!compEntries.has(k)) {
          compEntries.set(k, { challengeId: item.challengeId, groupId: item.groupId, userId: item.userId });
        }
      } else if (item.challengeType === 'streak') {
        const k = `${item.challengeId}_${item.userId}`;
        if (!streakKeys.has(k)) {
          streakKeys.set(k, { challengeId: item.challengeId, userId: item.userId });
        }
      }
    }

    const [collectiveStats, competitiveStats, streakStats] = await Promise.all([
      this.fetchCollective([...collectiveIds]),
      this.fetchCompetitive([...compEntries.values()]),
      this.fetchStreak([...streakKeys.values()]),
    ]);

    const result = new Map<string, FeedLiveStats>();
    for (const item of items) {
      if (!item.challengeId) continue;
      const stats: FeedLiveStats = {};

      if (item.challengeType === 'collective') {
        const cs = collectiveStats.get(item.challengeId);
        if (cs) {
          stats.teamTotal = cs.total;
          stats.teamTarget = cs.target;
          stats.unit = cs.unit;
        }
      } else if (item.challengeType === 'competitive') {
        const cs = competitiveStats.get(`${item.challengeId}_${item.userId}`);
        if (cs) {
          stats.posterScore = cs.posterScore;
          stats.posterCumulativeValue = cs.posterCumulativeValue;
          stats.perPersonTarget = cs.perPersonTarget;
          stats.unit = cs.unit;
          stats.leaderScore = cs.leaderScore;
          stats.leaderName = cs.leaderName;
        }
      } else if (item.challengeType === 'streak') {
        const cs = streakStats.get(`${item.challengeId}_${item.userId}`);
        if (cs) {
          stats.currentStreak = cs.currentStreak;
          stats.streakDailyTarget = cs.streakDailyTarget;
          stats.unit = cs.unit;
        }
      }

      result.set(item.id, stats);
    }
    return result;
  }
}

export const feedLiveStatsService = new FeedLiveStatsService();
