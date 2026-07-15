import { useMemo, useState } from 'react';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import {
  usePlatformSupportDonations,
  usePlatformSupportReport,
  usePlatformSupportSettings,
  useSavePlatformSupportSettings,
  useUpdatePlatformSupportDonation,
} from '../../../hooks/useAdminDonations';
import { AdminLayout } from '../layout/AdminLayout';
import { useToast } from '../../../context/ToastContext';
import type { SupportDonationSettings } from '../../../types';
import type { PlatformSupportAction, PlatformSupportDonation } from '../../../services/adminDonationService';

type StatusFilter = 'all' | PlatformSupportDonation['status'] | 'flagged';

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'intent', label: 'Intent saved' },
  { value: 'pending_confirmation', label: 'Pending admin review' },
  { value: 'confirmed', label: 'Admin confirmed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'flagged', label: 'Flagged' },
];

function csvToNumbers(value: string) {
  return value
    .split(',')
    .map((item) => Math.round(Number(item.trim())))
    .filter((amount) => Number.isFinite(amount) && amount > 0);
}

function statusClass(status: PlatformSupportDonation['status'], flagged?: boolean) {
  if (flagged) return 'bg-amber-100 text-amber-700';
  if (status === 'confirmed') return 'bg-green-100 text-green-700';
  if (status === 'rejected' || status === 'refunded' || status === 'cancelled') return 'bg-red-100 text-red-700';
  if (status === 'pending_confirmation') return 'bg-blue-100 text-blue-700';
  return 'bg-slate-100 text-slate-700';
}

