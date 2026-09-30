import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { V2Button, V2Chip, V2EmptyState, V2ErrorState, V2Field, V2LoadingState, V2Page, V2SectionHeader, V2TextInput } from '../components/V2Primitives';
import { useChallengeListV2 } from './useChallengeCreation';
import {
  challengeTypeLabel,
  formatDayRange,
} from './challengeCreationDraft';
import { endStateFor, statusLabelForEndState, type V2ChallengeEndState } from './challengeEndState';
import type { V2ChallengeSummary } from '../../api/v2ChallengeApi';
import { filterChallengeDiscovery, type ChallengeDomainFilter, type ChallengeLifecycleFilter, type ChallengeTypeFilter } from './challengeDiscovery';

const INITIAL_RESULTS = 8;

/**
 * S2b — V2 Challenges entry point.
 *
 * Real read binding to GET /v1/challenges (persisted V2 truth) with loading,
 * empty and populated states, and the Create Challenge action that starts the
 * V2 creation journey. Deliberately NOT full S3 discovery/detail/results.
 *
 * S3d (CORR-002 alignment) — the list lifecycle badge is derived from the
 * server-governed end state (`governingToday` vs `endDate`, plus `finalized`),
 * the SAME authority the detail hero uses. A window-expired-but-unprocessed
 * Challenge reads "Finished", never the raw domain status "Running"; the
 * device clock is never consulted.
 */

function statusTone(endState: V2ChallengeEndState): string {
  return endState === 'live' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600';
}

/**
 * S4a — shared with Group Home hosted-Challenge rows so both surfaces
 * present the SAME participation/end-state badges from the SAME code.
 */
export { statusTone };

function participationLabel(challenge: V2ChallengeSummary): { text: string; className: string } | null {
  // Bound directly to the authoritative read model — never inferred.
  if (challenge.myParticipation?.status === 'active') {
    return { text: 'Taking part', className: 'bg-emerald-100 text-emerald-800' };
  }
  if (challenge.status === 'ended') return null;
  if (challenge.myParticipation) {
    return { text: 'Not taking part', className: 'bg-slate-100 text-slate-600' };
  }
  return { text: 'Not joined', className: 'bg-slate-100 text-slate-600' };
}

/** S4a — shared with Group Home (see statusTone above). */
export { participationLabel };

export function V2ChallengeListScreen() {
  const navigate = useNavigate();
  const challenges = useChallengeListV2();
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState<ChallengeLifecycleFilter>('all');
  const [type, setType] = useState<ChallengeTypeFilter>('all');
  const [domain, setDomain] = useState<ChallengeDomainFilter>('all');
  const [visibleCount, setVisibleCount] = useState(INITIAL_RESULTS);
  useEffect(() => setVisibleCount(INITIAL_RESULTS), [search, lifecycle, type, domain]);

  const createAction = (
    <div className="flex flex-col items-end gap-1">
      <V2Button onClick={() => navigate('/v2/challenges/new')}>Create Challenge</V2Button>
      {/* Activity Guide is supporting Challenge guidance — a contextual
          secondary entry near Create Challenge, never a primary destination. */}
      <button
        type="button"
        onClick={() => navigate('/v2/guide')}
        className="text-[11px] font-bold text-slate-500 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-slate-900"
      >
        View Activity Guide
      </button>
    </div>
  );

  return (
    <V2Page wide>
      <V2SectionHeader
        eyebrow="Challenges"
        title="Challenges"
        description="Move together or race each other. Every Challenge belongs to a Group you are part of."
        action={createAction}
      />

      {challenges.isLoading && <V2LoadingState label="Loading your Challenges…" />}

      {challenges.isError && (
        <V2ErrorState
          title="We could not load your Challenges"
          message="Please try again. If this keeps happening, check your connection and try once more."
          onRetry={() => void challenges.refetch()}
        />
      )}

      {challenges.isSuccess && challenges.data.challenges.length === 0 && (
        <V2EmptyState
          title="No Challenges yet"
          message="Start one with a Group you belong to. You decide how it works, what counts, and when it runs."
          action={createAction}
        />
      )}

      {challenges.isSuccess && challenges.data.challenges.length > 0 && (() => {
        const filtered = filterChallengeDiscovery(challenges.data.challenges, { search, lifecycle, type, domain });
        const visible = filtered.slice(0, visibleCount);
        return <section aria-label="Challenge discovery" className="mt-5 space-y-4">
          <V2Field label="Search Challenges" hint="Search names, descriptions, Groups, Activities, type, or Fitness/Wellness categories.">
            <V2TextInput value={search} onChange={setSearch} placeholder="Search Challenges…" />
          </V2Field>
          <div className="space-y-3">
            <FilterRow label="Status" value={lifecycle} onChange={setLifecycle} options={[
              ['all', 'All'], ['active', 'Active / Ongoing'], ['upcoming', 'Scheduled / Upcoming'], ['completed', 'Completed'],
            ]} />
            <FilterRow label="Type" value={type} onChange={setType} options={[
              ['all', 'All'], ['collective', 'Together'], ['competitive', 'Race'], ['streak', 'Streak'],
            ]} />
            <FilterRow label="Domain" value={domain} onChange={setDomain} options={[
              ['all', 'All'], ['fitness', 'Fitness'], ['wellness', 'Wellness'],
            ]} />
          </div>
          {filtered.length === 0 ? <V2EmptyState title="No matching Challenges" message="Try another search or change a filter." /> : (
          <ul className="space-y-2">
          {visible.map((challenge: V2ChallengeSummary) => {
            const participation = participationLabel(challenge);
            const endState = endStateFor(challenge);
            return (
            <li key={challenge.challengeId}>
              <button
                type="button"
                onClick={() => navigate(`/v2/challenges/${challenge.challengeId}`)}
                className="flex min-h-[86px] w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-4"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-black uppercase text-slate-500" aria-hidden="true">{challengeTypeLabel(challenge.challengeType).slice(0, 1)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-primary">{challengeTypeLabel(challenge.challengeType)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone(endState)}`}>{statusLabelForEndState(challenge.status, endState)}</span>
                    {participation && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${participation.className}`}>{participation.text}</span>}
                  </span>
                  <span className="mt-1 block truncate text-sm font-black text-slate-900">{challenge.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">{challenge.groupName ?? 'Group Challenge'} · {challenge.activities.map((activity) => `${activity.name} · ${activity.domain === 'wellness' ? 'Wellness' : 'Fitness'}${activity.category ? ` · ${activity.category}` : ''}`).join(' / ')}</span>
                  <span className="mt-0.5 block text-xs font-semibold text-slate-500">{formatDayRange(challenge.startDate, challenge.endDate)}</span>
                </span>
                <span className="shrink-0 text-lg text-slate-300" aria-hidden="true">›</span>
              </button>
            </li>
            );
          })}
          </ul>)}
          {filtered.length > visible.length && <div className="flex justify-center"><V2Button variant="secondary" onClick={() => setVisibleCount((count) => count + INITIAL_RESULTS)}>View more Challenges</V2Button></div>}
        </section>;
      })()}
    </V2Page>
  );
}

function FilterRow<T extends string>({ label, value, onChange, options }: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<readonly [T, string]>;
}) {
  return <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
    <span className="w-16 shrink-0 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{label}</span>
    <div className="flex flex-wrap gap-1.5">{options.map(([key, text]) => <V2Chip key={key} selected={value === key} onClick={() => onChange(key)}>{text}</V2Chip>)}</div>
  </div>;
}
