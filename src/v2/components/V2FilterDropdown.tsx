import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';

export type FilterTone = 'orange' | 'green';

export interface FilterOption<T extends string> { value: T; label: string; tone?: FilterTone }
export interface FilterGroup<T extends string> { label: string; tone: FilterTone; options: ReadonlyArray<FilterOption<T>> }
export type FilterItem<T extends string> = FilterOption<T> | FilterGroup<T>;

const DOT: Record<FilterTone, string> = { orange: 'bg-orange-500', green: 'bg-emerald-500' };
const GROUP_HEADER: Record<FilterTone, string> = { orange: 'bg-orange-50/60 text-orange-600', green: 'bg-emerald-50/60 text-emerald-600' };

export function FilterToneDot({ tone, className = '' }: { tone: FilterTone; className?: string }) {
  return <span aria-hidden="true" className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT[tone]} ${className}`} />;
}

function isGroup<T extends string>(item: FilterItem<T>): item is FilterGroup<T> {
  return 'options' in item;
}

/**
 * Compact labelled dropdown (closed control shows the current value). The
 * first option is the default; any other selection highlights the control.
 * Open state is owned by the parent so only one dropdown is open at a time.
 */
export function V2FilterDropdown<T extends string>({ id, label, align, open, onOpenChange, value, onChange, items, menuClassName = 'w-48' }: {
  id: string;
  label: string;
  align: 'left' | 'right';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: T;
  onChange: (value: T) => void;
  items: ReadonlyArray<FilterItem<T>>;
  menuClassName?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const options = items.flatMap((item) => (isGroup(item) ? item.options : [item]));
  const selected = options.find((option) => option.value === value) ?? options[0];
  const active = selected.value !== options[0].value;
  const menuId = `v2-filter-${id}-menu`;

  useEffect(() => {
    if (!open) return;
    const nodes = menuRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
    const index = options.findIndex((option) => option.value === value);
    (nodes?.[index] ?? nodes?.[0])?.scrollIntoView?.({ block: 'nearest' });
    (nodes?.[index] ?? nodes?.[0])?.focus({ preventScroll: true });
  }, [open]);

  const choose = (next: T) => { onChange(next); onOpenChange(false); triggerRef.current?.focus(); };
  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    const move = (target: number) => { event.preventDefault(); nodes[target]?.focus(); };
    if (event.key === 'Escape') { event.preventDefault(); onOpenChange(false); triggerRef.current?.focus(); }
    else if (event.key === 'ArrowDown') move((index + 1) % nodes.length);
    else if (event.key === 'ArrowUp') move((index - 1 + nodes.length) % nodes.length);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(nodes.length - 1);
    else if (event.key === 'Tab') onOpenChange(false);
  };

  const renderOption = (option: FilterOption<T>, compact: boolean) => {
    const isSelected = option.value === value;
    return <button
      key={option.value}
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={() => choose(option.value)}
      className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${compact ? 'font-medium' : 'font-semibold'} ${isSelected ? 'bg-orange-50' : ''}`}
    >
      <span className="flex min-w-0 items-center gap-1.5">{option.tone && <FilterToneDot tone={option.tone} />}<span className="min-w-0">{option.label}</span></span>
      {isSelected && <span aria-hidden="true" className="shrink-0 text-sm font-bold text-primary">✓</span>}
    </button>;
  };

  return <div className="relative min-w-0">
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      aria-label={`${label}: ${selected.label}`}
      onClick={() => onOpenChange(!open)}
      onKeyDown={(event) => { if (event.key === 'ArrowDown' && !open) { event.preventDefault(); onOpenChange(true); } }}
      className={`flex min-h-11 w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? 'border-primary/50 bg-orange-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'} ${open ? 'ring-2 ring-primary' : ''}`}
    >
      <span className="min-w-0 truncate pr-1">
        <span className="block text-[9px] font-bold uppercase leading-none tracking-wider text-slate-500">{label}</span>
        <span className={`mt-0.5 flex items-center gap-1.5 text-xs font-bold ${active ? 'text-primary' : 'text-slate-800'}`}>
          {active && selected.tone && <FilterToneDot tone={selected.tone} />}<span className="truncate">{selected.label}</span>
        </span>
      </span>
      <svg aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
    </button>
    {open && <div
      ref={menuRef}
      id={menuId}
      role="listbox"
      aria-label={label}
      onKeyDown={onMenuKeyDown}
      className={`absolute top-full z-50 mt-1.5 max-h-[min(20rem,60vh)] max-w-[calc(100vw-2rem)] space-y-0.5 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl ${menuClassName} ${align === 'right' ? 'right-0' : 'left-0'}`}
    >
      {items.map((item) => isGroup(item)
        ? <div key={item.label} role="group" aria-label={item.label} className="space-y-0.5 pt-1">
          <div aria-hidden="true" className={`rounded-lg px-2 pb-1 pt-1.5 text-[10px] font-extrabold uppercase tracking-wider ${GROUP_HEADER[item.tone]}`}>{item.label}</div>
          {item.options.map((option) => renderOption(option, true))}
        </div>
        : renderOption(item, false))}
    </div>}
  </div>;
}
