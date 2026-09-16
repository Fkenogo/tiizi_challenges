import { V2BrandMark } from '../brand';

/**
 * TIIZI S1 CORR-001 — shared V2 authentication chrome.
 *
 * New V2 visual language only: orange-led brand, mobile-first
 * centred card, responsive on desktop. Plain member-facing copy.
 * No V1 screen composition is referenced or restyled here.
 */

export function V2AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center text-center">
          <V2BrandMark size={44} />
          <p className="mt-3 text-2xl font-black tracking-tight">tiizi</p>
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
            Together We Move
          </p>
        </div>

        <section
          aria-label={title}
          className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <h1 className="text-xl font-black tracking-tight">{title}</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">{subtitle}</p>
          <div className="mt-5">{children}</div>
        </section>

        {footer && (
          <div className="mt-5 text-center text-sm text-slate-500">{footer}</div>
        )}
      </main>
    </div>
  );
}

/** Primary V2 action button. */
export function V2AuthButton({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="h-12 w-full rounded-xl bg-primary text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-dark disabled:opacity-60"
    >
      {children}
    </button>
  );
}

/** V2 text field with label. */
export function V2AuthField({
  label,
  ...input
}: {
  label: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-slate-600">{label}</span>
      <input
        {...input}
        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none"
      />
    </label>
  );
}

/** Secondary provider button (Google). */
export function V2ProviderButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-12 w-full rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-60"
    >
      {children}
    </button>
  );
}
