import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LearnMoreLink } from '../../components/LearnMoreLink';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, ChevronRight, Flame, Trophy, Users, Zap } from 'lucide-react';
import { Screen, BottomNav } from '../../components/Layout';
import { EmptyState } from '../../components/Mobile';
import { useCanAccessChallenge, useChallenge, useChallengeMembership, useChallengeSummary, useJoinChallenge, useLeaveChallenge } from '../../hooks/useChallenges';
import { useGroup, useGroups } from '../../hooks/useGroups';
import { useCreateChallengeReminder } from '../../hooks/useNotifications';
import { useAuth } from '../../hooks/useAuth';
import { useChallengeProgress } from '../../hooks/useWorkouts';
import { useToast } from '../../context/ToastContext';
import { useChallengeContributions, useChallengeTotalRaised, useCreateChallengeContribution, useConfirmChallengeContribution } from '../../hooks/useDonations';
import { isChallengeCompletedOrExpired } from '../../utils/challengeLifecycle';
import { sortLeaderboardRows } from '../../utils/leaderboardSort';
import { resolveChallengeProgress, safeNum } from '../Challenges/challengeProgressResolver';
import { db } from '../../lib/firebase';

function targetLabel(activity: { targetValue?: number; unit?: string; targetType?: string }): string {
  const val = activity.targetValue ?? '';
  const unit = activity.unit ?? '';
  switch (activity.targetType) {
    case 'daily': return `${val} ${unit} per day`;
    case 'weekly': return `${val} ${unit} per week`;
    case 'monthly': return `${val} ${unit} per month`;
    case 'cumulative': return `${typeof val === 'number' ? val.toLocaleString() : val} ${unit} total`;
    default: return `${val} ${unit}`.trim();
  }
}

function ChallengeDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const groupId = params.get('groupId') ?? undefined;
  const { data: challenge, isLoading } = useChallenge(id);
  const { data: canAccessChallenge = false, isLoading: isCheckingAccess } = useCanAccessChallenge(id);
  const { data: membership } = useChallengeMembership(id);
  const { data: challengeSummary } = useChallengeSummary(id);
  const joinChallenge = useJoinChallenge();
  const leaveChallenge = useLeaveChallenge();
  const createReminder = useCreateChallengeReminder();
  const { data: groups } = useGroups();
  const challengeGroupId = challenge?.groupId;
  const { data: challengeGroupFromId } = useGroup(challengeGroupId);
  const { user } = useAuth();
  const { showToast } = useToast();
  const resolvedChallenge = challenge ?? null;
  const hasValidGroupId = !!groupId && !!groups?.some((group) => group.id === groupId);
  const activeGroupId = hasValidGroupId ? groupId : undefined;
  const challengeGroup = challengeGroupFromId ?? groups?.find((item) => item.id === challengeGroupId);
  const canPreviewPublicChallenge = !canAccessChallenge && !!challengeGroup && !challengeGroup.isPrivate;
  const normalizedGroupId = challengeGroupId ?? activeGroupId;
  const backToChallengesPath = `/app/challenges${normalizedGroupId ? `?groupId=${normalizedGroupId}` : ''}`;
  const { data: progress } = useChallengeProgress(resolvedChallenge?.id, user?.uid);
  const { data: myContributions = [] } = useChallengeContributions(resolvedChallenge?.id);
  const { data: totalRaised = 0 } = useChallengeTotalRaised(resolvedChallenge?.id);
  const createContribution = useCreateChallengeContribution();
  const confirmContribution = useConfirmChallengeContribution();

  // Cause pledge flow state machine
  const [pledgeStep, setPledgeStep] = useState<'idle' | 'selecting_amount' | 'payment_instructions' | 'confirmed'>('idle');
  const [pledgePreset, setPledgePreset] = useState<number | null>(null);
  const [pledgeCustom, setPledgeCustom] = useState('');
  const [activePledgeId, setActivePledgeId] = useState<string | null>(null);

  const summary = useMemo(() => {
    if (!resolvedChallenge) return null;
    const start = new Date(resolvedChallenge.startDate);
    const end = new Date(resolvedChallenge.endDate);
    const now = Date.now();
    const startMs = start.getTime();
    const endMs = end.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const durationDays = Math.max(1, Math.ceil((endMs - startMs) / oneDay) + 1);
    const startsInDays = Math.max(0, Math.ceil((startMs - now) / oneDay));
    const daysLeft = Math.max(0, Math.ceil((endMs - now) / oneDay));
    const statusLabel =
      now < startMs ? `Scheduled · starts in ${startsInDays} day${startsInDays === 1 ? '' : 's'}` :
      now > endMs ? 'Ended' :
      `Ongoing · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
    const currentDay = now >= startMs && now <= endMs
      ? Math.min(durationDays, Math.floor((now - startMs) / oneDay) + 1)
      : null;
    const completionPct = membership?.completionRate ?? 0;
    return {
      durationDays,
      currentDay,
      completionPct,
      statusLabel,
      startLabel: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      endLabel: end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };
  }, [resolvedChallenge, membership]);

  const { data: leaderboardData = { entries: [], memberSumContribution: 0 } } = useQuery({
    queryKey: ['challenge-leaderboard-snapshot', resolvedChallenge?.id, resolvedChallenge?.engineVersion, resolvedChallenge?.challengeType],
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(db, 'challengeMembers'), where('challengeId', '==', resolvedChallenge!.id)),
      );
      const rows = snap.docs.map((d) => {
        const data = d.data() as {
          userId: string;
          totalPoints?: number;
          completionRate?: number;
          currentStreak?: number;
          longestStreak?: number;
          cumulativeLoggedValue?: number;
          cumulativeValues?: Record<string, number>;
        };
        const cumulativeFromValues = Object.values(data.cumulativeValues ?? {}).reduce((s, v) => s + v, 0);
        return {
          userId: data.userId,
          totalPoints: Math.max(0, Number(data.totalPoints ?? 0)),
          completionRate: Math.max(0, Number(data.completionRate ?? 0)),
          currentStreak: Math.max(0, Number(data.currentStreak ?? 0)),
          longestStreak: Math.max(0, Number(data.longestStreak ?? 0)),
          cumulativeLoggedValue: Math.max(0, Number(data.cumulativeLoggedValue ?? cumulativeFromValues)),
        };
      });
      // Compute memberSum before sorting/slicing so we have the full cross-member total.
      const memberSumContribution = rows.reduce((s, r) => s + r.cumulativeLoggedValue, 0);
      const sorted = sortLeaderboardRows(rows, resolvedChallenge!.engineVersion, resolvedChallenge!.challengeType);
      const ct = resolvedChallenge!.challengeType;
      const entries = sorted
        .slice(0, 5)
        .map((entry, index) => {
          let score: number;
          let scoreLabel: string;
          if (ct === 'streak') {
            score = entry.currentStreak;
            scoreLabel = score === 1 ? 'day streak' : 'days';
          } else if (ct === 'competitive') {
            const totalTarget = (resolvedChallenge!.activities ?? []).reduce((s, a) => s + (a.targetValue ?? 0), 0);
            const activityUnit = resolvedChallenge!.activities?.[0]?.unit ?? '';
            score = entry.cumulativeLoggedValue;
            scoreLabel = totalTarget > 0 ? `/ ${totalTarget.toLocaleString()} ${activityUnit}`.trim() : '';
          } else if (ct === 'collective') {
            score = entry.cumulativeLoggedValue;
            scoreLabel = '';
          } else {
            score = entry.totalPoints;
            scoreLabel = 'pts';
          }
          return { rank: index + 1, userId: entry.userId, score, scoreLabel };
        });
      return { entries, memberSumContribution };
    },
    enabled: !!resolvedChallenge?.id,
    staleTime: 60 * 1000,
  });
  const leaderboard = leaderboardData.entries;
  const leaderboardMemberSum = leaderboardData.memberSumContribution;

  const leaderboardUserIds = useMemo(() => leaderboard.map((e) => e.userId), [leaderboard]);
  const { data: leaderboardNames = new Map<string, string>() } = useQuery({
    queryKey: ['challenge-participant-names', leaderboardUserIds.join(',')],
    queryFn: async () => {
      const map = new Map<string, string>();
      if (leaderboardUserIds.length === 0) return map;
      const snaps = await Promise.all(leaderboardUserIds.map((uid) => getDoc(doc(db, 'users', uid))));
      snaps.forEach((snap, i) => {
        const uid = leaderboardUserIds[i];
        if (snap.exists()) {
          const data = snap.data() as {
            email?: string;
            profile?: { personalInfo?: { displayName?: string; fullName?: string } };
          };
          const name =
            data.profile?.personalInfo?.displayName ||
            data.profile?.personalInfo?.fullName ||
            data.email?.split('@')[0] ||
            '';
          map.set(uid, name.trim() || `Member ${uid.slice(0, 6).toUpperCase()}`);
        } else {
          map.set(uid, `Member ${uid.slice(0, 6).toUpperCase()}`);
        }
      });
      return map;
    },
    enabled: leaderboardUserIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const now = Date.now();
  const challengeStartsAt = resolvedChallenge ? Date.parse(resolvedChallenge.startDate) : 0;
  const challengeEndsAt = resolvedChallenge ? Date.parse(resolvedChallenge.endDate) : 0;
  const hasStarted = resolvedChallenge ? now >= challengeStartsAt : false;
  const hasEnded = resolvedChallenge ? now > challengeEndsAt : false;
  const canLogWorkout = !!membership && membership.status === 'active' && hasStarted && !hasEnded;
  const isWellnessChallenge = !!resolvedChallenge?.category && resolvedChallenge.category !== 'fitness';
  const challengeIsOver = resolvedChallenge ? isChallengeCompletedOrExpired(resolvedChallenge, now) : false;
  const requiresApproval = !!resolvedChallenge?.donation?.enabled
    && (resolvedChallenge?.moderationStatus === 'pending' || resolvedChallenge?.status === 'draft');
  const challengeTypeMap: Record<string, string> = { collective: 'Collective', competitive: 'Competitive', streak: 'Streak' };
  const challengeTypeLabel = resolvedChallenge
    ? (challengeTypeMap[resolvedChallenge.challengeType ?? ''] ?? 'Challenge')
    : '';
  const modeLabel = resolvedChallenge
    ? (resolvedChallenge.category === 'fitness' ? 'Fitness' : 'Wellness')
    : '';
  const isV2 = resolvedChallenge?.engineVersion === 'v2';

  useEffect(() => {
    if (!groupId) return;
    if (groups && !hasValidGroupId) {
      if (resolvedChallenge) {
        navigate(`/app/challenge/${resolvedChallenge.id}`, { replace: true });
      } else {
        navigate('/app/challenges', { replace: true });
      }
      return;
    }
    if (resolvedChallenge && challengeGroupId && groupId !== challengeGroupId) {
      navigate(`/app/challenge/${resolvedChallenge.id}?groupId=${challengeGroupId}`, { replace: true });
      return;
    }
    if (resolvedChallenge && !challengeGroupId) {
      navigate(`/app/challenge/${resolvedChallenge.id}`, { replace: true });
    }
  }, [groupId, groups, hasValidGroupId, resolvedChallenge, challengeGroupId, navigate]);

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Screen noPadding noBottomPadding className="st-page bg-slate-50">
        <div className="px-4 pt-4">
          <div className="h-10 w-10 rounded-full bg-slate-200 animate-pulse" />
        </div>
        <div className="mx-4 mt-3 rounded-[24px] bg-slate-200 h-52 animate-pulse" />
        <div className="mx-4 mt-4 space-y-3">
          <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
          <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
        </div>
        <BottomNav active="challenges" />
      </Screen>
    );
  }

  if (!resolvedChallenge) {
    return (
      <EmptyState
        icon={<Trophy size={32} className="text-primary" />}
        title="Challenge not found"
        message="This challenge may have expired or the link is invalid."
        action={(
          <button
            className="h-11 px-5 rounded-xl bg-primary text-white text-sm font-bold"
            onClick={() => navigate(backToChallengesPath)}
          >
            Back to Challenges
          </button>
        )}
      />
    );
  }

  if (isCheckingAccess) {
    return (
      <Screen noPadding noBottomPadding className="st-page bg-slate-50">
        <div className="flex items-center justify-center h-screen">
          <p className="text-sm text-slate-500">Checking access…</p>
        </div>
        <BottomNav active="challenges" />
      </Screen>
    );
  }

  if (!isV2) {
    return (
      <EmptyState
        icon={<Trophy size={32} className="text-primary" />}
        title="This challenge is no longer supported"
        message="This challenge was created on an older version of Tiizi and is no longer available."
        action={(
          <button
            className="h-11 px-5 rounded-xl bg-primary text-white text-sm font-bold"
            onClick={() => navigate(backToChallengesPath)}
          >
            Back to Challenges
          </button>
        )}
      />
    );
  }

  if (!canAccessChallenge && !canPreviewPublicChallenge) {
    return (
      <Screen noPadding noBottomPadding className="st-page bg-slate-50">
        <div className="px-4 pt-4 pb-32">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate(backToChallengesPath)}>
            <ArrowLeft size={24} className="text-slate-900" />
          </button>
          <div className="mt-6 rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <p className="text-base font-black text-slate-900">Join Group First</p>
            <p className="text-sm text-slate-500 mt-2">This challenge is in a private group. Join and get approved to participate.</p>
            <div className="mt-5 space-y-2">
              {resolvedChallenge.groupId && (
                <button
                  className="w-full h-12 rounded-xl bg-primary text-white text-sm font-bold"
                  onClick={() => navigate(`/app/group/${resolvedChallenge.groupId}`)}
                >
                  Go to Group
                </button>
              )}
              <button
                className="w-full h-12 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold"
                onClick={() => navigate(backToChallengesPath)}
              >
                Back to Challenges
              </button>
            </div>
          </div>
        </div>
        <BottomNav active="challenges" />
      </Screen>
    );
  }

  // ── Main screen ──────────────────────────────────────────────────────────
  return (
    <Screen noPadding noBottomPadding className="st-page bg-slate-50">
      <div className="pb-32">

        {/* ── Sticky top bar ───────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 bg-slate-50 px-4 pt-4 pb-3 flex items-center gap-3">
          <button
            className="h-10 w-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm flex-shrink-0"
            onClick={() => navigate(backToChallengesPath)}
          >
            <ArrowLeft size={20} className="text-slate-900" />
          </button>
          <p className="st-section-label flex-1">Challenge Detail</p>
        </div>

        {/* ── Hero card ────────────────────────────────────────────────── */}
        <div className="mx-4">
          <div className="rounded-2xl bg-primary px-5 py-5 relative overflow-hidden">
            {/* Subtle radial glow for depth */}
            <div className="absolute inset-0 opacity-20 pointer-events-none"
              style={{ background: 'radial-gradient(circle at 80% 20%, #fff 0%, transparent 60%)' }} />

            {/* Type + mode chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-full bg-white/25 px-3 py-1 text-[11px] font-bold text-white uppercase tracking-widest">
                {challengeTypeLabel}
              </span>
              <span className="rounded-full bg-white/15 border border-white/30 px-3 py-1 text-[11px] font-bold text-white uppercase tracking-widest">
                {modeLabel}
              </span>
              {resolvedChallenge.challengeType && (
                <LearnMoreLink
                  section={resolvedChallenge.challengeType}
                  label={`How ${resolvedChallenge.challengeType} challenges work`}
                  className="!text-white/75 !text-[11px]"
                />
              )}
            </div>

            {/* Title */}
            <h1 className="mt-3 text-[22px] leading-[27px] font-black text-white tracking-tight">
              {resolvedChallenge.name}
            </h1>

            {/* Description */}
            {resolvedChallenge.description && (
              <p className="mt-1.5 text-[13px] leading-[18px] text-white/80">
                {resolvedChallenge.description}
              </p>
            )}

            {/* Day progress row */}
            {summary?.currentDay != null && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] font-black text-white uppercase tracking-wider">
                    Day {summary.currentDay} of {summary.durationDays}
                  </p>
                  {membership?.status === 'active' && (
                    <p className="text-[11px] font-black text-white/90 uppercase tracking-wider">
                      {summary.completionPct}% Complete
                    </p>
                  )}
                </div>
                <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-500"
                    style={{ width: `${Math.min(100, (summary.currentDay / summary.durationDays) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Calendar size={12} className="text-white/70" />
                <p className="text-[11px] text-white/70">{summary?.startLabel}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar size={12} className="text-white/70" />
                <p className="text-[11px] text-white/70">{summary?.endLabel}</p>
              </div>
            </div>

            {/* Status */}
            <p className="mt-2 text-[12px] font-semibold text-white/90">{summary?.statusLabel}</p>

            {/* Pending approval notice */}
            {requiresApproval && (
              <div className="mt-3 rounded-xl bg-white/15 border border-white/20 px-3 py-2">
                <p className="text-[12px] text-white font-semibold">Awaiting platform review before going live.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Stats row ────────────────────────────────────────────────── */}
        <div className="mx-4 mt-3 grid grid-cols-3 gap-2">
          {[
            { label: 'My Logs', value: progress?.myLogs ?? 0 },
            { label: 'Total Logs', value: progress?.totalLogs ?? 0 },
            { label: 'Participants', value: progress?.uniqueParticipants || resolvedChallenge.participantCount || 0 },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl bg-white border border-slate-100 px-3 py-3 shadow-sm text-center">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider leading-tight">{label}</p>
              <p className="mt-1 text-[20px] leading-[24px] font-black text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        {/* ── Group link ───────────────────────────────────────────────── */}
        {!!normalizedGroupId ? (
          <div className="mx-4 mt-3">
            <button
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 active:opacity-70"
              onClick={() => navigate(`/app/group/${normalizedGroupId}`)}
            >
              <Users size={13} className="text-primary flex-shrink-0" />
              <span className="text-[12px] font-bold text-primary leading-none">
                View Group: {challengeGroup?.name ?? 'Group Challenge'}
              </span>
            </button>
          </div>
        ) : null}

        {/* ── Engine-aware target + rules section ──────────────────────── */}

        {/* v2 Collective: Team Progress */}
        {isV2 && resolvedChallenge.challengeType === 'collective' && (
          <div className="mx-4 mt-4">
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users size={14} className="text-primary" />
                <p className="st-section-label">Team Progress</p>
              </div>
              {(() => {
                const rp = resolveChallengeProgress({
                  challenge: resolvedChallenge,
                  membership: membership ?? null,
                  currentUserId: user?.uid,
                  memberSumContribution: leaderboardMemberSum,
                  activitySummaryTotal: challengeSummary?.totalValue,
                });
                const unit = rp.unit;
                return (
                  <>
                    <p className="text-[22px] font-black text-slate-900">
                      {rp.groupTotal.toLocaleString()} / {rp.groupTarget.toLocaleString()}
                      {unit ? <span className="text-[15px] font-semibold text-slate-500"> {unit}</span> : null}
                    </p>
                    <div className="mt-2">
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span>{rp.groupPercent}%</span>
                        <span>{rp.groupRemaining.toLocaleString()} remaining</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(rp.groupPercent, 100)}%` }} />
                      </div>
                    </div>
                    {membership && rp.userContributionTotal > 0 && (
                      <p className="mt-2 text-[13px] text-slate-600">
                        You contributed <span className="font-bold text-primary">{rp.userContributionTotal.toLocaleString()}{unit ? ` ${unit}` : ''}</span>
                      </p>
                    )}
                    <p className="mt-2 text-[12px] text-slate-400">Challenge completes when the group reaches the target or the end date arrives. Rankings are based on each member's contribution.</p>
                    {resolvedChallenge.activities && resolvedChallenge.activities.length > 0 && (
                      <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                        {resolvedChallenge.activities.map((act, idx) => (
                          <div key={idx} className="flex justify-between">
                            <p className="text-[13px] text-slate-700">{act.exerciseName ?? act.activityId ?? `Activity ${idx + 1}`}</p>
                            <p className="text-[13px] font-bold text-primary">{targetLabel(act)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* v2 Competitive: Personal Target + Leader Comparison */}
        {isV2 && resolvedChallenge.challengeType === 'competitive' && (
          <div className="mx-4 mt-4">
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={14} className="text-primary" />
                <p className="st-section-label">Personal Target</p>
              </div>
              {resolvedChallenge.activities && resolvedChallenge.activities.length > 0 && (
                <div className="space-y-2">
                  {resolvedChallenge.activities.map((act, idx) => (
                    <div key={idx} className="flex justify-between">
                      <p className="text-[13px] text-slate-700">{act.exerciseName ?? act.activityId ?? `Activity ${idx + 1}`}</p>
                      <p className="text-[13px] font-bold text-primary">{targetLabel(act)}</p>
                    </div>
                  ))}
                </div>
              )}
              {/* Leader comparison — derived from leaderboard snapshot already loaded */}
              {leaderboard.length > 0 && membership && (() => {
                const rp = resolveChallengeProgress({
                  challenge: resolvedChallenge,
                  membership,
                  leaderboard,
                  currentUserId: user?.uid,
                });
                const totalTarget = (resolvedChallenge.activities ?? []).reduce((s, a) => s + safeNum(a.targetValue), 0);
                return (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    {rp.isCurrentUserLeading ? (
                      <p className="text-[13px] font-bold text-primary">You are leading 🏆</p>
                    ) : (
                      <>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Leader</p>
                        <p className="text-[13px] font-bold text-slate-800">
                          {rp.competitiveLeaderTotal.toLocaleString()}{totalTarget > 0 ? ` / ${totalTarget.toLocaleString()}` : ''}{rp.unit ? ` ${rp.unit}` : ''}
                        </p>
                        {rp.competitiveGap > 0 && (
                          <p className="text-[12px] text-slate-500 mt-0.5">{rp.competitiveGap.toLocaleString()}{rp.unit ? ` ${rp.unit}` : ''} behind leader</p>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}
              <p className="mt-3 text-[13px] text-slate-600">Each member works toward their own target.</p>
              <p className="mt-1 text-[12px] text-slate-400">Race to hit your targets first. Rankings are based on total progress logged, then points.</p>
            </div>
          </div>
        )}

        {/* v2 Streak: Streak Goal */}
        {isV2 && resolvedChallenge.challengeType === 'streak' && (
          <div className="mx-4 mt-4">
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Flame size={14} className="text-primary" />
                <p className="st-section-label">Streak Challenge</p>
              </div>

              {/* Required streak */}
              <div className="flex items-baseline gap-2">
                <p className="text-[22px] font-black text-slate-900">
                  {resolvedChallenge.requiredConsecutiveDays ?? summary?.durationDays ?? '?'}
                </p>
                <p className="text-[14px] font-semibold text-slate-500">days in a row required</p>
              </div>

              {/* Member streak progress */}
              {membership && (membership.currentStreak != null || membership.longestStreak != null) && (
                <div className="mt-3 flex gap-6">
                  {membership.currentStreak != null && (
                    <div>
                      <p className="text-[20px] font-black text-primary">{membership.currentStreak}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Current Streak</p>
                    </div>
                  )}
                  {membership.longestStreak != null && (
                    <div>
                      <p className="text-[20px] font-black text-slate-700">{membership.longestStreak}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Best Streak</p>
                    </div>
                  )}
                </div>
              )}

              <p className="mt-3 text-[13px] text-slate-600">Log the required activity every day to keep your streak alive. Missing a day may reset your streak.</p>

              {/* Daily targets per activity */}
              {resolvedChallenge.activities && resolvedChallenge.activities.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Daily targets</p>
                  <div className="space-y-1">
                    {resolvedChallenge.activities.map((act, idx) => (
                      <div key={idx} className="flex justify-between">
                        <p className="text-[13px] text-slate-700">{act.exerciseName ?? act.activityId ?? `Activity ${idx + 1}`}</p>
                        <p className="text-[13px] font-bold text-primary">
                          {act.targetValue != null
                            ? `${act.targetValue.toLocaleString()} ${act.unit ?? ''} / day`.trim()
                            : targetLabel(act)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Fitness + Cause section ──────────────────────────────────── */}
        {resolvedChallenge.donation?.enabled && (() => {
          const donationApproved = resolvedChallenge.donation?.approvalStatus === 'approved';
          const isCreator = resolvedChallenge.createdBy === user?.uid;
          const causeCurrency = resolvedChallenge.donation?.currency ?? 'RWF';
          const adminCampaignStatus = (resolvedChallenge.donation as Record<string, unknown> | undefined)?.campaignStatus as string | undefined;
          const timingEndDate = resolvedChallenge.donation?.contributionEndDate ?? '';
          const isExpired = !!timingEndDate && timingEndDate < new Date().toISOString().slice(0, 10);
          const campaignSuspended = adminCampaignStatus === 'paused' || adminCampaignStatus === 'suspended' || isExpired;
          const causeTarget = resolvedChallenge.donation?.targetAmountKes ?? 0;
          const causeName = resolvedChallenge.donation?.causeName || 'this cause';
          const phone = resolvedChallenge.donation?.contributionPhoneNumber ?? null;

          const CAUSE_PRESETS: Record<string, number[]> = {
            KES: [100, 250, 500, 1000],
            RWF: [1000, 2500, 5000, 10000],
            UGX: [3000, 7000, 15000, 30000],
          };
          const presets = CAUSE_PRESETS[causeCurrency] ?? CAUSE_PRESETS.KES;

          const pledgeAmount = pledgeCustom.trim()
            ? Math.round(Number(pledgeCustom))
            : (pledgePreset ?? presets[0]);

          const hasConfirmedContribution = myContributions.some((c) => c.status === 'confirmed');
          const remaining = causeTarget > 0 ? Math.max(0, causeTarget - totalRaised) : null;

          const startPledgeFlow = () => {
            setPledgePreset(presets[0]);
            setPledgeCustom('');
            setPledgeStep('selecting_amount');
          };

          const submitPledge = async () => {
            if (!normalizedGroupId) return;
            if (!Number.isFinite(pledgeAmount) || pledgeAmount < 1) {
              showToast('Enter an amount greater than 0.', 'error');
              return;
            }
            try {
              const record = await createContribution.mutateAsync({
                challengeId: resolvedChallenge.id,
                groupId: normalizedGroupId,
                pledgedAmount: pledgeAmount,
                currency: causeCurrency,
                causeName,
                timingStartDate: resolvedChallenge.donation?.contributionStartDate,
                timingEndDate: resolvedChallenge.donation?.contributionEndDate,
                paymentPhoneNumber: phone ?? undefined,
                status: 'pledged',
              });
              setActivePledgeId(record.id);
              setPledgeStep('payment_instructions');
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Could not save pledge.', 'error');
            }
          };

          const markSent = async () => {
            if (!activePledgeId) return;
            try {
              await confirmContribution.mutateAsync({
                pledgeId: activePledgeId,
                challengeId: resolvedChallenge.id,
              });
              setPledgeStep('confirmed');
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'Could not record confirmation.', 'error');
            }
          };

          return (
            <div className="mx-4 mt-3">
              <div className="rounded-2xl bg-white border border-amber-200 shadow-sm px-4 py-4">
                <p className="st-section-label text-amber-700">Fitness + Cause</p>
                <p className="mt-2 text-[14px] font-bold text-slate-800">
                  {resolvedChallenge.donation.causeName || 'Cause challenge'}
                </p>
                {resolvedChallenge.donation.causeDescription && (
                  <p className="mt-1 text-[13px] text-slate-600">{resolvedChallenge.donation.causeDescription}</p>
                )}
                {causeTarget > 0 && (
                  <div className="mt-2 space-y-0.5">
                    <p className="text-[12px] text-slate-500">
                      Cause target: {causeCurrency} {causeTarget.toLocaleString()} total
                    </p>
                    {totalRaised > 0 && (
                      <>
                        <p className="text-[12px] text-slate-500">
                          Raised so far: {causeCurrency} {totalRaised.toLocaleString()}
                        </p>
                        {remaining !== null && (
                          <p className="text-[12px] text-slate-500">
                            Remaining: {causeCurrency} {remaining.toLocaleString()}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
                {(resolvedChallenge.donation.contributionStartDate || resolvedChallenge.donation.contributionEndDate) && (
                  <p className="mt-1 text-[12px] text-slate-500">
                    Window: {resolvedChallenge.donation.contributionStartDate || 'N/A'} → {resolvedChallenge.donation.contributionEndDate || 'N/A'}
                  </p>
                )}

                {/* Payment details — only shown when donation is approved */}
                {donationApproved ? (
                  <>
                    <p className="mt-2 text-[11px] text-slate-400">
                      {resolvedChallenge.donation.disclaimer || 'Tiizi does not hold or manage funds. Contributions are coordinated by the group.'}
                    </p>
                    <div className="mt-1">
                      <LearnMoreLink section="donations" label="Learn about cause challenges" />
                    </div>

                    {/* ── STEP: idle / contribute again ── */}
                    {(pledgeStep === 'idle') && (
                      <div className="mt-3">
                        {hasConfirmedContribution && (
                          <p className="text-[13px] text-slate-600 mb-2">You have supported this cause.</p>
                        )}
                        {campaignSuspended ? (
                          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-500">
                            Support for this cause is temporarily unavailable.
                          </p>
                        ) : (
                          <button
                            className="w-full h-10 rounded-xl bg-primary text-white text-[13px] font-bold"
                            onClick={startPledgeFlow}
                          >
                            {hasConfirmedContribution ? 'Contribute Again' : 'Support this Cause'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* ── STEP: amount selection ── */}
                    {pledgeStep === 'selecting_amount' && (
                      <div className="mt-3 space-y-3">
                        <p className="text-[13px] font-bold text-slate-800">
                          Support {causeName}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {presets.map((v) => (
                            <button
                              key={v}
                              className={`h-10 rounded-xl text-[13px] font-bold ${!pledgeCustom && pledgePreset === v ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}
                              onClick={() => { setPledgePreset(v); setPledgeCustom(''); }}
                            >
                              {causeCurrency} {v.toLocaleString()}
                            </button>
                          ))}
                        </div>
                        <div>
                          <p className="text-[12px] uppercase font-bold text-slate-500 tracking-wide">Custom amount ({causeCurrency})</p>
                          <input
                            className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-[14px] font-semibold text-slate-800"
                            type="number"
                            min={1}
                            placeholder={`Enter amount`}
                            value={pledgeCustom}
                            onChange={(e) => setPledgeCustom(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="flex-1 h-10 rounded-xl bg-slate-100 text-slate-600 text-[13px] font-semibold"
                            onClick={() => setPledgeStep('idle')}
                          >
                            Cancel
                          </button>
                          <button
                            className="flex-1 h-10 rounded-xl bg-primary text-white text-[13px] font-bold disabled:opacity-60"
                            disabled={createContribution.isPending}
                            onClick={submitPledge}
                          >
                            {createContribution.isPending ? 'Saving…' : 'Continue'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── STEP: payment instructions ── */}
                    {pledgeStep === 'payment_instructions' && (
                      <div className="mt-3 rounded-xl border border-primary/20 bg-[#fff4eb] p-3 space-y-2">
                        <p className="text-[13px] font-bold text-slate-800">
                          Your pledge: {causeCurrency} {pledgeAmount.toLocaleString()}
                        </p>
                        {phone ? (
                          <>
                            <p className="text-[13px] text-slate-700">Send your contribution to:</p>
                            <a
                              href={`tel:${phone}`}
                              className="inline-flex items-center h-10 rounded-xl bg-primary/10 px-4 text-[15px] font-black text-primary"
                            >
                              {phone}
                            </a>
                          </>
                        ) : (
                          <p className="text-[13px] text-slate-500">Payment details will be shared by the group organiser.</p>
                        )}
                        <p className="text-[13px] font-semibold text-slate-800">
                          After sending, confirm below.
                        </p>
                        <button
                          className="w-full h-10 rounded-xl bg-primary text-white text-[13px] font-bold disabled:opacity-60"
                          disabled={confirmContribution.isPending}
                          onClick={markSent}
                        >
                          {confirmContribution.isPending ? 'Saving…' : "I've Sent My Contribution"}
                        </button>
                      </div>
                    )}

                    {/* ── STEP: confirmed ── */}
                    {pledgeStep === 'confirmed' && (
                      <div className="mt-3 space-y-2">
                        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">
                          Contribution marked as sent. Thank you for supporting this cause.
                        </p>
                        <button
                          className="w-full h-10 rounded-xl bg-slate-100 text-slate-700 text-[13px] font-semibold"
                          onClick={() => { setPledgeStep('idle'); }}
                        >
                          Contribute Again
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  /* Unapproved — show pending notice only to creator */
                  isCreator ? (
                    <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-[18px] text-amber-800">
                      Donation details are awaiting admin approval and are not yet visible to participants.
                    </p>
                  ) : null
                )}
              </div>
            </div>
          );
        })()}

        {/* ── Leaderboard snapshot (non-streak) / Personal stats (streak) ── */}
        {isV2 && resolvedChallenge.challengeType === 'streak' ? (
          <div className="mx-4 mt-3">
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 pt-4 pb-3">
                <Flame size={14} className="text-primary" />
                <p className="st-section-label">My Streak Progress</p>
              </div>
              {membership ? (
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl bg-slate-50 px-3 py-3">
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider leading-tight">Days Completed</p>
                      <p className="mt-1 text-[20px] leading-[24px] font-black text-slate-900">
                        {membership.activitiesCompleted ?? 0}{summary?.durationDays ? <span className="text-[13px] font-semibold text-slate-400">/{summary.durationDays}</span> : null}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-3">
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider leading-tight">Best Streak</p>
                      <p className="mt-1 text-[20px] leading-[24px] font-black text-slate-700">{membership.longestStreak ?? 0}</p>
                    </div>
                    <div className="rounded-xl bg-primary/5 px-3 py-3">
                      <p className="text-[10px] uppercase font-bold text-primary tracking-wider leading-tight">Current Streak</p>
                      <p className="mt-1 text-[20px] leading-[24px] font-black text-primary">{membership.currentStreak ?? 0}🔥</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="px-4 pb-4 text-[13px] text-slate-400">Join the challenge to track your streak.</p>
              )}
            </div>
          </div>
        ) : (
        <div className="mx-4 mt-3">
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Trophy size={14} className="text-primary" />
                <p className="st-section-label">Leaderboard</p>
              </div>
              {/* Challenge leaderboard route exists at /app/challenges/leaderboard?challengeId= */}
              <button
                className="flex items-center gap-1 text-[12px] font-bold text-primary"
                onClick={() => navigate(`/app/challenges/leaderboard?challengeId=${resolvedChallenge.id}${normalizedGroupId ? `&groupId=${normalizedGroupId}` : ''}`)}
              >
                View All <ChevronRight size={14} />
              </button>
            </div>
            {leaderboard.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {leaderboard.map((entry) => (
                  <div key={`${entry.userId}-${entry.rank}`}
                    className="flex items-center gap-3 px-4 py-2.5">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-black flex-shrink-0 ${
                      entry.rank === 1 ? 'bg-primary text-white' :
                      entry.rank === 2 ? 'bg-slate-200 text-slate-700' :
                      entry.rank === 3 ? 'bg-orange-100 text-orange-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {entry.rank}
                    </span>
                    <div className="h-8 w-8 rounded-full bg-slate-200 flex-shrink-0" />
                    <p className="flex-1 text-[13px] font-semibold text-slate-700 truncate">
                      {entry.userId === user?.uid
                        ? `You (${leaderboardNames.get(entry.userId) ?? 'Me'})`
                        : (leaderboardNames.get(entry.userId) ?? `Member ${entry.userId.slice(0, 6).toUpperCase()}`)}
                    </p>
                    <p className="text-[14px] font-black text-slate-900">
                      {entry.score}{entry.scoreLabel ? <span className="text-[11px] font-normal text-slate-400"> {entry.scoreLabel}</span> : null}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-4 pb-4 text-[13px] text-slate-400">No activity logged yet. Be the first!</p>
            )}
          </div>
        </div>
        )}

        {/* ── CTA area ─────────────────────────────────────────────────── */}
        <div className="mx-4 mt-5 space-y-2">
          {membership?.status === 'completed' ? (
            <div className="w-full rounded-2xl border border-green-200 bg-green-50 px-4 py-4 text-center">
              <p className="text-[15px] font-black text-green-700">🎉 Challenge Completed</p>
              <p className="mt-1 text-[12px] text-green-600">Great work! Your effort earned {membership.totalPoints ?? 0} pts.</p>
            </div>
          ) : challengeIsOver ? (
            <div className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-4 text-center">
              <p className="text-[15px] font-bold text-slate-500">This challenge has ended.</p>
            </div>
          ) : !membership || membership.status !== 'active' ? (
            <button
              className="w-full h-12 rounded-2xl bg-primary text-white text-[15px] font-black disabled:opacity-60 transition-opacity"
              disabled={joinChallenge.isPending || requiresApproval}
              onClick={async () => {
                if (requiresApproval) return;
                if (canPreviewPublicChallenge && normalizedGroupId) {
                  navigate(`/app/group/${normalizedGroupId}`);
                  return;
                }
                try {
                  await joinChallenge.mutateAsync(resolvedChallenge.id);
                  showToast('Joined challenge.', 'success');
                } catch (error) {
                  console.warn('[JoinChallenge] failed:', error);
                  showToast(error instanceof Error ? error.message : 'Could not join challenge.', 'error');
                }
              }}
            >
              {requiresApproval
                ? 'Awaiting Approval'
                : canPreviewPublicChallenge ? 'Join Group to Participate'
                : joinChallenge.isPending ? 'Joining…'
                : 'Join Challenge'}
            </button>
          ) : requiresApproval ? (
            <button className="w-full h-12 rounded-2xl bg-slate-200 text-slate-500 text-[15px] font-bold" disabled>
              Awaiting Approval
            </button>
          ) : canLogWorkout ? (
            <button
              className="w-full h-12 rounded-2xl bg-primary text-white text-[15px] font-black transition-opacity active:opacity-80"
              onClick={() => navigate(`/app/workouts/select-activity?challengeId=${resolvedChallenge.id}${normalizedGroupId ? `&groupId=${normalizedGroupId}` : ''}`)}
            >
              {isWellnessChallenge ? 'Log Activity' : 'Log Workout'}
            </button>
          ) : (
            <button
              className="w-full h-12 rounded-2xl bg-primary text-white text-[15px] font-black disabled:opacity-60"
              disabled={createReminder.isPending}
              onClick={async () => {
                try {
                  await createReminder.mutateAsync({
                    challengeId: resolvedChallenge.id,
                    challengeName: resolvedChallenge.name,
                    startDate: resolvedChallenge.startDate,
                    groupId: normalizedGroupId,
                  });
                  showToast(`Reminder set for ${summary?.startLabel}.`, 'success');
                } catch (error) {
                  showToast(error instanceof Error ? error.message : 'Could not set reminder.', 'error');
                }
              }}
            >
              {createReminder.isPending ? 'Saving…' : 'Remind Me'}
            </button>
          )}

          {/* Leave — only for active members with no logs, on ongoing challenge */}
          {!!membership && membership.status === 'active' && !challengeIsOver && (progress?.myLogs ?? 0) === 0 && (
            <button
              className="w-full h-12 rounded-2xl border border-red-200 bg-red-50 text-red-600 text-[14px] font-bold disabled:opacity-60"
              disabled={leaveChallenge.isPending}
              onClick={async () => {
                try {
                  await leaveChallenge.mutateAsync(resolvedChallenge.id);
                  showToast('You left this challenge.', 'success');
                  navigate(backToChallengesPath);
                } catch (error) {
                  showToast(error instanceof Error ? error.message : 'Could not leave challenge.', 'error');
                }
              }}
            >
              {leaveChallenge.isPending ? 'Leaving…' : 'Leave Challenge'}
            </button>
          )}

          {/* Navigation secondaries */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              className="h-11 rounded-xl bg-white border border-slate-200 text-slate-700 text-[13px] font-bold"
              onClick={() => navigate(backToChallengesPath)}
            >
              ← Challenges
            </button>
            {!!normalizedGroupId && (
              <button
                className="h-11 rounded-xl bg-white border border-slate-200 text-slate-700 text-[13px] font-bold"
                onClick={() => navigate(`/app/group/${normalizedGroupId}`)}
              >
                ← Group
              </button>
            )}
          </div>
        </div>

      </div>
      <BottomNav active="challenges" />
    </Screen>
  );
}

export default ChallengeDetailScreen;
