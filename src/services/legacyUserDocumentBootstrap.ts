import { doc, setDoc } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from '../lib/firebaseDb';

const USER_SYNC_KEY_PREFIX = 'tiizi_user_sync';
const USER_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

function shouldSyncUserDocument(uid: string): boolean {
  const key = `${USER_SYNC_KEY_PREFIX}:${uid}`;
  const lastRaw = localStorage.getItem(key);
  const last = lastRaw ? Number(lastRaw) : 0;
  if (!Number.isFinite(last) || Date.now() - last > USER_SYNC_INTERVAL_MS) {
    localStorage.setItem(key, String(Date.now()));
    return true;
  }
  return false;
}

/**
 * Preserve V1's legacy `users/{uid}` bootstrap. Callers must scope this to
 * the V1 `/app/*` route family; V2 uses Firebase Auth plus Tiizi API only.
 */
export async function bootstrapLegacyUserDocument(
  firebaseUser: FirebaseUser,
  preferredDisplayName?: string,
): Promise<void> {
  if (!shouldSyncUserDocument(firebaseUser.uid)) return;

  const email = firebaseUser.email ?? 'user@tiizi.app';
  const displayName =
    preferredDisplayName?.trim() ||
    firebaseUser.displayName ||
    email.split('@')[0] ||
    'Tiizi User';

  await setDoc(
    doc(db, 'users', firebaseUser.uid),
    {
      uid: firebaseUser.uid,
      email,
      displayName,
      photoURL: firebaseUser.photoURL ?? null,
      status: 'active',
      emailVerified: firebaseUser.emailVerified ?? false,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    },
    { merge: true },
  );
}