function PlatformSupportScreen() {
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { showToast } = useToast();
  const [filter, setFilter] = useState<StatusFilter>('pending_confirmation');
  const { data: settings, isLoading: settingsLoading } = usePlatformSupportSettings();
  const { data: report, isLoading: reportLoading } = usePlatformSupportReport();
  const {
    data: donationPages,
    isLoading: donationsLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = usePlatformSupportDonations({ statusFilter: filter, pageSize: 25 });
  const saveSettings = useSavePlatformSupportSettings();
  const updateDonation = useUpdatePlatformSupportDonation();
  const [selectedId, setSelectedId] = useState('');
  const [action, setAction] = useState<PlatformSupportAction | ''>('');
  const [note, setNote] = useState('');
  const [settingsDraft, setSettingsDraft] = useState<SupportDonationSettings | null>(null);

  const activeSettings = settingsDraft ?? settings ?? null;
  const rows = useMemo(() => {
    return donationPages?.pages.flatMap((page) => page.items) ?? [];
  }, [donationPages]);
  const selected = useMemo(() => {
    if (!rows.length) return null;
    return rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;
  }, [rows, selectedId]);

  const updateSettingsDraft = (patch: Partial<SupportDonationSettings>) => {
    if (!activeSettings) return;
    setSettingsDraft({ ...activeSettings, ...patch });
  };

  const saveSupportSettings = async () => {
    if (!user?.uid || !activeSettings) return;
    try {
      await saveSettings.mutateAsync({ settings: activeSettings, adminUid: user.uid });
      setSettingsDraft(null);
      showToast('Platform support settings saved.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save support settings.', 'error');
    }
  };

  const runAction = async (nextAction: PlatformSupportAction) => {
    if (!user?.uid || !selected) return;
    if ((nextAction === 'reject' || nextAction === 'flag' || nextAction === 'note') && !note.trim()) {
      setAction(nextAction);
      showToast('Add an admin note before submitting.', 'error');
      return;
    }
    try {
      await updateDonation.mutateAsync({
        donationId: selected.id,
        action: nextAction,
        adminUid: user.uid,
        note,
      });
      setAction('');
      setNote('');
      showToast(`Support donation ${nextAction === 'note' ? 'note saved' : `${nextAction}ed`}.`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update support donation.', 'error');
    }
  };

  if (settingsLoading || reportLoading || donationsLoading || !activeSettings) {
    return <LoadingSpinner fullScreen label="Loading platform support donations..." />;
  }

  return (
    <AdminLayout title="Platform Support Donations" permissions={permissions}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card variant="flat"><p className="text-xs uppercase font-bold text-slate-500">Admin-Confirmed Support</p><p className="text-2xl font-black text-slate-900">{report?.totalConfirmedKes.toLocaleString() ?? 0} KES</p></Card>
        <Card variant="flat"><p className="text-xs uppercase font-bold text-slate-500">Pending / Unverified</p><p className="text-2xl font-black text-slate-900">{report?.pendingIntentKes.toLocaleString() ?? 0} KES</p></Card>
        <Card variant="flat"><p className="text-xs uppercase font-bold text-slate-500">Donors</p><p className="text-2xl font-black text-slate-900">{report?.donorCount ?? 0}</p></Card>
        <Card variant="flat"><p className="text-xs uppercase font-bold text-slate-500">Goal Progress</p><p className="text-2xl font-black text-slate-900">{report?.goalProgressPct ?? 0}%</p></Card>
      </div>

      <div className="mt-3 grid grid-cols-1 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-3">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-900">Support settings</p>
              <p className="text-xs text-slate-500">Controls the member-facing Support Tiizi screen and profile CTA. Confirmed totals are manually verified by admin. No automatic payment gateway verification is currently active.</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <input type="checkbox" checked={activeSettings.active} onChange={(event) => updateSettingsDraft({ active: event.target.checked })} />
              Active
            </label>
          </div>
          <div className="mt-3 grid gap-3">
            <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" value={activeSettings.title} onChange={(event) => updateSettingsDraft({ title: event.target.value })} placeholder="Support campaign title" />
            <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" value={activeSettings.subtitle} onChange={(event) => updateSettingsDraft({ subtitle: event.target.value })} placeholder="Subtitle / CTA copy" />
            <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" value={activeSettings.ctaLabel} onChange={(event) => updateSettingsDraft({ ctaLabel: event.target.value })} placeholder="CTA label" />
            <div className="grid grid-cols-2 gap-2">
              <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" type="number" value={activeSettings.goalAmountKes} onChange={(event) => updateSettingsDraft({ goalAmountKes: Number(event.target.value) })} placeholder="Goal amount KES" />
              <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" value={activeSettings.suggestedAmountsKes.join(', ')} onChange={(event) => updateSettingsDraft({ suggestedAmountsKes: csvToNumbers(event.target.value) })} placeholder="Suggested amounts, comma separated" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" value={activeSettings.mobileMoneyNumber ?? ''} onChange={(event) => updateSettingsDraft({ mobileMoneyNumber: event.target.value })} placeholder="Mobile money recipient number" />
              <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" value={activeSettings.mobileMoneyUssdCode ?? ''} onChange={(event) => updateSettingsDraft({ mobileMoneyUssdCode: event.target.value })} placeholder="Mobile money USSD code" />
            </div>
            <input className="h-10 rounded-lg border border-slate-200 px-3 text-sm" value={activeSettings.cardPaymentUrl ?? ''} onChange={(event) => updateSettingsDraft({ cardPaymentUrl: event.target.value })} placeholder="Card/payment link" />
            <textarea className="min-h-[72px] rounded-lg border border-slate-200 px-3 py-2 text-sm" value={activeSettings.manualPaymentNote} onChange={(event) => updateSettingsDraft({ manualPaymentNote: event.target.value })} placeholder="Manual payment note" />
            <textarea className="min-h-[72px] rounded-lg border border-slate-200 px-3 py-2 text-sm" value={activeSettings.thankYouMessage} onChange={(event) => updateSettingsDraft({ thankYouMessage: event.target.value })} placeholder="Thank-you message" />
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={activeSettings.showPublicGoal} onChange={(event) => updateSettingsDraft({ showPublicGoal: event.target.checked })} />
                Show public goal/progress
              </label>
              <select className="h-10 rounded-lg border border-slate-200 px-3 text-sm" value={activeSettings.reminderCadence ?? 'none'} onChange={(event) => updateSettingsDraft({ reminderCadence: event.target.value as SupportDonationSettings['reminderCadence'] })}>
                <option value="none">No reminder cadence</option>
                <option value="monthly">Monthly reminder</option>
                <option value="quarterly">Quarterly reminder</option>
              </select>
            </div>
            <button className="h-10 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50" disabled={!permissions.canManageDonations || saveSettings.isPending} onClick={saveSupportSettings}>
              {saveSettings.isPending ? 'Saving...' : 'Save support settings'}
            </button>
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-black text-slate-900">Support donation intents</p>
              <p className="text-xs text-slate-500">Confirmed totals are manually verified by admin. No automatic payment gateway verification is currently active.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {statusFilters.map((item) => (
                <button key={item.value} className={`h-8 px-2 rounded-lg text-xs font-bold ${filter === item.value ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`} onClick={() => { setFilter(item.value); setSelectedId(''); }}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200">
                  <th className="py-2 pr-3">Donor</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Frequency</th>
                  <th className="py-2 pr-3">Method</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={`border-b border-slate-100 ${selected?.id === row.id ? 'bg-slate-50' : ''}`}>
                    <td className="py-2 pr-3"><p className="font-semibold text-slate-900">{row.donorName}</p><p className="text-xs text-slate-500">{row.donorEmail || row.userId}</p></td>
                    <td className="py-2 pr-3 font-semibold text-slate-900">{row.amountKes.toLocaleString()} KES</td>
                    <td className="py-2 pr-3 text-slate-700">{row.frequency.replace('_', ' ')}</td>
                    <td className="py-2 pr-3 text-slate-700">{row.paymentMethod.replace('_', ' ')}</td>
                    <td className="py-2 pr-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${statusClass(row.status, row.flagged)}`}>{row.flagged ? 'Flagged' : row.status === 'pending_confirmation' ? 'pending admin review' : row.status === 'confirmed' ? 'admin confirmed' : row.status.replace('_', ' ')}</span></td>
                    <td className="py-2"><button className="text-primary font-bold" onClick={() => setSelectedId(row.id)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 ? <p className="mt-3 text-sm text-slate-600">No platform support donations match this filter.</p> : null}
          </div>
          {hasNextPage ? (
            <button
              className="mt-3 h-9 px-3 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-50"
              disabled={isFetchingNextPage}
              onClick={() => fetchNextPage()}
            >
              {isFetchingNextPage ? 'Loading...' : 'Load more support donations'}
            </button>
          ) : null}

          {selected ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">{selected.donorName}</p>
                  <p className="text-xs text-slate-500">{selected.id}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusClass(selected.status, selected.flagged)}`}>{selected.status.replace('_', ' ')}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-700">
                <p><span className="font-semibold">Amount:</span> {selected.amountKes.toLocaleString()} KES</p>
                <p><span className="font-semibold">Reference:</span> {selected.transactionId ? `${selected.transactionId} (pending manual review until confirmed)` : '-'}</p>
                <p><span className="font-semibold">Created:</span> {selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '-'}</p>
                <p><span className="font-semibold">Admin confirmed:</span> {selected.confirmedAt ? new Date(selected.confirmedAt).toLocaleString() : '-'}</p>
              </div>
              <p className="mt-2 text-sm text-slate-600"><span className="font-semibold">Admin note:</span> {selected.adminNote || '-'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="h-9 px-3 rounded-lg bg-green-600 text-white text-xs font-bold disabled:opacity-50" disabled={!permissions.canManageDonations || updateDonation.isPending || selected.status === 'confirmed'} onClick={() => runAction('confirm')}>Mark admin confirmed</button>
                <button className="h-9 px-3 rounded-lg bg-red-100 text-red-700 text-xs font-bold disabled:opacity-50" disabled={!permissions.canManageDonations || updateDonation.isPending} onClick={() => setAction('reject')}>Reject</button>
                {selected.flagged ? (
                  <button className="h-9 px-3 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold disabled:opacity-50" disabled={!permissions.canManageDonations || updateDonation.isPending} onClick={() => runAction('unflag')}>Unflag</button>
                ) : (
                  <button className="h-9 px-3 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold disabled:opacity-50" disabled={!permissions.canManageDonations || updateDonation.isPending} onClick={() => setAction('flag')}>Flag</button>
                )}
                <button className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold disabled:opacity-50" disabled={!permissions.canManageDonations || updateDonation.isPending} onClick={() => setAction('note')}>Add note</button>
              </div>
              {action ? (
                <div className="mt-3">
                  <textarea className="min-h-[72px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Admin note, rejection reason, or flag reason." />
                  <div className="mt-2 flex gap-2">
                    <button className="h-9 px-3 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-50" disabled={updateDonation.isPending} onClick={() => runAction(action)}>Submit</button>
                    <button className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold" onClick={() => { setAction(''); setNote(''); }}>Cancel</button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>
      </div>
    </AdminLayout>
  );
}

export default PlatformSupportScreen;
