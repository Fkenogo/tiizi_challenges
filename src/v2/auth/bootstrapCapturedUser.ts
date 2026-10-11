import type { MemberBootstrapResult } from '../../api/memberBootstrapApi';
import { resolveBootstrapDisplayName, type SignUpNameHandoff } from './signUpNameHandoff';

/**
 * MC-1 — identity-bound member bootstrap (no Firebase import; injectable).
 *
 * The name, the ID token and the request all come from ONE captured Firebase
 * user. The global `auth.currentUser` is only consulted to ABORT if the
 * identity has moved on, never as the source of the token. So user A's name
 * can never be sent with user B's token.
 */
export interface CapturedFirebaseUser {
  uid: string;
  displayName?: string | null;
  getIdToken(): Promise<string>;
}

export interface CapturedBootstrapDeps {
  user: CapturedFirebaseUser;
  /** The uid the gate is bootstrapping. */
  expectedUid: string;
  /** Live current Firebase uid (mutable global), used only to fail closed. */
  currentUid(): string | null;
  handoff: SignUpNameHandoff;
  send(token: string, displayName: string | null): Promise<MemberBootstrapResult>;
}

export class BootstrapIdentityMismatchError extends Error {
  constructor() {
    super('The signed-in account changed during member setup.');
  }
}

export async function bootstrapCapturedUser(deps: CapturedBootstrapDeps): Promise<MemberBootstrapResult> {
  const { user, expectedUid } = deps;
  if (user.uid !== expectedUid || deps.currentUid() !== expectedUid) throw new BootstrapIdentityMismatchError();
  const displayName = resolveBootstrapDisplayName(deps.handoff, user.uid, user.displayName);
  const token = await user.getIdToken(); // token of the captured user, not auth.currentUser
  // Identity may have moved while the token was fetched: abort before sending.
  if (deps.currentUid() !== expectedUid) throw new BootstrapIdentityMismatchError();
  return deps.send(token, displayName);
}
