import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QueryClientContext } from '@tanstack/react-query';
import { ApiError } from '../../api/apiClient';
import { removeOwnProfileImage, saveOwnProfileImage } from '../../api/mediaApi';
import type { V2ProfileChallengeItem } from '../../api/profileApi';
import {
  V2Button,
  V2Card,
  V2ErrorState,
  V2Field,
  V2LoadingState,
  V2Page,
  V2SectionHeader,
  V2TextInput,
} from '../components/V2Primitives';
import { useAuth } from '../../hooks/useAuth';
import { useV2Profile } from './useV2Profile';
import { useV2SignOut } from './useV2SignOut';
import { ProfilePreferencesSection } from '../preferences/ProfilePreferencesSection';
import { V2SupportTiiziCard } from '../support/V2SupportTiiziCard';
import { WELCOME_PATH } from '../welcome/welcomeContent';
import { ProfileSaveUncertainError } from './profileWriteState';
import { V2ProfileIdentityHeader } from './V2ProfileIdentityHeader';
import { useLocalImagePreview } from '../media/useLocalImagePreview';
import { useFileUploadIdentity } from '../media/useFileUploadIdentity';
import { invalidateV2ChallengeFeed } from '../challenges/challengeFeedQuery';
import {
  bucketProfileChallenges,
  challengeStatusLabel,
  displayNameLength,
  groupRoleLabel,
  PROFILE_DISPLAY_NAME_MAX,
  validateDisplayName,
} from './profileView';

/**
 * MC-2C-1 — Profile (`/v2/profile`).
 *
 * A mobile-first, own-member surface assembled from the governed
 * `GET /api/me` read. Discipline:
 * - the display name, Group/Challenge summaries and each derived
 *   `active`/`history` bucket are rendered exactly as served;
 * - the email is read directly from the raw Firebase `user.email`, never from
 *   the local `AuthContext.profile` cache and never from the API response;
 * - profile photo changes use the governed durable media API; the local
 *   preview is only a temporary selection state;
 * - no legal text or links are invented here (MC-2C-2 / legal authority);
 * - Group and Challenge pages advance independently and are keyed by
 *   participationId, so withdrawal + rejoin episodes stay distinct.
 */
