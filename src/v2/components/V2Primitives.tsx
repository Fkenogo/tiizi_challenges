import { useState } from 'react';

/**
 * TIIZI S1 — shared V2 experience primitives.
 *
 * Minimal set needed for the shell only. Deliberately self-contained:
 * no imports from frozen V1 experience modules (see
 * scripts/testV2ExperienceBoundary.mjs). Presentation follows the
 * approved orange-led brand and plain member-facing language.
 */

/** Page/screen container: responsive max width, consistent padding. */
export function V2Page({
  children,
  wide,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-full bg-slate-50">
      <div className={`mx-auto w-full px-4 py-5 sm:px-6 ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>
        {children}
      </div>
    </div>
  );
}

/** Section header: eyebrow + title + optional action. */
export function V2SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{eyebrow}</p>
        )}
        <h1 className="mt-0.5 text-xl font-black tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">{description}</p>}
      </div>
      {action && <div className="shrink-0 pt-1">{action}</div>}
    </div>
  );
}

/** Navigation item used by both member and operator shells. */
export function V2NavItem({
  label,
  icon,
  active,
  onClick,
  badge,
}: {
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  badge?: string | number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
        active ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge != null && (
        <span
          className={`ml-auto rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
            active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

/** Responsive layout: single column on mobile, sidebar+content on desktop. */
export function V2Responsive({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <div className="lg:min-h-screen">{sidebar}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Empty state: friendly, product-like, with optional next-step hint. */
export function V2EmptyState({
  title,
  message,
  nextSlice,
  action,
}: {
  title: string;
  message: string;
  nextSlice?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-xl" aria-hidden>
        <span className="font-black text-primary">t</span>
      </div>
      <h2 className="mt-3 text-base font-black text-slate-900">{title}</h2>
      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-600">{message}</p>
      {nextSlice && (
        <p className="mt-3 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
          Next: {nextSlice}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Primary/secondary action button in the V2 visual language. */
export function V2Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}) {
  const tone =
    variant === 'primary'
      ? 'bg-primary text-white hover:brightness-95'
      : variant === 'secondary'
        ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
        : 'text-slate-600 hover:bg-slate-100';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tone}`}
    >
      {children}
    </button>
  );
}

/** Labelled form field wrapper. */
export function V2Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-600">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs leading-5 text-slate-500">{hint}</span>}
    </label>
  );
}

const V2_INPUT_CLASS =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary';

export function V2TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  maxLength,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'number' | 'date';
  maxLength?: number;
}) {
  return (
    <input
      type={type}
      value={value}
      maxLength={maxLength}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={V2_INPUT_CLASS}
    />
  );
}

export function V2TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  maxLength,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      maxLength={maxLength}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={V2_INPUT_CLASS}
    />
  );
}

/** Surface card for grouping content. */
export function V2Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 ${className}`}>
      {children}
    </div>
  );
}

/** Loading state. */
export function V2LoadingState({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-6" role="status" aria-label={label ?? 'Loading'}>
      <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-sm font-medium text-slate-500">{label ?? 'Loading…'}</p>
    </div>
  );
}

/** Error state with retry. */
export function V2ErrorState({
  title = 'Something went wrong',
  message = 'Please try again. If this keeps happening, let us know from the Support section.',
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-6 text-center">
      <h2 className="text-base font-black text-red-900">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-red-800">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/** Bottom sheet / drawer for secondary actions (profile, filters, confirmations). */
export function V2Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [closing, setClosing] = useState(false);
  if (!open && !closing) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Close"
        onClick={() => {
          setClosing(false);
          onClose();
        }}
        className="absolute inset-0 h-full w-full cursor-default bg-slate-900/40"
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-3xl rounded-t-3xl bg-white p-5 pb-8 shadow-xl sm:bottom-8 sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-black text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={() => {
              setClosing(false);
              onClose();
            }}
            className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Profile/account trigger: opens the account sheet. */
export function V2AccountTrigger({ name, onOpen }: { name: string; onOpen: () => void }) {
  const initial = (name.trim()[0] ?? 'T').toUpperCase();
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open account for ${name}`}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-black text-white hover:bg-slate-700"
    >
      {initial}
    </button>
  );
}

/** Notification trigger with unread dot. */
export function V2NotificationTrigger({
  unread,
  onOpen,
}: {
  unread: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={unread ? 'Open notifications, you have unread updates' : 'Open notifications'}
      className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Zm4 10a2 2 0 0 0 4 0"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {unread && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" aria-hidden />}
    </button>
  );
}
