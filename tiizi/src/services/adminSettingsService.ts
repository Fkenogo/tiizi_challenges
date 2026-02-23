import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type AppConfig = {
  appName: string;
  supportEmail: string;
  termsUrl: string;
  privacyUrl: string;
  maintenanceMode: boolean;
  maxChallengesPerUser: number;
  maxGroupsPerUser: number;
  maxWorkoutLogsPerDay: number;
};

export type AdminUserRecord = {
  uid: string;
  role: 'super_admin' | 'content_manager' | 'moderator' | 'support' | 'admin';
  status: 'active' | 'suspended';
  displayName?: string;
  email?: string;
};

export type SystemLogItem = {
  id: string;
  at: string;
  actorUid: string;
  action: string;
  targetType: string;
  targetId: string;
  severity: 'info' | 'warning' | 'error';
  note?: string;
};

const defaultConfig: AppConfig = {
  appName: 'Tiizi',
  supportEmail: 'support@tiizi.app',
  termsUrl: 'https://tiizi.app/terms',
  privacyUrl: 'https://tiizi.app/privacy',
  maintenanceMode: false,
  maxChallengesPerUser: 10,
  maxGroupsPerUser: 8,
  maxWorkoutLogsPerDay: 30,
};

class AdminSettingsService {
  async getAppConfig(): Promise<AppConfig> {
    const snap = await getDoc(doc(db, 'settings', 'app'));
    if (!snap.exists()) return defaultConfig;
    return {
      ...defaultConfig,
      ...(snap.data() as Partial<AppConfig>),
    };
  }

  async saveAppConfig(config: AppConfig, actorUid: string): Promise<void> {
    await setDoc(doc(db, 'settings', 'app'), config, { merge: true });
    await this.addSystemLog({
      actorUid,
      action: 'settings.app.update',
      targetType: 'settings',
      targetId: 'app',
      severity: 'info',
      note: 'App configuration updated.',
    });
  }

  async getAdminUsers(): Promise<AdminUserRecord[]> {
    const snap = await getDocs(collection(db, 'admins'));
    return snap.docs.map((d) => {
      const data = d.data() as Omit<AdminUserRecord, 'uid'>;
      return {
        uid: d.id,
        role: data.role,
        status: data.status ?? 'active',
        displayName: data.displayName,
        email: data.email,
      };
    });
  }

  async upsertAdminUser(payload: AdminUserRecord, actorUid: string): Promise<void> {
    await setDoc(doc(db, 'admins', payload.uid), payload, { merge: true });
    await setDoc(doc(db, 'users', payload.uid), { role: payload.role }, { merge: true });
    await this.addSystemLog({
      actorUid,
      action: 'settings.admin.upsert',
      targetType: 'admin',
      targetId: payload.uid,
      severity: 'warning',
      note: `Role set to ${payload.role}; status ${payload.status}.`,
    });
  }

  async getSystemLogs(limitCount = 100): Promise<SystemLogItem[]> {
    const q = query(collection(db, 'systemLogs'), orderBy('at', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SystemLogItem, 'id'>) }));
  }

  async addSystemLog(input: Omit<SystemLogItem, 'id' | 'at'>): Promise<void> {
    await addDoc(collection(db, 'systemLogs'), {
      ...input,
      at: new Date().toISOString(),
    });
  }
}

export const adminSettingsService = new AdminSettingsService();
