import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

export type CatalogCursor = QueryDocumentSnapshot<DocumentData> | null;

export type CatalogPage<T> = {
  items: T[];
  nextCursor: CatalogCursor;
  hasMore: boolean;
};

export function toPage<T>(
  rows: T[],
  docs: QueryDocumentSnapshot<DocumentData>[],
  pageSize: number,
): CatalogPage<T> {
  return {
    items: rows,
    nextCursor: docs.length === pageSize ? docs[docs.length - 1] ?? null : null,
    hasMore: docs.length === pageSize,
  };
}

export function normalizedSortName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}
