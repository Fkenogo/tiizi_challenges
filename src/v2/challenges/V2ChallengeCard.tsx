import type { ReactNode } from 'react';
import type { V2ChallengeSummary } from '../../api/v2ChallengeApi';
import { challengeTypeLabel } from './challengeCreationDraft';
import { V2ChallengeCover } from './V2ChallengeCover';
import { getLocalChallengeCoverPreview } from './localChallengeCoverPreviews';

type Surface = 'my' | 'find' | 'explore';

const TYPE_BADGE: Record<V2ChallengeSummary['challengeType'], string> = {
  collective: 'bg-amber-100 text-amber-950',
  competitive: 'bg-sky-100 text-sky-950',
  streak: 'bg-orange-100 text-orange-950',
};

export function V2ChallengeCard({
  challenge,
  surface,
  statusLabel,
  statusTone,
  groupLine,
  progress,
  actions,
  extraBadges = [],
}: {
  challenge: V2ChallengeSummary;
  surface: Surface;
  statusLabel: string;
  statusTone: string;
  groupLine: string;
  progress: ReactNode;
  actions: ReactNode;
  extraBadges?: string[];
}) {
  const surfaceAttribute = surface === 'my'
    ? { 'data-my-challenge': challenge.challengeId }
    : surface === 'find'
      ? { 'data-find-challenge': challenge.challengeId }
      : { 'data-explore-challenge': challenge.challengeId };

  return (
    <li {...surfaceAttribute} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <V2ChallengeCover challengeId={challenge.challengeId} title={challenge.title} heightClass="h-44 sm:h-48">
        {!getLocalChallengeCoverPreview(challenge.challengeId) && <div className="absolute inset-x-4 bottom-3 text-xs font-semibold text-white drop-shadow sm:bottom-4">No cover photo</div>}
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2 sm:inset-x-4 sm:top-4">
          <span className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide shadow-sm ${TYPE_BADGE[challenge.challengeType]}`}>
            {challengeTypeLabel(challenge.challengeType)}
          </span>
          <div className="flex max-w-[72%] flex-wrap justify-end gap-1.5">
            <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold shadow-sm ${statusTone}`}>{statusLabel}</span>
            {extraBadges.map((badge) => <span key={badge} className="max-w-full truncate rounded-full bg-white/90 px-2.5 py-1.5 text-[10px] font-bold text-emerald-950 shadow-sm">{badge}</span>)}
          </div>
        </div>
        <div className="absolute inset-x-4 bottom-3 text-white sm:bottom-4">
          <p className="line-clamp-1 text-xs font-medium text-slate-100 drop-shadow">{groupLine}</p>
          <h3 className="mt-0.5 line-clamp-2 text-lg font-extrabold leading-tight drop-shadow sm:text-xl">{challenge.title}</h3>
        </div>
      </V2ChallengeCover>

      <div className="space-y-3.5 p-4 sm:p-5">
        <p className="line-clamp-3 text-sm leading-6 text-slate-600">
          {challenge.description.trim() || 'No description provided.'}
        </p>
        {getLocalChallengeCoverPreview(challenge.challengeId) && <p className="-mt-2 text-[11px] font-medium text-slate-500">Local photo preview · not saved to the Challenge</p>}
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 sm:p-4" aria-label="Challenge progress">
          {progress}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3.5">
          {actions}
        </div>
      </div>
    </li>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
}

function TogetherProgress({ challenge, contribution }: { challenge: V2ChallengeSummary; contribution?: number }) {
  const goal = challenge.goalValue;
  const total = challenge.collectiveTotal;
  if (goal === null || goal <= 0 || !challenge.goalUnit) {
    return <p className="text-xs font-medium text-slate-600">Shared goal progress is not available yet.</p>;
  }
  const percentage = Math.max(0, Math.min(100, (total / goal) * 100));
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-bold text-slate-800">Group milestone</span>
        <span className="font-extrabold text-primary">{formatNumber(total)} / {formatNumber(goal)} {challenge.goalUnit} <span className="font-semibold text-slate-400">({Math.round(percentage)}%)</span></span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Group milestone progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percentage)}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
      </div>
      {contribution !== undefined && <p className="mt-2 text-xs text-slate-500">Your contribution: <strong className="text-slate-800">{formatNumber(contribution)} {challenge.goalUnit}</strong></p>}
    </>
  );
}

export function MyChallengeProgress({ challenge }: { challenge: V2ChallengeSummary }) {
  const progress = challenge.myParticipation?.progress;
  if (!progress) return <p className="text-xs font-medium text-slate-600">Progress is not available yet.</p>;
  if (challenge.challengeType === 'collective') {
    return <TogetherProgress challenge={challenge} contribution={progress.cumulativeTotal} />;
  }
  if (challenge.challengeType === 'competitive') {
    return (
      <>
        <p className="text-sm font-bold text-slate-800">Race progress</p>
        <p className="mt-1 text-sm font-extrabold text-primary">{formatNumber(progress.totalPoints)} points <span className="font-medium text-slate-500">· {progress.logsAccepted} activities logged</span></p>
        {progress.finalPosition !== null && <p className="mt-1 text-xs text-slate-500">Final place: <strong className="text-slate-800">#{progress.finalPosition}</strong></p>}
      </>
    );
  }
  return (
    <>
      <p className="text-sm font-bold text-slate-800">Daily progress</p>
      <p className="mt-1 text-sm font-extrabold text-primary">{progress.currentStreak}-day streak</p>
      <p className="mt-1 text-xs text-slate-500">{progress.daysCompleted} days completed · best {progress.bestStreak} days</p>
    </>
  );
}

export function FindChallengeProgress({ challenge }: { challenge: V2ChallengeSummary }) {
  if (challenge.challengeType === 'collective') {
    return <TogetherProgress challenge={challenge} />;
  }
  const completed = challenge.completionsCount;
  return (
    <>
      <p className="text-sm font-bold text-slate-800">{challenge.challengeType === 'competitive' ? 'Race finishes' : 'Completed Streaks'}</p>
      <p className="mt-1 text-sm font-extrabold text-primary">{completed > 0 ? `${completed} completed` : 'No completions recorded yet'}</p>
    </>
  );
}
