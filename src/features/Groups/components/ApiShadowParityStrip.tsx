import { useMemo } from 'react';
import { isTiiziApiEnabled } from '../../../api/apiClient';
import { useMembershipShadowParity } from '../../../hooks/useMembershipShadowParity';

/**
 * Phase A2 operational proof surface (read-only, reversible).
 *
 * Rendered inside the existing Groups "My Groups" tab when
 * VITE_TIIZI_API_ENABLED=true. Exercises the full path
 * React hook -> apiClient -> Tiizi API -> PostgreSQL with the signed-in user
 * and reports whether the shadow read agrees with the Firestore read.
 * Renders nothing when the flag is off; Firestore stays authoritative either
 * way and no downstream action reads API data.
 */
export function ApiShadowParityStrip({ firestoreGroupIds }: { firestoreGroupIds: string[] }) {
  const flagEnabled = isTiiziApiEnabled();
  const stableIds = useMemo(
    () => [...new Set(firestoreGroupIds)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [firestoreGroupIds.join('|')],
  );
  const parity = useMembershipShadowParity(stableIds);

  if (!flagEnabled || parity.status === 'disabled') return null;
  if (parity.status === 'loading') {
    return (
      <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-500">
        Checking Tiizi API shadow…
      </p>
    );
  }
  if (parity.status === 'error') {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-800">
        Tiizi API shadow unreachable — showing Firestore data.
      </p>
    );
  }
  if (parity.status === 'match') {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-800">
        Tiizi API shadow in sync ({parity.apiCount} of {parity.firestoreCount} groups).
      </p>
    );
  }
  return (
    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-800">
      Tiizi API shadow differs ({parity.apiCount} API vs {parity.firestoreCount} Firestore) — Firestore
      shown.
    </p>
  );
}
