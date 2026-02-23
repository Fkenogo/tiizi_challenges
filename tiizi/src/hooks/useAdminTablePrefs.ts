import { useEffect, useState } from 'react';

export function useAdminTablePrefs<T extends Record<string, unknown>>(key: string, defaults: T) {
  const storageKey = `tiizi_admin_table_prefs_${key}`;
  const [prefs, setPrefs] = useState<T>(() => {
    if (typeof window === 'undefined') return defaults;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<T>;
      return { ...defaults, ...parsed };
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, JSON.stringify(prefs));
  }, [prefs, storageKey]);

  const resetPrefs = () => {
    setPrefs(defaults);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey);
    }
  };

  return { prefs, setPrefs, resetPrefs };
}