export function V2ProfileScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    profile,
    isLoading,
    error,
    isSaving,
    saveDisplayName,
    applyProfileImage,
    reload,
    loadMoreGroups,
    loadMoreChallenges,
    isLoadingGroups,
    isLoadingChallenges,
    pageError,
  } = useV2Profile();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const signOut = useV2SignOut();
  const queryClient = useContext(QueryClientContext);
  const profilePhoto = useLocalImagePreview();
  const photoUploadIdentity = useFileUploadIdentity();
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoSuccess, setPhotoSuccess] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const uid = user?.uid ?? null;
  const uidRef = useRef(uid);
  const photoOperationSeqRef = useRef(0);
  const photoInFlightRef = useRef(false);

  // An account switch must not leave one member's editor, draft or feedback
  // on screen for the next member.
  useEffect(() => {
    uidRef.current = uid;
    setEditing(false);
    setDraft('');
    setFieldError(null);
    setSaveError(null);
    setSaved(false);
    photoOperationSeqRef.current += 1;
    photoInFlightRef.current = false;
    photoUploadIdentity.reset();
    setPhotoSaving(false);
    setPhotoError(null);
    setPhotoSuccess(null);
    profilePhoto.remove();
  }, [uid, profilePhoto.remove, photoUploadIdentity.reset]);

  const loadedBuckets = bucketProfileChallenges(profile?.challenges.items ?? []);
  useEffect(() => {
    const needed = Math.min(3, profile?.challenges.historyCount ?? 0);
    if (loadedBuckets.history.length < needed && profile?.challenges.nextCursor && !isLoadingChallenges
        && pageError?.section !== 'challenges') {
      void loadMoreChallenges();
    }
  }, [isLoadingChallenges, loadMoreChallenges, loadedBuckets.history.length, pageError?.section, profile?.challenges.historyCount, profile?.challenges.nextCursor]);

  if (isLoading && !profile) {
    return (
      <V2Page>
        <V2LoadingState label="Loading your profile…" />
      </V2Page>
    );
  }

  if (error && !profile) {
    return (
      <V2Page>
        <V2ErrorState
          title="We couldn't load your profile"
          message={readErrorMessage(error)}
          onRetry={() => void reload()}
        />
      </V2Page>
    );
  }

  if (!profile) {
    return (
      <V2Page>
        <V2ErrorState title="We couldn't load your profile" onRetry={() => void reload()} />
      </V2Page>
    );
  }

  const displayName = profile.displayName;
  const draftLength = displayNameLength(draft);
  const draftOverLimit = draftLength > PROFILE_DISPLAY_NAME_MAX;
  const email = user?.email ?? null;
  const buckets = bucketProfileChallenges(profile.challenges.items);
  const recentHistory = buckets.history.slice(0, 3);

  const startEditing = () => {
    setDraft(displayName ?? '');
    setFieldError(null);
    setSaveError(null);
    setSaved(false);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setFieldError(null);
    setSaveError(null);
    setDraft('');
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
    } catch {
      setSignOutError("We couldn't sign you out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  const submitName = async () => {
    const validation = validateDisplayName(draft);
    if (!validation.ok) {
      setFieldError(validation.message);
      return;
    }
    const uidAtSubmit = uidRef.current;
    setFieldError(null);
    setSaveError(null);
    try {
      await saveDisplayName(validation.value);
      if (uidRef.current !== uidAtSubmit) return;
      setEditing(false);
      setSaved(true);
    } catch (saveFailure) {
      if (uidRef.current !== uidAtSubmit) return;
      setSaveError(writeErrorMessage(saveFailure));
    }
  };

  const persistedProfilePhotoUrl =
    profile?.profileImage?.status === 'ready' ? profile.profileImage.url : null;
  const durablePhotoEnabled = profile?.profileImage?.status !== 'not_configured';

  const handlePhotoUpload = async (file: File) => {
    if (photoInFlightRef.current) return;
    const uidAtUpload = uidRef.current;
    const operation = ++photoOperationSeqRef.current;
    const idempotencyKey = photoUploadIdentity.keyForFile(file);
    photoInFlightRef.current = true;
    setPhotoError(null);
    setPhotoSuccess(null);
    setPhotoSaving(true);
    try {
      const profileImage = await saveOwnProfileImage(file, { idempotencyKey });
      if (uidRef.current !== uidAtUpload || photoOperationSeqRef.current !== operation) return;
      photoUploadIdentity.reset();
      profilePhoto.remove();
      applyProfileImage(profileImage);
      setPhotoSuccess('Profile photo updated.');
      if (queryClient) void invalidateV2ChallengeFeed(queryClient);
    } catch (err) {
      if (uidRef.current !== uidAtUpload || photoOperationSeqRef.current !== operation) return;
      profilePhoto.remove();
      setPhotoError(err instanceof ApiError ? err.message : 'Could not save your profile photo. Please try again.');
    } finally {
      if (photoOperationSeqRef.current === operation) {
        photoInFlightRef.current = false;
        if (uidRef.current === uidAtUpload) setPhotoSaving(false);
      }
    }
  };

  const handlePhotoRemove = async () => {
    if (!persistedProfilePhotoUrl || photoInFlightRef.current) return;
    const uidAtRemove = uidRef.current;
    const operation = ++photoOperationSeqRef.current;
    photoInFlightRef.current = true;
    setPhotoError(null);
    setPhotoSuccess(null);
    setPhotoSaving(true);
    try {
      const profileImage = await removeOwnProfileImage();
      if (uidRef.current !== uidAtRemove || photoOperationSeqRef.current !== operation) return;
      photoUploadIdentity.reset();
      profilePhoto.remove();
      applyProfileImage(profileImage);
      setPhotoSuccess('Profile photo removed.');
      if (queryClient) void invalidateV2ChallengeFeed(queryClient);
    } catch (err) {
      if (uidRef.current !== uidAtRemove || photoOperationSeqRef.current !== operation) return;
      setPhotoError(err instanceof ApiError ? err.message : 'Could not remove your profile photo. Please try again.');
    } finally {
      if (photoOperationSeqRef.current === operation) {
        photoInFlightRef.current = false;
        if (uidRef.current === uidAtRemove) setPhotoSaving(false);
      }
    }
  };

  return (
    <V2Page>
      <V2SectionHeader
        eyebrow="Profile"
        title="Your profile"
        description="Your name, your Tiizi journey and your account."
      />

      {saved && (
        <p
          role="status"
          aria-live="polite"
          className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"
        >
          Display name updated.
        </p>
      )}

      {error ? (
        <div className="mb-4">
          <V2ErrorState
            title="We couldn't refresh your profile"
            message={readErrorMessage(error)}
            onRetry={() => void reload()}
          />
        </div>
      ) : null}

      <div className="space-y-4">
        <V2ProfileIdentityHeader
          displayName={displayName}
          persistedUrl={persistedProfilePhotoUrl}
          preview={profilePhoto}
          durable={durablePhotoEnabled}
          isSaving={photoSaving}
          error={photoError}
          success={photoSuccess}
          refreshKey={`profile-photo-${uid ?? 'signed-out'}`}
          onSelectFile={durablePhotoEnabled ? handlePhotoUpload : undefined}
          onRemove={durablePhotoEnabled ? handlePhotoRemove : undefined}
          onPersistedImageExpired={() => void reload()}
          onEditName={startEditing}
        >
          {editing && (
            <form
              className="mt-4 space-y-3 border-t border-slate-200 pt-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submitName();
              }}
            >
              <V2Field
                label="Display name"
                hint={`Up to ${PROFILE_DISPLAY_NAME_MAX} characters.`}
              >
                <V2TextInput
                  id="profile-display-name"
                  value={draft}
                  onChange={(value) => {
                    setDraft(value);
                    setFieldError(
                      displayNameLength(value) > PROFILE_DISPLAY_NAME_MAX
                        ? `Use ${PROFILE_DISPLAY_NAME_MAX} characters or fewer.`
                        : null,
                    );
                  }}
                  placeholder="Your name"
                />
              </V2Field>
              <p
                className={`text-right text-[11px] font-bold ${
                  draftOverLimit ? 'text-red-600' : 'text-slate-400'
                }`}
              >
                {draftLength}/{PROFILE_DISPLAY_NAME_MAX}
              </p>
              {fieldError && (
                <p role="alert" className="text-sm font-medium text-red-700">
                  {fieldError}
                </p>
              )}
              {saveError && (
                <div
                  role="alert"
                  className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-900"
                >
                  <p>{saveError}</p>
                  <button
                    type="button"
                    className="mt-2 font-bold underline"
                    onClick={() => {
                      setSaveError(null);
                      void reload();
                    }}
                  >
                    Reload profile
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <V2Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving…' : 'Save name'}
                </V2Button>
                <V2Button variant="ghost" onClick={cancelEditing} disabled={isSaving}>
                  Cancel
                </V2Button>
              </div>
            </form>
          )}
        </V2ProfileIdentityHeader>

        <V2Card>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Email</p>
          <p className="mt-0.5 break-words text-sm font-bold text-slate-900">
            {email ?? 'No email address is available for this account.'}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Email comes from your sign-in and can&apos;t be changed here.
          </p>
        </V2Card>

        {/* Final section order is preserved. Interests & Goals is live (P1b); Support Tiizi
            is live as a placeholder-complete, non-payable screen (P8a; activation is P8b). */}
        <ProfilePreferencesSection uid={uid} />
        <div data-profile-slot="support-tiizi">
          <V2SupportTiiziCard />
        </div>

        <SectionLabel>My Tiizi Journey</SectionLabel>

        <V2Card>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-base font-black text-slate-900">Groups</h3>
            <p className="text-xs font-bold text-slate-500">
              {profile.groups.count} {profile.groups.count === 1 ? 'group' : 'groups'}
            </p>
          </div>
          {profile.groups.items.length === 0 ? (
            <div className="mt-3">
              <p className="text-sm leading-6 text-slate-600">
                You haven&apos;t joined a Group yet.
              </p>
              <V2Button
                variant="secondary"
                className="mt-3"
                onClick={() => navigate('/v2/groups')}
              >
                Go to Groups
              </V2Button>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {profile.groups.items.map((item) => (
                <li key={item.groupId} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0 break-words text-sm font-bold text-slate-900">
                    {item.name}
                  </span>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {groupRoleLabel(item.role)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {profile.groups.nextCursor && (
            <div className="mt-3">
              <V2Button
                variant="secondary"
                onClick={() => void loadMoreGroups()}
                disabled={isLoadingGroups}
              >
                {isLoadingGroups ? 'Loading…' : 'Show more Groups'}
              </V2Button>
            </div>
          )}
          {pageError?.section === 'groups' && (
            <PageError onRetry={() => void loadMoreGroups()} />
          )}
        </V2Card>

        <V2Card>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-base font-black text-slate-900">Challenges</h3>
            <p className="text-xs font-bold text-slate-500">
              {profile.challenges.activeCount} active · {profile.challenges.historyCount} in history
            </p>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Only Challenges you actually took part in appear here.
          </p>

          {profile.challenges.items.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-slate-600">
              You haven&apos;t taken part in a Challenge yet.
            </p>
          ) : (
            <div className="mt-3 space-y-4">
              {buckets.active.length > 0 && (
                <ChallengeGroup title="Active" items={buckets.active} />
              )}
              {buckets.history.length > 0 && (
                <ChallengeGroup title="History" items={recentHistory} />
              )}
            </div>
          )}
          <Link to="/v2/profile/challenges" className="mt-3 inline-flex py-2 text-sm font-bold text-primary underline underline-offset-2">
            View Challenge History
          </Link>

          {profile.challenges.nextCursor && (
            <div className="mt-3">
              <V2Button
                variant="secondary"
                onClick={() => void loadMoreChallenges()}
                disabled={isLoadingChallenges}
              >
                {isLoadingChallenges ? 'Loading…' : 'Show more Challenges'}
              </V2Button>
            </div>
          )}
          {pageError?.section === 'challenges' && (
            <PageError onRetry={() => void loadMoreChallenges()} />
          )}
        </V2Card>
        <V2Card>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900">Activity History</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">Your private history of logged Activities.</p>
            </div>
            <Link to="/v2/activity" className="inline-flex min-h-11 items-center self-start text-sm font-bold text-primary underline underline-offset-2">
              View Activity History
            </Link>
          </div>
        </V2Card>

        <SectionLabel>Account &amp; preferences</SectionLabel>

        <V2Card>
          <V2Button
            variant="secondary"
            className="w-full"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </V2Button>
          {signOutError && (
            <p role="alert" className="mt-2 px-1 text-xs leading-5 text-red-700">
              {signOutError}
            </p>
          )}
        </V2Card>

        <SectionLabel>Help &amp; guide</SectionLabel>

        <V2Card>
          <ul className="divide-y divide-slate-100">
            <li>
              <HelpRow label="Activity Guide" hint="How each activity works and is recorded" onClick={() => navigate('/v2/guide')} />
            </li>
            <li>
              <HelpRow label="How Tiizi works" hint="Replay the quick welcome" onClick={() => navigate(WELCOME_PATH)} />
            </li>
          </ul>
        </V2Card>
      </div>
    </V2Page>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">{children}</h2>
  );
}

function HelpRow({ label, hint, onClick }: { label: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-900">{label}</span>
        <span className="block text-xs leading-5 text-slate-500">{hint}</span>
      </span>
      <span className="shrink-0 text-lg leading-none text-slate-300" aria-hidden="true">›</span>
    </button>
  );
}

function ChallengeGroup({ title, items }: { title: string; items: V2ProfileChallengeItem[] }) {
  return (
    <section aria-label={title}>
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</h3>
      <ul className="mt-1 divide-y divide-slate-100">
        {items.map((item) => (
          <li
            key={item.participationId}
            className="flex items-center justify-between gap-3 py-2.5"
          >
            {item.bucket === 'history' ? (
              <Link to={`/v2/challenges/${encodeURIComponent(item.challengeId)}`} className="min-w-0 break-words text-sm font-bold text-primary underline underline-offset-2">
                {item.title}
              </Link>
            ) : (
              <span className="min-w-0 break-words text-sm font-bold text-slate-900">{item.title}</span>
            )}
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {challengeStatusLabel(item)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PageError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <p>We couldn&apos;t load more. Please try again.</p>
      <button type="button" onClick={onRetry} className="mt-1 font-bold underline">
        Try again
      </button>
    </div>
  );
}

function readErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Sign in again to view your profile.';
    if (error.status === 503) return 'Your profile is temporarily unavailable. Please try again.';
  }
  return 'Something went wrong loading your profile. Please try again.';
}

/**
 * Save failures are described without claiming the write did not happen: the
 * server can fail after committing the name when a post-commit read fails.
 */
function writeErrorMessage(error: unknown): string {
  if (error instanceof ProfileSaveUncertainError) {
    return error.reconciled
      ? 'We refreshed your profile from Tiizi. If your name changed, it is shown above; if not, you can try saving again.'
      : "We couldn't confirm that change. Your name may already be updated — reload to check.";
  }
  if (error instanceof ApiError) {
    if (error.status === 400) return "That display name can't be saved. Check it and try again.";
    if (error.status === 401) return 'Your session has expired. Sign in again, then retry.';
    if (error.code === 'api_unreachable') {
      return 'The Tiizi service is unreachable. Check your connection and try again.';
    }
  }
  return "We couldn't confirm that change. Your name may already be updated — reload to check.";
}
