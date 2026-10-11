import type { MemberBootstrapResult } from '../../api/memberBootstrapApi';

/**
 * MC-1 — per-session member bootstrap state (no React, unit-testable).
 *
 * `ensure(uid)` runs the explicit bootstrap at most once per signed-in
 * subject while it succeeds, and shares one in-flight call among concurrent
 * callers of the SAME uid. State is per uid, so one identity's completion can
 * never mark another ready. A failure is NOT cached and is NOT retried here:
 * only an explicit user action (calling `ensure` again) re-attempts.
 */
export interface MemberBootstrapSession {
  ensure(uid: string, displayName?: string | null): Promise<void>;
}

export function createMemberBootstrapSession(
  run: (displayName?: string | null) => Promise<MemberBootstrapResult>,
  onBootstrapped?: (uid: string) => void,
): MemberBootstrapSession {
  const ready = new Set<string>();
  const inFlight = new Map<string, Promise<void>>();

  return {
    ensure(uid: string, displayName?: string | null): Promise<void> {
      if (ready.has(uid)) return Promise.resolve();
      const existing = inFlight.get(uid);
      if (existing) return existing;
      const promise = run(displayName).then(
        () => {
          ready.add(uid);
          inFlight.delete(uid);
          onBootstrapped?.(uid);
        },
        (error: unknown) => {
          inFlight.delete(uid);
          throw error;
        },
      );
      inFlight.set(uid, promise);
      return promise;
    },
  };
}

/** Outcome of a bootstrap attempt, always bound to the uid it was for. */
export interface BootstrapOutcome {
  uid: string;
  status: 'ready' | 'failed';
}

/**
 * Gate status for the CURRENT uid. An outcome for any other uid (or none) is
 * 'working', so children never render for an identity that has not itself
 * completed bootstrap — including a direct A -> B switch with no null state.
 */
export function bootstrapGateStatus(
  outcome: BootstrapOutcome | null,
  currentUid: string | null,
): 'working' | 'ready' | 'failed' {
  if (!currentUid || !outcome || outcome.uid !== currentUid) return 'working';
  return outcome.status;
}
