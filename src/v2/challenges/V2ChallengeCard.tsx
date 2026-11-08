import { useEffect, useState, type ReactNode } from 'react';
import type { V2ChallengeSummary } from '../../api/v2ChallengeApi';
import { challengeTypeLabel } from './challengeCreationDraft';
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
  const localCover = getLocalChallengeCoverPreview(challenge.challengeId);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!localCover) {
      setPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(localCover);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [challenge.challengeId, localCover]);

  const surfaceAttribute = surface === 'my'
    ? { 'data-my-challenge': challenge.challengeId }
    : surface === 'find'
      ? { 'data-find-challenge': challenge.challengeId }
      : { 'data-explore-challenge': challenge.challengeId };

  return (
    <li {...surfaceAttribute} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative h-44 bg-slate-200 sm:h-48">
        {photoUrl ? (
          <img src={photoUrl} alt={`${challenge.title} cover photo`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-200 text-slate-500">
            <svg aria-hidden="true" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7.5A1.5 1.5 0 0 1 5.5 6h2l1.2-1.5h6.6L16.5 6h2A1.5 1.5 0 0 1 20 7.5v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-10Z" />
              <circle cx="12" cy="12" r="3.2" />
            </svg>
            <span className="text-xs font-semibold">No cover photo</span>
          </div>
        )}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-slate-950/10" />
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
      </div>

      <div className="space-y-3.5 p-4 sm:p-5">
        <p className="line-clamp-3 text-sm leading-6 text-slate-600">
          {challenge.description.trim() || 'No description provided.'}
        </p>
        {photoUrl && <p className="-mt-2 text-[11px] font-medium text-slate-500">Local photo preview · not saved to the Challenge</p>}
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
