import { ArrowLeft, CheckCircle2, Circle, Clock3, Dumbbell, Flame, Info, Trophy, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';
import { BottomNav, Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { useChallenge, useChallengeMembership } from '../../hooks/useChallenges';
import { useExercises } from '../../hooks/useExercises';
import { useLogWellnessActivity, useLogWorkout } from '../../hooks/useWorkouts';
import { db } from '../../lib/firebase';
import { buildActivitySuccessPath, parseLoggedActivityIndexes, resolveWellnessActivityType } from '../../services/challengeActivityFlow';
import { computeActivityScore, type ChallengeType } from '../../services/scoringConfig';
import { sortLeaderboardRows } from '../../utils/leaderboardSort';
import { resolveChallengeProgress } from '../Challenges/challengeProgressResolver';

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function SelectChallengeActivityScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const challengeId = params.get('challengeId') ?? undefined;
  const groupId = params.get('groupId') ?? undefined;
  const { data: challenge } = useChallenge(challengeId);
  const { data: membership } = useChallengeMembership(challengeId);
  const { data: exercises = [] } = useExercises();
  const { user } = useAuth();
  const { showToast } = useToast();
  const logWorkout = useLogWorkout();
  const logWellness = useLogWellnessActivity();
  const [checklistValues, setChecklistValues] = useState<Record<number, number>>({});
  const [isChecklistSubmitting, setIsChecklistSubmitting] = useState(false);

  const engineVersion = challenge?.engineVersion;
  const challengeType = challenge?.challengeType ?? 'collective';
  const isV2 = engineVersion === 'v2';

  // ── Leaderboard snapshot — identical queryKey to ChallengeDetailScreen so TanStack cache is shared ──
  const { data: leaderboardData = { entries: [], memberSumContribution: 0 } } = useQuery({
    queryKey: ['challenge-leaderboard-snapshot', challenge?.id, challenge?.engineVersion, challenge?.challengeType],
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(db, 'challengeMembers'), where('challengeId', '==', challenge!.id)),
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
      const memberSumContribution = rows.reduce((s, r) => s + r.cumulativeLoggedValue, 0);
      const sorted = sortLeaderboardRows(rows, challenge!.engineVersion, challenge!.challengeType);
      const ct = challenge!.challengeType;
      const entries = sorted.slice(0, 5).map((entry, index) => {
        let score: number;
        let scoreLabel: string;
        if (ct === 'streak') {
          score = entry.currentStreak;
          scoreLabel = score === 1 ? 'day streak' : 'days';
        } else if (ct === 'competitive') {
          const totalTarget = (challenge!.activities ?? []).reduce((s, a) => s + (a.targetValue ?? 0), 0);
          const activityUnit = challenge!.activities?.[0]?.unit ?? '';
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
    enabled: !!challenge?.id,
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

  const activities = useMemo(() => {
    if (challenge?.activities && challenge.activities.length > 0) return challenge.activities;
    if (challenge?.exerciseIds && challenge.exerciseIds.length > 0) {
      return challenge.exerciseIds.map((exerciseId) => {
        const match = exercises.find((item) => item.id === exerciseId);
        return {
          exerciseId,
          exerciseName: match?.name ?? 'Activity',
          targetValue: 0,
          unit: match?.metric.unit ?? 'Reps',
        };
      });
    }
    return [];
  }, [challenge?.activities, challenge?.exerciseIds, exercises]);

  const displayName = challenge?.name || 'Challenge';
  const challengeStartsAt = challenge?.startDate ? new Date(challenge.startDate) : null;
  const challengeEndsAt = challenge?.endDate ? new Date(challenge.endDate) : null;
  const now = new Date();
  const isBeforeStart = !!challengeStartsAt && now < challengeStartsAt;
  const isAfterEnd = !!challengeEndsAt && now > challengeEndsAt;
  const isChallengeActiveNow = !isBeforeStart && !isAfterEnd;
  const backPath = challengeId
    ? `/app/challenges/${challengeType}?challengeId=${challengeId}${groupId ? `&groupId=${groupId}` : ''}`
    : '/app/challenges';

  const loggedActivityIndexes = parseLoggedActivityIndexes(params.get('loggedActivityIndexes'));
  const allLogged = activities.length > 0 && loggedActivityIndexes.length >= activities.length;

  // Multi-activity streak mode: show inline checklist instead of sequential per-activity navigation.
  const isMultiStreakMode = challengeType === 'streak' && activities.length > 1;
  const allChecklistValuesValid = isMultiStreakMode && activities.every((_, idx) => (checklistValues[idx] ?? 0) > 0);

  const handleChecklistSubmit = async () => {
    if (!user?.uid || !challengeId || !groupId) {
      showToast('Missing challenge context.', 'error');
      return;
    }
    const now = new Date();
    const startAt = challenge?.startDate ? new Date(challenge.startDate) : null;
    const endAt = challenge?.endDate ? new Date(challenge.endDate) : null;
    if (startAt && now < startAt) { showToast(`Challenge starts on ${startAt.toLocaleDateString()}.`, 'error'); return; }
    if (endAt && now > endAt) { showToast('Challenge has ended.', 'error'); return; }

    // MVP limitation: activities are logged sequentially. If activity N succeeds but N+1 fails,
    // the streak day is partially written in Firestore. The user sees an error toast and is NOT
    // navigated to the success screen, so they know to retry. The streak engine's same-day
    // idempotency guard (prevLastLogDate === today → no increment) prevents double-counting on retry.
    setIsChecklistSubmitting(true);
    try {
      for (let i = 0; i < activities.length; i++) {
        const activity = activities[i];
        const value = checklistValues[i] ?? 0;
        const match = exercises.find((item) => item.id === activity.exerciseId || item.name.toLowerCase() === (activity.exerciseName || '').toLowerCase());
        const activityId = 'activityId' in activity ? activity.activityId : undefined;
        const activityType = 'activityType' in activity ? activity.activityType : undefined;
        const resolvedExerciseId = match?.id || activity.exerciseId || activityId || 'wellness-activity';
        const isWellness = (challenge?.category && challenge.category !== 'fitness') || !!activityType || resolvedExerciseId.startsWith('wellness:');
        if (isWellness) {
          await logWellness.mutateAsync({
            userId: user.uid,
            challengeId,
            groupId,
            activityId: activityId || resolvedExerciseId,
            activityType: resolveWellnessActivityType(activityType?.toLowerCase(), activity.exerciseName ?? '', challenge?.category),
            value,
            unit: activity.unit,
          });
        } else {
          await logWorkout.mutateAsync({
            userId: user.uid,
            challengeId,
            exerciseId: resolvedExerciseId,
            value,
            unit: activity.unit,
            groupId,
          });
        }
      }
      navigate(buildActivitySuccessPath({
        challengeId,
        groupId,
        source: 'workout',
        activityName: challenge?.name ?? 'Challenge',
        value: activities.length,
        unit: 'activities',
        targetValue: activities.length,
        points: 0,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to log activities.';
      showToast(message, 'error');
    } finally {
      setIsChecklistSubmitting(false);
    }
  };

  const today = todayDateString();
  const loggedToday = membership?.lastLogDate === today;

  // --- Engine-specific data — from canonical resolver (same inputs as ChallengeDetailScreen) ---
  const _rp = resolveChallengeProgress({
    challenge: challenge ?? null,
    membership: membership ?? null,
    leaderboard,
    memberSumContribution: leaderboardMemberSum,
    currentUserId: user?.uid,
  });
  const groupCurrentTotal = _rp.groupTotal;
  const groupCumulativeTarget = _rp.groupTarget;
  const groupPct = _rp.groupPercent;

  const currentStreak = _rp.streakCurrentDays;
  const longestStreak = membership?.longestStreak ?? 0;
  const requiredDays = _rp.streakTargetDays;
  const daysRemaining = requiredDays > 0 ? Math.max(0, requiredDays - currentStreak) : null;

  const handleSessionComplete = () => {
    if (!challengeId) return;
    const totals = activities.reduce(
      (acc, activity, idx) => {
        if (loggedActivityIndexes.includes(idx)) {
          const targetValue = activity.targetValue ?? 0;
          const scoring = computeActivityScore({
            value: targetValue,
            targetValue,
            challengeType: (challengeType ?? 'collective') as ChallengeType,
          });
          acc.points += scoring.pointsEarned;
        }
        return acc;
      },
      { points: 0 },
    );
    const firstActivity = activities[0];
    const targetValue = firstActivity?.targetValue ?? 0;
    navigate(buildActivitySuccessPath({
      challengeId,
      groupId,
      source: 'workout',
      activityName: challenge?.name ?? 'Challenge',
      value: loggedActivityIndexes.length,
      unit: 'activities',
      targetValue,
      points: totals.points,
    }));
  };

  const handleLog = (
    exerciseId: string,
    unit: string,
    exerciseName: string,
    disabled?: boolean,
    activityId?: string,
    activityType?: string,
  ) => {
    if (disabled) return;
    const qs = new URLSearchParams();
    if (challengeId) qs.set('challengeId', challengeId);
    if (groupId) qs.set('groupId', groupId);
    const normalizedType = String(activityType ?? '').toLowerCase();
    const isWellness = (challenge?.category && challenge.category !== 'fitness') || !!activityType || exerciseId.startsWith('wellness:');
    if (isWellness) {
      qs.set('activityId', activityId || exerciseId);
      qs.set('activityType', resolveWellnessActivityType(normalizedType || undefined, exerciseName, challenge?.category));
      qs.set('activityName', exerciseName);
      qs.set('unit', unit);
      qs.set('targetValue', String(
        activities.find((item) => (('activityId' in item && item.activityId && item.activityId === activityId) || item.exerciseId === exerciseId))?.targetValue ?? 1,
      ));
      navigate(`/app/workouts/log-wellness?${qs.toString()}`);
      return;
    }
    qs.set('exerciseId', exerciseId);
    qs.set('unit', unit);
    qs.set('exerciseName', exerciseName);
    navigate(`/app/workouts/log?${qs.toString()}`);
  };

  const subtitle = (unit: string, activityType?: string) => {
    const normalizedUnit = unit.toLowerCase();
    const normalizedType = String(activityType ?? '').toLowerCase();

    if (
      normalizedType === 'fasting'
      || normalizedType === 'sleep'
      || normalizedType === 'meditation'
      || normalizedUnit === 'seconds'
      || normalizedUnit === 'minutes'
      || normalizedUnit === 'hours'
    ) {
      return 'Time-based activity';
    }
    if (
      normalizedType === 'water'
      || normalizedUnit === 'milliliters'
      || normalizedUnit === 'ml'
      || normalizedUnit === 'liters'
      || normalizedUnit === 'l'
    ) {
      return 'Volume-based activity';
    }
    if (normalizedUnit === 'reps') return 'Reps-based activity';
    if (normalizedUnit === 'km' || normalizedUnit === 'miles' || normalizedUnit === 'meters' || normalizedUnit === 'm') {
      return 'Distance-based activity';
    }
    return 'Count-based activity';
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[108px]">
        <div className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 pb-3">
          <header className="st-form-max h-12 flex items-center gap-3">
            <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate(backPath)}>
              <ArrowLeft size={28} className="text-slate-900" />
            </button>
            <h1 className="text-[24px] leading-[30px] tracking-[-0.01em] font-black text-slate-900">Select Activity</h1>
          </header>
        </div>

        <section className="st-form-max mt-5 rounded-none border-y border-[#e7d7ca] bg-[#faf5f1] -mx-5 px-5 py-6">
          <p className="text-[12px] leading-[14px] tracking-[0.12em] uppercase font-black text-primary">Current Challenge</p>
          <p className="mt-2 text-[24px] leading-[30px] tracking-[-0.01em] font-black text-[#18110d]">{displayName}</p>
          <p className="mt-1 text-[16px] leading-[22px] font-medium text-[#5f5a55]">
            {isV2 && challengeType === 'collective' && 'Contribute to the team\'s goal.'}
            {isV2 && challengeType === 'competitive' && 'My race toward completion.'}
            {isV2 && challengeType === 'streak' && 'Keep the streak alive.'}
            {!isV2 && 'Pick an activity to log your progress'}
          </p>
          {!isChallengeActiveNow && (
            <p className="mt-2 text-[14px] leading-[20px] font-semibold text-primary">
              {isBeforeStart
                ? `Challenge starts on ${challengeStartsAt?.toLocaleDateString()}. Logging opens then.`
                : 'Challenge has ended. Logging is closed.'}
            </p>
          )}
        </section>

        {/* Engine context panel */}
        {isV2 && isChallengeActiveNow && (
          <section className="st-form-max mt-4">
            {/* Collective progress */}
            {challengeType === 'collective' && groupCumulativeTarget > 0 && (
              <div className="st-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users size={16} className="text-primary" />
                  <p className="text-[13px] leading-[16px] font-bold text-primary uppercase tracking-[0.08em]">Team Progress</p>
                </div>
                <div className="h-4 rounded-full bg-[#e8edf5] overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${groupPct}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-[13px] leading-[16px] text-slate-700">
                    {groupCurrentTotal.toLocaleString()} / {groupCumulativeTarget.toLocaleString()}
                  </p>
                  <p className="text-[15px] font-black text-primary">{groupPct}%</p>
                </div>
                <p className="mt-1 text-[12px] text-slate-500">Every contribution moves the team closer.</p>
                {_rp.secondaryLabel && (
                  <p className="mt-1 text-[12px] text-slate-500">{_rp.secondaryLabel}</p>
                )}
              </div>
            )}

            {/* Competitive overall progress */}
            {challengeType === 'competitive' && (
              <div className="st-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy size={16} className="text-primary" />
                  <p className="text-[13px] leading-[16px] font-bold text-primary uppercase tracking-[0.08em]">My Progress</p>
                </div>
                <div className="h-2.5 rounded-full bg-[#e8edf5] overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${_rp.progressPercent}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-[13px] leading-[16px] text-slate-700">{_rp.primaryLabel}</p>
                  <p className="text-[15px] font-black text-primary">{_rp.progressPercent}%</p>
                </div>
                {_rp.secondaryLabel && (
                  <p className="mt-1 text-[12px] text-slate-500">{_rp.secondaryLabel}</p>
                )}
              </div>
            )}

            {/* Streak progress */}
            {challengeType === 'streak' && (
              <div className="st-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Flame size={16} className="text-primary" />
                  <p className="text-[13px] leading-[16px] font-bold text-primary uppercase tracking-[0.08em]">Streak Status</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-[#fff3e8] py-2.5">
                    <p className="text-[20px] font-black text-primary">{currentStreak}</p>
                    <p className="text-[10px] uppercase tracking-[0.08em] font-bold text-slate-500 mt-0.5">Current</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 py-2.5">
                    <p className="text-[20px] font-black text-slate-800">{longestStreak}</p>
                    <p className="text-[10px] uppercase tracking-[0.08em] font-bold text-slate-500 mt-0.5">Best</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 py-2.5">
                    <p className="text-[20px] font-black text-slate-800">{daysRemaining ?? '—'}</p>
                    <p className="text-[10px] uppercase tracking-[0.08em] font-bold text-slate-500 mt-0.5">To Go</p>
                  </div>
                </div>
                {requiredDays > 0 && (
                  <div className="mt-2">
                    <div className="h-2.5 rounded-full bg-[#e8edf5] overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.round((currentStreak / requiredDays) * 100))}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Day {currentStreak} of {requiredDays} · {challenge?.streakResetOnMiss ? 'Resets on miss' : 'Pauses on miss'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Already logged today banner */}
            {loggedToday && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
                <Info size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[13px] leading-[18px] font-semibold text-amber-800">You've already logged today.</p>
                  <p className="text-[12px] leading-[16px] text-amber-700 mt-0.5">
                    Additional sessions improve your totals.
                    {challengeType === 'streak' && ' They won\'t advance your streak.'}
                  </p>
                </div>
              </div>
            )}

            {/* Compact leaderboard — same data source as ChallengeDetailScreen */}
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Trophy size={14} className="text-primary" />
                  <p className="text-[13px] leading-[16px] font-bold text-primary uppercase tracking-[0.08em]">Leaderboard</p>
                </div>
                {leaderboard.length > 0 && (
                  <p className="text-[12px] text-slate-400">{leaderboard.length} shown</p>
                )}
              </div>
              {leaderboard.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {leaderboard.map((entry) => (
                    <div key={`${entry.userId}-${entry.rank}`} className="flex items-center gap-3 px-4 py-2.5">
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
                        {entry.score.toLocaleString()}{entry.scoreLabel ? <span className="text-[11px] font-normal text-slate-400"> {entry.scoreLabel}</span> : null}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-4 text-[13px] text-slate-400">No activity logged yet. Be the first!</p>
              )}
            </div>
          </section>
        )}

        {/* Multi-activity streak: inline checklist — all activities must be filled before saving */}
        {isMultiStreakMode && (
          <section className="st-form-max mt-4">
            <div className="st-card p-4">
              <p className="text-[13px] leading-[16px] tracking-[0.08em] uppercase font-bold text-primary mb-3">
                Today's Checklist
              </p>
              <div className="space-y-3">
                {activities.map((activity, idx) => {
                  const match = exercises.find((item) => item.id === activity.exerciseId || item.name.toLowerCase() === (activity.exerciseName || '').toLowerCase());
                  const name = match?.name || activity.exerciseName || `Activity ${idx + 1}`;
                  const val = checklistValues[idx] ?? 0;
                  const filled = val > 0;
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="flex-shrink-0 text-primary">
                        {filled ? <CheckCircle2 size={22} /> : <Circle size={22} className="text-slate-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-slate-800 truncate">{name}</p>
                        {activity.targetValue > 0 && (
                          <p className="text-[11px] text-slate-500">Daily target: {activity.targetValue} {activity.unit}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <input
                          type="number"
                          min={0}
                          className="w-20 h-10 rounded-xl border border-slate-200 bg-white px-2 text-[15px] font-bold text-center text-slate-900"
                          value={val === 0 ? '' : val}
                          placeholder="0"
                          onChange={(e) => {
                            const n = Math.max(0, Number(e.target.value) || 0);
                            setChecklistValues((prev) => ({ ...prev, [idx]: n }));
                          }}
                        />
                        <span className="text-[12px] text-slate-500 w-10 truncate">{activity.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                className={`mt-4 w-full h-14 rounded-2xl text-[16px] font-black transition-colors ${allChecklistValuesValid && isChallengeActiveNow && !isChecklistSubmitting ? 'bg-primary text-white' : 'bg-slate-200 text-slate-400'}`}
                disabled={!allChecklistValuesValid || !isChallengeActiveNow || isChecklistSubmitting}
                onClick={handleChecklistSubmit}
              >
                {isChecklistSubmitting ? 'Saving…' : !isChallengeActiveNow ? 'Locked' : `Log Day${!allChecklistValuesValid ? ' (fill all values)' : ''}`}
              </button>
            </div>
          </section>
        )}

        <section className="st-form-max mt-4 space-y-4">
          {!isMultiStreakMode && activities.map((activity) => {
            const isOptional = false;
            const match = exercises.find((item) => item.id === activity.exerciseId || item.name.toLowerCase() === (activity.exerciseName || '').toLowerCase());
            const activityId = 'activityId' in activity ? activity.activityId : undefined;
            const resolvedExerciseId = match?.id || activity.exerciseId || activityId || 'wellness-activity';
            const icon =
              activity.unit.toLowerCase() === 'reps'
                ? <Dumbbell size={28} />
                : activity.unit.toLowerCase() === 'seconds' || activity.unit.toLowerCase() === 'minutes'
                  ? <Clock3 size={28} />
                  : <Circle size={28} />;

            return (
              <article key={`${activity.exerciseId}-${activity.exerciseName}`} className={`st-card p-4 flex items-center justify-between ${isOptional ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-20 w-20 rounded-[22px] bg-[#f8e9df] text-primary flex items-center justify-center">{icon}</div>
                  <div className="min-w-0">
                    <p className="text-[20px] leading-[24px] tracking-[-0.01em] font-black text-[#18110d] truncate">
                      {match?.name || activity.exerciseName || 'Activity'}
                    </p>
                    <p className="mt-1 text-[16px] leading-[22px] font-medium text-[#68605a]">
                      {isOptional
                        ? 'Bonus challenge'
                        : subtitle(activity.unit, 'activityType' in activity ? activity.activityType : undefined)}
                    </p>
                    {isV2 && challengeType === 'collective' && activity.targetValue > 0 && (
                      <p className="mt-0.5 text-[12px] text-primary font-semibold">Target: {activity.targetValue.toLocaleString()} {activity.unit}</p>
                    )}
                    {isV2 && challengeType === 'streak' && (
                      <p className="mt-0.5 text-[12px] text-primary font-semibold">Log daily to keep your streak</p>
                    )}
                    {match?.id && (
                      <button
                        className="mt-2 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 active:opacity-70"
                        onClick={(e) => {
                          e.stopPropagation();
                          const qs = new URLSearchParams();
                          if (challengeId) qs.set('challengeId', challengeId);
                          if (groupId) qs.set('groupId', groupId);
                          navigate(`/app/exercises/${match.id}?${qs.toString()}`);
                        }}
                      >
                        <Info size={11} className="text-primary flex-shrink-0" />
                        <span className="text-[11px] font-bold text-primary leading-none">View Exercise Guide</span>
                      </button>
                    )}
                  </div>
                </div>
                <button
                  className={`h-16 min-w-[104px] rounded-full px-6 text-[16px] leading-[16px] font-black ${isOptional ? 'bg-[#d7dbe1] text-[#8f96a1]' : 'bg-primary text-white'}`}
                  onClick={() =>
                    handleLog(
                      resolvedExerciseId,
                      activity.unit,
                      match?.name || activity.exerciseName || 'Activity',
                      isOptional || !isChallengeActiveNow,
                      activityId,
                      'activityType' in activity ? activity.activityType : undefined,
                    )}
                >
                  {!isChallengeActiveNow ? 'Locked' : 'Log'}
                </button>
              </article>
            );
          })}
          {activities.length === 0 && (
            <article className="st-card p-4">
              <p className="text-[14px] leading-[20px] text-slate-600">No challenge activities found yet. Ask your group admin to configure challenge activities.</p>
            </article>
          )}
          {!isMultiStreakMode && allLogged && (
            <button className="st-btn-primary mt-2" onClick={handleSessionComplete}>
              View Session Results →
            </button>
          )}
        </section>
      </div>

      <BottomNav active="challenges" />
    </Screen>
  );
}

export default SelectChallengeActivityScreen;
