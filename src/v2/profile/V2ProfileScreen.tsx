import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/apiClient';
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
import { V2SupportTiiziCard } from '../support/V2SupportTiiziCard';
import { useV2Profile } from './useV2Profile';
import { ProfileSaveUncertainError } from './profileWriteState';
import {
  bucketProfileChallenges,
  challengeStatusLabel,
  displayNameLength,
  groupRoleLabel,
  initialsFor,
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
 * - the photo slot is honest: initials today, no upload control, because
 *   media persistence is MEDIA-2b;
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
  const uid = user?.uid ?? null;
  const uidRef = useRef(uid);

  // An account switch must not leave one member's editor, draft or feedback
  // on screen for the next member.
  useEffect(() => {
    uidRef.current = uid;
    setEditing(false);
    setDraft('');
    setFieldError(null);
    setSaveError(null);
    setSaved(false);
  }, [uid]);

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
  const imageNotConfigured = profile.profileImage.status === 'not_configured';
  const email = user?.email ?? null;
  const buckets = bucketProfileChallenges(profile.challenges.items);

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

  return (
    <V2Page>
      <V2SectionHeader
        eyebrow="Profile"
        title="Your profile"
        description="Your name and the Groups and Challenges you have taken part in."
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
        <V2Card>
          <div className="flex items-start gap-4">
            <ProfileAvatar name={displayName} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Display name
              </p>
              <p className="mt-0.5 break-words text-lg font-black text-slate-900">
                {displayName ?? 'No display name yet'}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {displayName
                  ? 'You can change your name at any time.'
                  : 'Add a name so Tiizi can greet you properly.'}
              </p>
            </div>
            {!editing && (
              <V2Button variant="secondary" onClick={startEditing}>
                {displayName ? 'Edit' : 'Add name'}
              </V2Button>
            )}
          </div>

          {imageNotConfigured && (
            <p className="mt-4 text-xs leading-5 text-slate-500">
              A profile photo arrives with a later update. For now your initials stand in for it.
            </p>
          )}

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
        </V2Card>

        <V2Card>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Email</p>
          <p className="mt-0.5 break-words text-sm font-bold text-slate-900">
            {email ?? 'No email address is available for this account.'}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Email comes from your sign-in and can&apos;t be changed here.
          </p>
        </V2Card>

        <V2SupportTiiziCard />

        <V2Card>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-black text-slate-900">Groups</h2>
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
            <h2 className="text-base font-black text-slate-900">Challenges</h2>
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
                <ChallengeGroup title="History" items={buckets.history} />
              )}
            </div>
          )}

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
      </div>
    </V2Page>
  );
}

function ProfileAvatar({ name }: { name: string | null }) {
  const initials = initialsFor(name);
  return (
    <div
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-xl font-black text-primary"
      aria-hidden
    >
      {initials || (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
          <path
            d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
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
            <span className="min-w-0 break-words text-sm font-bold text-slate-900">
              {item.title}
            </span>
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
