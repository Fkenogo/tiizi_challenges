import { useState, type ReactNode } from 'react';
import type { V2ChallengeDetail } from '../../api/v2ChallengeApi';

const SAMPLE_BADGE = 'SAMPLE DATA · FICTIONAL PREVIEW';

export function TodayActivityTimelinePreview() {
  if (!import.meta.env.DEV) return null;

  return (
    <section aria-labelledby="today-activity-preview" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="today-activity-preview" className="text-base font-black text-slate-900">Your activity today</h2>
        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-800">{SAMPLE_BADGE}</span>
      </div>
      <p className="text-sm text-slate-600">Preview only · these events are fictional and are not loaded from member history.</p>
      <ol className="space-y-2" aria-label="Sample recent activity, newest first">
        <li className="rounded-2xl border border-slate-200 bg-white p-3">
          <p className="text-sm font-bold text-slate-900">Activity logged · Push-Up · 25 reps</p>
          <p className="mt-1 text-xs text-slate-600">Reps Race · performed 8:35 AM · recorded 8:42 AM</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-violet-700">{SAMPLE_BADGE}</p>
        </li>
        <li className="rounded-2xl border border-slate-200 bg-white p-3">
          <p className="text-sm font-bold text-slate-900">Daily Streak requirement completed</p>
          <p className="mt-1 text-xs text-slate-600">Breathing Practice · 5 minutes · Morning Momentum · 8:10 AM</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-violet-700">{SAMPLE_BADGE}</p>
        </li>
        <li className="rounded-2xl border border-slate-200 bg-white p-3">
          <p className="text-sm font-bold text-slate-900">Challenge joined · Morning Momentum</p>
          <p className="mt-1 text-xs text-slate-600">Today · 7:55 AM</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-violet-700">{SAMPLE_BADGE}</p>
        </li>
        <li className="rounded-2xl border border-slate-200 bg-white p-3">
          <p className="text-sm font-bold text-slate-900">Group joined · KILIMANJARO</p>
          <p className="mt-1 text-xs text-slate-600">Today · 7:30 AM</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-violet-700">{SAMPLE_BADGE}</p>
        </li>
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-500" aria-describedby="activity-history-preview-note">
          View activity history
        </button>
        <span id="activity-history-preview-note" className="text-xs text-slate-500">Preview only · destination not implemented</span>
      </div>
    </section>
  );
}

const PARTICIPANT_SAMPLE_COUNTS: Record<V2ChallengeDetail['challengeType'], number> = {
  collective: 6,
  competitive: 8,
  streak: 5,
};

export function ChallengeVisibilityPreview({ detail }: { detail: V2ChallengeDetail }) {
  if (!import.meta.env.DEV) return null;
  const participantCount = PARTICIPANT_SAMPLE_COUNTS[detail.challengeType];
  const milestone = detail.challengeType === 'collective';

  return (
    <div className="space-y-4">
      <section aria-labelledby="sample-participant-count" className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="sample-participant-count" className="text-sm font-black text-slate-900">Participants</h2>
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-800">{SAMPLE_BADGE}</span>
        </div>
        <p className="mt-2 text-2xl font-black text-slate-900">{participantCount} <span className="text-base font-bold">participants</span></p>
        <p className="mt-1 text-xs leading-5 text-slate-700">Fictional count for the Founder walkthrough. Connected {detail.challengeType === 'collective' ? 'contributor' : detail.challengeType === 'competitive' ? 'standings' : 'Streak'} presentation above remains unchanged.</p>
        {detail.challengeType === 'streak' && <p className="mt-1 text-xs font-semibold text-slate-700">Count only · Streak has no leaderboard or participant ranking.</p>}
      </section>

      <section aria-labelledby="challenge-feed-preview" className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="challenge-feed-preview" className="text-base font-black text-slate-900">Challenge Feed</h2>
          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-800">{SAMPLE_BADGE}</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-600">Fictional event cards · not connected to a Feed API. Private Activity is absent unless its owner explicitly shares it.</p>
        <ol className="mt-3 space-y-2" aria-label="Sample Challenge Feed events, newest first">
          <li className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-violet-700">Participation · sample</p>
            <p className="mt-1 text-sm font-bold text-slate-900">Amara joined this Challenge</p>
            <p className="mt-1 text-xs text-slate-500">1 hour ago</p>
          </li>
          <li className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-violet-700">{milestone ? 'Together milestone · sample' : 'Challenge lifecycle · sample'}</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{milestone ? 'The Group reached 25% of its goal' : 'The Challenge started'}</p>
            <p className="mt-1 text-xs text-slate-500">Yesterday</p>
          </li>
          <li className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-violet-700">Explicit Activity Share · sample</p>
            <p className="mt-1 text-sm font-bold text-slate-900">Amara shared Push-Up · 25 reps</p>
            <p className="mt-1 text-xs text-slate-500">30 minutes ago · own accepted value only</p>
          </li>
        </ol>
        <details className="mt-3 rounded-xl border border-dashed border-slate-300 p-3">
          <summary className="cursor-pointer text-sm font-bold text-slate-700">Show sample empty state</summary>
          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-violet-700">Empty-state example · preview only</p>
          <p className="mt-1 text-sm text-slate-600">No Challenge activity yet.</p>
        </details>
      </section>
    </div>
  );
}

export function ActivitySharePreview({
  activityName,
  value,
  unit,
  challengeTitle,
}: {
  activityName: ReactNode;
  value: number;
  unit: string;
  challengeTitle: string;
}) {
  const [choice, setChoice] = useState<'private' | 'share'>('private');
  if (!import.meta.env.DEV) return null;

  return (
    <section aria-labelledby="share-prototype-title" className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="share-prototype-title" className="text-sm font-black text-slate-900">Optional Share</h2>
        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-800">Prototype · not connected</span>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-700">Your Activity is already recorded. This preview choice is local only; nothing will be published or saved.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" aria-pressed={choice === 'share'} onClick={() => setChoice('share')} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-bold ${choice === 'share' ? 'border-violet-500 bg-white text-violet-900 ring-2 ring-violet-200' : 'border-slate-200 bg-white text-slate-700'}`}>
          Share to Challenge
        </button>
        <button type="button" aria-pressed={choice === 'private'} onClick={() => setChoice('private')} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-bold ${choice === 'private' ? 'border-slate-500 bg-white text-slate-900 ring-2 ring-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}>
          Keep private
        </button>
      </div>
      {choice === 'share' ? (
        <div className="mt-3 rounded-xl border border-violet-200 bg-white p-3" aria-label="Share preview showing permitted fields">
          <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700">Share preview · sample fields</p>
          <p className="mt-2 text-sm font-bold text-slate-900">Amara · {activityName} · {value} {unit}</p>
          <p className="mt-1 text-xs text-slate-600">{challengeTitle}</p>
          <p className="mt-2 text-[11px] text-slate-500">No notes, evidence, location, exact routine time, points, or other members&apos; data.</p>
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-white p-3 text-xs text-slate-700">Private by default. The accepted Activity remains recorded for Challenge progress.</p>
      )}
      <button type="button" disabled aria-describedby="share-prototype-note" className="mt-3 min-h-11 w-full rounded-xl bg-slate-300 px-4 py-2 text-sm font-bold text-slate-600">Publish is not connected</button>
      <p id="share-prototype-note" className="mt-1 text-center text-[11px] text-slate-600">No working Publish action · preview only</p>
    </section>
  );
}
