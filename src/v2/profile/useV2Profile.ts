/**
 * MC-2C-1 — own-member Profile read + display-name self-edit.
 *
 * Deliberately NOT a shared query cache: this slice keeps the Profile in
 * component state and resets it whenever the authenticated UID changes, so a
 * previous member's data can never be presented to the next one. UID-scoped
 * caching, account-switch clearing tests and post-edit cache invalidation are
 * MC-2C-2 concerns; nothing here persists Profile data to storage.
 *
 * The server remains the authority for every value. This hook only sequences
 * one governed read, independent Group/Challenge page reads, and one
 * display-name PATCH.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/apiClient';
import {
  fetchV2Profile,
  updateV2DisplayName,
  type V2Profile,
} from '../../api/profileApi';
import { useAuth } from '../../hooks/useAuth';

type ProfileSection = 'groups' | 'challenges';

interface PageError {
  section: ProfileSection;
  error: unknown;
}

export function useV2Profile() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [profile, setProfile] = useState<V2Profile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isLoadingChallenges, setIsLoadingChallenges] = useState(false);
  const [pageError, setPageError] = useState<PageError | null>(null);

  // Increments on every identity change or explicit reload so late responses
  // from a previous member can never overwrite the current view.
  const requestSeq = useRef(0);
  const activeUid = useRef<string | null>(uid);
  const groupsInFlight = useRef(false);
  const challengesInFlight = useRef(false);

  useEffect(() => {
    activeUid.current = uid;
    requestSeq.current += 1;
    const seq = requestSeq.current;

    setProfile(null);
    setError(null);
    setPageError(null);
    setIsSaving(false);
    setIsLoadingGroups(false);
    setIsLoadingChallenges(false);
    groupsInFlight.current = false;
    challengesInFlight.current = false;

    if (!uid) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    void (async () => {
      try {
        const next = await fetchV2Profile();
        if (requestSeq.current !== seq) return;
        setProfile(next);
      } catch (readError) {
        if (requestSeq.current !== seq) return;
        setError(readError);
      } finally {
        if (requestSeq.current === seq) setIsLoading(false);
      }
    })();
  }, [uid]);

  const reload = useCallback(async () => {
    if (!uid) return;
    requestSeq.current += 1;
    const seq = requestSeq.current;
    setIsLoading(true);
    setError(null);
    setPageError(null);
    try {
      const next = await fetchV2Profile();
      if (requestSeq.current !== seq) return;
      setProfile(next);
    } catch (readError) {
      if (requestSeq.current !== seq) return;
      setError(readError);
    } finally {
      if (requestSeq.current === seq) setIsLoading(false);
    }
  }, [uid]);

  const loadMoreGroups = useCallback(async () => {
    const cursor = profile?.groups.nextCursor;
    if (!cursor || groupsInFlight.current) return;
    groupsInFlight.current = true;
    setIsLoadingGroups(true);
    setPageError((current) => (current?.section === 'groups' ? null : current));
    try {
      const next = await fetchV2Profile({ groupsCursor: cursor });
      if (activeUid.current !== uid) return;
      setProfile((current) =>
        current
          ? {
              ...current,
              groups: {
                ...next.groups,
                items: [...current.groups.items, ...next.groups.items],
              },
            }
          : current,
      );
    } catch (pageReadError) {
      if (activeUid.current !== uid) return;
      if (pageReadError instanceof ApiError && pageReadError.status === 400) {
        // A continuation the server no longer accepts is never retried: fall
        // back to the first page rather than looping on the same cursor.
        await reload();
        return;
      }
      setPageError({ section: 'groups', error: pageReadError });
    } finally {
      groupsInFlight.current = false;
      if (activeUid.current === uid) setIsLoadingGroups(false);
    }
  }, [profile?.groups.nextCursor, reload, uid]);

  const loadMoreChallenges = useCallback(async () => {
    const cursor = profile?.challenges.nextCursor;
    if (!cursor || challengesInFlight.current) return;
    challengesInFlight.current = true;
    setIsLoadingChallenges(true);
    setPageError((current) => (current?.section === 'challenges' ? null : current));
    try {
      const next = await fetchV2Profile({ challengesCursor: cursor });
      if (activeUid.current !== uid) return;
      setProfile((current) =>
        current
          ? {
              ...current,
              challenges: {
                ...next.challenges,
                items: [...current.challenges.items, ...next.challenges.items],
              },
            }
          : current,
      );
    } catch (pageReadError) {
      if (activeUid.current !== uid) return;
      if (pageReadError instanceof ApiError && pageReadError.status === 400) {
        await reload();
        return;
      }
      setPageError({ section: 'challenges', error: pageReadError });
    } finally {
      challengesInFlight.current = false;
      if (activeUid.current === uid) setIsLoadingChallenges(false);
    }
  }, [profile?.challenges.nextCursor, reload, uid]);

  /**
   * Submit one explicit display-name edit. The server's response becomes the
   * canonical presented state, so the member sees the value that was actually
   * committed. Errors propagate to the caller for honest messaging — a failed
   * PATCH is never assumed to mean the name did not change.
   */
  const saveDisplayName = useCallback(
    async (displayName: string): Promise<V2Profile> => {
      if (isSaving) throw new Error('A display name update is already in progress.');
      const seq = requestSeq.current;
      setIsSaving(true);
      try {
        const next = await updateV2DisplayName(displayName);
        if (requestSeq.current === seq && activeUid.current === uid) {
          setProfile(next);
          setError(null);
        }
        return next;
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving, uid],
  );

  return {
    profile,
    isLoading,
    error,
    isSaving,
    saveDisplayName,
    reload,
    loadMoreGroups,
    loadMoreChallenges,
    isLoadingGroups,
    isLoadingChallenges,
    pageError,
  };
}
