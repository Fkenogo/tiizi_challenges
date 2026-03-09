import { useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Screen, Section } from '../../components/Layout';
import { Card, EmptyState } from '../../components/Mobile';
import { useCanAccessChallenge, useChallenge, useChallengeMembership, useJoinChallenge, useLeaveChallenge } from '../../hooks/useChallenges';
import { useGroup, useGroups } from '../../hooks/useGroups';
import { useCreateChallengeReminder } from '../../hooks/useNotifications';
import { useAuth } from '../../hooks/useAuth';
import { useChallengeProgress, useChallengeWorkouts } from '../../hooks/useWorkouts';
import { useToast } from '../../context/ToastContext';
import { useChallengeContribution, useCreateChallengeContribution } from '../../hooks/useDonations';

function ChallengeDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const groupId = params.get('groupId') ?? undefined;
  const { data: challenge, isLoading } = useChallenge(id);
  const { data: canAccessChallenge = false, isLoading: isCheckingAccess } = useCanAccessChallenge(id);
  const { data: membership } = useChallengeMembership(id);
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
  const { data: workouts = [] } = useChallengeWorkouts(resolvedChallenge?.id);
  const { data: contribution } = useChallengeContribution(resolvedChallenge?.id);
  const createContribution = useCreateChallengeContribution();

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
      now < startMs ? `Scheduled • starts in ${startsInDays} day${startsInDays === 1 ? '' : 's'}` :
      now > endMs ? 'Completed' :
      `Ongoing • ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
    return {
      durationDays,
      statusLabel,
      startLabel: start.toLocaleDateString(),
      endLabel: end.toLocaleDateString(),
    };
  }, [resolvedChallenge]);

  const leaderboard = useMemo(() => {
    const scoreMap = new Map<string, number>();
    workouts.forEach((item) => {
      scoreMap.set(item.userId, (scoreMap.get(item.userId) ?? 0) + Math.max(1, Math.round(item.value)));
    });
    return Array.from(scoreMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([userId, score], index) => ({ rank: index + 1, userId, score }));
  }, [workouts]);
  const now = Date.now();
  const challengeStartsAt = resolvedChallenge ? Date.parse(resolvedChallenge.startDate) : 0;
  const challengeEndsAt = resolvedChallenge ? Date.parse(resolvedChallenge.endDate) : 0;
  const hasStarted = resolvedChallenge ? now >= challengeStartsAt : false;
  const hasEnded = resolvedChallenge ? now > challengeEndsAt : false;
  const canLogWorkout = !!membership && membership.status === 'active' && hasStarted && !hasEnded;
  const isWellnessChallenge = !!resolvedChallenge?.category && resolvedChallenge.category !== 'fitness';
  const requiresApproval = !!resolvedChallenge?.donation?.enabled
    && (resolvedChallenge?.moderationStatus === 'pending' || resolvedChallenge?.status === 'draft');

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

  if (isLoading) {
    return (
      <Screen>
        <Section title="Challenge Detail">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-2/3" />
            <div className="h-3 bg-slate-100 rounded w-1/2" />
            <div className="h-11 bg-slate-200 rounded-xl" />
            <div className="h-11 bg-slate-100 rounded-xl" />
          </div>
        </Section>
      </Screen>
    );
  }
  if (!resolvedChallenge) {
    return (
      <EmptyState
        icon={<span>🏆</span>}
        title="Challenge not found"
        message="This challenge may have expired or the link is invalid."
        action={(
          <button
            className="h-11 px-4 rounded-xl bg-primary text-white text-sm font-bold"
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
      <Screen>
        <Section title="Challenge Detail">
          <Card>
            <p className="text-sm text-slate-700">Checking challenge access...</p>
          </Card>
        </Section>
      </Screen>
    );
  }

  if (!canAccessChallenge && !canPreviewPublicChallenge) {
    return (
      <Screen>
        <Section title="Challenge Detail">
          <Card>
            <p className="text-sm text-slate-700 font-bold">Join Group First</p>
            <p className="text-xs text-slate-500 mt-2">This challenge is in a private group. Join and get approved first.</p>
            <div className="mt-4 space-y-2">
              {resolvedChallenge.groupId ? (
                <button
                  className="w-full h-11 rounded-xl bg-primary text-white text-sm font-bold"
                  onClick={() => navigate(`/app/group/${resolvedChallenge.groupId}`)}
                >
                  Go To Group
                </button>
              ) : null}
              <button
                className="w-full h-11 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold"
                onClick={() => navigate(backToChallengesPath)}
              >
                Back to Challenges
              </button>
            </div>
          </Card>
        </Section>
      </Screen>
    );
  }

  return (
    <Screen>
      <Section title="Challenge Detail">
        <Card>
          <p className="text-sm text-slate-700">Challenge: <span className="font-bold">{resolvedChallenge.name}</span></p>
          <p className="mt-2 text-xs text-slate-500">{resolvedChallenge.description || 'No description provided.'}</p>
          <p className="text-xs text-slate-500 mt-2">Status: {summary?.statusLabel}</p>
          <p className="text-xs text-slate-500">Starts: {summary?.startLabel}</p>
          <p className="text-xs text-slate-500">Ends: {summary?.endLabel}</p>
          <p className="text-xs text-slate-500">Duration: {summary?.durationDays} day{summary?.durationDays === 1 ? '' : 's'}</p>
          {requiresApproval && (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-800">
              This Fitness + Cause challenge is awaiting super admin approval before it goes active.
            </p>
          )}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
              <p className="text-[10px] uppercase font-bold text-slate-500">My Logs</p>
              <p className="text-base font-black text-slate-900">{progress?.myLogs ?? 0}</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
              <p className="text-[10px] uppercase font-bold text-slate-500">Total Logs</p>
              <p className="text-base font-black text-slate-900">{progress?.totalLogs ?? 0}</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
              <p className="text-[10px] uppercase font-bold text-slate-500">Participants</p>
              <p className="text-base font-black text-slate-900">{progress?.uniqueParticipants ?? 0}</p>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] uppercase font-bold text-slate-500">Activities</p>
            {resolvedChallenge.activities && resolvedChallenge.activities.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {resolvedChallenge.activities.map((activity) => (
                  <li key={`${activity.exerciseId}-${activity.exerciseName}`} className="text-xs text-slate-700">
                    • {activity.exerciseName || activity.exerciseId}: target {activity.targetValue} {activity.unit}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-slate-500">No activities configured yet.</p>
            )}
          </div>
          {resolvedChallenge.donation?.enabled && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] uppercase font-bold text-slate-500">Fitness + Cause</p>
              <p className="mt-1 text-xs text-slate-700 font-semibold">{resolvedChallenge.donation.causeName || 'Cause challenge'}</p>
              {resolvedChallenge.donation.causeDescription ? (
                <p className="mt-1 text-xs text-slate-600">{resolvedChallenge.donation.causeDescription}</p>
              ) : null}
              <p className="mt-1 text-xs text-slate-600">
                Target: KES {(resolvedChallenge.donation.targetAmountKes ?? 0).toLocaleString()}
              </p>
              {(resolvedChallenge.donation.contributionStartDate || resolvedChallenge.donation.contributionEndDate) && (
                <p className="mt-1 text-xs text-slate-600">
                  Contribution window: {resolvedChallenge.donation.contributionStartDate || 'N/A'} to {resolvedChallenge.donation.contributionEndDate || 'N/A'}
                </p>
              )}
              {resolvedChallenge.donation.contributionPhoneNumber && (
                <p className="mt-1 text-xs text-slate-700">Donate here (mobile): {resolvedChallenge.donation.contributionPhoneNumber}</p>
              )}
              {resolvedChallenge.donation.contributionCardUrl && (
                <p className="mt-1 text-xs text-slate-700">Card option: {resolvedChallenge.donation.contributionCardUrl}</p>
              )}
              <p className="mt-2 text-[11px] text-slate-500">
                {resolvedChallenge.donation.disclaimer || 'Tiizi does not hold or manage funds. Contributions are coordinated by the group.'}
              </p>
              {!contribution && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    className="h-9 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-60"
                    disabled={createContribution.isPending || !normalizedGroupId}
                    onClick={async () => {
                      if (!normalizedGroupId) return;
                      try {
                        await createContribution.mutateAsync({
                          challengeId: resolvedChallenge.id,
                          groupId: normalizedGroupId,
                          amountKes: resolvedChallenge.donation?.targetAmountKes ? Math.max(100, Math.round(resolvedChallenge.donation.targetAmountKes / 10)) : 500,
                          timingStartDate: resolvedChallenge.donation?.contributionStartDate,
                          timingEndDate: resolvedChallenge.donation?.contributionEndDate,
                          paymentPhoneNumber: resolvedChallenge.donation?.contributionPhoneNumber,
                          status: 'pledged',
                        });
                        showToast('Contribution pledge saved.', 'success');
                      } catch (error) {
                        const msg = error instanceof Error ? error.message : 'Could not save pledge.';
                        showToast(msg, 'error');
                      }
                    }}
                  >
                    Contribute
                  </button>
                  <button
                    className="h-9 rounded-lg bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-60"
                    disabled={createContribution.isPending || !normalizedGroupId}
                    onClick={async () => {
                      if (!normalizedGroupId) return;
                      try {
                        await createContribution.mutateAsync({
                          challengeId: resolvedChallenge.id,
                          groupId: normalizedGroupId,
                          amountKes: 0,
                          timingStartDate: resolvedChallenge.donation?.contributionStartDate,
                          timingEndDate: resolvedChallenge.donation?.contributionEndDate,
                          paymentPhoneNumber: resolvedChallenge.donation?.contributionPhoneNumber,
                          status: 'skipped',
                        });
                        showToast('You can still do workouts without contributing.', 'info');
                      } catch (error) {
                        const msg = error instanceof Error ? error.message : 'Could not save preference.';
                        showToast(msg, 'error');
                      }
                    }}
                  >
                    Skip
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] uppercase font-bold text-slate-500">Leaderboard Snapshot</p>
            {leaderboard.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {leaderboard.map((entry) => (
                  <li key={`${entry.userId}-${entry.rank}`} className="text-xs text-slate-700">
                    #{entry.rank} {entry.userId.slice(0, 6)} • {entry.score} pts
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-slate-500">No leaderboard activity yet.</p>
            )}
          </div>
          {!!normalizedGroupId && <p className="text-xs text-primary mt-1">Linked to selected group</p>}
          <div className="mt-4 space-y-2">
            {!membership || membership.status !== 'active' ? (
              <button
                className="w-full h-11 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-60"
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
                    const msg = error instanceof Error ? error.message : 'Could not join challenge.';
                    showToast(msg, 'error');
                  }
                }}
              >
                {requiresApproval
                  ? 'Awaiting Approval'
                  : (canPreviewPublicChallenge ? 'Join Group to Participate' : (joinChallenge.isPending ? 'Joining...' : 'Join Challenge'))}
              </button>
            ) : requiresApproval ? (
              <button className="w-full h-11 rounded-xl bg-slate-200 text-slate-700 text-sm font-bold" disabled>
                Awaiting Approval
              </button>
            ) : hasEnded ? (
              <button className="w-full h-11 rounded-xl bg-slate-200 text-slate-700 text-sm font-bold" disabled>
                Completed
              </button>
            ) : canLogWorkout ? (
              <button className="w-full h-11 rounded-xl bg-primary text-white text-sm font-bold" onClick={() => navigate(`/app/workouts/select-activity?challengeId=${resolvedChallenge.id}${normalizedGroupId ? `&groupId=${normalizedGroupId}` : ''}`)}>
                {isWellnessChallenge ? 'Log Activity' : 'Log Workout'}
              </button>
            ) : (
              <button
                className="w-full h-11 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-60"
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
                    const msg = error instanceof Error ? error.message : 'Could not set reminder.';
                    showToast(msg, 'error');
                  }
                }}
              >
                {createReminder.isPending ? 'Saving...' : 'Remind Me'}
              </button>
            )}
            {!!membership && (membership.status === 'active' || membership.status === 'completed') && (
              <button
                className="w-full h-11 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-bold disabled:opacity-60"
                disabled={leaveChallenge.isPending}
                onClick={async () => {
                  try {
                    await leaveChallenge.mutateAsync(resolvedChallenge.id);
                    showToast('You left this challenge.', 'success');
                    navigate(backToChallengesPath);
                  } catch (error) {
                    const msg = error instanceof Error ? error.message : 'Could not leave challenge.';
                    showToast(msg, 'error');
                  }
                }}
              >
                {leaveChallenge.isPending ? 'Leaving...' : 'Leave Challenge'}
              </button>
            )}
            <button className="w-full h-11 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate(backToChallengesPath)}>
              Back to Challenges
            </button>
            {!!normalizedGroupId && (
              <button className="w-full h-11 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate(`/app/group/${normalizedGroupId}`)}>
                Back to Group
              </button>
            )}
          </div>
        </Card>
      </Section>
    </Screen>
  );
}

export default ChallengeDetailScreen;
