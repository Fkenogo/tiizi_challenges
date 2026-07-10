import React from 'react';
import { Card } from '../../../components/Mobile';

export function formatKes(value: number | undefined): string {
  return `${Math.round(value ?? 0).toLocaleString()} KES`;
}

export function formatNumber(value: number | undefined): string {
  return Math.round(value ?? 0).toLocaleString();
}

export function formatDecimal(value: number | undefined): string {
  const numeric = Number(value ?? 0);
  return Number.isInteger(numeric) ? numeric.toLocaleString() : numeric.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function AnalyticsSection({
  title,
  eyebrow,
  insight,
  children,
  action,
}: {
  title: string;
  eyebrow?: string;
  insight?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="mt-4">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          {eyebrow ? <p className="text-[11px] uppercase font-black text-primary tracking-normal">{eyebrow}</p> : null}
          <h2 className="text-base font-black text-slate-950">{title}</h2>
          {insight ? <p className="mt-1 text-sm text-slate-600">{insight}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  note,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  note?: string;
  tone?: 'default' | 'attention' | 'success' | 'muted';
}) {
  const toneClass = {
    default: 'border-slate-100 bg-white',
    attention: 'border-amber-200 bg-amber-50',
    success: 'border-emerald-200 bg-emerald-50',
    muted: 'border-slate-100 bg-slate-50',
  }[tone];

  return (
    <Card variant="compact" className={toneClass}>
      <p className="text-[11px] uppercase font-black text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
      {note ? <p className="mt-1 text-xs text-slate-600">{note}</p> : null}
    </Card>
  );
}

export function EmptyAnalyticsState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
      {message}
    </div>
  );
}

export function MetricsFreshnessNotice({ generatedAt }: { generatedAt?: string }) {
  const generatedTime = generatedAt ? Date.parse(generatedAt) : NaN;
  const hasGeneratedAt = Number.isFinite(generatedTime);
  const isStale = hasGeneratedAt && Date.now() - generatedTime > 24 * 60 * 60 * 1000;
  const className = isStale || !hasGeneratedAt
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : 'border-emerald-200 bg-emerald-50 text-emerald-900';

  return (
    <Card variant="compact" className={`mt-3 ${className}`}>
      <p className="text-xs font-bold">
        {!hasGeneratedAt
          ? 'Metrics not generated yet.'
          : isStale
            ? `Metrics may be stale. Last generated ${new Date(generatedTime).toLocaleString()}.`
            : `Metrics generated ${new Date(generatedTime).toLocaleString()}.`}
      </p>
    </Card>
  );
}

export function CompactBar({
  value,
  max,
  label,
  count,
}: {
  value: number;
  max: number;
  label: string;
  count?: string | number;
}) {
  const width = value <= 0 ? 0 : Math.max(4, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div className="flex items-center gap-3">
      <p className="w-20 shrink-0 text-xs text-slate-500">{label}</p>
      <div className="h-3 min-w-0 flex-1 rounded-full bg-slate-100 overflow-hidden">
        {value > 0 ? <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} /> : null}
      </div>
      {count != null ? <p className="w-12 shrink-0 text-right text-xs font-bold text-slate-700">{count}</p> : null}
    </div>
  );
}

export function RatioBar({ segments }: { segments: Array<{ label: string; value: number; className: string }> }) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  if (total <= 0) {
    return <EmptyAnalyticsState message="No activity mix available for this period." />;
  }

  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className={segment.className}
            style={{ width: `${Math.max(2, (segment.value / total) * 100)}%` }}
            title={`${segment.label}: ${segment.value}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        {segments.map((segment) => (
          <p key={segment.label} className="text-xs text-slate-600">
            <span className={`mr-1 inline-block h-2 w-2 rounded-full ${segment.className}`} />
            {segment.label}: <span className="font-bold text-slate-900">{segment.value.toLocaleString()}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

export function DataTable({
  columns,
  rows,
  emptyMessage,
}: {
  columns: string[];
  rows: React.ReactNode[];
  emptyMessage: string;
}) {
  if (rows.length === 0) return <EmptyAnalyticsState message={emptyMessage} />;
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
            {columns.map((column) => (
              <th key={column} className="py-2 pr-3 font-black">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}
