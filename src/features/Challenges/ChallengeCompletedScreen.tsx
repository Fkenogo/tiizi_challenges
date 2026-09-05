import { collection, getDocs, query, where } from 'firebase/firestore';
import { EllipsisVertical, Flame, Home, Trophy, Users, X } from 'lucide-react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { EmptyState } from '../../components/Mobile';
import { useChallenge, useChallengeMembership, useChallengeSummary } from '../../hooks/useChallenges';
import { useAuth } from '../../hooks/useAuth';
import { useChallengeWorkouts } from '../../hooks/useWorkouts';
import { db } from '../../lib/firebase';
import { isChallengeOngoing } from '../../utils/challengeLifecycle';
import { assignFinishingPositions, ordinal } from '../../utils/competitiveFinishing';
import { resolveChallengeProgress } from './challengeProgressResolver';

// ── Shared navigation CTA block for all v2 recap variants ──────────────────
// PRIMARY   : Share Achievement (full-width orange)
// SECONDARY : View Leaderboard + Back to Group (side-by-side outlined buttons)
// TERTIARY  : Go to Home (muted text link with icon)
function RecapNavActions({
  shareUrl,
  toLeaderboard,
  groupId,
  toGroup,
  toHome,
  onNavigate,
}: {
  shareUrl: string;
  /** Omitted for V2 streak recaps — streak has no leaderboard. */
  toLeaderboard?: string;
  groupId?: string;
  toGroup: string;
  toHome: string;
  onNavigate: (path: string) => void;
}) {
  const secondaryClass =
    'flex items-center justify-center gap-2 h-12 rounded-2xl border border-slate-200 bg-white text-[13px] font-bold text-slate-700 px-3 active:opacity-70';
  return (
    <div className="mt-6 space-y-3">
      {/* Primary */}
      <button className="st-btn-primary" onClick={() => onNavigate(shareUrl)}>
        Share Achievement
      </button>

      {/* Secondary — side-by-side when both present, full-width otherwise.
          No leaderboard button when toLeaderboard is omitted (V2 streak). */}
      {groupId ? (
        <div className="grid grid-cols-2 gap-3">
          {toLeaderboard ? (
            <button className={secondaryClass} onClick={() => onNavigate(toLeaderboard)}>
              <Trophy size={14} className="text-slate-400 flex-shrink-0" />
              View Leaderboard
            </button>
          ) : null}
          <button className={`${secondaryClass} ${toLeaderboard ? '' : 'col-span-2'}`} onClick={() => onNavigate(toGroup)}>
            <Users size={14} className="text-slate-400 flex-shrink-0" />
            Back to Group
          </button>
        </div>
      ) : toLeaderboard ? (
        <button className={`${secondaryClass} w-full`} onClick={() => onNavigate(toLeaderboard)}>
          <Trophy size={14} className="text-slate-400 flex-shrink-0" />
          View Leaderboard
        </button>
      ) : null}

      {/* Tertiary */}
      <button
        className="flex items-center justify-center gap-1.5 w-full py-2 text-[13px] font-semibold text-slate-400 active:opacity-60"
        onClick={() => onNavigate(toHome)}
      >
        <Home size={13} className="flex-shrink-0" />
        Go to Home
      </button>
    </div>
  );
}

