import { useState, useMemo } from 'react';
import { LoadingSpinner } from '../../../components/Mobile';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useDonationCampaigns, useChallengePledgesAdmin, usePlatformSupportForDetail, useUpdateCampaignStatus } from '../../../hooks/useAdminDonations';
import { AdminLayout } from '../layout/AdminLayout';
import type { DonationCampaign } from '../../../services/adminDonationService';

type FilterKey = 'all' | 'platform_support' | 'challenge_cause' | 'active' | 'paused_suspended' | 'completed';

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  draft: 'bg-slate-100 text-slate-500',
  completed: 'bg-blue-100 text-blue-700',
  pending_approval: 'bg-amber-100 text-amber-700',
  paused: 'bg-orange-100 text-orange-700',
  suspended: 'bg-red-100 text-red-700',
};

function CurrencyBreakdown({
  byCurrency,
  colorClass = 'text-slate-800',
  fallbackCurrency,
}: {
  byCurrency: Record<string, number>;
  colorClass?: string;
  fallbackCurrency?: string;
}) {
  const entries = Object.entries(byCurrency);
  if (entries.length === 0) {
    return <span className={`font-semibold ${colorClass}`}>{fallbackCurrency ?? 'KES'} 0</span>;
  }
  return (
    <span className="font-semibold space-y-0.5">
      {entries.map(([ccy, amt]) => (
        <span key={ccy} className={`block ${colorClass}`}>{ccy} {amt.toLocaleString()}</span>
      ))}
    </span>
  );
}

