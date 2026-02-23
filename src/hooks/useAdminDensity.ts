import { useEffect, useMemo, useState } from 'react';

export type AdminDensity = 'comfortable' | 'compact';

const DENSITY_KEY = 'tiizi_admin_density';
const DENSITY_EVENT = 'tiizi-admin-density-change';

function readDensity(): AdminDensity {
  if (typeof window === 'undefined') return 'comfortable';
  const raw = window.localStorage.getItem(DENSITY_KEY);
  return raw === 'compact' ? 'compact' : 'comfortable';
}

export function useAdminDensity() {
  const [density, setDensity] = useState<AdminDensity>(() => readDensity());

  useEffect(() => {
    const onDensityChange = () => {
      setDensity(readDensity());
    };
    window.addEventListener(DENSITY_EVENT, onDensityChange);
    window.addEventListener('storage', onDensityChange);
    return () => {
      window.removeEventListener(DENSITY_EVENT, onDensityChange);
      window.removeEventListener('storage', onDensityChange);
    };
  }, []);

  const actions = useMemo(
    () => ({
      set(next: AdminDensity) {
        window.localStorage.setItem(DENSITY_KEY, next);
        window.dispatchEvent(new Event(DENSITY_EVENT));
      },
      toggle() {
        const next: AdminDensity = density === 'compact' ? 'comfortable' : 'compact';
        window.localStorage.setItem(DENSITY_KEY, next);
        window.dispatchEvent(new Event(DENSITY_EVENT));
      },
    }),
    [density],
  );

  return { density, ...actions };
}
