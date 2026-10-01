import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../api/apiClient';
import {
  fetchOperatorAccess, fetchOperatorActivities, fetchOperatorAudit, fetchOperatorChallenge,
  fetchOperatorChallenges, fetchOperatorGroup, fetchOperatorGroups, fetchOperatorHealth,
  fetchOperatorLocalisation, fetchOperatorMember, fetchOperatorMembers, fetchOperatorOverview,
  fetchOperatorSupport,
} from '../../api/operatorConsoleApi';
import { useAuth } from '../../hooks/useAuth';
import { V2Card, V2ErrorState, V2LoadingState, V2Page, V2SectionHeader } from '../components/V2Primitives';

type Section = 'overview' | 'users' | 'groups' | 'activities' | 'challenges' | 'templates' | 'access' | 'support' | 'content' | 'health' | 'audit' | 'settings';
type Item = Record<string, any>;

const LABELS: Record<Section, string> = {
  overview: 'Overview', users: 'Users', groups: 'Groups', activities: 'Activities & Knowledge',
  challenges: 'Challenges', templates: 'Templates', access: 'Access & Roles', support: 'Donations / Support',
  content: 'Content & Localisation', health: 'Platform Health', audit: 'Audit Log', settings: 'Settings',
};
const URLS: Record<Section, string> = {
  overview: 'overview', users: 'users', groups: 'groups', activities: 'activities', challenges: 'challenges',
  templates: 'templates', access: 'access', support: 'support', content: 'content', health: 'health', audit: 'audit', settings: 'settings',
};

function date(value: unknown): string {
  if (!value) return '—';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.valueOf()) ? String(value) : parsed.toLocaleString();
}
function shortId(value: unknown): string { return typeof value === 'string' ? value.slice(0, 8) : '—'; }
function statusClass(value: unknown): string {
  const state = String(value ?? '').toLowerCase();
  return `inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${state.includes('approved') || state === 'active' || state === 'healthy' ? 'bg-emerald-100 text-emerald-800' : state.includes('pending') || state === 'establishment' || state === 'unknown' ? 'bg-amber-100 text-amber-800' : state === 'ended' || state === 'finalized' || state === 'revision_required' || state === 'unhealthy' ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-700'}`;
}

function ShellPage({ section, description, action, children }: { section: Section; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <V2Page wide><V2SectionHeader eyebrow="Tiizi Platform Operator" title={LABELS[section]} description={description} action={action} />{children}</V2Page>;
}
function LoadOrError({ query, children }: { query: { isLoading: boolean; isError: boolean; error?: unknown; refetch: () => unknown }; children: React.ReactNode }) {
  if (query.isLoading) return <V2LoadingState label="Loading authoritative Development data…" />;
  if (query.isError) {
    const error = query.error;
    const status = error instanceof ApiError ? error.status : undefined;
    const code = error instanceof ApiError ? error.code : undefined;
    const title = status === 401
      ? 'Sign-in required'
      : status === 403
        ? 'Platform Operator access denied'
        : status === 503
          ? 'Local API or database unavailable'
          : status && status >= 500
            ? 'Operator read failed in the API'
            : code === 'invalid_response'
              ? 'Operator API returned an invalid response'
              : 'Operator data could not be loaded';
    const message = status === 401
      ? 'Your session is not authenticated. Sign in again, then retry.'
      : status === 403
        ? 'This authenticated account does not have an active Platform Operator Console read grant.'
        : status === 503
          ? 'The browser could not reach the local API. Check that it is running, the Development database is ready, and the frontend origin is in the local API CORS allowlist.'
          : status && status >= 500
            ? 'The API could not complete this read. Check the local API log for the request and database error.'
            : code === 'invalid_response'
              ? 'The API response could not be parsed. Check that the frontend and local API are from the same preview build.'
              : 'The Operator read could not be completed. Retry or check the local API.';
    const diagnostic = import.meta.env.DEV && error instanceof ApiError
      ? `Development diagnostic: HTTP ${error.status} · ${error.code}`
      : undefined;
    return <V2ErrorState title={title} message={diagnostic ? `${message} ${diagnostic}` : message} onRetry={() => void query.refetch()} />;
  }
  return <>{children}</>;
}
function SearchBox({ value, onChange, placeholder = 'Search authoritative records…' }: { value: string; onChange: (next: string) => void; placeholder?: string }) {
  return <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} className="min-w-[220px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />;
}
function SelectBox({ value, onChange, label, options }: { value: string; onChange: (next: string) => void; label: string; options: Array<[string, string]> }) {
  return <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">{options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select>;
}
function Metric({ label, value, to, tone = 'slate' }: { label: string; value: unknown; to?: string; tone?: 'slate' | 'orange' | 'amber' | 'green' }) {
  const style = tone === 'orange' ? 'border-orange-200 bg-orange-50' : tone === 'amber' ? 'border-amber-200 bg-amber-50' : tone === 'green' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white';
  return <div className={`rounded-xl border p-4 ${style}`}><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-900">{String(value ?? '—')}</p>{to && <Link className="mt-2 inline-block text-xs font-bold text-primary hover:underline" to={to}>Inspect records →</Link>}</div>;
}
function CompactDeferred({ section, reason }: { section: Section; reason: string }) {
  return <ShellPage section={section} description={reason}><V2Card><p className="text-sm font-semibold text-slate-800">This capability is not available in the current Product Truth.</p><p className="mt-1 text-sm text-slate-600">{reason}</p></V2Card></ShellPage>;
}

