import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { V2Button, V2Sheet } from '../components/V2Primitives';
import {
  challengeTypeLabel,
  formatDayRange,
  timezoneLabel,
} from '../challenges/challengeCreationDraft';
import {
  endStateFor,
  statusLabelForEndState,
} from '../challenges/challengeEndState';
import { statusTone } from '../challenges/V2ChallengeListScreen';
import {
  useChallengeContributorsV2,
  useCompetitiveLeaderboardV2,
} from '../challenges/useChallengeCreation';
import { invalidateV2ChallengeReads } from '../challenges/challengeQueryKeys';
import { joinChallengeV2, type V2ChallengeSummary } from '../../api/v2ChallengeApi';

/**
 * TIIZI S4a CORR-001 — hosted Challenge card for Group Home.
 *
 * Reference composition (prototype ChallengeCard) bound strictly to
 * existing S3 read truth — no second Challenge system, no client-computed
 * authority:
 *
 * - type + state badges (an `establishment`-status Challenge reads neutral
 *   "Upcoming": scheduled, not yet running — presentation only, the domain
 *   lifecycle is untouched);
 * - title + "Hosted by {Group}" context + description;
 * - compact per-type snapshot from the served summary (collective
 *   total/goal bar + your contribution; competitive target + your
 *   total/position; streak current/best/days + today state);
 * - participant count from the existing collective-contributor /
 *   competitive-leaderboard reads (live only — finalized Challenges show
 *   their served frozen result instead, never a live fetch as truth;
 *   streaks carry no count because no roster read exists);
 * - CTA: Join (inline, confirmed, governed mutation) when the viewer is a
 *   Group member with no participation on a live Challenge; Log activity /
 *   View results navigate into the existing Challenge detail experience
 *   (S3b logging lives there — never duplicated here).
 */

function participationText(challenge: V2ChallengeSummary): string | null {
  if (challenge.myParticipation?.status === 'active') return 'Taking part';
  if (challenge.status === 'ended' || challenge.finalized) return null;
  if (challenge.myParticipation) return 'Not taking part';
  return 'Not joined';
}

