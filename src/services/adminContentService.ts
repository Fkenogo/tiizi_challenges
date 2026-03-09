import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
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
  subject?: string;
  body?: string;
  triggerType?: 'manual' | 'scheduled' | 'inactivity' | 'challenge_completion' | 'streak_milestone' | 'donation_nudge';
  triggerCooldownDays?: number;
  inactivityDays?: number;
  milestoneValue?: number;
  status: 'draft' | 'scheduled' | 'sent';
  scheduledAt?: string;
  publishedAt?: string;
  updatedAt: string;
};

export type NotificationTemplateInput = {
  id?: string;
  name: string;
  channel: NotificationTemplate['channel'];
  audience: string;
  subject?: string;
  body?: string;
  status?: NotificationTemplate['status'];
  scheduledAt?: string;
  triggerType?: NotificationTemplate['triggerType'];
  triggerCooldownDays?: number;
  inactivityDays?: number;
  milestoneValue?: number;
};

export type InterestGoalInput = {
  id?: string;
  name: string;
  type: 'interest' | 'goal';
  category: string;
  icon?: string;
  isActive: boolean;
  isDefault: boolean;
  order: number;
};

export type ContentPage = {
  id: string;
  title: string;
  slug: string;
  category: 'legal' | 'policy' | 'update' | 'help';
  body: string;
  status: 'draft' | 'published';
  updatedAt: string;
};

export type ContentPageInput = {
  id?: string;
  title: string;
  slug: string;
  category: ContentPage['category'];
  body: string;
  status: ContentPage['status'];
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
          subject: typeof data.subject === 'string' ? data.subject : '',
          body: typeof data.body === 'string' ? data.body : '',
          triggerType: (data.triggerType as NotificationTemplate['triggerType']) ?? 'manual',
          triggerCooldownDays: Number(data.triggerCooldownDays ?? 0),
          inactivityDays: Number(data.inactivityDays ?? 0),
          milestoneValue: Number(data.milestoneValue ?? 0),
          status: (data.status as NotificationTemplate['status']) ?? 'draft',
          scheduledAt: typeof data.scheduledAt === 'string' ? data.scheduledAt : '',
          publishedAt: typeof data.publishedAt === 'string' ? data.publishedAt : '',
          updatedAt: String(data.updatedAt ?? data.createdAt ?? ''),
        };
      })
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  async upsertInterestGoal(input: InterestGoalInput, actorUid: string): Promise<string> {
    const collectionName = input.type === 'interest' ? 'exerciseInterests' : 'wellnessGoals';
    const payload = {
      name: input.name.trim(),
      category: input.category.trim() || 'General',
      icon: input.icon?.trim() || null,
      isActive: input.isActive,
      isDefault: input.isDefault,
      order: input.order,
      updatedAt: new Date().toISOString(),
      updatedBy: actorUid,
      updatedAtServer: serverTimestamp(),
    };
    if (!payload.name) {
      throw new Error('Name is required.');
    }

    if (input.id && input.id.trim()) {
      const id = input.id.trim();
      await setDoc(doc(db, collectionName, id), payload, { merge: true });
      return id;
    }

    const ref = await addDoc(collection(db, collectionName), {
      ...payload,
      createdAt: new Date().toISOString(),
      createdBy: actorUid,
      createdAtServer: serverTimestamp(),
    });
    return ref.id;
  }

  async deleteInterestGoal(type: 'interest' | 'goal', id: string): Promise<void> {
    const collectionName = type === 'interest' ? 'exerciseInterests' : 'wellnessGoals';
    await deleteDoc(doc(db, collectionName, id));
  }

  async upsertNotificationTemplate(input: NotificationTemplateInput, actorUid: string): Promise<string> {
    const payload = {
      name: input.name.trim(),
      channel: input.channel,
      audience: input.audience.trim() || 'all-users',
      subject: input.subject?.trim() || '',
      body: input.body?.trim() || '',
      status: input.status ?? (input.scheduledAt ? 'scheduled' : 'draft'),
      scheduledAt: input.scheduledAt || '',
      triggerType: input.triggerType ?? 'manual',
      triggerCooldownDays: Number(input.triggerCooldownDays ?? 0),
      inactivityDays: Number(input.inactivityDays ?? 0),
      milestoneValue: Number(input.milestoneValue ?? 0),
      updatedAt: new Date().toISOString(),
      updatedBy: actorUid,
      updatedAtServer: serverTimestamp(),
    };
    if (!payload.name) throw new Error('Template name is required.');
    if (!payload.body) throw new Error('Template message is required.');

    if (input.id && input.id.trim()) {
      const id = input.id.trim();
      await setDoc(doc(db, 'notificationTemplates', id), payload, { merge: true });
      return id;
    }

    const ref = await addDoc(collection(db, 'notificationTemplates'), {
      ...payload,
      createdAt: new Date().toISOString(),
      createdBy: actorUid,
      createdAtServer: serverTimestamp(),
    });
    return ref.id;
  }

  async publishNotificationTemplate(id: string, actorUid: string): Promise<void> {
    await updateDoc(doc(db, 'notificationTemplates', id), {
      status: 'sent',
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: actorUid,
      updatedAtServer: serverTimestamp(),
    });
  }

  async deleteNotificationTemplate(id: string): Promise<void> {
    await deleteDoc(doc(db, 'notificationTemplates', id));
  }

  async getContentPages(): Promise<ContentPage[]> {
    const snap = await getDocs(collection(db, 'contentPages'));
    return snap.docs
      .map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          title: String(data.title ?? 'Untitled'),
          slug: String(data.slug ?? d.id),
          category: (data.category as ContentPage['category']) ?? 'policy',
          body: String(data.body ?? ''),
          status: (data.status as ContentPage['status']) ?? 'draft',
          updatedAt: String(data.updatedAt ?? data.createdAt ?? ''),
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  async upsertContentPage(input: ContentPageInput, actorUid: string): Promise<string> {
    const payload = {
      title: input.title.trim(),
      slug: input.slug.trim(),
      category: input.category,
      body: input.body.trim(),
      status: input.status,
      updatedAt: new Date().toISOString(),
      updatedBy: actorUid,
      updatedAtServer: serverTimestamp(),
    };
    if (!payload.title) throw new Error('Title is required.');
    if (!payload.slug) throw new Error('Slug is required.');
    if (!payload.body) throw new Error('Content body is required.');

    if (input.id && input.id.trim()) {
      const id = input.id.trim();
      await setDoc(doc(db, 'contentPages', id), payload, { merge: true });
      return id;
    }

    const ref = await addDoc(collection(db, 'contentPages'), {
      ...payload,
      createdAt: new Date().toISOString(),
      createdBy: actorUid,
      createdAtServer: serverTimestamp(),
    });
    return ref.id;
  }

  async deleteContentPage(id: string): Promise<void> {
    await deleteDoc(doc(db, 'contentPages', id));
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
