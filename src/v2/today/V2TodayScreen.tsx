import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/apiClient';
import type {
  V2TodayJoinedChallenge,
  V2TodayOpportunity,
  V2TodayRequiredChallenge,
} from '../../api/todayApi';
import {
  V2Button,
  V2Card,
  V2EmptyState,
  V2ErrorState,
  V2LoadingState,
  V2Page,
} from '../components/V2Primitives';
import { useAuth } from '../../hooks/useAuth';
import { useV2Today } from './useV2Today';
import {
  challengeTypeLabel,
  formatAmount,
  formatGoverningDay,
  governingDayFor,
  greetingFor,
  isTodayEmpty,
  presentedJoinedChallenges,
  progressPercent,
  raceActivitySummary,
  requirementProgress,
  TODAY_SECTION_LIMIT,
  togetherSummary,
  upcomingSummary,
  visibleSectionItems,
} from './todayView';

/**
 * TIIZI S5b — Today (`/v2/today`).
 *
 * The member's action-oriented home, assembled from the single
 * server-composed `GET /api/today` projection. Today answers, in order:
 * what do I need to do today, how am I doing in my active Challenges, and
 * what else can I take part in.
 *
 * Discipline:
 * - every value is rendered as served; no domain truth is derived here;
 * - the governing Challenge day and any date context come from the server
 *   projection, never from the device clock;
 * - there is no countdown (the projection omits a day-end instant while
 *   governing-day boundary equivalence remains unproven);
 * - opportunities are Group-contextual, never recommendations or invitations;
 *   because the projection reports `joinability: 'not_asserted'`, the card
 *   offers discovery and defers joining to the governed Challenge surface;
 * - unsupported capability is omitted, never simulated: no Feed, invitations,
 *   notifications, Recognition, milestones, or payment affordances;
 * - link targets are current V2 routes only.
 */
