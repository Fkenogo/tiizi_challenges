/**
 * TIIZI-FER-P1A-001 — device-scoped "welcome seen" state.
 *
 * The welcome is shown BEFORE registration, so there is no member identity to
 * key on: the flag belongs to this device/browser. It is only a convenience
 * (which public screen an unauthenticated visitor lands on first); it never
 * gates sign-in, sign-up or any member feature. Storage can be unavailable or
 * throw (private windows, blocked site data), so every access is guarded and
 * an in-memory fallback keeps the current page session consistent.
 */
export const WELCOME_VERSION = 'v1';
export const WELCOME_SEEN_KEY = `tiizi.v2.welcome.${WELCOME_VERSION}.seen`;

export interface WelcomeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

let memorySeen = false;

function browserStorage(): WelcomeStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function hasSeenWelcome(storage: WelcomeStorage | null = browserStorage()): boolean {
  if (memorySeen) return true;
  try {
    return storage?.getItem(WELCOME_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markWelcomeSeen(storage: WelcomeStorage | null = browserStorage()): void {
  memorySeen = true;
  try {
    storage?.setItem(WELCOME_SEEN_KEY, '1');
  } catch {
    // Storage unavailable: the in-memory flag still covers this page session.
  }
}

/** Test seam: clears only the in-memory fallback. */
export function resetWelcomeMemoryForTests(): void {
  memorySeen = false;
}

/** Slide arithmetic kept pure so keyboard/scroll behaviour is unit-testable. */
export function clampSlide(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(index)));
}

export function slideFromScroll(scrollLeft: number, slideWidth: number, count: number): number {
  if (slideWidth <= 0) return 0;
  return clampSlide(scrollLeft / slideWidth, count);
}
