import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type LibraryBook = {
  id: string;
  title: string;
  author?: string;
  description?: string;
  coverImageUrl?: string;
  plainText: string;
  rawContent: unknown;
};

type MaybeRecord = Record<string, unknown>;

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

function flattenAnyText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((item) => flattenAnyText(item)).filter(Boolean).join('\n\n');
  }
  if (typeof value === 'object') {
    const obj = value as MaybeRecord;
    const orderedKeys = [
      'title',
      'heading',
      'subtitle',
      'body',
      'content',
      'text',
      'paragraphs',
      'sections',
      'chapters',
    ];
    const picked = orderedKeys
      .map((key) => flattenAnyText(obj[key]))
      .filter(Boolean)
      .join('\n\n');
    if (picked) return picked;
    return Object.values(obj).map((item) => flattenAnyText(item)).filter(Boolean).join('\n\n');
  }
  return '';
}

function normalizeBook(id: string, raw: MaybeRecord): LibraryBook {
  const title = asString(raw.title) ?? asString(raw.name) ?? asString(raw.bookTitle) ?? `Book ${id}`;
  const author = asString(raw.author) ?? asString(raw.writer) ?? asString(raw.by);
  const description = asString(raw.description) ?? asString(raw.summary) ?? asString(raw.subtitle);
  const coverImageUrl = asString(raw.coverImageUrl) ?? asString(raw.cover) ?? asString(raw.imageUrl);

  const textSources: unknown[] = [
    raw.plainText,
    raw.content,
    raw.text,
    raw.body,
    raw.bookText,
    raw.chapters,
    raw.sections,
    raw.pages,
  ];

  const plainText = textSources.map((item) => flattenAnyText(item)).filter(Boolean).join('\n\n').trim();

  return {
    id,
    title,
    author,
    description,
    coverImageUrl,
    plainText,
    rawContent: raw,
  };
}

class BookLibraryService {
  private collectionNames = ['books', 'libraryBooks', 'bookLibrary'];

  async getBooks(): Promise<LibraryBook[]> {
    for (const collectionName of this.collectionNames) {
      try {
        const snap = await getDocs(collection(db, collectionName));
        if (snap.empty) continue;
        const books = snap.docs
          .map((row) => normalizeBook(row.id, row.data() as MaybeRecord))
          .filter((book) => book.plainText.length > 0);
        if (books.length > 0) {
          return books.sort((a, b) => a.title.localeCompare(b.title));
        }
      } catch {
        // Try next collection name.
      }
    }
    return [];
  }

  async getBookById(id: string): Promise<LibraryBook | null> {
    for (const collectionName of this.collectionNames) {
      try {
        const snap = await getDoc(doc(db, collectionName, id));
        if (snap.exists()) {
          const normalized = normalizeBook(snap.id, snap.data() as MaybeRecord);
          return normalized.plainText.length > 0 ? normalized : null;
        }
      } catch {
        // Try next collection name.
      }
    }
    return null;
  }
}

export const bookLibraryService = new BookLibraryService();
