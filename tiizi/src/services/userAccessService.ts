import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type AppRole = 'admin' | 'member';

class UserAccessService {
  private collectionName = 'users';

  async getRole(uid: string): Promise<AppRole> {
    const ref = doc(db, this.collectionName, uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return 'member';

    const data = snap.data() as { role?: string; profile?: { role?: string } };
    const role = data.role ?? data.profile?.role;
    return role === 'admin' ? 'admin' : 'member';
  }
}

export const userAccessService = new UserAccessService();