export function V2HostedChallengeCard({
  challenge,
  groupName,
  viewerMemberId,
  viewerIsGroupMember,
  onOpen,
}: {
  challenge: V2ChallengeSummary;
  groupName: string;
  viewerMemberId: string | null;
  viewerIsGroupMember: boolean;
  onOpen: (challengeId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [joinOpen, setJoinOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  const upcoming = challenge.status === 'establishment';
  const endState = endStateFor(challenge);
  const participation = participationText(challenge);
  const isLive = !challenge.finalized && challenge.status !== 'ended' && endState === 'live' && !upcoming;
  const mine = challenge.myParticipation?.status === 'active' ? challenge.myParticipation : null;

  // Live-only counts (finalized Challenges show served frozen results;
  // streaks have no roster read — no count is fabricated).
  const contributors = useChallengeContributorsV2(
    challenge.challengeType === 'collective' && !challenge.finalized ? challenge.challengeId : undefined,
    challenge.challengeType,
  );
  const leaderboard = useCompetitiveLeaderboardV2(
    challenge.challengeType === 'competitive' && !challenge.finalized ? challenge.challengeId : undefined,
    challenge.challengeType,
    challenge.finalized,
  );
  const participantCount =
    challenge.challengeType === 'collective' && !challenge.finalized && contributors.data
      ? contributors.data.contributors.length
      : challenge.challengeType === 'competitive' && !challenge.finalized && leaderboard.data
        ? leaderboard.data.entries.length
        : null;

  const myPosition =
    challenge.challengeType === 'competitive' && viewerMemberId && leaderboard.data
      ? (leaderboard.data.entries.find((entry) => entry.memberId === viewerMemberId)?.position ?? null)
      : null;

  const canJoinInline =
    isLive && viewerIsGroupMember && !challenge.myParticipation;

  const confirmJoin = async () => {
    setJoining(true);
    setJoinError('');
    try {
      await joinChallengeV2(challenge.challengeId);
      await invalidateV2ChallengeReads(queryClient, user?.uid, challenge.challengeId);
      setJoinOpen(false);
    } catch {
      setJoinError('We could not join this Challenge just now. Please try again from its page.');
    } finally {
      setJoining(false);
    }
  };

  const cta = canJoinInline ? (
    <V2Button variant="secondary" onClick={() => setJoinOpen(true)}>
      Join
    </V2Button>
  ) : (
    <V2Button
      variant={mine ? 'primary' : 'secondary'}
      onClick={() => onOpen(challenge.challengeId)}
    >
      {mine ? 'Log activity' : challenge.finalized || challenge.status === 'ended' ? 'View results' : 'View'}
    </V2Button>
  );

  return (
    <li className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => onOpen(challenge.challengeId)}
        className="block w-full p-4 text-left"
        aria-label={`Open ${challenge.title}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-bold text-primary">
            {challengeTypeLabel(challenge.challengeType)}
          </span>
          {upcoming ? (
            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-bold text-sky-900">
              Upcoming
            </span>
          ) : (
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusTone(endState)}`}>
              {statusLabelForEndState(challenge.status, endState)}
            </span>
          )}
          {participation && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
              {participation}
            </span>
          )}
        </div>
        <p className="mt-2 text-base font-black text-slate-900">{challenge.title}</p>
        <p className="mt-0.5 text-[11px] font-bold text-slate-400">
          Hosted by {groupName} · {timezoneLabel(challenge.timezone)}
        </p>
        {challenge.description && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{challenge.description}</p>
        )}

        {!upcoming && challenge.challengeType === 'collective' && (
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Group total</span>
              <span className="font-black tabular-nums text-slate-900">
                {challenge.collectiveTotal}
                {challenge.goalUnit ? ` ${challenge.goalUnit}` : ''}
                {challenge.goalValue != null && (
                  <span className="font-bold text-slate-500"> / {challenge.goalValue}{challenge.goalUnit ? ` ${challenge.goalUnit}` : ''}</span>
                )}
              </span>
            </div>
            {challenge.goalValue != null && challenge.goalValue > 0 && (
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-orange-500"
                  style={{ width: `${Math.min(100, (challenge.collectiveTotal / challenge.goalValue) * 100)}%` }}
                />
              </div>
            )}
            {mine && (
              <p className="mt-1 text-[11px] text-slate-600">
                Your contribution: <strong className="text-slate-900">{mine.progress.cumulativeTotal}{challenge.goalUnit ? ` ${challenge.goalUnit}` : ''}</strong>
              </p>
            )}
          </div>
        )}

        {!upcoming && challenge.challengeType === 'competitive' && (
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">Target</span>
              <span className="font-black tabular-nums text-slate-900">
                {challenge.goalValue ?? '—'}{challenge.goalUnit ? ` ${challenge.goalUnit}` : ''}
              </span>
            </div>
            {mine && (
              <p className="mt-1 text-[11px] text-slate-600">
                Your total: <strong className="text-slate-900">{mine.progress.cumulativeTotal}{challenge.goalUnit ? ` ${challenge.goalUnit}` : ''}</strong>
                {(mine.final?.finalPosition ?? mine.progress.finalPosition ?? myPosition) != null && (
                  <span> · Finishing position #{mine.final?.finalPosition ?? mine.progress.finalPosition ?? myPosition}</span>
                )}
              </p>
            )}
            {!mine && (
              <p className="mt-1 text-[11px] text-slate-500">
                Everyone who finishes is ranked in order — tied members share a spot.
              </p>
            )}
          </div>
        )}

        {!upcoming && challenge.challengeType === 'streak' && mine && (
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            <span>Streak: <strong className="font-bold text-orange-600">{challenge.finalized && mine.final ? mine.final.finalStreak : mine.progress.currentStreak}d</strong></span>
            <span>Best: <strong className="font-bold text-slate-900">{challenge.finalized && mine.final ? mine.final.bestStreak : mine.progress.bestStreak}d</strong></span>
            <span>Done: <strong className="font-bold text-slate-900">{challenge.finalized && mine.final ? mine.final.daysCompleted : mine.progress.daysCompleted}</strong></span>
          </div>
        )}

        <p className="mt-2 text-xs font-bold text-slate-500">
          {formatDayRange(challenge.startDate, challenge.endDate)}
          {participantCount !== null && (
            <span> · {participantCount} {participantCount === 1 ? 'participant' : 'participants'}</span>
          )}
        </p>
      </button>
      <div className="flex items-center justify-end border-t border-slate-100 px-4 py-2.5">
        {cta}
      </div>
      <V2Sheet open={joinOpen} onClose={() => setJoinOpen(false)} title={`Join ${challenge.title}?`}>
        <p className="text-sm leading-6 text-slate-600">
          Joining starts your participation in this Challenge. Membership in {groupName} does
          not join you automatically — this is your explicit choice.
        </p>
        {joinError && (
          <p role="alert" className="mt-2 text-xs font-bold text-red-600">{joinError}</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <V2Button variant="ghost" onClick={() => setJoinOpen(false)}>
            Not now
          </V2Button>
          <V2Button onClick={() => void confirmJoin()} disabled={joining}>
            {joining ? 'Joining…' : 'Join Challenge'}
          </V2Button>
        </div>
      </V2Sheet>
    </li>
  );
}
