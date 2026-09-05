import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { ArrowLeft, Flame, Trophy, Users } from 'lucide-react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { EmptyState } from '../../components/Mobile';
import { useChallenge } from '../../hooks/useChallenges';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../lib/firebase';
import { sortLeaderboardRows } from '../../utils/leaderboardSort';
import { assignFinishingPositions, ordinal, orderCompetitiveDisplay } from '../../utils/competitiveFinishing';
import { resolveChallengeProgress } from './challengeProgressResolver';

interface LeaderboardRow {
  userId: string;
  totalPoints: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  cumulativeValues: Record<string, number>;
  cumulativeLoggedValue: number;
  activitiesCompleted: number;
  lastActivityAt?: string;
  /** Membership status — drives governed finishing positions (competitive). */
  status?: string;
  /** Governed target-completion point written by CompetitiveEngine. */
  completedAt?: unknown;
}

function useChallengeLeaderboard(challengeId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['challenge-leaderboard', challengeId, user?.uid],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'challengeMembers'), where('challengeId', '==', challengeId)));
      return snap.docs.map((d) => {
        const data = d.data() as Partial<LeaderboardRow> & { userId: string };
        const cumulativeValues = (data.cumulativeValues ?? {}) as Record<string, number>;
        const cumulativeFromValues = Object.values(cumulativeValues).reduce((s, v) => s + v, 0);
        return {
          userId: data.userId,
          totalPoints: Math.max(0, Number(data.totalPoints ?? 0)),
          completionRate: Math.max(0, Number(data.completionRate ?? 0)),
          currentStreak: Math.max(0, Number(data.currentStreak ?? 0)),
          longestStreak: Math.max(0, Number(data.longestStreak ?? 0)),
          cumulativeValues,
          cumulativeLoggedValue: Math.max(0, Number(data.cumulativeLoggedValue ?? cumulativeFromValues)),
          activitiesCompleted: Math.max(0, Number(data.activitiesCompleted ?? 0)),
          lastActivityAt: data.lastActivityAt,
          status: data.status,
          completedAt: data.completedAt,
        } satisfies LeaderboardRow;
      });
    },
    enabled: !!challengeId && !!user?.uid,
    staleTime: 60 * 1000,
  });
}

type UserProfileDoc = {
  email?: string;
  profile?: { personalInfo?: { displayName?: string; fullName?: string } };
};

function resolveDisplayName(uid: string, data?: UserProfileDoc): string {
  const name =
    data?.profile?.personalInfo?.displayName ||
    data?.profile?.personalInfo?.fullName ||
    data?.email?.split('@')[0] ||
    '';
  return name.trim() || `Member ${uid.slice(0, 6).toUpperCase()}`;
}

