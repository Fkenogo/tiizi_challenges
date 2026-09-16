import { createContext, useContext, useMemo, useState } from 'react';

/**
 * TIIZI S1 — lightweight localisation scaffolding.
 *
 * English first. Additional locales plug in later without touching
 * shell copy: every V2 member/operator surface reads copy through
 * this hook. No technical timezone identifiers are exposed in
 * member-facing copy (see formatFriendlyDay).
 */

export type V2Locale = 'en';

type V2Strings = Record<string, string>;

const EN: V2Strings = {
  'shell.today': 'Today',
  'shell.challenges': 'Challenges',
  'shell.groups': 'Groups',
  'shell.guide': 'Activity Guide',
  'shell.profile': 'Profile',
  'shell.notifications': 'Notifications',
  'shell.operator': 'Operator',
  'shell.exitToMember': 'Exit to Member experience',
  'shell.memberView': 'Member view',
  'common.comingSoon': 'Coming soon in the next slice',
  'common.loading': 'Loading…',
};

const LOCALES: Record<V2Locale, V2Strings> = { en: EN };

type V2LocaleContextValue = {
  locale: V2Locale;
  setLocale: (locale: V2Locale) => void;
  t: (key: string) => string;
  /** Member-friendly day label. Never emits technical tz identifiers. */
  formatFriendlyDay: (date: Date) => string;
};

const V2LocaleContext = createContext<V2LocaleContextValue | null>(null);

export function V2LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<V2Locale>('en');
  const value = useMemo<V2LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key: string) => LOCALES[locale][key] ?? key,
      formatFriendlyDay: (date: Date) => {
        const now = new Date();
        const sameDay =
          date.getFullYear() === now.getFullYear()
          && date.getMonth() === now.getMonth()
          && date.getDate() === now.getDate();
        if (sameDay) return 'Today';
        return date.toLocaleDateString(locale === 'en' ? 'en-GB' : locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });
      },
    }),
    [locale],
  );
  return <V2LocaleContext.Provider value={value}>{children}</V2LocaleContext.Provider>;
}

export function useV2Locale(): V2LocaleContextValue {
  const ctx = useContext(V2LocaleContext);
  if (!ctx) throw new Error('useV2Locale must be used inside V2LocaleProvider');
  return ctx;
}