function CampaignDetailPanel({
  campaign,
  onClose,
}: {
  campaign: DonationCampaign;
  onClose: () => void;
}) {
  const { data: pledges = [], isLoading: pledgesLoading } = useChallengePledgesAdmin(
    campaign.source === 'challenge_cause' && campaign.challengeId ? campaign.challengeId : null,
  );
  const { data: supportRecords = [], isLoading: supportLoading } = usePlatformSupportForDetail();
  const updateStatus = useUpdateCampaignStatus();

  const isPlatform = campaign.source === 'platform_support';
  const canManageStatus = campaign.source === 'challenge_cause' && !!campaign.challengeId;

  // Platform support behaviour stats — computed from live records
  const supportStats = useMemo(() => {
    if (!isPlatform || supportRecords.length === 0) return null;
    const freqCount: Record<string, number> = {};
    const amountCount: Record<string, number> = {};
    let latestMs = 0;
    supportRecords.forEach((r) => {
      freqCount[r.frequency] = (freqCount[r.frequency] ?? 0) + 1;
      const amtKey = `${r.currency ?? 'KES'} ${r.amountKes.toLocaleString()}`;
      amountCount[amtKey] = (amountCount[amtKey] ?? 0) + 1;
      const ts = Date.parse(r.createdAt || '0');
      if (ts > latestMs) latestMs = ts;
    });
    const mostCommonFreq = Object.entries(freqCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';
    const mostCommonAmount = Object.entries(amountCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';
    const latestDate = latestMs > 0 ? new Date(latestMs).toLocaleDateString() : 'N/A';
    return { mostCommonFreq, mostCommonAmount, latestDate };
  }, [isPlatform, supportRecords]);

  const setStatus = async (campaignStatus: 'active' | 'paused' | 'suspended' | 'completed') => {
    if (!campaign.challengeId) return;
    await updateStatus.mutateAsync({ challengeId: campaign.challengeId, campaignStatus });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <p className="text-[15px] font-black text-slate-900 truncate max-w-[280px]">{campaign.name}</p>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 text-sm font-bold">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Summary card */}
          <section className="rounded-xl border border-slate-200 p-3 space-y-1.5">
            <p className="text-xs uppercase font-bold text-slate-500 tracking-wide">Campaign Summary</p>
            <div className="grid grid-cols-2 gap-1 text-sm">
              <span className="text-slate-500">Source</span>
              <span className="font-semibold text-slate-800 capitalize">
                {campaign.source === 'platform_support' ? 'Platform Support' : campaign.source.replace('_', ' ')}
              </span>
              <span className="text-slate-500">Status</span>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold w-fit ${STATUS_BADGE[campaign.status] ?? 'bg-slate-100 text-slate-600'}`}>
                {campaign.status.replace('_', ' ')}
              </span>

              {/* Platform support: show currency note, not a single currency label */}
              {isPlatform ? (
                <>
                  <span className="text-slate-500">Currencies</span>
                  <span className="font-semibold text-slate-800">KES · RWF · UGX (mixed)</span>
                  <span className="text-slate-500">Confirmed raised</span>
                  <CurrencyBreakdown byCurrency={campaign.confirmedByCurrency} colorClass="text-emerald-700" />
                  <span className="text-slate-500">Pending</span>
                  <CurrencyBreakdown byCurrency={campaign.pendingByCurrency} colorClass="text-amber-700" />
                  <span className="text-slate-500">Confirmed supporters</span>
                  <span className="font-semibold text-slate-800">{campaign.contributorCount}</span>
                  <span className="text-slate-500">Total records</span>
                  <span className="font-semibold text-slate-800">{campaign.donorCount}</span>
                  {supportStats && <>
                    <span className="text-slate-500">Most common frequency</span>
                    <span className="font-semibold text-slate-800 capitalize">{supportStats.mostCommonFreq.replace('_', '-')}</span>
                    <span className="text-slate-500">Most common amount</span>
                    <span className="font-semibold text-slate-800">{supportStats.mostCommonAmount}</span>
                    <span className="text-slate-500">Latest support</span>
                    <span className="font-semibold text-slate-800">{supportStats.latestDate}</span>
                  </>}
                </>
              ) : (
                <>
                  {/* Cause / legacy campaign: show campaign currency + per-currency breakdown */}
                  <span className="text-slate-500">Campaign currency</span>
                  <span className="font-semibold text-slate-800">{campaign.currency}</span>
                  {campaign.goalAmount > 0 && <>
                    <span className="text-slate-500">Target</span>
                    <span className="font-semibold text-slate-800">{campaign.currency} {campaign.goalAmount.toLocaleString()} total</span>
                  </>}
                  <span className="text-slate-500">Confirmed raised</span>
                  <CurrencyBreakdown
                    byCurrency={campaign.confirmedByCurrency}
                    colorClass="text-emerald-700"
                    fallbackCurrency={campaign.currency}
                  />
                  <span className="text-slate-500">Pending (pledged)</span>
                  <CurrencyBreakdown
                    byCurrency={campaign.pendingByCurrency}
                    colorClass="text-amber-700"
                    fallbackCurrency={campaign.currency}
                  />
                  {campaign.goalAmount > 0 && (() => {
                    const confirmedKeys = Object.keys(campaign.confirmedByCurrency);
                    const isMixed = confirmedKeys.length > 1 || (confirmedKeys.length === 1 && !campaign.confirmedByCurrency[campaign.currency]);
                    const confirmedInGoalCurrency = campaign.confirmedByCurrency[campaign.currency] ?? 0;
                    return <>
                      <span className="text-slate-500">Remaining</span>
                      <span className="font-semibold text-slate-700">
                        {isMixed
                          ? 'See currency breakdown'
                          : `${campaign.currency} ${Math.max(0, campaign.goalAmount - confirmedInGoalCurrency).toLocaleString()}`}
                      </span>
                    </>;
                  })()}
                  <span className="text-slate-500">Confirmed contributors</span>
                  <span className="font-semibold text-slate-800">{campaign.contributorCount}</span>
                  <span className="text-slate-500">All pledgers</span>
                  <span className="font-semibold text-slate-800">{campaign.donorCount}</span>
                  {campaign.challengeName && <>
                    <span className="text-slate-500">Challenge</span>
                    <span className="font-semibold text-slate-800 truncate">{campaign.challengeName}</span>
                  </>}
                  {campaign.approvalStatus && <>
                    <span className="text-slate-500">Donation approval</span>
                    <span className="font-semibold text-slate-800 capitalize">{campaign.approvalStatus}</span>
                  </>}
                  {campaign.timingStartDate && <>
                    <span className="text-slate-500">Window start</span>
                    <span className="font-semibold text-slate-800">{campaign.timingStartDate}</span>
                  </>}
                  {campaign.timingEndDate && (() => {
                    const today = new Date().toISOString().slice(0, 10);
                    const daysRemaining = Math.ceil(
                      (Date.parse(campaign.timingEndDate) - Date.now()) / (1000 * 60 * 60 * 24),
                    );
                    const expired = campaign.timingEndDate < today;
                    return <>
                      <span className="text-slate-500">Window end</span>
                      <span className={`font-semibold ${expired ? 'text-red-600' : 'text-slate-800'}`}>
                        {campaign.timingEndDate} {expired ? '(expired)' : `(${daysRemaining}d remaining)`}
                      </span>
                    </>;
                  })()}
                </>
              )}
            </div>
          </section>

          {/* Payment / channel details */}
          <section className="rounded-xl border border-amber-100 bg-amber-50 p-3 space-y-1">
            <p className="text-xs uppercase font-bold text-amber-700 tracking-wide">Payment Channels</p>
            <p className="text-xs text-amber-700">
              Tiizi does not verify manual payments. Contributions below are self-reported by users.
            </p>
            {isPlatform && (
              <p className="text-sm text-slate-700">Mobile money — configured in Platform Support Settings.</p>
            )}
            {!isPlatform && (
              <p className="text-sm text-slate-700">
                Phone and payment details set by challenge creator and approved by admin.
                {campaign.approvalStatus !== 'approved' && (
                  <span className="ml-1 text-amber-700 font-semibold">Not yet approved.</span>
                )}
              </p>
            )}
          </section>

          {/* Campaign management actions (cause campaigns only) */}
          {canManageStatus && (
            <section className="rounded-xl border border-slate-200 p-3 space-y-2">
              <p className="text-xs uppercase font-bold text-slate-500 tracking-wide">Campaign Actions</p>
              <p className="text-xs text-slate-500">
                Pausing or suspending hides the contribution CTA from participants. Historical pledges are preserved.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={updateStatus.isPending || campaign.campaignStatus === 'active'}
                  onClick={() => setStatus('active')}
                  className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-40"
                >
                  Resume
                </button>
                <button
                  disabled={updateStatus.isPending || campaign.campaignStatus === 'paused'}
                  onClick={() => setStatus('paused')}
                  className="h-8 px-3 rounded-lg bg-orange-500 text-white text-xs font-bold disabled:opacity-40"
                >
                  Pause
                </button>
                <button
                  disabled={updateStatus.isPending || campaign.campaignStatus === 'suspended'}
                  onClick={() => setStatus('suspended')}
                  className="h-8 px-3 rounded-lg bg-red-600 text-white text-xs font-bold disabled:opacity-40"
                >
                  Suspend
                </button>
                <button
                  disabled={updateStatus.isPending || campaign.campaignStatus === 'completed'}
                  onClick={() => setStatus('completed')}
                  className="h-8 px-3 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-40"
                >
                  Mark Completed
                </button>
              </div>
              {updateStatus.isPending && <p className="text-xs text-slate-500">Saving…</p>}
            </section>
          )}

          {/* Cause campaign contribution records */}
          {campaign.source === 'challenge_cause' && (
            <section className="rounded-xl border border-slate-200 p-3 space-y-2">
              <p className="text-xs uppercase font-bold text-slate-500 tracking-wide">Contribution Records</p>
              {pledgesLoading && <p className="text-xs text-slate-500">Loading…</p>}
              {!pledgesLoading && pledges.length === 0 && (
                <p className="text-xs text-slate-500">No contributions yet.</p>
              )}
              {!pledgesLoading && pledges.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-left">
                        <th className="py-1.5 pr-2 text-slate-500 font-semibold">Contributor</th>
                        <th className="py-1.5 pr-2 text-slate-500 font-semibold">Amount</th>
                        <th className="py-1.5 pr-2 text-slate-500 font-semibold">Status</th>
                        <th className="py-1.5 pr-2 text-slate-500 font-semibold">Pledged</th>
                        <th className="py-1.5 text-slate-500 font-semibold">Confirmed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pledges.map((p) => (
                        <tr key={p.id} className="border-b border-slate-100">
                          <td className="py-1.5 pr-2 text-slate-700 max-w-[100px]">
                            <p className="font-semibold truncate">{p.displayName || `User ${p.userId.slice(0, 6)}`}</p>
                            {p.email && <p className="text-[10px] text-slate-400 truncate">{p.email}</p>}
                          </td>
                          <td className="py-1.5 pr-2 font-semibold text-slate-900">
                            {p.currency} {p.pledgedAmount.toLocaleString()}
                          </td>
                          <td className="py-1.5 pr-2">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              p.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700'
                              : p.status === 'pledged' ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-500'
                            }`}>
                              {p.status === 'confirmed' ? 'Marked as sent' : p.status}
                            </span>
                          </td>
                          <td className="py-1.5 pr-2 text-slate-600">
                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-'}
                          </td>
                          <td className="py-1.5 text-slate-600">
                            {p.confirmedAt ? new Date(p.confirmedAt).toLocaleDateString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-[10px] text-slate-400">
                    "Marked as sent" = user self-reported. Tiizi has not verified these payments.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Platform Support records — always show table structure */}
          {campaign.source === 'platform_support' && (
            <section className="rounded-xl border border-slate-200 p-3 space-y-2">
              <p className="text-xs uppercase font-bold text-slate-500 tracking-wide">Support Records</p>
              {supportLoading && <p className="text-xs text-slate-500">Loading…</p>}
              {!supportLoading && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-left">
                        <th className="py-1.5 pr-2 text-slate-500 font-semibold">Contributor</th>
                        <th className="py-1.5 pr-2 text-slate-500 font-semibold">Amount</th>
                        <th className="py-1.5 pr-2 text-slate-500 font-semibold">Currency</th>
                        <th className="py-1.5 pr-2 text-slate-500 font-semibold">Frequency</th>
                        <th className="py-1.5 pr-2 text-slate-500 font-semibold">Status</th>
                        <th className="py-1.5 pr-2 text-slate-500 font-semibold">Created</th>
                        <th className="py-1.5 text-slate-500 font-semibold">Confirmed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supportRecords.map((r) => (
                        <tr key={r.id} className="border-b border-slate-100">
                          <td className="py-1.5 pr-2 text-slate-700 max-w-[90px]">
                            <p className="font-semibold truncate">{r.donorName}</p>
                            {r.donorEmail && <p className="text-[10px] text-slate-400 truncate">{r.donorEmail}</p>}
                          </td>
                          <td className="py-1.5 pr-2 font-semibold text-slate-900">
                            {r.amountKes.toLocaleString()}
                          </td>
                          <td className="py-1.5 pr-2 text-slate-700 font-semibold">
                            {r.currency ?? 'KES'}
                          </td>
                          <td className="py-1.5 pr-2 text-slate-600 capitalize">
                            {r.frequency.replace('_', '-')}
                          </td>
                          <td className="py-1.5 pr-2">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              r.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700'
                              : r.status === 'intent' ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-500'
                            }`}>
                              {r.status === 'confirmed' ? 'Marked as sent' : r.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-1.5 pr-2 text-slate-600">
                            {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '-'}
                          </td>
                          <td className="py-1.5 text-slate-600">
                            {r.confirmedAt ? new Date(r.confirmedAt).toLocaleDateString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {supportRecords.length === 0 && (
                    <p className="mt-2 text-xs text-slate-500">
                      No support records yet. When users record support, their contribution details will appear here.
                    </p>
                  )}
                  <p className="mt-2 text-[10px] text-slate-400">
                    Support Tiizi records are self-reported until payment integration is added.
                  </p>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function DonationCampaignsScreen() {
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useDonationCampaigns();

  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<DonationCampaign | null>(null);

  const campaigns = data ?? [];

  const kpi = useMemo(() => {
    const active = campaigns.filter((c) => c.status === 'active').length;
    const confirmed = campaigns.reduce((s, c) => s + c.confirmedAmount, 0);
    const pending = campaigns.reduce((s, c) => s + c.pendingAmount, 0);
    const contributors = campaigns.reduce((s, c) => s + c.contributorCount, 0);
    const platform = campaigns.filter((c) => c.source === 'platform_support').reduce((s, c) => s + c.confirmedAmount, 0);
    const cause = campaigns.filter((c) => c.source === 'challenge_cause').reduce((s, c) => s + c.confirmedAmount, 0);
    return { active, confirmed, pending, contributors, platform, cause };
  }, [campaigns]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (filter === 'platform_support') return c.source === 'platform_support';
      if (filter === 'challenge_cause') return c.source === 'challenge_cause';
      if (filter === 'active') return c.status === 'active';
      if (filter === 'paused_suspended') return c.status === 'paused' || c.status === 'suspended';
      if (filter === 'completed') return c.status === 'completed';
      return true;
    }).filter((c) => {
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.challengeName ?? '').toLowerCase().includes(q)
      );
    });
  }, [campaigns, filter, search]);

  if (isLoading) return <LoadingSpinner fullScreen label="Loading donation campaigns…" />;

  const FILTERS: [FilterKey, string][] = [
    ['all', 'All'],
    ['platform_support', 'Platform Support'],
    ['challenge_cause', 'Cause'],
    ['active', 'Active'],
    ['paused_suspended', 'Paused / Suspended'],
    ['completed', 'Completed'],
  ];

  return (
    <AdminLayout title="Donation Campaigns" permissions={permissions}>
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">Active campaigns</p>
          <p className="text-2xl font-black text-slate-900 mt-0.5">{kpi.active}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">Confirmed raised</p>
          <p className="text-2xl font-black text-emerald-700 mt-0.5">{kpi.confirmed.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400">mixed currencies</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">Pending pledges</p>
          <p className="text-2xl font-black text-amber-600 mt-0.5">{kpi.pending.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400">not yet confirmed by users</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">Total contributors</p>
          <p className="text-2xl font-black text-slate-900 mt-0.5">{kpi.contributors}</p>
          <p className="text-[10px] text-slate-400">confirmed only</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">Platform support</p>
          <p className="text-2xl font-black text-slate-900 mt-0.5">{kpi.platform.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">Cause campaigns</p>
          <p className="text-2xl font-black text-slate-900 mt-0.5">{kpi.cause.toLocaleString()}</p>
        </div>
      </div>

      {/* Search + filter */}
      <div className="mt-4 space-y-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search campaign or challenge name…"
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`h-8 px-3 rounded-full text-xs font-bold border ${
                filter === key
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign list */}
      <div className="mt-3 space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-slate-500 mt-4">No campaigns match this filter.</p>
        )}
        {filtered.map((campaign) => (
          <div
            key={campaign.id}
            className="rounded-xl border border-slate-200 bg-white p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-slate-900 truncate">{campaign.name}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-semibold uppercase">
                    {campaign.source === 'platform_support' ? 'Platform' : campaign.source === 'legacy' ? 'Legacy' : 'Cause'}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${STATUS_BADGE[campaign.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {campaign.status.replace('_', ' ')}
                  </span>
                </div>
                {campaign.challengeName && campaign.challengeName !== campaign.name && (
                  <p className="text-xs text-slate-500 mt-0.5 truncate">Challenge: {campaign.challengeName}</p>
                )}
                <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                  <span className="text-slate-500">Currency: <strong className="text-slate-700">{campaign.currency}</strong></span>
                  {campaign.goalAmount > 0 && (
                    <span className="text-slate-500">Target: <strong className="text-slate-700">{campaign.currency} {campaign.goalAmount.toLocaleString()}</strong></span>
                  )}
                  <span className="text-slate-500">Confirmed: <strong className="text-emerald-700">{campaign.currency} {campaign.confirmedAmount.toLocaleString()}</strong></span>
                  <span className="text-slate-500">Pending: <strong className="text-amber-600">{campaign.currency} {campaign.pendingAmount.toLocaleString()}</strong></span>
                  <span className="text-slate-500">Contributors: <strong className="text-slate-700">{campaign.contributorCount}</strong></span>
                  <span className="text-slate-500">All pledgers: <strong className="text-slate-700">{campaign.donorCount}</strong></span>
                </div>
              </div>
              <button
                onClick={() => setSelectedCampaign(campaign)}
                className="shrink-0 h-8 px-3 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
              >
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Detail panel */}
      {selectedCampaign && (
        <CampaignDetailPanel
          campaign={selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
        />
      )}
    </AdminLayout>
  );
}

export default DonationCampaignsScreen;
