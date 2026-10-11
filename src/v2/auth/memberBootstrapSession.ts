import type { MemberBootstrapResult } from '../../api/memberBootstrapApi';

/**
 * MC-1 — per-session member bootstrap state (no React, unit-testable).
 *
 * `ensure(uid)` runs the explicit bootstrap at most once per signed-in
 * subject while it succeeds, and shares one in-flight call among concurrent
 * callers. A failure is NOT cached and is NOT retried here: only an explicit
 * user action (calling `ensure` again) re-attempts. There is no retry loop.
 */
export interface MemberBootstrapSession {
  ensure(uid: string): Promise<void>;
}

export function createMemberBootstrapSession(
  run: () => Promise<MemberBootstrapResult>,
): MemberBootstrapSession {
  let readyUid: string | null = null;
  let inFlight: { uid: string; promise: Promise<void> } | null = null;

  return {
    ensure(uid: string): Promise<void> {
      if (readyUid === uid) return Promise.resolve();
      if (inFlight && inFlight.uid === uid) return inFlight.promise;
      const promise = run().then(
        () => {
          readyUid = uid;
          if (inFlight?.promise === promise) inFlight = null;
        },
        (error: unknown) => {
          if (inFlight?.promise === promise) inFlight = null;
          throw error;
        },
      );
      inFlight = { uid, promise };
      return promise;
    },
  };
}
