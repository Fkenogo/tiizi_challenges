import { Link } from 'react-router-dom';
import { V2Button, V2Card, V2ErrorState, V2LoadingState, V2Page, V2SectionHeader } from '../components/V2Primitives';
import { useV2Profile } from './useV2Profile';
import { challengeStatusLabel } from './profileView';

/** Dedicated presentation over the existing paginated own-member Profile read. */
export function V2ProfileChallengeHistoryScreen() {
  const { profile, isLoading, error, reload, loadMoreChallenges, isLoadingChallenges, pageError } = useV2Profile();
  if (isLoading && !profile) return <V2Page><V2LoadingState label="Loading your Challenge history…" /></V2Page>;
  if (error && !profile) return <V2Page><V2ErrorState title="We could not load your Challenge history" message="Your own-member Profile history is temporarily unavailable." onRetry={() => void reload()} /></V2Page>;
  if (!profile) return <V2Page><V2ErrorState title="We could not load your Challenge history" onRetry={() => void reload()} /></V2Page>;

  const history = profile.challenges.items.filter((item) => item.bucket === 'history');
  return (
    <V2Page>
      <V2SectionHeader eyebrow="Profile" title="Challenge history" description={`${profile.challenges.historyCount} historical participation${profile.challenges.historyCount === 1 ? '' : 's'} from your own-member history.`} />
      <Link to="/v2/profile" className="mb-3 inline-flex font-bold text-primary underline">Back to Profile</Link>
      <V2Card>
        {history.length === 0 ? <p className="text-sm text-slate-600">No historical Challenges are available on this page yet.</p> : (
          <ul className="divide-y divide-slate-100">
            {history.map((item) => <li key={item.participationId} className="flex items-center justify-between gap-3 py-3">
              <Link to={`/v2/challenges/${encodeURIComponent(item.challengeId)}`} className="min-w-0 break-words text-sm font-bold text-primary underline underline-offset-2">{item.title}</Link>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">{challengeStatusLabel(item)}</span>
            </li>)}
          </ul>
        )}
        {profile.challenges.nextCursor && <V2Button variant="secondary" className="mt-3" disabled={isLoadingChallenges} onClick={() => void loadMoreChallenges()}>{isLoadingChallenges ? 'Loading…' : 'Load more history'}</V2Button>}
        {pageError?.section === 'challenges' && <p role="alert" className="mt-3 text-sm text-red-700">We couldn&apos;t load more history. Return to Profile and try again.</p>}
        <p className="mt-3 text-xs leading-5 text-slate-500">Ended Challenges awaiting finalization remain in the server&apos;s active bucket. Open a listed Challenge to see its current governed end state.</p>
      </V2Card>
    </V2Page>
  );
}
