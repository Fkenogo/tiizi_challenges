import { Link, useParams } from 'react-router-dom';
import { V2Card, V2ErrorState, V2LoadingState, V2Page, V2SectionHeader } from '../components/V2Primitives';
import { useChallengeDetailV2 } from './useChallengeCreation';
import { endStateFor } from './challengeEndState';
import { streakFinalResultFor, streakPeriodDays } from './resultsView';
import { formatDay } from './challengeCreationDraft';

/** Full, member-authorized Streak history from the existing frozen detail read. */
export function V2FinalizedStreakHistoryScreen() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const query = useChallengeDetailV2(challengeId);
  if (query.isLoading) return <V2Page><V2LoadingState label="Loading your Challenge history…" /></V2Page>;
  if (!query.data || query.isError) return <V2Page><V2ErrorState title="We could not open this Challenge history" message="It may not be available under your current access." onRetry={() => void query.refetch()} /></V2Page>;

  const detail = query.data;
  const result = streakFinalResultFor(detail);
  const days = streakPeriodDays(detail.config.period.startDate, detail.config.period.endDate);
  if (detail.challengeType !== 'streak' || endStateFor(detail) !== 'finalized' || !result.hasFinalTruth) {
    return <V2Page><V2SectionHeader eyebrow="Challenge history" title={detail.title} description="A finalized personal Streak history is not available." /><Link className="font-bold text-primary underline" to={`/v2/challenges/${encodeURIComponent(detail.challengeId)}`}>Back to Challenge</Link></V2Page>;
  }

  return (
    <V2Page>
      <V2SectionHeader eyebrow="Personal Streak history" title={detail.title} description="Your day-by-day history from the finalized Challenge record." />
      <Link className="mb-3 inline-flex font-bold text-primary underline" to={`/v2/challenges/${encodeURIComponent(detail.challengeId)}`}>Back to Challenge result</Link>
      <V2Card>
        <p className="text-sm leading-6 text-slate-600">This is your personal history. It is not a leaderboard and is not compared with other members.</p>
        <ul aria-label="Finalized day by day history" className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {days.map((day) => {
            const complete = result.dayStates[day]?.complete === true;
            return <li key={day} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${complete ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-50 text-slate-600'}`}><span>{formatDay(day)}</span><span className="font-bold">{complete ? 'Complete' : 'Missed'}</span></li>;
          })}
        </ul>
      </V2Card>
    </V2Page>
  );
}
