import type { TemplateDraftBody } from '../../../api/operatorTemplatesApi';

/**
 * TIIZI-FER-P5T-2-S3B — temporary, account-scoped recovery of unsaved Template
 * draft work.
 *
 * Session storage only (gone when the tab session ends), time-bounded, keyed by
 * the authenticated account AND the draft identity. It stores the author's
 * content and the revision token of the server draft that content was based on
 * (a content hash, not a credential). It never stores an authentication token
 * or any credential. Every storage access is guarded: an unavailable store
 * simply means no recovery.
 */

export const RECOVERY_TTL_MS = 8 * 60 * 60 * 1000;
const PREFIX = 'tiizi:v2:template-draft:';

export interface RecoveryRecord {
  savedAt: number;
  /** Server revision token the work was based on; null for a draft never saved. */
  baseToken: string | null;
  /** The server content the work was based on, for a three-way comparison. */
  baseBody: TemplateDraftBody | null;
  /** The author's unsaved work. */
  body: TemplateDraftBody;
}

export type DraftIdentity = { templateId: string; version: number } | 'new';

function storage(): Storage | null {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch { return null; }
}

function accountPrefix(uid: string): string { return `${PREFIX}${encodeURIComponent(uid)}:`; }

export function recoveryKey(uid: string, draft: DraftIdentity): string {
  return `${accountPrefix(uid)}${draft === 'new' ? 'new' : `${draft.templateId}:${draft.version}`}`;
}

export function writeRecovery(uid: string, draft: DraftIdentity, record: Omit<RecoveryRecord, 'savedAt'>, now = Date.now()): void {
  const store = storage();
  if (!store || !uid) return;
  try { store.setItem(recoveryKey(uid, draft), JSON.stringify({ ...record, savedAt: now })); } catch { /* quota or blocked */ }
}

export function readRecovery(uid: string, draft: DraftIdentity, now = Date.now()): RecoveryRecord | null {
  const store = storage();
  if (!store || !uid) return null;
  const key = recoveryKey(uid, draft);
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RecoveryRecord>;
    const valid = parsed && typeof parsed.savedAt === 'number' && parsed.body && typeof parsed.body === 'object'
      && Array.isArray(parsed.body.composer?.activities) && (parsed.baseToken === null || typeof parsed.baseToken === 'string');
    if (!valid || now - (parsed.savedAt as number) > RECOVERY_TTL_MS || (parsed.savedAt as number) > now + 60_000) {
      store.removeItem(key);
      return null;
    }
    return parsed as RecoveryRecord;
  } catch {
    try { store.removeItem(key); } catch { /* ignore */ }
    return null;
  }
}

export function clearRecovery(uid: string, draft: DraftIdentity): void {
  const store = storage();
  if (!store || !uid) return;
  try { store.removeItem(recoveryKey(uid, draft)); } catch { /* ignore */ }
}

function removeWhere(predicate: (key: string) => boolean): void {
  const store = storage();
  if (!store) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i += 1) { const key = store.key(i); if (key && key.startsWith(PREFIX) && predicate(key)) keys.push(key); }
    keys.forEach((key) => store.removeItem(key));
  } catch { /* ignore */ }
}

/** Sign-out: remove every recovery record of this account. */
export function clearAccountRecovery(uid: string): void {
  if (!uid) return;
  const prefix = accountPrefix(uid);
  removeWhere((key) => key.startsWith(prefix));
}

/** Account switch: remove every record that belongs to any other account. */
export function purgeOtherAccountsRecovery(currentUid: string): void {
  const prefix = accountPrefix(currentUid);
  removeWhere((key) => !key.startsWith(prefix));
}
