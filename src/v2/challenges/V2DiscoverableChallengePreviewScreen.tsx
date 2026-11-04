import { useParams } from 'react-router-dom';
import { V2ErrorState, V2LoadingState, V2Page } from '../components/V2Primitives';
import { useV2ChallengeDiscovery } from './useChallengeDiscovery';
import { flattenDiscoveryPages, relevanceBadges } from './discoveryRelevance';
import { challengeTypeLabel, formatDayRange } from './challengeCreationDraft';
import { endStateFor, statusLabelForEndState } from './challengeEndState';
import { statusTone } from './challengePresentation';

/** Safe outsider preview. The participant-only detail API remains membership-gated. */
export function V2DiscoverableChallengePreviewScreen() {
  const { challengeId } = useParams();
  const discovery = useV2ChallengeDiscovery('relevance');
  if (discovery.isLoading) return <V2Page><V2LoadingState label="Loading Challenge…" /></V2Page>;
  if (discovery.isError) return <V2Page><V2ErrorState title="We couldn’t load this Challenge" message="Please try again." onRetry={() => void discovery.refetch()} /></V2Page>;
  const challenge = flattenDiscoveryPages(discovery.data?.pages).find((item) => item.challengeId === challengeId);
  if (!challenge) return <V2Page><V2ErrorState title="This Challenge is no longer available" message="It may no longer be open to discovery. Explore current Challenges to see what is available." /></V2Page>;
  const state = endStateFor(challenge);
  return <V2Page>
    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Challenge preview</p>
    <h1 className="mt-1 text-2xl font-black text-slate-900">{challenge.title}</h1>
    <p className="mt-2 text-sm text-slate-600">Hosted by {challenge.host.groupName ?? challenge.groupName ?? 'a Group'}</p>
    <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
      <span className="rounded-full bg-orange-50 px-2 py-1 text-primary">{challengeTypeLabel(challenge.challengeType)}</span>
      <span className={`rounded-full px-2 py-1 ${statusTone(state)}`}>{challenge.status === 'establishment' ? 'Upcoming' : statusLabelForEndState(challenge.status, state)}</span>
    </div>
    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{challenge.description || 'No description provided.'}</p>
    <p className="mt-3 text-sm text-slate-600">{formatDayRange(challenge.startDate, challenge.endDate)}</p>
    <h2 className="mt-5 font-bold text-slate-900">Activities</h2>
    <ul className="mt-2 list-inside list-disc text-sm text-slate-700">{challenge.activities.map((activity, index) => <li key={`${activity.name}-${index}`}>{activity.name} · {activity.domain === 'wellness' ? 'Wellness' : 'Fitness'}{activity.category ? ` · ${activity.category}` : ''}</li>)}</ul>
    {relevanceBadges(challenge.relevance).map((badge) => <p key={badge} className="mt-2 text-xs text-emerald-800">{badge}</p>)}
    <p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
      {challenge.host.viewerRelationship === 'pending'
        ? 'Your request to join the hosting Group is awaiting approval.'
        : challenge.host.admissionMode === 'approval'
          ? 'You need the hosting Group’s approval before you can view participation details or take part.'
          : 'Join the hosting Group to view participation details. Joining a Group does not enroll you in this Challenge.'}
    </p>
  </V2Page>;
}
