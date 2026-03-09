import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type UserNotification = {
  id: string;
  type: 'challenge-reminder' | 'system';
  title: string;
  message: string;
  createdAt: string;
  unread: boolean;
  challengeId?: string;
  groupId?: string;
  startsOn?: string;
};

type NotificationsPayload = {
  items?: UserNotification[];
};

const MAX_ITEMS = 100;

function sortNewest(items: UserNotification[]) {
  return [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

class NotificationService {
  async getUserNotifications(uid: string): Promise<UserNotification[]> {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return [];
    const data = snap.data() as { notifications?: NotificationsPayload };
    const items = data.notifications?.items ?? [];
    return sortNewest(items).slice(0, MAX_ITEMS);
  }

  async markAllRead(uid: string): Promise<void> {
    const existing = await this.getUserNotifications(uid);
    const next = existing.map((item) => ({ ...item, unread: false }));
    await setDoc(doc(db, 'users', uid), { notifications: { items: next } }, { merge: true });
  }

  async addChallengeReminder(input: {
    uid: string;
    challengeId: string;
    challengeName: string;
    startDate: string;
    groupId?: string;
  }): Promise<void> {
    const existing = await this.getUserNotifications(input.uid);
    const duplicate = existing.find(
      (item) => item.type === 'challenge-reminder' && item.challengeId === input.challengeId,
    );
    if (duplicate) {
      if (duplicate.unread) return;
      const refreshed = existing.map((item) =>
        item.id === duplicate.id ? { ...item, unread: true, createdAt: new Date().toISOString() } : item,
      );
      await setDoc(doc(db, 'users', input.uid), { notifications: { items: sortNewest(refreshed).slice(0, MAX_ITEMS) } }, { merge: true });
      return;
    }

    const createdAt = new Date().toISOString();
    const startLabel = new Date(input.startDate).toLocaleDateString();
    const nextItem: UserNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'challenge-reminder',
      title: 'Challenge reminder',
      message: `Reminder set for ${input.challengeName} starting on ${startLabel}.`,
      createdAt,
      unread: true,
      challengeId: input.challengeId,
      groupId: input.groupId,
      startsOn: input.startDate,
    };

    const merged = sortNewest([nextItem, ...existing]).slice(0, MAX_ITEMS);
    await setDoc(doc(db, 'users', input.uid), { notifications: { items: merged } }, { merge: true });
  }
}

export const notificationService = new NotificationService();