function OperatorOverview() {
  const query = useQuery({ queryKey: ['operator-console', 'overview'], queryFn: fetchOperatorOverview, staleTime: 10_000 });
  const data = query.data;
  const counts = data?.counts;
  return <ShellPage section="overview" description="Authoritative snapshot of Tiizi Development data and the work that currently needs attention.">
    <LoadOrError query={query}>
      {data && <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Members" value={counts?.members} to="/v2/operator/users" />
          <Metric label="Groups" value={counts?.groups} to="/v2/operator/groups" />
          <Metric label="Challenges" value={counts?.challenges} to="/v2/operator/challenges" />
          <Metric label="Pending Cause reviews" value={counts?.pending_causes} to="/v2/operator/review" tone="amber" />
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
          <V2Card>
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-base font-black">Challenge lifecycle</h2><p className="mt-1 text-xs text-slate-500">Counts from the Challenge state and finalization records.</p></div><Link className="text-xs font-bold text-primary" to="/v2/operator/challenges">Open Challenges →</Link></div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">{data.lifecycle.map((state) => <div key={state.status} className="rounded-lg bg-slate-50 p-3"><span className={statusClass(state.status)}>{state.status}</span><p className="mt-2 text-xl font-black">{state.count}</p></div>)}<div className="rounded-lg bg-slate-50 p-3"><span className={statusClass('finalized')}>finalized</span><p className="mt-2 text-xl font-black">{data.finalizedChallenges}</p></div></div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600"><span>Support Tiizi enabled: <strong>{data.support.enabled}</strong></span><span>disabled: <strong>{data.support.disabled}</strong></span><span>with Social Cause: <strong>{data.support.with_social_cause}</strong></span><Link className="font-bold text-primary" to="/v2/operator/support">Inspect configuration →</Link></div>
          </V2Card>
          <V2Card>
            <div className="flex items-center justify-between gap-2"><div><h2 className="text-base font-black">Review & Attention</h2><p className="mt-1 text-xs text-slate-500">The governed decision queue.</p></div><Link className="text-xs font-bold text-primary" to="/v2/operator/review">Open queue →</Link></div>
            <p className="mt-5 text-4xl font-black">{counts?.pending_causes ?? 0}</p><p className="text-sm text-slate-600">Social Causes awaiting review</p>
            <div className="mt-4 flex flex-wrap gap-2">{data.causes.map((cause) => <span key={cause.status} className={`${statusClass(cause.status)} gap-2`}>{cause.status.replace('_', ' ')} <strong>{cause.count}</strong></span>)}</div>
          </V2Card>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <V2Card><div className="flex items-center justify-between"><h2 className="text-base font-black">Recent accepted Challenge Activity</h2><Link className="text-xs font-bold text-primary" to="/v2/operator/activities">Browse Activity →</Link></div>{data.recentAcceptedActivities.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead><tr className="border-b text-slate-500"><th className="py-2 pr-3">Accepted</th><th className="py-2 pr-3">Activity</th><th className="py-2 pr-3">Challenge / Group</th><th className="py-2">Value</th></tr></thead><tbody>{data.recentAcceptedActivities.map((row: Item) => <tr key={row.recordId} className="border-b last:border-0"><td className="py-2 pr-3">{date(row.acceptedAt)}</td><td className="py-2 pr-3 font-semibold">{row.activityName || 'Activity definition unavailable'}</td><td className="py-2 pr-3">{row.challengeTitle} · {row.groupName}</td><td className="py-2">{row.value} {row.unit}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-slate-500">No accepted Challenge Activity records.</p>}</V2Card>
          <V2Card><div className="flex items-center justify-between"><h2 className="text-base font-black">Recent governed decisions</h2><Link className="text-xs font-bold text-primary" to="/v2/operator/audit">Open Cause audit →</Link></div>{data.recentCauseDecisions.length ? <ul className="mt-3 divide-y">{data.recentCauseDecisions.map((row: Item) => <li key={row.decisionId} className="py-3"><p className="text-sm font-bold">{row.causeTitle} · {row.decision.replace('_', ' ')}</p><p className="mt-1 text-xs text-slate-500">{row.challengeTitle} · {date(row.decidedAt)}</p><p className="mt-1 text-xs text-slate-600">{row.reason}</p></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No Cause decisions recorded yet.</p>}</V2Card>
        </div>
        <div className="flex flex-wrap gap-2">{(['users', 'groups', 'activities', 'challenges', 'support', 'access', 'health'] as Section[]).map((key) => <Link key={key} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-orange-300 hover:text-primary" to={`/v2/operator/${URLS[key]}`}>{LABELS[key]} →</Link>)}</div>
      </div>}
    </LoadOrError>
  </ShellPage>;
}

function OperatorUsers() {
  const [q, setQ] = useState(''); const [selected, setSelected] = useState('');
  const list = useQuery({ queryKey: ['operator-console', 'members', q], queryFn: () => fetchOperatorMembers({ q }), staleTime: 10_000 });
  const data = list.data as Item | undefined; const rows = (data?.members ?? []) as Item[];
  const selectedId = rows.some((row) => row.memberId === selected) ? selected : rows[0]?.memberId ?? '';
  const detail = useQuery({ queryKey: ['operator-console', 'member', selectedId], queryFn: () => fetchOperatorMember(selectedId), enabled: !!selectedId });
  return <ShellPage section="users" description="Read-only member directory with participation and Group context from PostgreSQL.">
    <LoadOrError query={list}>
      <div className="mb-3 flex flex-wrap gap-2"><SearchBox value={q} onChange={setQ} placeholder="Search member UUID or stored role…" /><span className="self-center text-xs text-slate-500">{rows.length} shown · bounded list</span></div>
      <p className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">The authoritative member model has no profile name, email, or account-state fields. Member UUIDs are shown as identity references; no Firebase UID or private profile data is exposed.</p>
      <div className="grid gap-4 2xl:grid-cols-[minmax(480px,1.2fr)_minmax(380px,0.8fr)]">
        <V2Card><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-xs"><thead><tr className="border-b text-slate-500"><th className="py-2 pr-3">Member</th><th className="py-2 pr-3">Stored role</th><th className="py-2 pr-3">Groups</th><th className="py-2 pr-3">Active Challenges</th><th className="py-2">Accepted Activity</th></tr></thead><tbody>{rows.map((row) => <tr key={row.memberId} onClick={() => setSelected(row.memberId)} className={`cursor-pointer border-b last:border-0 hover:bg-orange-50 ${selectedId === row.memberId ? 'bg-orange-50' : ''}`}><td className="py-2 pr-3 font-mono font-bold">{shortId(row.memberId)}</td><td className="py-2 pr-3">{row.memberRole}</td><td className="py-2 pr-3">{row.activeGroups}</td><td className="py-2 pr-3">{row.activeChallenges}</td><td className="py-2">{row.acceptedChallengeActivities}</td></tr>)}</tbody></table></div>{!rows.length && <p className="py-8 text-center text-sm text-slate-500">No members match the search.</p>}</V2Card>
        <V2Card><h2 className="font-black">Member inspection</h2>{detail.isLoading ? <p className="mt-3 text-sm text-slate-500">Select a member to inspect.</p> : detail.data && <><p className="mt-2 break-all font-mono text-sm">{detail.data.memberId}</p><p className="mt-1 text-xs text-slate-500">Stored role: {detail.data.memberRole} · Created {date(detail.data.createdAt)}</p><div className="mt-4 grid grid-cols-2 gap-2"><Metric label="Active Groups" value={detail.data.activeGroups} /><Metric label="Challenge episodes" value={detail.data.challengeEpisodes} /></div><h3 className="mt-4 text-xs font-black uppercase text-slate-500">Group memberships</h3><ul className="mt-2 divide-y">{((detail.data.groups ?? []) as Item[]).map((group) => <li key={group.groupId} className="py-2 text-xs">{group.groupName} · {group.role} · {group.status}</li>)}</ul><h3 className="mt-4 text-xs font-black uppercase text-slate-500">Challenge participation</h3><ul className="mt-2 divide-y">{((detail.data.challenges ?? []) as Item[]).map((challenge) => <li key={`${challenge.challengeId}-${challenge.joinedAt}`} className="py-2 text-xs">{challenge.title} · {challenge.type} · {challenge.status} · {challenge.participationStatus}</li>)}</ul></>}</V2Card>
      </div>
    </LoadOrError>
  </ShellPage>;
}

function OperatorGroups() {
  const [q, setQ] = useState(''); const [visibility, setVisibility] = useState(''); const [status, setStatus] = useState(''); const [selected, setSelected] = useState('');
  const list = useQuery({ queryKey: ['operator-console', 'groups', q, visibility, status], queryFn: () => fetchOperatorGroups({ q, visibility, status }), staleTime: 10_000 });
  const rows = (((list.data as Item | undefined)?.groups ?? []) as Item[]);
  const selectedId = rows.some((row) => row.groupId === selected) ? selected : rows[0]?.groupId ?? '';
  const detail = useQuery({ queryKey: ['operator-console', 'group', selectedId], queryFn: () => fetchOperatorGroup(selectedId), enabled: !!selectedId });
  return <ShellPage section="groups" description="Group directory and drill-down using the authoritative PostgreSQL Group and membership model.">
    <LoadOrError query={list}><div className="mb-3 flex flex-wrap gap-2"><SearchBox value={q} onChange={setQ} placeholder="Search Group name or identifier…" /><SelectBox label="Group visibility" value={visibility} onChange={setVisibility} options={ [['','All visibility'],['public','Public'],['private','Private']] } /><SelectBox label="Group status" value={status} onChange={setStatus} options={ [['','All states'],['active','Active']] } /></div>
      <div className="grid gap-4 2xl:grid-cols-[minmax(480px,1.2fr)_minmax(380px,0.8fr)]"><V2Card><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead><tr className="border-b text-slate-500"><th className="py-2 pr-3">Group</th><th className="py-2 pr-3">Visibility</th><th className="py-2 pr-3">Steward reference</th><th className="py-2 pr-3">Members</th><th className="py-2 pr-3">Challenges</th><th className="py-2">State</th></tr></thead><tbody>{rows.map((row) => <tr key={row.groupId} onClick={() => setSelected(row.groupId)} className={`cursor-pointer border-b last:border-0 hover:bg-orange-50 ${selectedId === row.groupId ? 'bg-orange-50' : ''}`}><td className="py-2 pr-3 font-bold">{row.name}</td><td className="py-2 pr-3">{row.isPrivate ? 'Private' : 'Public'}</td><td className="py-2 pr-3 font-mono">{shortId(row.stewardMemberId)}</td><td className="py-2 pr-3">{row.memberCount}</td><td className="py-2 pr-3">{row.challengeCount}</td><td className="py-2"><span className={statusClass(row.status)}>{row.status}</span></td></tr>)}</tbody></table></div></V2Card>
        <V2Card><h2 className="font-black">Group inspection</h2>{detail.data && <><h3 className="mt-2 text-lg font-black">{detail.data.name}</h3><p className="mt-1 text-sm text-slate-600">{detail.data.description || 'No description recorded.'}</p><p className="mt-2 text-xs text-slate-500">{detail.data.isPrivate ? 'Private' : 'Public'} · {detail.data.status} · steward {shortId(detail.data.stewardMemberId)}</p><p className="mt-1 text-xs text-slate-500">Member approval required: {detail.data.requireAdminApproval ? 'yes' : 'no'} · Member-created Challenges allowed: {detail.data.allowMemberChallenges ? 'yes' : 'no'}</p><h4 className="mt-4 text-xs font-black uppercase text-slate-500">Memberships ({(detail.data.memberships as Item[] | undefined)?.length ?? 0})</h4><ul className="mt-2 max-h-44 divide-y overflow-y-auto">{((detail.data.memberships ?? []) as Item[]).map((m) => <li key={m.memberId} className="py-2 text-xs"><span className="font-mono">{shortId(m.memberId)}</span> · {m.role} · {m.status}</li>)}</ul><h4 className="mt-4 text-xs font-black uppercase text-slate-500">Related Challenges</h4><ul className="mt-2 divide-y">{((detail.data.challenges ?? []) as Item[]).map((c) => <li key={c.challengeId} className="py-2 text-xs"><Link className="font-bold text-primary" to={`/v2/operator/challenges?selected=${c.challengeId}`}>{c.title}</Link> · {c.type} · {c.status}</li>)}</ul></>}</V2Card>
      </div>
    </LoadOrError>
  </ShellPage>;
}

function OperatorActivities() {
  const [q, setQ] = useState(''); const [kind, setKind] = useState(''); const [lifecycle, setLifecycle] = useState('');
  const query = useQuery({ queryKey: ['operator-console', 'activities', q, kind, lifecycle], queryFn: () => fetchOperatorActivities({ q, kind, lifecycle }), staleTime: 10_000 });
  const data = query.data as Item | undefined; const items = (data?.items ?? []) as Item[]; const events = (data?.recentAcceptedRecords ?? []) as Item[];
  return <ShellPage section="activities" description="Canonical Activity definitions are distinct from accepted member evidence applied to Challenges.">
    <LoadOrError query={query}><div className="mb-3 flex flex-wrap gap-2"><SearchBox value={q} onChange={setQ} placeholder="Search Activity name, code or category…" /><SelectBox label="Activity kind" value={kind} onChange={setKind} options={ [['','All kinds'],['fitness','Fitness'],['wellness','Wellness']] } /><SelectBox label="Catalogue state" value={lifecycle} onChange={setLifecycle} options={ [['','All lifecycle states'],['published','Published'],['draft','Draft'],['retired','Retired']] } /></div>
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(480px,0.85fr)]"><V2Card><div className="flex items-center justify-between"><h2 className="font-black">Activity definitions / Knowledge catalogue</h2><span className="text-xs text-slate-500">{items.length} shown</span></div><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead><tr className="border-b text-slate-500"><th className="py-2 pr-3">Code / Name</th><th className="py-2 pr-3">Kind</th><th className="py-2 pr-3">Category</th><th className="py-2 pr-3">Lifecycle</th><th className="py-2 pr-3">Version</th><th className="py-2">Locale</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="py-2 pr-3"><p className="font-bold">{item.name}</p><p className="font-mono text-[10px] text-slate-500">{item.activityCode ?? shortId(item.id)}</p><p className="mt-1 max-w-md text-slate-500">{item.description}</p></td><td className="py-2 pr-3">{item.kind}</td><td className="py-2 pr-3">{item.category || '—'}{item.subcategory ? ` / ${item.subcategory}` : ''}</td><td className="py-2 pr-3"><span className={statusClass(item.lifecycle)}>{item.lifecycle}</span></td><td className="py-2 pr-3">v{item.currentVersion}</td><td className="py-2">{item.defaultLocale}{item.grandfathered ? ' · legacy published' : ''}</td></tr>)}</tbody></table></div></V2Card>
        <V2Card><div className="flex items-center justify-between"><h2 className="font-black">Accepted Activity applied to Challenges</h2><span className="text-xs text-slate-500">{events.length} shown</span></div><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead><tr className="border-b text-slate-500"><th className="py-2 pr-3">Accepted</th><th className="py-2 pr-3">Member Activity</th><th className="py-2 pr-3">Challenge / Group</th><th className="py-2">Value</th></tr></thead><tbody>{events.map((event) => <tr key={event.recordId} className="border-b last:border-0"><td className="py-2 pr-3">{date(event.acceptedAt)}</td><td className="py-2 pr-3">{event.activityName}<span className="block font-mono text-[10px] text-slate-500">{event.activityCode}</span></td><td className="py-2 pr-3">{event.challengeTitle}<span className="block text-slate-500">{event.groupName}</span></td><td className="py-2">{event.value} {event.unit}</td></tr>)}</tbody></table></div><p className="mt-3 text-[11px] text-slate-500">These rows are accepted Challenge application records, not a general personal Activity-history feed.</p></V2Card></div>
    </LoadOrError>
  </ShellPage>;
}

function OperatorChallenges() {
  const params = new URLSearchParams(window.location.search);
  const [q, setQ] = useState(''); const [status, setStatus] = useState(''); const [type, setType] = useState(''); const [support, setSupport] = useState(''); const [selected, setSelected] = useState(params.get('selected') ?? '');
  const list = useQuery({ queryKey: ['operator-console', 'challenges', q, status, type, support], queryFn: () => fetchOperatorChallenges({ q, status, type, supportTiizi: support }), staleTime: 10_000 });
  const rows = (((list.data as Item | undefined)?.challenges ?? []) as Item[]);
  const selectedId = rows.some((row) => row.challengeId === selected) ? selected : rows[0]?.challengeId ?? '';
  const detail = useQuery({ queryKey: ['operator-console', 'challenge', selectedId], queryFn: () => fetchOperatorChallenge(selectedId), enabled: !!selectedId });
  return <ShellPage section="challenges" description="Platform-wide Challenge visibility across authoritative lifecycle, participation, Cause, and Support Tiizi records.">
    <LoadOrError query={list}><div className="mb-3 flex flex-wrap gap-2"><SearchBox value={q} onChange={setQ} placeholder="Search Challenge or Group…" /><SelectBox label="Challenge state" value={status} onChange={setStatus} options={ [['','All states'],['establishment','Establishment'],['active','Active'],['ended','Ended']] } /><SelectBox label="Challenge type" value={type} onChange={setType} options={ [['','All types'],['collective','Together / Collective'],['competitive','Race / Competitive'],['streak','Streak']] } /><SelectBox label="Support Tiizi" value={support} onChange={setSupport} options={ [['','All Support Tiizi states'],['enabled','Enabled'],['disabled','Disabled']] } /></div>
      <div className="grid gap-4 2xl:grid-cols-[minmax(560px,1.25fr)_minmax(400px,0.75fr)]"><V2Card><div className="overflow-x-auto"><table className="w-full min-w-[830px] text-left text-xs"><thead><tr className="border-b text-slate-500"><th className="py-2 pr-3">Challenge</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Group</th><th className="py-2 pr-3">Lifecycle / dates</th><th className="py-2 pr-3">Participants</th><th className="py-2 pr-3">Cause</th><th className="py-2">Support</th></tr></thead><tbody>{rows.map((row) => <tr key={row.challengeId} onClick={() => setSelected(row.challengeId)} className={`cursor-pointer border-b last:border-0 hover:bg-orange-50 ${selectedId === row.challengeId ? 'bg-orange-50' : ''}`}><td className="py-2 pr-3 font-bold">{row.title}</td><td className="py-2 pr-3">{row.type}</td><td className="py-2 pr-3">{row.groupName}</td><td className="py-2 pr-3"><span className={statusClass(row.status)}>{row.status}</span><span className="mt-1 block text-[10px] text-slate-500">{String(row.startDate).slice(0, 10)} – {String(row.endDate).slice(0, 10)}</span></td><td className="py-2 pr-3">{row.activeParticipationCount} active / {row.participationCount} episodes</td><td className="py-2 pr-3">{row.causeStatus ?? '—'}</td><td className="py-2">{row.supportTiiziEnabled ? 'Enabled' : 'Disabled'}</td></tr>)}</tbody></table></div></V2Card>
        <V2Card><h2 className="font-black">Challenge inspection</h2>{detail.data && <><h3 className="mt-2 text-lg font-black">{detail.data.title}</h3><p className="mt-1 text-xs text-slate-500">{detail.data.type} · {detail.data.status} · {detail.data.groupName} · {detail.data.groupIsPrivate ? 'private Group' : 'public Group'}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{detail.data.description || 'No description recorded.'}</p>{detail.data.instructions && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{detail.data.instructions}</p>}<dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="font-bold text-slate-500">Schedule</dt><dd>{String(detail.data.startDate).slice(0, 10)} – {String(detail.data.endDate).slice(0, 10)}</dd></div><div><dt className="font-bold text-slate-500">Lifecycle events</dt><dd>Activated {date(detail.data.activatedAt)} · Ended {date(detail.data.endedAt)} · Finalized {date(detail.data.finalizedAt)}</dd></div><div><dt className="font-bold text-slate-500">Participation</dt><dd>{detail.data.activeParticipationCount} active / {detail.data.participationCount} total episodes</dd></div><div><dt className="font-bold text-slate-500">Governing version</dt><dd>v{detail.data.configVersion}</dd></div><div><dt className="font-bold text-slate-500">Support Tiizi</dt><dd>{detail.data.supportTiiziEnabled ? 'Enabled' : 'Disabled'}</dd></div><div><dt className="font-bold text-slate-500">Creator reference</dt><dd className="font-mono">{shortId(detail.data.creatorMemberId)}</dd></div></dl>{detail.data.causeTitle && <div className="mt-4 rounded-lg border border-slate-200 p-3"><h4 className="font-bold">Social Cause · {detail.data.causeStatus}</h4><p className="mt-1 text-sm">{detail.data.causeTitle}</p><p className="mt-1 text-xs text-slate-600">{detail.data.beneficiary} · destination owned by {detail.data.destinationOwner}</p><p className="mt-1 break-all font-mono text-xs text-slate-600">{detail.data.paymentDestinationReference}</p></div>}</>}</V2Card></div>
    </LoadOrError>
  </ShellPage>;
}

function OperatorSupport() {
  const [q, setQ] = useState('');
  const query = useQuery({ queryKey: ['operator-console', 'support', q], queryFn: () => fetchOperatorSupport({ q }), staleTime: 10_000 });
  const rows = (((query.data as Item | undefined)?.configurations ?? []) as Item[]);
  return <ShellPage section="support" description="Support Tiizi and Social Cause configuration across Challenges. Configuration visibility only; this is not a payment ledger.">
    <LoadOrError query={query}><div className="mb-3 flex flex-wrap items-center gap-2"><SearchBox value={q} onChange={setQ} placeholder="Search Challenge, Group or beneficiary…" /><span className="text-xs text-slate-500">{rows.length} configurations</span></div><V2Card><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead><tr className="border-b text-slate-500"><th className="py-2 pr-3">Challenge / Group</th><th className="py-2 pr-3">Type / lifecycle</th><th className="py-2 pr-3">Support Tiizi</th><th className="py-2 pr-3">Social Cause</th><th className="py-2 pr-3">Beneficiary / ownership</th><th className="py-2">Destination reference</th></tr></thead><tbody>{rows.map((row) => <tr key={row.challengeId} className="border-b last:border-0"><td className="py-2 pr-3"><Link className="font-bold text-primary" to={`/v2/operator/challenges?selected=${row.challengeId}`}>{row.challengeTitle}</Link><span className="block text-slate-500">{row.groupName}</span></td><td className="py-2 pr-3">{row.challengeType} · {row.challengeStatus}<span className="block text-slate-500">{String(row.startDate).slice(0, 10)} – {String(row.endDate).slice(0, 10)}</span></td><td className="py-2 pr-3">{row.supportTiiziEnabled ? 'Enabled' : 'Disabled'}</td><td className="py-2 pr-3">{row.causeTitle ? <>{row.causeTitle}<span className="block">{row.causeStatus}</span></> : 'No Cause configured'}</td><td className="py-2 pr-3">{row.beneficiary ?? '—'}<span className="block text-slate-500">{row.destinationOwner ? `Destination owner: ${row.destinationOwner}` : '—'}</span></td><td className="break-all py-2 font-mono">{row.paymentDestinationReference ?? '—'}</td></tr>)}</tbody></table></div><p className="mt-3 border-t pt-3 text-xs text-slate-500">Participant support remains voluntary. Tiizi does not hold or escrow beneficiary funds. Contribution, payment, settlement, and reconciliation records are not represented here.</p></V2Card></LoadOrError>
  </ShellPage>;
}

function OperatorContent() {
  const [q, setQ] = useState('');
  const query = useQuery({ queryKey: ['operator-console', 'localisation', q], queryFn: () => fetchOperatorLocalisation({ q }), staleTime: 10_000 });
  const data = query.data as Item | undefined; const rows = (data?.localisedFields ?? []) as Item[];
  const coverage = (data?.coverage ?? []) as Item[];
  return <ShellPage section="content" description="Read-only locale overrides attached to canonical Activity and Knowledge identities.">
    <LoadOrError query={query}><div className="mb-3 flex flex-wrap gap-2"><SearchBox value={q} onChange={setQ} placeholder="Search item, locale, field or text…" /><span className="self-center text-xs text-slate-500">Translation editing is not exposed.</span></div><div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,0.8fr)]"><V2Card><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-xs"><thead><tr className="border-b text-slate-500"><th className="py-2 pr-3">Activity / Knowledge</th><th className="py-2 pr-3">Locale</th><th className="py-2 pr-3">Field</th><th className="py-2 pr-3">Default locale</th><th className="py-2">Stored value</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.knowledgeId}-${row.locale}-${row.field}`} className="border-b last:border-0"><td className="py-2 pr-3 font-bold">{row.itemName}<span className="block font-mono text-[10px] font-normal text-slate-500">{row.activityCode ?? shortId(row.knowledgeId)}</span></td><td className="py-2 pr-3">{row.locale}</td><td className="py-2 pr-3">{row.field}</td><td className="py-2 pr-3">{row.defaultLocale}</td><td className="max-w-lg whitespace-pre-wrap py-2">{row.value}</td></tr>)}</tbody></table></div>{!rows.length && <p className="py-6 text-center text-sm text-slate-500">No locale override rows match this search.</p>}</V2Card><V2Card><h2 className="font-black">Stored locale coverage</h2><p className="mt-1 text-xs text-slate-500">Counts from canonical knowledge_item_texts.</p><ul className="mt-3 divide-y">{coverage.map((row) => <li key={row.locale} className="flex justify-between py-2 text-sm"><span>{row.locale}</span><span className="text-slate-600">{row.itemsWithText} items · {row.translatedFields} fields</span></li>)}</ul><h3 className="mt-4 text-xs font-black uppercase text-slate-500">Catalogue default locales</h3><ul className="mt-2 divide-y">{((data?.defaultLocales ?? []) as Item[]).map((row) => <li key={row.locale} className="flex justify-between py-2 text-sm"><span>{row.locale}</span><span>{row.catalogueItems} items</span></li>)}</ul></V2Card></div></LoadOrError>
  </ShellPage>;
}

function OperatorAccess() {
  const { user } = useAuth(); const query = useQuery({ queryKey: ['operator-console', 'access'], queryFn: fetchOperatorAccess, staleTime: 10_000 });
  const data = query.data as Item | undefined;
  return <ShellPage section="access" description="Current read access and Social Cause decision authority, shown separately by scope.">
    <LoadOrError query={query}>{data && <div className="grid gap-4 xl:grid-cols-2"><V2Card><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Current Platform Operator</p><h2 className="mt-2 text-2xl font-black">{user?.displayName || 'Fred Kenogo'}</h2><p className="text-sm font-semibold text-slate-700">Platform Operator</p><p className="mt-3 text-sm text-slate-600">Local / Development Preview. Data is non-production. The Console reader grant provides read-only access; Social Cause decisions use a separate explicit grant.</p><p className="mt-4 font-mono text-xs text-slate-500">Member reference {data.currentOperatorMemberId}</p></V2Card><V2Card><h2 className="font-black">Console read grants</h2><ul className="mt-3 divide-y">{((data.consoleReaders ?? []) as Item[]).map((row) => <li key={row.memberId} className="py-2 text-xs"><p className="font-mono font-bold">{row.memberId}</p><p>{row.grantReference} · {row.revokedAt ? `revoked ${date(row.revokedAt)}` : 'active'}</p></li>)}</ul><h2 className="mt-5 border-t pt-4 font-black">Social Cause decision grants</h2><ul className="mt-3 divide-y">{((data.socialCauseReviewers ?? []) as Item[]).map((row) => <li key={row.memberId} className="py-2 text-xs"><p className="font-mono font-bold">{row.memberId}</p><p>{row.grantReference} · {row.revokedAt ? `revoked ${date(row.revokedAt)}` : 'active'}</p></li>)}</ul><p className="mt-3 text-xs text-slate-500">This view is read-only. It does not invite operators or change grants.</p></V2Card></div>}</LoadOrError>
  </ShellPage>;
}

function OperatorHealth() {
  const query = useQuery({ queryKey: ['operator-console', 'health'], queryFn: fetchOperatorHealth, staleTime: 0, refetchInterval: 30_000 });
  return <ShellPage section="health" description="Live API process and database connectivity checks; no simulated telemetry is shown.">
    <LoadOrError query={query}>{query.data && <div className="grid gap-4 md:grid-cols-2"><Metric label="Tiizi API" value={query.data.api} tone="green" /><Metric label="PostgreSQL" value={query.data.database} tone="green" /><V2Card className="md:col-span-2"><h2 className="font-black">Check details</h2><p className="mt-2 text-sm text-slate-600">Checked {date(query.data.checkedAt)} · {query.data.scope}.</p><p className="mt-2 text-xs text-slate-500">Auth emulator, background scheduling, notification delivery, storage, and external integrations are not currently represented by a health read model.</p><button onClick={() => void query.refetch()} className="mt-3 rounded-lg border px-3 py-2 text-xs font-bold hover:bg-slate-50">Refresh checks</button></V2Card></div>}</LoadOrError>
  </ShellPage>;
}

function OperatorAudit() {
  const [q, setQ] = useState(''); const [decision, setDecision] = useState('');
  const query = useQuery({ queryKey: ['operator-console', 'audit', q, decision], queryFn: () => fetchOperatorAudit({ q, decision }), staleTime: 10_000 });
  const rows = (((query.data as Item | undefined)?.decisions ?? []) as Item[]);
  return <ShellPage section="audit" description="The current authoritative Console audit source is Social Cause decision history.">
    <LoadOrError query={query}><div className="mb-3 flex flex-wrap gap-2"><SearchBox value={q} onChange={setQ} placeholder="Search Cause, Challenge, Group or decision reason…" /><SelectBox label="Decision" value={decision} onChange={setDecision} options={ [['','All decisions'],['approved','Approved'],['revision_required','Revision required']] } /></div><V2Card><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-xs"><thead><tr className="border-b text-slate-500"><th className="py-2 pr-3">When</th><th className="py-2 pr-3">Decision</th><th className="py-2 pr-3">Cause / Challenge / Group</th><th className="py-2 pr-3">Actor member reference</th><th className="py-2">Decision reason</th></tr></thead><tbody>{rows.map((row) => <tr key={row.decisionId} className="border-b last:border-0"><td className="py-2 pr-3">{date(row.decidedAt)}</td><td className="py-2 pr-3"><span className={statusClass(row.decision)}>{String(row.decision).replace('_', ' ')}</span><span className="mt-1 block text-slate-500">current: {row.currentCauseStatus}</span></td><td className="py-2 pr-3">{row.causeTitle}<span className="block">{row.challengeTitle} · {row.groupName}</span></td><td className="py-2 pr-3 font-mono">{row.authorityMemberId}</td><td className="max-w-lg whitespace-pre-wrap py-2">{row.reason}</td></tr>)}</tbody></table>{!rows.length && <p className="py-7 text-center text-sm text-slate-500">No Cause decisions match.</p>}</div></V2Card></LoadOrError>
  </ShellPage>;
}

function OperatorTemplates() { return <CompactDeferred section="templates" reason="Challenge templates remain authoritative in the separate Firestore challengeTemplates / wellnessTemplates collections. The current Fred Platform Operator identity has no governed read path to those collections; the existing Firestore admin surface is a distinct role model. No cross-store bypass or speculative template authority is introduced." />; }
function OperatorSettings() { return <CompactDeferred section="settings" reason="No authoritative Platform Operator settings model or governed settings API exists in the current Product Truth." />; }

export function V2OperatorPage({ section }: { section: Section }) {
  if (section === 'overview') return <OperatorOverview />;
  if (section === 'users') return <OperatorUsers />;
  if (section === 'groups') return <OperatorGroups />;
  if (section === 'activities') return <OperatorActivities />;
  if (section === 'challenges') return <OperatorChallenges />;
  if (section === 'templates') return <OperatorTemplates />;
  if (section === 'support') return <OperatorSupport />;
  if (section === 'content') return <OperatorContent />;
  if (section === 'access') return <OperatorAccess />;
  if (section === 'health') return <OperatorHealth />;
  if (section === 'audit') return <OperatorAudit />;
  return <OperatorSettings />;
}

export const V2_OPERATOR_SECTIONS: Section[] = ['overview', 'users', 'groups', 'activities', 'challenges', 'templates', 'access', 'support', 'content', 'health', 'audit', 'settings'];
