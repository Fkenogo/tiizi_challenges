import { ApiError } from '../../../api/apiError';

/**
 * TIIZI-FER-P5T-2-S2 — pure model for the read-only Operator Template Library.
 * No Firebase/transport import: guards and the render harness load it directly.
 */

export const LIBRARY_PAGE_SIZE = 25;
/** Consecutive empty pages followed automatically before asking the reader to continue. */
export const MAX_AUTO_EMPTY_PAGES = 5;

export type TemplateTypeFilter = '' | 'collective' | 'competitive' | 'streak';
export type TemplateLifecycleFilter = '' | 'draft' | 'published' | 'retired';

export interface LibraryFilters {
  q: string;
  type: TemplateTypeFilter;
  lifecycle: TemplateLifecycleFilter;
  activity: string;
  tag: string;
}

export const EMPTY_FILTERS: LibraryFilters = { q: '', type: '', lifecycle: '', activity: '', tag: '' };

export const TYPE_LABELS: Record<Exclude<TemplateTypeFilter, ''>, string> = {
  collective: 'Together',
  competitive: 'Race',
  streak: 'Streak',
};

export const LIFECYCLE_LABELS: Record<Exclude<TemplateLifecycleFilter, ''>, string> = {
  draft: 'Draft',
  published: 'Published',
  retired: 'Retired',
};

export function typeLabel(type: string | null | undefined): string {
  return type && type in TYPE_LABELS ? TYPE_LABELS[type as keyof typeof TYPE_LABELS] : '—';
}

export function lifecycleLabel(lifecycle: string | null | undefined): string {
  return lifecycle && lifecycle in LIFECYCLE_LABELS ? LIFECYCLE_LABELS[lifecycle as keyof typeof LIFECYCLE_LABELS] : '—';
}

export function hasActiveFilters(filters: LibraryFilters): boolean {
  return (Object.keys(EMPTY_FILTERS) as Array<keyof LibraryFilters>).some((key) => filters[key].trim() !== '');
}

/**
 * Query string for `GET /api/operator/templates`. Empty filters are omitted;
 * the SAME filters are sent with every page so a cursor is only ever replayed
 * against the query that issued it.
 */
export function templateListQuery(filters: LibraryFilters, cursor: string | null, limit = LIBRARY_PAGE_SIZE): string {
  const params = new URLSearchParams();
  const put = (key: string, value: string) => { if (value.trim() !== '') params.set(key, value.trim()); };
  put('q', filters.q);
  put('type', filters.type);
  put('lifecycle', filters.lifecycle);
  put('activity', filters.activity);
  put('tag', filters.tag);
  params.set('limit', String(limit));
  if (cursor) params.set('cursor', cursor);
  return params.toString();
}

export interface LibraryFailure {
  kind: 'signin' | 'denied' | 'cursor' | 'missing' | 'unavailable' | 'failed';
  title: string;
  message: string;
}

/** Distinct, honest states: never conflates "no access" with "no data" or "API down". */
export function classifyLibraryError(error: unknown): LibraryFailure {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return { kind: 'signin', title: 'Sign-in required', message: 'Your session is not authenticated. Sign in again, then retry.' };
    }
    if (error.status === 403) {
      return {
        kind: 'denied',
        title: 'Template Library access denied',
        message: 'This account does not hold an active Template-author or Platform Operator Console read grant.',
      };
    }
    if (error.status === 400 && error.code === 'invalid_cursor') {
      return {
        kind: 'cursor',
        title: 'This list changed while you were browsing',
        message: 'The page marker is no longer valid. Reload the list from the first page.',
      };
    }
    if (error.status === 404) {
      return { kind: 'missing', title: 'Template not found', message: 'This Template is no longer available.' };
    }
    if (error.status === 503 || error.status === 0) {
      return { kind: 'unavailable', title: 'The API is unreachable', message: 'The Template service could not be reached. Check the connection and retry.' };
    }
    if (error.status >= 500) {
      return { kind: 'failed', title: 'The API could not complete this read', message: 'Retry in a moment. If this persists, check the API log.' };
    }
    return { kind: 'failed', title: 'The Template read could not be completed', message: 'Retry, or adjust the search and filters.' };
  }
  return { kind: 'unavailable', title: 'The API is unreachable', message: 'The Template service could not be reached. Check the connection and retry.' };
}

export interface CursorPage<T> { items: readonly T[]; nextCursor: string | null }

/** Concatenate pages in order, de-duplicating by key (a page boundary can never repeat a row). */
export function flattenPages<T>(pages: ReadonlyArray<CursorPage<T>>, key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const page of pages) {
    for (const item of page.items) {
      const id = key(item);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(item);
    }
  }
  return out;
}

export type PageAdvice = 'done' | 'wait' | 'advance' | 'ask';

/**
 * What to do after the pages loaded so far. A page may carry a cursor yet be
 * EMPTY (a bounded scan found nothing adoptable — the P5T-3 member catalogue
 * does this): keep following the cursor, up to MAX_AUTO_EMPTY_PAGES in a row,
 * then hand control to the reader. A non-empty page with a cursor means "more
 * available on request". Only a null cursor ends the list.
 */
export function pageAdvice(pages: ReadonlyArray<CursorPage<unknown>>, fetching: boolean): PageAdvice {
  const last = pages[pages.length - 1];
  if (!last || last.nextCursor === null) return 'done';
  if (fetching) return 'wait';
  if (last.items.length > 0) return 'ask';
  let streak = 0;
  for (let i = pages.length - 1; i >= 0 && pages[i].items.length === 0; i -= 1) streak += 1;
  return streak < MAX_AUTO_EMPTY_PAGES ? 'advance' : 'ask';
}

/** Short identity reference (members have no operator-visible name). */
export function shortId(value: string | null | undefined): string {
  return typeof value === 'string' && value.length >= 8 ? value.slice(0, 8) : '—';
}

export function formatWhen(value: unknown): string {
  if (!value) return '—';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.valueOf()) ? String(value) : parsed.toLocaleString();
}
