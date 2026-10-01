import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/apiClient';
import { fetchPendingSocialCauses } from '../../api/socialCauseReviewApi';
import { useAuth } from '../../hooks/useAuth';
import { V2Placeholder } from '../components/V2Placeholder';
import { V2Card, V2ErrorState, V2LoadingState, V2Page, V2SectionHeader } from '../components/V2Primitives';

/** Console sections without an Operator-scoped capability stay explicitly unavailable. */
type OperatorPageSpec = { title: string; explanation: string; emptyTitle: string; emptyMessage: string };

const PAGES: Record<string, OperatorPageSpec> = {
  users: {
    title: 'Users',
    explanation: 'Member records and member support.',
    emptyTitle: 'User directory is not assembled',
    emptyMessage: 'No Operator-scoped member directory or member support actions are available in this console.',
  },
  groups: {
    title: 'Groups',
    explanation: 'Group records, membership, and stewardship.',
    emptyTitle: 'Group overview is not assembled',
    emptyMessage: 'Existing Group reads are member-scoped. This console has no Operator-scoped Group read or management capability.',
  },
  activities: {
    title: 'Activities & Knowledge',
    explanation: 'The shared activity and knowledge catalogue.',
    emptyTitle: 'Operator catalogue view is not assembled',
    emptyMessage: 'The current catalogue reads are used by member experiences. No Operator publishing or catalogue management controls are available here.',
  },
  challenges: {
    title: 'Challenges',
    explanation: 'Challenge state and configuration.',
    emptyTitle: 'Challenge overview is not assembled',
    emptyMessage: 'Current Challenge reads are scoped to member access. This console does not expose a platform-wide Operator Challenge view.',
  },
  templates: {
    title: 'Templates',
    explanation: 'Reusable Challenge starting points.',
    emptyTitle: 'Template management is not assembled',
    emptyMessage: 'No authoritative Operator template read or publishing capability is available in this console.',
  },
  support: {
    title: 'Donations / Support',
    explanation: 'Support is voluntary. Cause configuration is visible during Social Cause review.',
    emptyTitle: 'Platform-wide support view is not assembled',
    emptyMessage: 'Challenge support configuration is not exposed through the current Operator-scoped API. Tiizi does not execute participant payments or contributions in this console.',
  },
  content: {
    title: 'Content & Localisation',
    explanation: 'Product content and supported languages.',
    emptyTitle: 'Content management is not assembled',
    emptyMessage: 'No authoritative Operator content or localisation read and editing capability is available in this console.',
  },
  health: {
    title: 'Platform Health',
    explanation: 'Operational service health and readiness.',
    emptyTitle: 'Platform health view is not assembled',
    emptyMessage: 'The current API health checks are service endpoints, not a complete Operator health view. This page does not yet expose platform-wide health signals.',
  },
  audit: {
    title: 'Audit Log',
    explanation: 'Decision history for governed Operator actions.',
    emptyTitle: 'Console-wide audit view is not assembled',
    emptyMessage: 'Social Cause decision history remains available on each item in Review & Attention. A broader Operator audit view is not exposed here.',
  },
  settings: {
    title: 'Settings',
    explanation: 'Platform configuration.',
    emptyTitle: 'Platform settings are not assembled',
    emptyMessage: 'No authoritative Operator settings read or change capability is available in this console.',
  },
};

function OperatorOverview() {
  const { user } = useAuth();
  const pending = useQuery({
    queryKey: ['operator-social-cause-pending', user?.uid],
    queryFn: fetchPendingSocialCauses,
    enabled: !!user?.uid,
    staleTime: 0,
  });

  return (
    <V2Page wide>
      <V2SectionHeader eyebrow="Tiizi Platform Operator" title="Overview" description="A read-only snapshot of the Operator capability currently assembled." />
      {pending.isLoading ? <V2LoadingState label="Loading current review queue…" /> : pending.isError ? (
        <V2ErrorState
          title={pending.error instanceof ApiError && pending.error.status === 403 ? 'Platform Operator access required' : 'Review queue unavailable'}
          message={pending.error instanceof ApiError && pending.error.status === 403
            ? 'Sign in with the authorized Platform Operator identity to view platform review information.'
            : 'The Social Cause review queue could not be loaded. Check the local preview services and try again.'}
          onRetry={() => void pending.refetch()}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
          <V2Card>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Review & Attention</p>
            <h2 className="mt-2 text-2xl font-black">{pending.data?.length ?? 0} Social Cause{pending.data?.length === 1 ? '' : 's'} awaiting review</h2>
            <p className="mt-2 text-sm text-slate-600">This count comes from the roster-protected pending Cause queue.</p>
            {pending.data && pending.data.length > 0 && (
              <ul className="mt-4 space-y-2">
                {pending.data.slice(0, 3).map((cause) => (
                  <li key={cause.challengeId} className="rounded-lg bg-slate-50 p-3 text-sm">
                    <span className="font-bold">{cause.title}</span>
                    <span className="text-slate-600"> · {cause.challengeTitle} · {cause.groupName}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/v2/operator/review" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90">Open Social Cause review</Link>
          </V2Card>
          <V2Card>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Current operator</p>
            <h2 className="mt-2 text-xl font-black">{user?.displayName || 'Fred Kenogo'}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-700">Platform Operator</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">Environment: Local / Development Preview. Data is non-production. The current roster grant covers Social Cause review.</p>
          </V2Card>
        </div>
      )}
    </V2Page>
  );
}

function AccessOverview() {
  const { user } = useAuth();
  return (
    <V2Page wide>
      <V2SectionHeader eyebrow="Tiizi Platform Operator" title="Access & Roles" description="Who currently operates the console." />
      <V2Card>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Current sole Platform Operator</p>
        <h2 className="mt-2 text-xl font-black">{user?.displayName || 'Fred Kenogo'}</h2>
        <p className="mt-1 text-sm font-semibold">Platform Operator</p>
        <p className="mt-3 text-sm leading-6 text-slate-600">The Platform Operator roster remains authoritative. This page does not assign or change access. Additional operator invitations and bounded roles are not assembled.</p>
      </V2Card>
    </V2Page>
  );
}

export function V2OperatorPage({ section }: { section: keyof typeof PAGES | 'overview' | 'access' }) {
  if (section === 'overview') return <OperatorOverview />;
  if (section === 'access') return <AccessOverview />;
  const spec = PAGES[section];
  return (
    <V2Placeholder
      wide
      eyebrow="Tiizi Platform Operator"
      title={spec.title}
      explanation={spec.explanation}
      emptyTitle={spec.emptyTitle}
      emptyMessage={spec.emptyMessage}
    />
  );
}

export const V2_OPERATOR_SECTIONS = ['overview', ...Object.keys(PAGES)];
