import { useMemo } from 'react';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import { useDonationTransactions } from '../../../hooks/useAdminDonations';
import { useAdminTablePrefs } from '../../../hooks/useAdminTablePrefs';
import { AdminLayout } from '../layout/AdminLayout';

type DonationSortKey = 'createdAt' | 'amount';

function DonationListScreen() {
  const { user } = useAuth();
  const { permissions } = useAdminPermissions(user?.uid);
  const { data, isLoading } = useDonationTransactions();
  const { prefs, setPrefs, resetPrefs } = useAdminTablePrefs<{
    status: 'all' | 'success' | 'pending' | 'failed' | 'refunded';
    search: string;
    sortKey: DonationSortKey;
    pageSize: number;
    page: number;
  }>('donation_list', {
    status: 'all',
    search: '',
    sortKey: 'createdAt',
    pageSize: 25,
    page: 1,
  });

  const rows = useMemo(() => {
    const q = prefs.search.trim().toLowerCase();
    const filtered = (data ?? [])
      .filter((item) => (prefs.status === 'all' ? true : item.status === prefs.status))
      .filter((item) => {
        if (!q) return true;
        return item.donorName.toLowerCase().includes(q) || item.donorEmail.toLowerCase().includes(q) || item.campaignName.toLowerCase().includes(q);
      });
    if (prefs.sortKey === 'amount') return filtered.sort((a, b) => b.amount - a.amount);
    return filtered.sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
  }, [data, prefs.status, prefs.search, prefs.sortKey]);

  const totalPages = Math.max(1, Math.ceil(rows.length / prefs.pageSize));
  const clampedPage = Math.min(Math.max(1, prefs.page), totalPages);
  const pageRows = rows.slice((clampedPage - 1) * prefs.pageSize, clampedPage * prefs.pageSize);

  if (isLoading) return <LoadingSpinner fullScreen label="Loading donation transactions..." />;

  return (
    <AdminLayout title="Donation Transactions" permissions={permissions}>
      <Card>
        <div className="flex flex-wrap gap-2">
          <input
            value={prefs.search}
            onChange={(e) => setPrefs((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
            placeholder="Search donor/campaign..."
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm flex-1 min-w-[220px]"
          />
          <select value={prefs.status} onChange={(e) => setPrefs((prev) => ({ ...prev, status: e.target.value as typeof prev.status, page: 1 }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
            <option value="all">All statuses</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
          <select value={prefs.sortKey} onChange={(e) => setPrefs((prev) => ({ ...prev, sortKey: e.target.value as DonationSortKey }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
            <option value="createdAt">Sort: Date</option>
            <option value="amount">Sort: Amount</option>
          </select>
          <select value={prefs.pageSize} onChange={(e) => setPrefs((prev) => ({ ...prev, pageSize: Number(e.target.value), page: 1 }))} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>
          <button className="h-10 px-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-700" onClick={resetPrefs}>
            Reset Prefs
          </button>
        </div>
      </Card>

      <Card className="mt-3">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Donor</th>
                <th className="py-2 pr-3">Campaign</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 text-slate-700">{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '-'}</td>
                  <td className="py-2 pr-3 text-slate-700">{row.donorName}</td>
                  <td className="py-2 pr-3 text-slate-700">{row.campaignName}</td>
                  <td className="py-2 pr-3 font-semibold text-slate-900">{row.amount.toLocaleString()} {row.currency}</td>
                  <td className="py-2 pr-3 text-slate-700 capitalize">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
          <span>Page {clampedPage} of {totalPages}</span>
          <div className="flex gap-2">
            <button className="h-8 px-2 rounded border border-slate-200 disabled:opacity-50" disabled={clampedPage <= 1} onClick={() => setPrefs((prev) => ({ ...prev, page: clampedPage - 1 }))}>Prev</button>
            <button className="h-8 px-2 rounded border border-slate-200 disabled:opacity-50" disabled={clampedPage >= totalPages} onClick={() => setPrefs((prev) => ({ ...prev, page: clampedPage + 1 }))}>Next</button>
          </div>
        </div>
        {rows.length === 0 ? <p className="text-sm text-slate-600 mt-2">No donation transactions.</p> : null}
      </Card>
    </AdminLayout>
  );
}

export default DonationListScreen;