export function V2TodayScreen() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const today = useV2Today();
  // Progressive disclosure is local presentation state only: each growing
  // section initially presents the first TODAY_SECTION_LIMIT served items in
  // server order, expanding inline on request. `Do today` is never limited.
  const [showAllChallenges, setShowAllChallenges] = useState(false);
  const [showAllOpportunities, setShowAllOpportunities] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);

  if (today.isLoading) {
    return (
      <V2Page>
        <V2LoadingState label="Loading your day…" />
      </V2Page>
    );
  }

  if (today.isError) {
    return (
      <V2Page>
        <V2ErrorState
          title="We couldn't load your day"
          message={
            today.error instanceof ApiError && today.error.status === 503
              ? 'Your day is temporarily unavailable. Please try again in a moment.'
              : 'Something went wrong loading your day. Please try again.'
          }
          onRetry={() => void today.refetch()}
        />
      </V2Page>
    );
  }

  const projection = today.data;
  if (!projection) {
    return (
      <V2Page>
        <V2ErrorState title="We couldn't load your day" onRetry={() => void today.refetch()} />
      </V2Page>
    );
  }

  const displayName = profile?.displayName ?? null;
  const timezone = projection.todayContext.timezoneContexts[0]?.timezone ?? null;
  const governingDay = governingDayFor(projection);
  // Presentation deduplication: Challenges already represented in Do today
  // are not immediately repeated in Your Challenges. Computed here, after
  // the projection is established — the loading/error flow above is
  // untouched. Server order preserved; the projection is never mutated.
  const presentedChallenges = presentedJoinedChallenges(projection);

  return (
    <V2Page>
      {/* 1. Today header — contextual greeting, governing context, active count. */}
      <header className="mb-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Today</p>
        <h1 className="mt-0.5 text-2xl font-black tracking-tight text-slate-900">
          {greetingFor(projection.todayContext.serverNow, timezone, displayName)}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
          {governingDay && <span className="font-medium">{formatGoverningDay(governingDay)}</span>}
          <span aria-hidden className="text-slate-300">•</span>
          <span>
            {projection.todayContext.activeChallengeCount === 1
              ? '1 active Challenge'
              : `${projection.todayContext.activeChallengeCount} active Challenges`}
          </span>
        </div>
      </header>

      {isTodayEmpty(projection) ? (
        <V2EmptyState
          title="Nothing needs you today"
          message="You have no active Challenges yet. When you join one, today's requirements and your progress will show up here."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <V2Button onClick={() => navigate('/v2/challenges')}>Find a Challenge</V2Button>
              <V2Button variant="secondary" onClick={() => navigate('/v2/groups')}>
                Find a Group
              </V2Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* 2. Required today — Streak Challenges with governed requirements. */}
          {projection.requiredToday.length > 0 && (
            <section aria-labelledby="today-required">
              <h2 id="today-required" className="mb-3 text-base font-black text-slate-900">
                Do today
              </h2>
              <div className="space-y-3">
                {projection.requiredToday.map((challenge) => (
                  <RequiredTodayCard
                    key={challenge.challengeId}
                    challenge={challenge}
                    onOpen={() => navigate(challenge.detailPath)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 3. Active Challenge progress, progressively disclosed, deduplicated
              against Do today (a Challenge already represented above is not
              immediately repeated here). */}
          {presentedChallenges.length > 0 && (
            <section aria-labelledby="today-progress">
              <h2 id="today-progress" className="mb-3 text-base font-black text-slate-900">
                Your Challenges
              </h2>
              <div className="space-y-3">
                {visibleSectionItems(presentedChallenges, showAllChallenges).map((challenge) => (
                  <ActiveChallengeCard
                    key={challenge.challengeId}
                    challenge={challenge}
                    onOpen={() => navigate(challenge.detailPath)}
                  />
                ))}
              </div>
              <SectionToggle
                total={presentedChallenges.length}
                expanded={showAllChallenges}
                onToggle={() => setShowAllChallenges((next) => !next)}
                label="Challenges"
              />
            </section>
          )}

          {/* 4. Group-contextual opportunities (never recommendations). */}
          {projection.groupChallengeOpportunities.length > 0 && (
            <section aria-labelledby="today-opportunities">
              <h2 id="today-opportunities" className="mb-1 text-base font-black text-slate-900">
                In your Groups
              </h2>
              <p className="mb-3 text-sm text-slate-600">
                Challenges hosted by Groups you belong to.
              </p>
              <div className="space-y-3">
                {visibleSectionItems(projection.groupChallengeOpportunities, showAllOpportunities).map((opportunity) => (
                  <OpportunityCard
                    key={opportunity.challengeId}
                    opportunity={opportunity}
                    onOpen={() => navigate(opportunity.detailPath)}
                  />
                ))}
              </div>
              <SectionToggle
                total={projection.groupChallengeOpportunities.length}
                expanded={showAllOpportunities}
                onToggle={() => setShowAllOpportunities((next) => !next)}
                label="Group Challenges"
              />
            </section>
          )}

          {/* 5. Upcoming — authoritative lifecycle boundaries only. */}
          {projection.upcoming.length > 0 && (
            <section aria-labelledby="today-upcoming">
              <h2 id="today-upcoming" className="mb-3 text-base font-black text-slate-900">
                Coming up
              </h2>
              <div className="space-y-2">
                {visibleSectionItems(projection.upcoming, showAllUpcoming).map((item) => (
                  <button
                    key={`${item.challengeId}-${item.kind}`}
                    type="button"
                    onClick={() => navigate(item.detailPath)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900">{item.title}</span>
                      <span className="mt-0.5 block text-xs font-medium text-slate-500">
                        {upcomingSummary(item)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-bold text-primary">View</span>
                  </button>
                ))}
              </div>
              <SectionToggle
                total={projection.upcoming.length}
                expanded={showAllUpcoming}
                onToggle={() => setShowAllUpcoming((next) => !next)}
                label="upcoming items"
              />
            </section>
          )}

          {/* 6. Finalized results — compact links to existing result surfaces. */}
          {projection.finalizedResults.length > 0 && (
            <section aria-labelledby="today-results">
              <h2 id="today-results" className="mb-3 text-base font-black text-slate-900">
                Recent results
              </h2>
              <div className="space-y-2">
                {projection.finalizedResults.map((result) => (
                  <button
                    key={result.challengeId}
                    type="button"
                    onClick={() => navigate(result.detailPath)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900">{result.title}</span>
                      <span className="mt-0.5 block text-xs font-medium text-slate-500">Final results</span>
                    </span>
                    <span className="shrink-0 text-xs font-bold text-primary">View</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </V2Page>
  );
}

/** One Required Today card: governing requirements with completed/pending state. */
function RequiredTodayCard({
  challenge,
  onOpen,
}: {
  challenge: V2TodayRequiredChallenge;
  onOpen: () => void;
}) {
  const { completed, total, allComplete } = requirementProgress(challenge);
  return (
    <V2Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
            {challengeTypeLabel(challenge.challengeType)}
          </p>
          <h3 className="mt-0.5 truncate text-base font-black text-slate-900">{challenge.title}</h3>
          <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{challenge.group.name}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
            allComplete ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-primary'
          }`}
        >
          {completed}/{total} done
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 px-3 py-2 text-center">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Streak</dt>
          <dd className="text-sm font-black text-slate-900">{challenge.streak.currentStreak}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Best</dt>
          <dd className="text-sm font-black text-slate-900">{challenge.streak.bestStreak}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Days</dt>
          <dd className="text-sm font-black text-slate-900">{challenge.streak.daysCompleted}</dd>
        </div>
      </dl>

      <ul className="mt-3 space-y-2">
        {challenge.requirements.map((requirement) => {
          const done = requirement.state === 'completed';
          return (
            <li key={requirement.activity} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                {/*
                  Completed vs pending is carried by shape and fill, never by a
                  hidden glyph: completed is a filled tick, pending is an empty
                  ring. The label weight and strikethrough below repeat the
                  distinction, so state never rests on colour alone.
                */}
                <span
                  aria-hidden
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-black ${
                    done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 bg-white'
                  }`}
                >
                  {done ? '✓' : ''}
                </span>
                <span className={`truncate text-sm ${done ? 'font-medium text-slate-500 line-through' : 'font-bold text-slate-900'}`}>
                  {requirement.label ?? 'Activity'}
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-slate-500">
                {formatAmount(requirement.targetValue, requirement.unit)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-center gap-2">
        <V2Button onClick={onOpen}>
          {allComplete ? 'View Challenge' : 'Log activity'}
        </V2Button>
      </div>
    </V2Card>
  );
}

/** One active Challenge card: type-specific own-progress presentation. */
function ActiveChallengeCard({
  challenge,
  onOpen,
}: {
  challenge: V2TodayJoinedChallenge;
  onOpen: () => void;
}) {
  return (
    <V2Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            {challengeTypeLabel(challenge.challengeType)}
          </p>
          <h3 className="mt-0.5 truncate text-base font-black text-slate-900">{challenge.title}</h3>
          <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
            {challenge.group.name} · {challenge.startDate} → {challenge.endDate}
          </p>
        </div>
      </div>

      {challenge.challengeType === 'collective' && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-black text-slate-900">{togetherSummary(challenge)}</p>
            {challenge.progress.goalReached && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                Goal reached
              </span>
            )}
          </div>
          <ProgressBar value={challenge.progress.groupTotal ?? 0} target={challenge.progress.target} />
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Your contribution: {formatAmount(challenge.progress.memberContribution, challenge.progress.unit)}
          </p>
        </div>
      )}

      {challenge.challengeType === 'competitive' && (
        <div className="mt-3 space-y-2">
          {challenge.progress.activities.map((activity) => (
            <div key={activity.activity}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-bold text-slate-900">{activity.label ?? 'Activity'}</span>
                <span className="shrink-0 text-xs font-semibold text-slate-500">
                  {raceActivitySummary(activity)}
                </span>
              </div>
              <ProgressBar value={activity.memberProgress} target={activity.targetValue} />
            </div>
          ))}
          {challenge.progress.finalPosition !== null && (
            <p className="text-xs font-semibold text-slate-600">
              Final position: {challenge.progress.finalPosition}
            </p>
          )}
          {challenge.progress.completionStatus === 'completed' && challenge.progress.finalPosition === null && (
            <p className="text-xs font-semibold text-emerald-700">You finished this Challenge</p>
          )}
        </div>
      )}

      {challenge.challengeType === 'streak' && (
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 px-3 py-2 text-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Streak</p>
            <p className="text-sm font-black text-slate-900">{challenge.progress.currentStreak}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Best</p>
            <p className="text-sm font-black text-slate-900">{challenge.progress.bestStreak}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Days</p>
            <p className="text-sm font-black text-slate-900">{challenge.progress.daysCompleted}</p>
          </div>
        </div>
      )}

      <div className="mt-4">
        <V2Button variant="secondary" onClick={onOpen}>
          View Challenge
        </V2Button>
      </div>
    </V2Card>
  );
}

/**
 * A Group-contextual opportunity. Deliberately offers discovery, not Join:
 * the projection reports `joinability: 'not_asserted'`, so joining stays on
 * the governed Challenge surface where membership and window are proven.
 */
function OpportunityCard({
  opportunity,
  onOpen,
}: {
  opportunity: V2TodayOpportunity;
  onOpen: () => void;
}) {
  // The projection asserts no joinability, so Today offers discovery only.
  // Joining stays on the governed Challenge surface where membership and the
  // Challenge window are re-proven. Read here so the contract is visible at
  // the call site; deliberately never used to unlock a Join action.
  void opportunity.joinability;
  const activityNames = opportunity.activities
    .map((activity) => activity.name)
    .filter((name): name is string => !!name);

  return (
    <V2Card>
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
        {challengeTypeLabel(opportunity.challengeType)}
      </p>
      <h3 className="mt-0.5 truncate text-base font-black text-slate-900">{opportunity.title}</h3>
      <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
        {opportunity.group.name} · {opportunity.startDate} → {opportunity.endDate}
      </p>
      {activityNames.length > 0 && (
        <p className="mt-2 truncate text-xs font-medium text-slate-600">{activityNames.join(' · ')}</p>
      )}
      <div className="mt-3">
        <V2Button variant="secondary" onClick={onOpen}>
          View Challenge
        </V2Button>
      </div>
    </V2Card>
  );
}

/** Daily-target progress bar. Width is clamped; the values shown stay exact. */
function ProgressBar({ value, target }: { value: number; target: number | null }) {
  const percent = progressPercent(value, target);
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100" role="presentation">
      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
    </div>
  );
}

/**
 * Progressive-disclosure toggle for one growing Today section. Renders
 * nothing when the section already fits the initial limit, so short sections
 * never gain a redundant control. Labels state the consequence honestly from
 * the served total — no count is invented.
 */
function SectionToggle({
  total,
  expanded,
  onToggle,
  label,
}: {
  total: number;
  expanded: boolean;
  onToggle: () => void;
  label: string;
}) {
  if (total <= TODAY_SECTION_LIMIT) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="mt-3 min-h-10 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-slate-50"
    >
      {expanded ? `Show less ${label}` : `View more ${label} (${total - TODAY_SECTION_LIMIT} more)`}
    </button>
  );
}
