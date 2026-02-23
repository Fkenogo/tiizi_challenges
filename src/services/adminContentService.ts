import { addDoc, collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type InterestGoalItem = {
  id: string;
  name: string;
  type: 'interest' | 'goal';
  category: string;
  icon?: string;
  isActive: boolean;
  isDefault: boolean;
  order: number;
};

export type OnboardingContentItem = {
  id: string;
  stepKey: string;
  title: string;
  body: string;
  version: number;
  isActive: boolean;
};

export type NotificationTemplate = {
  id: string;
  name: string;
  channel: 'push' | 'in_app' | 'email';
  audience: string;
  status: 'draft' | 'scheduled' | 'sent';
  updatedAt: string;
};

export type AdminBookRow = {
  id: string;
  title: string;
  author: string;
  description: string;
  coverImageUrl?: string;
  wordCount: number;
  updatedAt: string;
};

export type AdminBookInput = {
  id?: string;
  title: string;
  author?: string;
  description?: string;
  coverImageUrl?: string;
  plainText: string;
};

function normalizeBookRow(id: string, data: Record<string, unknown>): AdminBookRow {
  const textCandidate = [
    data.plainText,
    data.content,
    data.text,
    data.body,
    data.bookText,
  ].find((value) => typeof value === 'string') as string | undefined;

  const plainText = textCandidate?.trim() ?? '';

  return {
    id,
    title: String(data.title ?? data.name ?? data.bookTitle ?? `Book ${id}`),
    author: String(data.author ?? ''),
    description: String(data.description ?? ''),
    coverImageUrl: typeof data.coverImageUrl === 'string' ? data.coverImageUrl : undefined,
    wordCount: plainText ? plainText.split(/\s+/).filter(Boolean).length : 0,
    updatedAt: String(data.updatedAt ?? data.createdAt ?? ''),
  };
}

function sanitizeBookInput(input: AdminBookInput): Omit<AdminBookInput, 'id'> {
  return {
    title: input.title.trim(),
    author: input.author?.trim() ?? '',
    description: input.description?.trim() ?? '',
    coverImageUrl: input.coverImageUrl?.trim() ?? '',
    plainText: input.plainText.trim(),
  };
}

class AdminContentService {
  async getInterestsAndGoals(): Promise<InterestGoalItem[]> {
    const [interestsSnap, goalsSnap] = await Promise.all([
      getDocs(collection(db, 'exerciseInterests')),
      getDocs(collection(db, 'wellnessGoals')),
    ]);

    const interests = interestsSnap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        name: String(data.name ?? 'Untitled'),
        type: 'interest' as const,
        category: String(data.category ?? 'General'),
        icon: typeof data.icon === 'string' ? data.icon : undefined,
        isActive: data.isActive !== false,
        isDefault: data.isDefault === true,
        order: Number(data.order ?? 0),
      };
    });

    const goals = goalsSnap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        name: String(data.name ?? 'Untitled'),
        type: 'goal' as const,
        category: String(data.category ?? 'General'),
        icon: typeof data.icon === 'string' ? data.icon : undefined,
        isActive: data.isActive !== false,
        isDefault: data.isDefault === true,
        order: Number(data.order ?? 0),
      };
    });

    return [...interests, ...goals].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }

  async getOnboardingContent(): Promise<OnboardingContentItem[]> {
    const snap = await getDocs(collection(db, 'onboardingContent'));
    return snap.docs
      .map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          stepKey: String(data.stepKey ?? d.id),
          title: String(data.title ?? 'Untitled'),
          body: String(data.body ?? ''),
          version: Number(data.version ?? 1),
          isActive: data.isActive !== false,
        };
      })
      .sort((a, b) => a.stepKey.localeCompare(b.stepKey));
  }

  async getNotificationTemplates(): Promise<NotificationTemplate[]> {
    const snap = await getDocs(collection(db, 'notificationTemplates'));
    return snap.docs
      .map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          name: String(data.name ?? 'Untitled Notification'),
          channel: (data.channel as NotificationTemplate['channel']) ?? 'push',
          audience: String(data.audience ?? 'all-users'),
          status: (data.status as NotificationTemplate['status']) ?? 'draft',
          updatedAt: String(data.updatedAt ?? data.createdAt ?? ''),
        };
      })
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  async getBooks(): Promise<AdminBookRow[]> {
    const snap = await getDocs(collection(db, 'books'));
    return snap.docs
      .map((d) => normalizeBookRow(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  async upsertBook(input: AdminBookInput, actorUid: string): Promise<string> {
    const sanitized = sanitizeBookInput(input);
    if (!sanitized.title) throw new Error('Book title is required.');
    if (!sanitized.plainText) throw new Error('Book text is required.');

    const payload: Record<string, unknown> = {
      title: sanitized.title,
      author: sanitized.author,
      description: sanitized.description,
      coverImageUrl: sanitized.coverImageUrl || null,
      plainText: sanitized.plainText,
      content: sanitized.plainText,
      updatedAt: new Date().toISOString(),
      updatedBy: actorUid,
      updatedAtServer: serverTimestamp(),
    };

    if (input.id && input.id.trim()) {
      const id = input.id.trim();
      await setDoc(doc(db, 'books', id), payload, { merge: true });
      return id;
    }

    const ref = await addDoc(collection(db, 'books'), {
      ...payload,
      createdAt: new Date().toISOString(),
      createdBy: actorUid,
      createdAtServer: serverTimestamp(),
    });
    return ref.id;
  }
}

export const adminContentService = new AdminContentService();
