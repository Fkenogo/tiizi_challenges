/**
 * MC-2C-1 — own-member Profile read + display-name self-edit.
 *
 * Deliberately NOT a shared query cache: this slice keeps the Profile in
 * component state, tagged with the authenticated UID that produced it. State
 * from another identity is never returned, so a previous member's data cannot
 * be presented to the next one. UID-scoped caching, account-switch clearing
 * tests and post-edit cache invalidation are MC-2C-2 concerns; nothing here
 * persists Profile data to storage.
 *
 * The server remains the authority for every value. This hook only sequences
 * one governed read, independent Group/Challenge page reads, and one
 * display-name PATCH. A display-name save supersedes any in-flight read.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/apiClient';
import {
  fetchV2Profile,
  updateV2DisplayName,
  type V2Profile,
} from '../../api/profileApi';
import { useAuth } from '../../hooks/useAuth';
import { mergeProfileIdentity } from './profileView';

type ProfileSection = 'groups' | 'challenges';

interface LoadedProfile {
  uid: string;
  profile: V2Profile;
}

interface ReadFailure {
  uid: string;
  error: unknown;
}

interface PageError {
  section: ProfileSection;
  error: unknown;
}

export function useV2Profile() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [loaded, setLoaded] = useState<LoadedProfile | null>(null);
  const [readFailure, setReadFailure] = useState<ReadFailure | null>(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(uid));
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isLoadingChallenges, setIsLoadingChallenges] = useState(false);
  const [pageError, setPageError] = useState<PageError | null>(null);

  // Increments on every identity change, explicit reload, or name save so
  // late responses from a superseded read can never overwrite current state.
  const requestSeq = useRef(0);
  const activeUid = useRef<string | null>(uid);
  const groupsInFlight = useRef(false);
  const challengesInFlight = useRef(false);

  // Only state produced by the current identity is visible. This also covers
  // the render before the effect below runs after an account switch.
  const profile = loaded && loaded.uid === uid ? loaded.profile : null;
  const error = readFailure && readFailure.uid === uid ? readFailure.error : null;
  const awaitingIdentity = Boolean(uid) && loaded?.uid !== uid && !error;
  const showLoading = isLoading || awaitingIdentity;

  useEffect(() => {
    activeUid.current = uid;
    requestSeq.current += 1;
    const seq = requestSeq.current;

    setLoaded(null);
    setReadFailure(null);
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
        setLoaded({ uid, profile: next });
        setReadFailure(null);
      } catch (readError) {
        if (requestSeq.current !== seq) return;
        setReadFailure({ uid, error: readError });
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
    setReadFailure(null);
    setPageError(null);
    try {
      const next = await fetchV2Profile();
      if (requestSeq.current !== seq) return;
      setLoaded({ uid, profile: next });
    } catch (readError) {
      if (requestSeq.current !== seq) return;
      setReadFailure({ uid, error: readError });
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
      setLoaded((current) =>
        current && current.uid === uid
          ? {
              uid,
              profile: {
                ...current.profile,
                groups: {
                  ...next.groups,
                  items: [...current.profile.groups.items, ...next.groups.items],
                },
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
      setLoaded((current) =>
        current && current.uid === uid
          ? {
              uid,
              profile: {
                ...current.profile,
                challenges: {
                  ...next.challenges,
                  items: [...current.profile.challenges.items, ...next.challenges.items],
                },
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
   * Submit one explicit display-name edit. The server's response is the
   * canonical identity, but only identity fields are merged: the summaries
   * already loaded on this screen (and their continuation cursors) are kept,
   * because a name edit does not invalidate them and the PATCH response only
   * carries the default first page.
   *
   * A save advances the request sequence, so an in-flight reload can never
   * land afterwards and show the old name beside a success message. Errors
   * propagate to the caller for honest messaging — a failed PATCH is never
   * assumed to mean the name did not change.
   */
  const saveDisplayName = useCallback(
    async (displayName: string): Promise<V2Profile> => {
      if (isSaving) throw new Error('A display name update is already in progress.');
      if (!uid) throw new Error('Sign-in is required to save a display name.');
      const uidAtSave = uid;
      requestSeq.current += 1;
      const seq = requestSeq.current;
      setIsLoading(false);
      setReadFailure(null);
      setIsSaving(true);
      try {
        const next = await updateV2DisplayName(displayName);
        if (requestSeq.current === seq && activeUid.current === uidAtSave) {
          setLoaded((current) =>
            current && current.uid === uidAtSave
              ? { uid: uidAtSave, profile: mergeProfileIdentity(current.profile, next) }
              : { uid: uidAtSave, profile: next },
          );
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
    isLoading: showLoading,
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