function useFinalRank(challengeId: string, userId: string | undefined, engineVersion: string | undefined, challengeType: string) {
  return useQuery({
    queryKey: ['final-rank', challengeId, userId, engineVersion, challengeType],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'challengeMembers'), where('challengeId', '==', challengeId)));
      type Row = { userId: string; totalPoints: number; completionRate: number; currentStreak: number; cumulativeLoggedValue: number; status?: string; completedAt?: unknown };
      const rows: Row[] = snap.docs.map((d) => {
        const data = d.data() as Partial<Row>;
        const cumulativeValues = (d.data().cumulativeValues ?? {}) as Record<string, number>;
        return {
          userId: data.userId ?? '',
          totalPoints: Math.max(0, Number(data.totalPoints ?? 0)),
          completionRate: Math.max(0, Number(data.completionRate ?? 0)),
          currentStreak: Math.max(0, Number(data.currentStreak ?? 0)),
          cumulativeLoggedValue: Math.max(0, Number(data.cumulativeLoggedValue ?? Object.values(cumulativeValues).reduce((s, v) => s + v, 0))),
          status: data.status,
          completedAt: data.completedAt,
        };
      });

      const memberSumContribution = rows.reduce((s, r) => s + r.cumulativeLoggedValue, 0);

      // v2 only — non-v2/unsupported challenges never render a rank (see the !isV2
      // early return in ChallengeCompletedScreen), so no legacy sort is computed here.
      // Competitive uses GOVERNED finishing positions (completedAt order, ties
      // share, non-completers get null) — never a points-based tie-breaker.
      if (engineVersion === 'v2' && challengeType === 'competitive') {
        const positions = assignFinishingPositions(rows);
        return { rank: userId ? (positions.get(userId) ?? null) : null, total: rows.length, memberSumContribution };
      }
      let sorted: Row[] | null = null;
      if (engineVersion === 'v2' && challengeType === 'collective') {
        sorted = rows.slice().sort((a, b) => b.cumulativeLoggedValue - a.cumulativeLoggedValue);
      }
      // V2 streak has NO leaderboard: personal progress only (Days Completed,
      // Current Streak, Best Streak). Never compute a streak rank here.
      if (!sorted) {
        return { rank: null, total: rows.length, memberSumContribution };
      }
      const idx = sorted.findIndex((r) => r.userId === userId);
      return { rank: idx >= 0 ? idx + 1 : null, total: sorted.length, memberSumContribution };
    },
    enabled: !!challengeId && !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

function ChallengeCompletedScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const challengeId = params.get('challengeId') ?? '';
  const groupId = params.get('groupId') || undefined;
  const titleParam = params.get('name') || '';
  // Passed by WorkoutLoggedScreen (and wellness log screens) to avoid relying on
  // Firestore propagation timing and to support wellness logs (stored in wellnessLogs,
  // not workouts — so useChallengeWorkouts would miss them).
  const sessionLastValue = params.get('lastValue') ? Number(params.get('lastValue')) : null;
  const sessionLastUnit = params.get('lastUnit') ?? '';
  const { user } = useAuth();
  const { data: challenge } = useChallenge(challengeId);
  const { data: workouts = [] } = useChallengeWorkouts(challengeId);
  const { data: membership } = useChallengeMembership(challengeId);
  const { data: challengeSummary } = useChallengeSummary(challengeId);

  const title = titleParam || challenge?.name || 'this challenge';
  const engineVersion = challenge?.engineVersion;
  const challengeType = challenge?.challengeType ?? 'collective';
  const isV2 = engineVersion === 'v2';

  const { data: rankData } = useFinalRank(challengeId, user?.uid, engineVersion, challengeType);

  if (!challengeId) return <Navigate to="/app/challenges" replace />;

  const toHome = '/app/home';
  const toLeaderboard = `/app/challenges/leaderboard?challengeId=${challengeId}${groupId ? `&groupId=${groupId}` : ''}`;
  const toGroup = groupId ? `/app/group/${groupId}/feed` : `/app/challenges`;
  const toShare = `/app/share?challengeId=${challengeId}${groupId ? `&groupId=${groupId}` : ''}`;
  const toChallenges = `/app/challenges${groupId ? `?groupId=${groupId}` : ''}`;

  const myWorkouts = useMemo(() => workouts.filter((item) => item.userId === user?.uid), [user?.uid, workouts]);
  const uniqueDays = useMemo(() => {
    const days = new Set<string>();
    myWorkouts.forEach((item) => {
      const date = new Date(item.completedAt);
      days.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
    });
    return days.size;
  }, [myWorkouts]);
  const totalDays = useMemo(() => {
    if (!challenge) return 0;
    if (challenge.durationDays && challenge.durationDays > 0) return challenge.durationDays;
    const start = new Date(challenge.startDate).getTime();
    const end = new Date(challenge.endDate).getTime();
    return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
  }, [challenge]);

  const points = membership?.totalPoints ?? 0;
  const completionRate = membership?.completionRate ?? 0;
  const totalTarget = (challenge?.activities ?? []).reduce((s, a) => s + (a.targetValue ?? 0), 0);
  const activityUnit = challenge?.activities?.[0]?.unit ?? '';
  const currentStreak = membership?.currentStreak ?? 0;
  const longestStreak = membership?.longestStreak ?? 0;
  const cumulativeLoggedValue = membership?.cumulativeLoggedValue ?? 0;

  // Collective — from canonical resolver. rankData includes memberSum so the multi-source floor applies.
  const _rp = resolveChallengeProgress({
    challenge: challenge ?? null,
    membership: membership ?? null,
    memberSumContribution: rankData?.memberSumContribution,
    activitySummaryTotal: challengeSummary?.totalValue,
  });
  const groupCurrentTotal = _rp.groupTotal;
  const groupCumulativeTarget = _rp.groupTarget;
  const groupPct = _rp.groupPercent;
  const myContributionPct = groupCurrentTotal > 0 ? Math.round((_rp.userContributionTotal / groupCurrentTotal) * 100) : 0;

  // Whether the challenge is still ongoing (not yet ended by date + status).
  // Used for dynamic headings: "Your progress so far" vs "Complete".
  const isOngoing = challenge ? isChallengeOngoing(challenge) : true;

  // Streak
  const requiredDays = challenge?.requiredConsecutiveDays ?? 0;
  // Days elapsed since challenge start — used to guard against false missed-day counts
  // on day 0/1 when the user has had no chance to log yet.
  const daysElapsed = useMemo(() => {
    const start = Date.parse(challenge?.startDate ?? '');
    if (Number.isNaN(start)) return 0;
    return Math.max(0, Math.floor((Date.now() - start) / (24 * 60 * 60 * 1000)));
  }, [challenge?.startDate]);
  // Only compute missedDays when there have been at least 2 elapsed days — avoids showing
  // "7 missed days" on day 0 or 1 when the user simply hasn't had time to log.
  const missedDays = daysElapsed > 1 ? Math.max(0, uniqueDays < daysElapsed ? daysElapsed - uniqueDays : 0) : null;
  // Consistency: only show once at least 1 day has elapsed.
  const consistencyScore = daysElapsed > 0 && daysElapsed <= totalDays
    ? Math.min(100, Math.round((uniqueDays / daysElapsed) * 100))
    : null;

  // Competitive — most recent workout logged by this user (used for hero "Just logged" value)
  const lastLoggedWorkout = useMemo(() => {
    if (myWorkouts.length === 0) return null;
    return [...myWorkouts].sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))[0];
  }, [myWorkouts]);

  // Build enriched share URL for each challenge type so ShareScreen can compose
  // achievement-based copy instead of generic invite text.
  const baseShare = `/app/share?challengeId=${challengeId}${groupId ? `&groupId=${groupId}` : ''}`;
  const enc = encodeURIComponent;
  // Prefer the session-injected value (passed as URL param from the log screen) so that:
  // a) wellness logs (stored in wellnessLogs, not workouts) aren't silently missing, and
  // b) there's no Firestore propagation race between log write and this screen loading.
  const resolvedLastValue = sessionLastValue ?? lastLoggedWorkout?.value ?? 0;
  const resolvedLastUnit = (sessionLastValue !== null ? sessionLastUnit : null) ?? lastLoggedWorkout?.unit ?? activityUnit;
  const collectiveShare =
    `${baseShare}&type=collective&name=${enc(title)}` +
    `&lastValue=${resolvedLastValue}&lastUnit=${enc(resolvedLastUnit)}` +
    `&teamTotal=${groupCurrentTotal}&teamTarget=${groupCumulativeTarget}&unit=${enc(activityUnit)}`;
  const competitiveShare =
    `${baseShare}&type=competitive&name=${enc(title)}` +
    `&lastValue=${resolvedLastValue}&lastUnit=${enc(resolvedLastUnit)}` +
    `&myProgress=${cumulativeLoggedValue}&totalTarget=${totalTarget}&unit=${enc(activityUnit)}` +
    (rankData?.rank ? `&rank=${rankData.rank}` : '');
  const streakShare =
    `${baseShare}&type=streak&name=${enc(title)}` +
    `&streak=${currentStreak}&totalDays=${totalDays}`;

  // Reusable donate section — same across all v2 challenge types
  const DonateSection = (
    <section className="mt-4 rounded-2xl border border-primary/20 bg-[#fff4eb] px-4 py-4">
      <p className="text-[16px] leading-[20px] font-black text-slate-900">Nice work on the challenge</p>
      <p className="mt-2 text-[13px] leading-[19px] text-slate-600">
        If Tiizi helped you stay consistent, you can support its growth. This is optional.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button className="h-10 rounded-xl bg-primary text-white text-[12px] font-bold" onClick={() => navigate(`/app/donate?trigger=challenge_completion&challengeId=${challengeId}`)}>
          Support Tiizi
        </button>
        <button className="h-10 rounded-xl bg-slate-100 text-slate-700 text-[12px] font-semibold" onClick={() => navigate(toHome)}>Maybe later</button>
        <button className="h-10 rounded-xl bg-slate-100 text-slate-700 text-[12px] font-semibold" onClick={() => navigate(toHome)}>Skip</button>
      </div>
    </section>
  );

  if (!isV2) {
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

  // --- Collective recap ---
  if (isV2 && challengeType === 'collective') {
    const headerLabel = isOngoing ? 'Team Progress' : 'Team Goal Achieved!';
    const activityName = challenge?.activities?.[0]?.exerciseName ?? '';
    const justLoggedValue = sessionLastValue !== null ? sessionLastValue : (lastLoggedWorkout?.value ?? null);
    const justLoggedUnit = (sessionLastValue !== null ? sessionLastUnit : null) || lastLoggedWorkout?.unit || activityUnit;
    const heroHeadline = justLoggedValue !== null
      ? activityName
        ? `${activityName}: ${justLoggedValue.toLocaleString()} ${justLoggedUnit} logged!`
        : `${justLoggedValue.toLocaleString()} ${justLoggedUnit} logged!`
      : 'Activity logged!';
    const headline = heroHeadline;
    const subline = isOngoing
      ? `Every contribution moves the team forward. Keep it up!`
      : `The team crushed the ${title}. Every rep counted.`;

    return (
      <Screen noPadding noBottomPadding className="st-page">
        <div className="st-frame st-bottom-safe pb-[108px]">
          <header className="st-form-max flex items-center justify-between">
            <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate(-1)}>
              <X size={26} className="text-[#3b4d67]" />
            </button>
            <p className="text-[12px] leading-[14px] tracking-[0.18em] uppercase font-black text-primary">{headerLabel}</p>
            <button className="h-10 w-10 flex items-center justify-center">
              <EllipsisVertical size={22} className="text-[#3b4d67]" />
            </button>
          </header>

          <main className="st-form-max mt-5">
            <h1 className="text-center text-[36px] leading-[40px] tracking-[-0.03em] font-light text-primary whitespace-pre-line">
              {headline}
            </h1>
            <p className="mt-3 text-center text-[14px] leading-[22px] font-medium text-[#4f6785]">{subline}</p>

            <div className="mt-6 rounded-full border-[5px] border-[#f5cdb8] bg-[#fff8f4] h-[240px] flex items-center justify-center shadow-[0_14px_30px_rgba(255,111,0,0.15)]">
              <div className="text-center">
                <div className="flex items-center justify-center">
                  <Users size={56} className="text-primary" />
                </div>
                {justLoggedValue !== null ? (
                  <>
                    <div className="mt-3 text-[18px] leading-[22px] font-black text-[#1c120d]">
                      {justLoggedValue.toLocaleString()}
                      {justLoggedUnit && <span className="text-[13px] font-semibold text-slate-500"> {justLoggedUnit}</span>}
                    </div>
                    <p className="text-[12px] text-slate-500 mt-1">Just logged</p>
                  </>
                ) : (
                  <p className="mt-3 text-[14px] font-semibold text-slate-500">Activity logged!</p>
                )}
              </div>
            </div>

            {/* Team progress */}
            <section className="st-card mt-6 p-5">
              <p className="text-[11px] tracking-[0.12em] uppercase font-black text-[#8ca0ba] mb-4">
                {isOngoing ? 'Team Progress' : 'Final Team Progress'}
              </p>
              <div className="h-5 rounded-full bg-slate-100 p-[3px]">
                <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${Math.min(groupPct, 100)}%` }} />
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-[22px] leading-[26px] font-black text-primary">
                    {groupCurrentTotal.toLocaleString()}
                    <span className="text-[15px] text-slate-400"> / {groupCumulativeTarget.toLocaleString()}</span>
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500">Team total</p>
                </div>
                <p className="text-[28px] leading-[28px] font-black text-primary">{groupPct}%</p>
              </div>
            </section>

            {/* Your contribution — hide share % when 0 to avoid confusing "0%" display */}
            <section className="st-card mt-4 p-5">
              <p className="text-[11px] tracking-[0.12em] uppercase font-black text-[#8ca0ba] mb-4">Your Contribution</p>
              <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                <div>
                  <p className="text-[12px] leading-[14px] tracking-[0.08em] uppercase font-bold text-primary">Contributed</p>
                  <p className="mt-2 text-[22px] leading-[26px] font-black text-slate-900">{cumulativeLoggedValue.toLocaleString()}</p>
                </div>
                {myContributionPct > 0 && (
                  <div>
                    <p className="text-[12px] leading-[14px] tracking-[0.08em] uppercase font-bold text-primary">Your Share</p>
                    <p className="mt-2 text-[22px] leading-[26px] font-black text-slate-900">{myContributionPct}%</p>
                  </div>
                )}
                {rankData?.rank && (
                  <div>
                    <p className="text-[12px] leading-[14px] tracking-[0.08em] uppercase font-bold text-primary">
                      {isOngoing ? 'Current Rank' : 'Final Rank'}
                    </p>
                    <p className="mt-2 text-[22px] leading-[26px] font-black text-slate-900">
                      #{rankData.rank}
                      {rankData.total ? <span className="text-[14px] text-slate-400"> / {rankData.total}</span> : null}
                    </p>
                  </div>
                )}
              </div>
            </section>

            <p className="mt-5 text-center text-[15px] leading-[22px] font-semibold text-slate-600 italic">
              "The team that moves together, wins together."
            </p>

            <RecapNavActions
              shareUrl={collectiveShare}
              toLeaderboard={toLeaderboard}
              groupId={groupId}
              toGroup={toGroup}
              toHome={toHome}
              onNavigate={navigate}
            />
            {DonateSection}
          </main>
        </div>
        <BottomNav active="challenges" />
      </Screen>
    );
  }

  // --- Competitive recap ---
  if (isV2 && challengeType === 'competitive') {
    const headerLabel = isOngoing ? 'Your Progress' : 'Challenge Complete!';
    const headline = isOngoing ? 'Your progress\nso far.' : 'You raced.\nYou finished.';
    const subline = isOngoing
      ? `Here's how you're doing on the ${title}.`
      : `Here's your final performance on the ${title}.`;

    // Governed finishing position (null when this Participant has not finished).
    // Non-completers see progress only — NO position, never a rank.
    const myPosition = rankData?.rank ?? null;
    const totalMembers = rankData?.total ?? 0;
    const isLeading = myPosition === 1 && totalMembers > 1;

    return (
      <Screen noPadding noBottomPadding className="st-page">
        <div className="st-frame st-bottom-safe pb-[108px]">
          <header className="st-form-max flex items-center justify-between">
            <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate(-1)}>
              <X size={26} className="text-[#3b4d67]" />
            </button>
            <p className="text-[12px] leading-[14px] tracking-[0.18em] uppercase font-black text-primary">{headerLabel}</p>
            <button className="h-10 w-10 flex items-center justify-center">
              <EllipsisVertical size={22} className="text-[#3b4d67]" />
            </button>
          </header>

          <main className="st-form-max mt-5">
            <h1 className="text-center text-[36px] leading-[40px] tracking-[-0.03em] font-light text-primary whitespace-pre-line">
              {headline}
            </h1>
            <p className="mt-3 text-center text-[14px] leading-[22px] font-medium text-[#4f6785]">{subline}</p>

            <div className="mt-6 rounded-full border-[5px] border-[#f5cdb8] bg-[#fff8f4] h-[240px] flex items-center justify-center shadow-[0_14px_30px_rgba(255,111,0,0.15)]">
              <div className="text-center">
                <div className="flex items-center justify-center">
                  <Trophy size={56} className="text-primary" />
                </div>
                {resolvedLastValue > 0 || lastLoggedWorkout ? (
                  <>
                    <div className="mt-3 text-[18px] leading-[22px] font-black text-[#1c120d]">
                      {resolvedLastValue > 0 ? resolvedLastValue.toLocaleString() : lastLoggedWorkout!.value.toLocaleString()}
                      {resolvedLastUnit && <span className="text-[13px] font-semibold text-slate-500"> {resolvedLastUnit}</span>}
                    </div>
                    <p className="text-[12px] text-slate-500 mt-1">Just logged</p>
                  </>
                ) : (
                  <>
                    <div className="mt-3 text-[18px] leading-[22px] font-black text-[#1c120d]">
                      {cumulativeLoggedValue.toLocaleString()}
                      {activityUnit && <span className="text-[13px] font-semibold text-slate-500"> {activityUnit}</span>}
                    </div>
                    <p className="text-[12px] text-slate-500 mt-1">Progress</p>
                  </>
                )}
                {completionRate >= 100 && (
                  <div className="mx-auto mt-2 inline-flex rounded-full bg-green-500 px-3 py-1 text-[11px] font-black text-white tracking-wide">
                    Completed ✓
                  </div>
                )}
              </div>
            </div>

            {/* Position + progress — no points */}
            <section className="st-card mt-6 p-5">
              <p className="text-[11px] tracking-[0.12em] uppercase font-black text-[#8ca0ba] mb-4">
                {isOngoing ? 'Current Standing' : 'Final Results'}
              </p>
              <div className="grid grid-cols-2 gap-3 text-center">
                {myPosition ? (
                  <div>
                    <p className="text-[11px] tracking-[0.08em] uppercase font-bold text-primary">
                      {isOngoing ? 'Finished' : 'Final Position'}
                    </p>
                    <p className="mt-2 text-[22px] leading-[26px] font-black text-slate-900">
                      {ordinal(myPosition)}
                      {totalMembers > 0 && <span className="text-[13px] font-normal text-slate-400"> / {totalMembers}</span>}
                    </p>
                  </div>
                ) : null}
                <div className={myPosition ? 'border-l border-slate-100' : 'col-span-2'}>
                  <p className="text-[11px] tracking-[0.08em] uppercase font-bold text-primary">Progress</p>
                  <p className="mt-2 text-[22px] leading-[26px] font-black text-slate-900">
                    {cumulativeLoggedValue.toLocaleString()}
                    {totalTarget > 0 && <span className="text-[13px] font-normal text-slate-400"> / {totalTarget.toLocaleString()}{activityUnit ? ` ${activityUnit}` : ''}</span>}
                  </p>
                </div>
              </div>
              {isLeading && (
                <p className="mt-3 text-center text-[13px] font-bold text-primary">🥇 You are leading the group!</p>
              )}
            </section>

            <RecapNavActions
              shareUrl={competitiveShare}
              toLeaderboard={toLeaderboard}
              groupId={groupId}
              toGroup={toGroup}
              toHome={toHome}
              onNavigate={navigate}
            />
            {DonateSection}
          </main>
        </div>
        <BottomNav active="challenges" />
      </Screen>
    );
  }

  // --- Streak recap ---
  if (isV2 && challengeType === 'streak') {
    const streakPct = requiredDays > 0 ? Math.min(100, Math.round((currentStreak / requiredDays) * 100)) : 0;
    const isMilestone7 = currentStreak > 0 && currentStreak % 7 === 0;
    const headerLabel = isOngoing ? 'Streak in Progress' : 'Streak Complete!';
    const headline = isOngoing ? 'Keep the\nstreak alive.' : 'Consistency\nwins.';
    const durationLabel = totalDays > 0 ? ` of ${totalDays}` : '';
    const subline = isOngoing
      ? `Day ${currentStreak}${durationLabel} done. Keep going.`
      : totalDays > 0
        ? `You completed ${totalDays} days of the streak. Well done.`
        : `You showed up. That's what the ${title} was about.`;

    return (
      <Screen noPadding noBottomPadding className="st-page">
        <div className="st-frame st-bottom-safe pb-[108px]">
          <header className="st-form-max flex items-center justify-between">
            <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate(-1)}>
              <X size={26} className="text-[#3b4d67]" />
            </button>
            <p className="text-[12px] leading-[14px] tracking-[0.18em] uppercase font-black text-primary">{headerLabel}</p>
            <button className="h-10 w-10 flex items-center justify-center">
              <EllipsisVertical size={22} className="text-[#3b4d67]" />
            </button>
          </header>

          <main className="st-form-max mt-5">
            <h1 className="text-center text-[36px] leading-[40px] tracking-[-0.03em] font-light text-primary whitespace-pre-line">
              {headline}
            </h1>
            <p className="mt-3 text-center text-[14px] leading-[22px] font-medium text-[#4f6785]">{subline}</p>

            <div className="mt-6 rounded-full border-[5px] border-[#f5cdb8] bg-[#fff8f4] h-[240px] flex items-center justify-center shadow-[0_14px_30px_rgba(255,111,0,0.15)]">
              <div className="text-center">
                <div className="flex items-center justify-center">
                  <Flame size={56} className="text-primary" />
                </div>
                <div className="mt-3 text-[18px] leading-[22px] font-black text-[#1c120d]">{currentStreak} day{currentStreak !== 1 ? 's' : ''}</div>
                <p className="text-[12px] text-slate-500 mt-1">{isOngoing ? 'Current Streak' : 'Final Streak'}</p>
                {isMilestone7 && (
                  <div className="mx-auto mt-2 inline-flex rounded-full bg-primary px-3 py-1 text-[11px] font-black text-white tracking-wide">
                    🔥 {currentStreak}-Day Milestone!
                  </div>
                )}
              </div>
            </div>

            {/* Streak stats — consistency only shown when there is at least 1 elapsed day */}
            <section className="st-card mt-6 p-5">
              <p className="text-[11px] tracking-[0.12em] uppercase font-black text-[#8ca0ba] mb-4">Your Streak Record</p>
              <div className={`grid gap-3 text-center mb-4 ${consistencyScore !== null ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <div className="rounded-xl bg-[#fff3e8] py-3">
                  <p className="text-[24px] leading-[28px] font-black text-primary">{currentStreak}</p>
                  <p className="text-[10px] leading-[13px] uppercase tracking-[0.08em] font-bold text-[#9597a0] mt-1">
                    {isOngoing ? 'Current' : 'Final'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 py-3">
                  <p className="text-[24px] leading-[28px] font-black text-[#1c120d]">{longestStreak}</p>
                  <p className="text-[10px] leading-[13px] uppercase tracking-[0.08em] font-bold text-[#9597a0] mt-1">Best</p>
                </div>
                {consistencyScore !== null && (
                  <div className="rounded-xl bg-slate-50 py-3">
                    <p className="text-[24px] leading-[28px] font-black text-[#1c120d]">{consistencyScore}%</p>
                    <p className="text-[10px] leading-[13px] uppercase tracking-[0.08em] font-bold text-[#9597a0] mt-1">Consistency</p>
                  </div>
                )}
              </div>
              {requiredDays > 0 && (
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${streakPct}%` }} />
                </div>
              )}
              {requiredDays > 0 && (
                <p className="mt-1.5 text-[12px] text-slate-500">
                  Day {currentStreak} of {requiredDays} required
                </p>
              )}
            </section>

            {/* Days breakdown — missed days only shown after >1 day elapsed */}
            {daysElapsed > 1 && (
              <section className="st-card mt-4 p-5">
                <p className="text-[11px] tracking-[0.12em] uppercase font-black text-[#8ca0ba] mb-4">Challenge Days</p>
                <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                  <div>
                    <p className="text-[12px] leading-[14px] tracking-[0.08em] uppercase font-bold text-primary">Active Days</p>
                    <p className="mt-2 text-[22px] leading-[26px] font-black text-slate-900">
                      {uniqueDays} <span className="text-[14px] text-slate-400">/ {daysElapsed} elapsed</span>
                    </p>
                  </div>
                  {missedDays !== null && (
                    <div>
                      <p className="text-[12px] leading-[14px] tracking-[0.08em] uppercase font-bold text-primary">Missed Days</p>
                      <p className="mt-2 text-[22px] leading-[26px] font-black text-slate-900">{missedDays}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* V2 streak: no leaderboard CTA — personal progress only. */}
            <RecapNavActions
              shareUrl={streakShare}
              groupId={groupId}
              toGroup={toGroup}
              toHome={toHome}
              onNavigate={navigate}
            />
            {DonateSection}
          </main>
        </div>
        <BottomNav active="challenges" />
      </Screen>
    );
  }

  // Safety net: isV2 is guaranteed true past the early return above, and challengeType
  // always resolves to one of the three branches handled above — this should be
  // unreachable, but avoids ever falling through to legacy calculations for any
  // malformed/unexpected record shape.
  return (
    <EmptyState
      icon={<Trophy size={32} className="text-primary" />}
      title="This challenge is no longer supported"
      message="This challenge type could not be displayed."
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

export default ChallengeCompletedScreen;
