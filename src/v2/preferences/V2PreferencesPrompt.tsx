import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PREFERENCES_PATH } from './preferencesView';
import { useV2Preferences } from './usePreferences';

/**
 * TIIZI-FER-P1B-001 — one-time personalization prompt (renders nothing).
 *
 * After sign-in/sign-up, a member who has not yet decided Interests or Goals
 * is taken to the optional personalization steps ONCE per browser session,
 * with their requested page preserved as the return path. This is a prompt,
 * not a gate: every step is skippable, it is never repeated once the member
 * has decided, it fails open (no redirect if the read fails), the Operator
 * console is exempt, and nothing else in the product depends on it.
 */
const PROMPTED_KEY = 'tiizi.v2.preferencesPrompt.v1:';

function alreadyPrompted(uid: string): boolean {
  try { return sessionStorage.getItem(PROMPTED_KEY + uid) === '1'; } catch { return promptedInMemory.has(uid); }
}
function markPrompted(uid: string): void {
  promptedInMemory.add(uid);
  try { sessionStorage.setItem(PROMPTED_KEY + uid, '1'); } catch { /* in-memory fallback covers this page session */ }
}
const promptedInMemory = new Set<string>();

export function V2PreferencesPrompt() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const prefs = useV2Preferences();
  const uid = user?.uid;
  const data = prefs.data;

  useEffect(() => {
    if (!uid || !data) return;
    if (data.interestsDecided && data.goalsDecided) return;
    if (location.pathname.startsWith(PREFERENCES_PATH) || location.pathname.startsWith('/v2/operator')) return;
    if (alreadyPrompted(uid)) return;
    markPrompted(uid);
    const requested = `${location.pathname}${location.search}${location.hash}`;
    navigate(`${PREFERENCES_PATH}?next=${encodeURIComponent(requested)}`, { replace: true });
  }, [uid, data, location.pathname, location.search, location.hash, navigate]);

  return null;
}