function useChallengeParticipantNames(userIds: string[]) {
  return useQuery({
    queryKey: ['challenge-participant-names', userIds.join(',')],
    queryFn: async () => {
      const map = new Map<string, string>();
      if (userIds.length === 0) return map;
      const snaps = await Promise.all(userIds.map((uid) => getDoc(doc(db, 'users', uid))));
      snaps.forEach((snap, i) => {
        map.set(userIds[i], resolveDisplayName(userIds[i], snap.exists() ? (snap.data() as UserProfileDoc) : undefined));
      });
      return map;
    },
    enabled: userIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

function rankBadge(rank: number) {
  if (rank === 1) return { bg: 'bg-primary', text: 'text-white', label: '1st' };
  if (rank === 2) return { bg: 'bg-slate-300', text: 'text-slate-700', label: '2nd' };
  if (rank === 3) return { bg: 'bg-orange-200', text: 'text-orange-800', label: '3rd' };
  return { bg: 'bg-slate-100', text: 'text-slate-500', label: `${rank}` };
}

function ChallengeLeaderboardScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const challengeId = params.get('challengeId') ?? '';
  const groupId = params.get('groupId') || undefined;
  const { user } = useAuth();
  const { data: challenge } = useChallenge(challengeId);
  const { data: rawRows = [] } = useChallengeLeaderboard(challengeId);
  const participantUserIds = useMemo(() => rawRows.map((r) => r.userId), [rawRows]);
  const { data: namesById = new Map<string, string>() } = useChallengeParticipantNames(participantUserIds);

  const engineVersion = challenge?.engineVersion;
  const challengeType = challenge?.challengeType ?? 'collective';
  const isV2 = engineVersion === 'v2';
  const totalTarget = (challenge?.activities ?? []).reduce((s, a) => s + (a.targetValue ?? 0), 0);
  const activityUnit = challenge?.activities?.[0]?.unit ?? '';

  const displayName = (userId: string) =>
    userId === user?.uid
      ? `You (${namesById.get(userId) ?? 'Me'})`
      : (namesById.get(userId) ?? `Member ${userId.slice(0, 6).toUpperCase()}`);

  // Governed finishing positions for competitive (Derived Truth from completedAt).
  // Non-completers are absent from the map: they receive NO position.
  const finishingPositions = useMemo(
    () => (isV2 && challengeType === 'competitive' ? assignFinishingPositions(rawRows) : new Map<string, number>()),
    [rawRows, isV2, challengeType],
  );

  const ranking = useMemo(() => {
    const sorted = sortLeaderboardRows(rawRows, engineVersion, challengeType);

    const withPositions = sorted.map((row) => ({
      ...row,
      position: isV2 && challengeType === 'competitive' ? finishingPositions.get(row.userId) : undefined,
    }));
    // Completers first by governed position, then non-completers by live
    // progress (no inline sort — governed ordering lives in the util).
    const ordered = isV2 && challengeType === 'competitive'
      ? orderCompetitiveDisplay(withPositions, finishingPositions)
      : withPositions;
    return ordered.slice(0, 20).map((row, idx) => ({
      ...row,
      rank: idx + 1,
      name: displayName(row.userId),
      me: row.userId === user?.uid,
    }));
  }, [rawRows, isV2, challengeType, user?.uid, namesById, finishingPositions, engineVersion]);

  const podium = ranking.slice(0, 3);
  const listRows = ranking.slice(3, 10);
  const myEntry = ranking.find((r) => r.me);
  const myInTop10 = myEntry ? myEntry.rank <= 10 : false;

  // Collective team progress — from canonical resolver.
  // rawRows has all members; compute memberSum before passing so the multi-source floor is applied.
  const collectiveMemberSum = useMemo(
    () => rawRows.reduce((s, r) => s + r.cumulativeLoggedValue, 0),
    [rawRows],
  );
  const _rp = resolveChallengeProgress({ challenge: challenge ?? null, membership: null, memberSumContribution: collectiveMemberSum });
  const groupCurrentTotal = _rp.groupTotal;
  const groupCumulativeTarget = _rp.groupTarget;
  const groupPct = _rp.groupPercent;

  const toChallenges = `/app/challenges${groupId ? `?groupId=${groupId}` : ''}`;

  if (!challengeId) return <Navigate to="/app/challenges" replace />;

  if (challenge && !isV2) {
    return (
      <EmptyState
        icon={<Trophy size={32} className="text-primary" />}
        title="This challenge is no longer supported"
        message="This challenge was created on an older version of Tiizi and is no longer available."
        action={(
          <button
            className="h-11 px-5 rounded-xl bg-primary text-white text-sm font-bold"
            onClick={() => navigate(toChallenges)}
          >
            Back to Challenges
          </button>
        )}
      />
    );
  }

  // Engine-specific header stat cards (my stats)
  const renderMyStatCard = () => {
    if (!myEntry) return null;

    if (isV2 && challengeType === 'collective') {
      return (
        <section className="st-form-max mt-4 rounded-2xl bg-primary text-white px-5 py-4">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <p className="text-[11px] leading-[13px] tracking-[0.1em] uppercase font-black text-white/90">Your Rank</p>
              <p className="mt-2 text-[22px] leading-[22px] font-black">#{myEntry.rank}</p>
            </div>
            <div className="border-l border-white/30 pl-5 text-right">
              <p className="text-[11px] leading-[13px] tracking-[0.1em] uppercase font-black text-white/90">Contributed</p>
              <p className="mt-2 text-[22px] leading-[22px] font-black">{myEntry.cumulativeLoggedValue.toLocaleString()}</p>
            </div>
          </div>
        </section>
      );
    }

    if (isV2 && challengeType === 'competitive') {
      // Governed result: finishers show their finishing position;
      // non-completers show progress only — NO position, never a rank.
      const myPosition = myEntry.position;
      return (
        <section className="st-form-max mt-4 rounded-2xl bg-primary text-white px-5 py-4">
          <div className={`grid gap-5 ${myPosition ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {myPosition ? (
              <div>
                <p className="text-[11px] leading-[13px] tracking-[0.1em] uppercase font-black text-white/90">Finished</p>
                <p className="mt-2 text-[22px] leading-[22px] font-black">{ordinal(myPosition)}</p>
              </div>
            ) : null}
            <div className={myPosition ? 'border-l border-white/30 pl-5 text-right' : 'text-center'}>
              <p className="text-[11px] leading-[13px] tracking-[0.1em] uppercase font-black text-white/90">Progress</p>
              <p className="mt-2 text-[22px] leading-[22px] font-black">{myEntry.cumulativeLoggedValue.toLocaleString()}</p>
              {totalTarget > 0 && (
                <p className="text-[11px] text-white/70">/ {totalTarget.toLocaleString()} {activityUnit}</p>
              )}
            </div>
          </div>
        </section>
      );
    }

    if (isV2 && challengeType === 'streak') {
      const startDate = challenge?.startDate ? new Date(challenge.startDate) : null;
      const endDate = challenge?.endDate ? new Date(challenge.endDate) : null;
      const totalDays = startDate && endDate
        ? Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)
        : 0;
      const daysCompleted = myEntry.activitiesCompleted ?? 0;
      return (
        <section className="st-form-max mt-4 rounded-2xl bg-primary text-white px-5 py-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] leading-[12px] tracking-[0.1em] uppercase font-black text-white/90">Days Completed</p>
              <p className="mt-2 text-[20px] leading-[22px] font-black">
                {daysCompleted}{totalDays > 0 ? <span className="text-[13px] font-bold text-white/70">/{totalDays}</span> : null}
              </p>
            </div>
            <div className="border-l border-white/30">
              <p className="text-[10px] leading-[12px] tracking-[0.1em] uppercase font-black text-white/90">Best Streak</p>
              <p className="mt-2 text-[20px] leading-[22px] font-black">{myEntry.longestStreak}</p>
            </div>
            <div className="border-l border-white/30">
              <p className="text-[10px] leading-[12px] tracking-[0.1em] uppercase font-black text-white/90">Current Streak</p>
              <p className="mt-2 text-[20px] leading-[22px] font-black">{myEntry.currentStreak}🔥</p>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="st-form-max mt-4 rounded-2xl bg-primary text-white px-5 py-4">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <p className="text-[11px] leading-[13px] tracking-[0.1em] uppercase font-black text-white/90">Current Rank</p>
            <p className="mt-2 text-[22px] leading-[22px] font-black">#{myEntry.rank}</p>
          </div>
          <div className="border-l border-white/30 pl-5 text-right">
            <p className="text-[11px] leading-[13px] tracking-[0.1em] uppercase font-black text-white/90">Total Points</p>
            <p className="mt-2 text-[22px] leading-[22px] font-black">{myEntry.totalPoints} <span className="text-[13px]">pts</span></p>
          </div>
        </div>
      </section>
    );
  };

  const renderRowScore = (row: typeof ranking[0]) => {
    if (isV2 && challengeType === 'collective') {
      const pct = rawRows.length > 0
        ? Math.round((row.cumulativeLoggedValue / Math.max(1, rawRows.reduce((s, r) => s + r.cumulativeLoggedValue, 0))) * 100)
        : 0;
      return (
        <div className="text-right">
          <p className={`text-[15px] leading-[18px] font-black ${row.me ? 'text-primary' : 'text-slate-900'}`}>
            {row.cumulativeLoggedValue.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-400">{pct}% of team</p>
        </div>
      );
    }
    if (isV2 && challengeType === 'competitive') {
      return (
        <div className="text-right flex items-center gap-2">
          {row.completionRate >= 100 && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">Done</span>
          )}
          <div className="text-right">
            <p className={`text-[16px] leading-[20px] font-black ${row.me ? 'text-primary' : 'text-slate-900'}`}>
              {row.cumulativeLoggedValue.toLocaleString()}
            </p>
            {totalTarget > 0 && (
              <p className="text-[11px] text-slate-400">/ {totalTarget.toLocaleString()} {activityUnit}</p>
            )}
          </div>
        </div>
      );
    }
    if (isV2 && challengeType === 'streak') {
      return (
        <div className="text-right flex items-center gap-1.5">
          {row.currentStreak >= 7 && (
            <span className="text-[13px]" title="On Fire">🔥</span>
          )}
          <div>
            <p className={`text-[15px] leading-[18px] font-black ${row.me ? 'text-primary' : 'text-slate-900'}`}>
              {row.currentStreak} day{row.currentStreak !== 1 ? 's' : ''}
            </p>
            <p className="text-[11px] text-slate-400">best {row.longestStreak}</p>
          </div>
        </div>
      );
    }
    return (
      <p className={`text-[16px] leading-[20px] font-black ${row.me ? 'text-primary' : 'text-slate-900'}`}>
        {row.totalPoints} <span className="text-[12px] text-[#9aa7b8]">pts</span>
      </p>
    );
  };

  const podiumScore = (row: typeof ranking[0]) => {
    if (isV2 && challengeType === 'collective') return `${row.cumulativeLoggedValue.toLocaleString()}`;
    if (isV2 && challengeType === 'competitive') return totalTarget > 0 ? `${row.cumulativeLoggedValue.toLocaleString()} / ${totalTarget.toLocaleString()}` : `${row.cumulativeLoggedValue.toLocaleString()}`;
    if (isV2 && challengeType === 'streak') return `${row.currentStreak}🔥`;
    return `${row.totalPoints} pts`;
  };

  const engineIcon =
    isV2 && challengeType === 'streak' ? <Flame size={14} className="text-primary" />
    : isV2 && challengeType === 'competitive' ? <Trophy size={14} className="text-primary" />
    : isV2 && challengeType === 'collective' ? <Users size={14} className="text-primary" />
    : <Trophy size={14} className="text-primary" />;

  // Display badge for a row: governed finishing position for competitive
  // finishers; live progress order otherwise. Non-completers get NO position.
  const displayBadge = (entry: { rank: number; position?: number }) => {
    if (isV2 && challengeType === 'competitive') {
      return entry.position
        ? rankBadge(entry.position)
        : { bg: 'bg-slate-100', text: 'text-slate-400', label: '–' };
    }
    return rankBadge(entry.rank);
  };
  const displayRank = (entry: { rank: number; position?: number }) =>
    isV2 && challengeType === 'competitive'
      ? (entry.position ? ordinal(entry.position) : '–')
      : `${entry.rank}`;

  const rankingLabel =
    isV2 && challengeType === 'collective' ? 'Ranked by total contribution'
    : isV2 && challengeType === 'competitive' ? 'Finish order by target completion · ties share position'
    : isV2 && challengeType === 'streak' ? 'Ranked by current streak · tiebreaker: longest streak'
    : 'Ranked by total points';

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[108px]">
        <header className="st-form-max flex items-center justify-between">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate(toChallenges)}>
            <ArrowLeft size={28} className="text-slate-900" />
          </button>
          <div className="min-w-0 px-1 text-center">
            <p className="st-page-title">Leaderboard</p>
            <p className="st-caption truncate">{challenge?.name || 'Challenge'}</p>
          </div>
          <span className="w-10" />
        </header>

        {/* Collective team progress banner */}
        {isV2 && challengeType === 'collective' && groupCumulativeTarget > 0 && (
          <section className="st-form-max mt-4 rounded-[20px] bg-primary/5 border border-primary/20 px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-primary" />
              <p className="text-[11px] tracking-[0.1em] uppercase font-black text-primary">Team Progress</p>
            </div>
            <div className="h-5 rounded-full bg-white border border-primary/20 p-[3px]">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${Math.min(groupPct, 100)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-slate-700">
                {groupCurrentTotal.toLocaleString()} / {groupCumulativeTarget.toLocaleString()}
              </p>
              <p className="text-[13px] font-black text-primary">{groupPct}%</p>
            </div>
            <p className="mt-1 text-[12px] text-slate-500">
              {Math.max(0, groupCumulativeTarget - groupCurrentTotal).toLocaleString()} remaining
            </p>
          </section>
        )}

        {/* My stats card */}
        {myEntry ? renderMyStatCard() : (
          <section className="st-form-max mt-4 rounded-2xl bg-primary text-white px-5 py-4">
            <p className="text-[13px] text-white/80">Log activity to appear on the leaderboard.</p>
          </section>
        )}

        {/* Podium — not shown for streak challenges (personal results only) */}
        {podium.length > 0 && !(isV2 && challengeType === 'streak') && (
          <section className="st-form-max mt-6">
            <div className="flex items-end justify-center gap-4 text-center">
              {podium.map((entry, index) => {
                const badge = displayBadge(entry);
                return (
                  <div key={entry.userId} className={index === 0 ? 'order-2' : index === 1 ? 'order-1' : 'order-3'}>
                    <div className={`mx-auto rounded-full border-4 bg-slate-200 ${
                      index === 0 ? 'h-24 w-24 border-primary' : 'h-16 w-16 border-slate-300'
                    } ${entry.me ? 'ring-2 ring-primary ring-offset-2' : ''}`} />
                    <p className="mt-2 max-w-[80px] text-[13px] leading-[17px] font-black text-slate-900 truncate">{entry.name}</p>
                    <p className="text-[12px] leading-[15px] font-bold text-primary">{podiumScore(entry)}</p>
                    <span className={`inline-block mt-1 rounded-full px-2 py-1 text-[10px] leading-[11px] font-bold ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Rankings list — not shown for streak challenges (personal results only) */}
        {!(isV2 && challengeType === 'streak') && (
        <section className="st-form-max mt-6">
          <div className="flex items-center gap-2 mb-1">
            {engineIcon}
            <p className="st-section-label">Rankings</p>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">{rankingLabel}</p>
          <p className="mt-0.5 text-[10px] text-slate-400">Points are based on challenge targets — log closer to your daily goal to earn more.</p>

          <div className="mt-4 space-y-3">
            {listRows.map((row) => {
              const badge = displayBadge(row);
              return (
                <article
                  key={row.userId}
                  className={`st-card px-4 py-3.5 flex items-center justify-between ${row.me ? 'border-primary/40 bg-[#fff7f1]' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-black flex-shrink-0 ${badge.bg} ${badge.text}`}>
                      {displayRank(row)}
                    </span>
                    <div className="h-9 w-9 rounded-full bg-slate-200 flex-shrink-0" />
                    <p className={`text-[15px] leading-[19px] font-bold truncate ${row.me ? 'text-primary' : 'text-slate-900'}`}>
                      {row.name}
                    </p>
                  </div>
                  {renderRowScore(row)}
                </article>
              );
            })}

            {ranking.length === 0 && (
              <article className="st-card px-4 py-5 text-center">
                <p className="text-[14px] leading-[20px] text-slate-500">No activity logged yet. Be the first!</p>
              </article>
            )}
          </div>

          {/* Pinned current user if not in top 10 */}
          {myEntry && !myInTop10 && (
            <div className="mt-6">
              <p className="st-section-label mb-3">Your Position</p>
              <article className="st-card border-primary/40 bg-[#fff7f1] px-4 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-black flex-shrink-0 bg-primary/10 text-primary">
                    {displayRank(myEntry)}
                  </span>
                  <div className="h-9 w-9 rounded-full bg-slate-200 flex-shrink-0" />
                  <p className="text-[15px] leading-[19px] font-bold text-primary truncate">{myEntry.name}</p>
                </div>
                {renderRowScore(myEntry)}
              </article>
            </div>
          )}
        </section>
        )}
      </div>

      <BottomNav active="challenges" />
    </Screen>
  );
}

export default ChallengeLeaderboardScreen;
