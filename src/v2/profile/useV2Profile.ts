/**
 * MC-2C-1 — own-member Profile read + display-name self-edit.
 *
 * The paginated Profile stays in component state, tagged with the
 * authenticated UID that produced it, so a previous member's summaries cannot
 * be presented to the next one. MC-2C-2 adds a separate UID-scoped identity
 * projection (member id, display name, image) shared with Today and the member
 * shell: a successful save updates that projection immediately, then marks it
 * stale so the server re-proves it. Nothing here persists Profile data to
 * storage.
 *
 * The server remains the authority for every value. This hook only sequences
 * one governed read, independent Group/Challenge page reads, and one
 * display-name PATCH. A display-name save supersedes any in-flight read.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../api/apiClient';
import {
  fetchV2Profile,
  updateV2DisplayName,
  type V2Profile,
} from '../../api/profileApi';
import { useAuth } from '../../hooks/useAuth';
import { invalidateV2MemberIdentity } from './memberIdentityQuery';
import {
  isUncertainProfileWriteFailure,
  ProfileSaveUncertainError,
  profileResponseIsCurrent,
  reconcileProfileIdentity,
  writeOwnedV2MemberIdentity,
} from './profileWriteState';
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
  const queryClient = useQueryClient();
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
  const savingRef = useRef(false);
  const saveSeq = useRef(0);

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
    savingRef.current = false;
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
    const seq = requestSeq.current;
    groupsInFlight.current = true;
    setIsLoadingGroups(true);
    setPageError((current) => (current?.section === 'groups' ? null : current));
    try {
      const next = await fetchV2Profile({ groupsCursor: cursor });
      if (activeUid.current !== uid || requestSeq.current !== seq) return;
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
      if (activeUid.current !== uid || requestSeq.current !== seq) return;
      if (pageReadError instanceof ApiError && pageReadError.status === 400) {
        // A continuation the server no longer accepts is never retried: fall
        // back to the first page rather than looping on the same cursor.
        await reload();
        return;
      }
      setPageError({ section: 'groups', error: pageReadError });
    } finally {
      // The identity effect already reset the shared lock for a new account.
      // A stale request must not clear the lock owned by that new account.
      if (activeUid.current === uid) {
        groupsInFlight.current = false;
        setIsLoadingGroups(false);
      }
    }
  }, [profile?.groups.nextCursor, reload, uid]);

  const loadMoreChallenges = useCallback(async () => {
    const cursor = profile?.challenges.nextCursor;
    if (!cursor || challengesInFlight.current) return;
    const seq = requestSeq.current;
    challengesInFlight.current = true;
    setIsLoadingChallenges(true);
    setPageError((current) => (current?.section === 'challenges' ? null : current));
    try {
      const next = await fetchV2Profile({ challengesCursor: cursor });
      if (activeUid.current !== uid || requestSeq.current !== seq) return;
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
      if (activeUid.current !== uid || requestSeq.current !== seq) return;
      if (pageReadError instanceof ApiError && pageReadError.status === 400) {
        await reload();
        return;
      }
      setPageError({ section: 'challenges', error: pageReadError });
    } finally {
      if (activeUid.current === uid) {
        challengesInFlight.current = false;
        setIsLoadingChallenges(false);
      }
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
   * land afterwards and show the old name beside a success message. An
   * uncertain outcome (5xx, timeout, network failure) is reconciled with a
   * fresh canonical read instead of being presented as success or failure.
   */
  const saveDisplayName = useCallback(
    async (displayName: string): Promise<V2Profile> => {
      if (isSaving || savingRef.current) {
        throw new Error('A display name update is already in progress.');
      }
      if (!uid) throw new Error('Sign-in is required to save a display name.');
      const uidAtSave = uid;
      requestSeq.current += 1;
      const seq = requestSeq.current;
      const saveId = ++saveSeq.current;
      savingRef.current = true;
      setIsLoading(false);
      setReadFailure(null);
      setIsSaving(true);

      const responseIsCurrent = () =>
        profileResponseIsCurrent({
          responseUid: uidAtSave,
          activeUid: activeUid.current,
          responseSeq: seq,
          activeSeq: requestSeq.current,
        });

      try {
        const next = await updateV2DisplayName(displayName);
        if (responseIsCurrent()) {
          setLoaded((current) =>
            current && current.uid === uidAtSave
              ? { uid: uidAtSave, profile: mergeProfileIdentity(current.profile, next) }
              : { uid: uidAtSave, profile: next },
          );
          writeOwnedV2MemberIdentity(queryClient, {
            responseUid: uidAtSave,
            activeUid: activeUid.current,
            responseSeq: seq,
            activeSeq: requestSeq.current,
            profile: next,
          });
          void invalidateV2MemberIdentity(queryClient, uidAtSave);
        }
        return next;
      } catch (saveFailure) {
        if (!isUncertainProfileWriteFailure(saveFailure)) throw saveFailure;

        let reconciled = false;
        try {
          const canonical = await reconcileProfileIdentity({
            current:
              loaded?.uid === uidAtSave
                ? loaded.profile
                : null,
            readCanonical: () => fetchV2Profile(),
          });
          if (responseIsCurrent()) {
            setLoaded((current) => {
              const retained =
                current && current.uid === uidAtSave ? current.profile : null;
              return {
                uid: uidAtSave,
                profile: retained
                  ? mergeProfileIdentity(retained, canonical)
                  : canonical,
              };
            });
            writeOwnedV2MemberIdentity(queryClient, {
              responseUid: uidAtSave,
              activeUid: activeUid.current,
              responseSeq: seq,
              activeSeq: requestSeq.current,
              profile: canonical,
            });
            setReadFailure(null);
            setPageError(null);
            reconciled = true;
          }
        } catch {
          reconciled = false;
        }

        throw new ProfileSaveUncertainError(saveFailure, reconciled);
      } finally {
        // Only the newest save may release the lock. A superseded save must
        // not clear a lock now owned by another save or account.
        if (saveSeq.current === saveId) {
          savingRef.current = false;
          setIsSaving(false);
        }
      }
    },
    [isSaving, loaded, queryClient, uid],
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
