import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/apiClient';
import {
  V2Button,
  V2Card,
  V2ChoiceCard,
  V2Field,
  V2Page,
  V2SectionHeader,
  V2TextArea,
  V2TextInput,
} from '../components/V2Primitives';
import {
  EMPTY_GROUP_DRAFT,
  GROUP_DESCRIPTION_MAX_LENGTH,
  GROUP_NAME_MAX_LENGTH,
  isCreateGroupDraftSubmittable,
  toCreateGroupInput,
  validateCreateGroupDraft,
  type CreateGroupDraft,
} from './groupDraft';
import { useCreateGroup } from './useV2Groups';

/**
 * TIIZI S4a — comprehensive Create Group journey (evolved from the S2-G minimum).
 *
 * Two progressive sections over the EXISTING governed authority
 * (`POST /v1/groups` — no new mutation, no schema change):
 *
 * Section 1 — Identity: required name + optional description/purpose.
 * Section 2 — Community Setup: the governed choices in human language
 * (Discoverable/Private, Direct join/Approval, Member/Steward Challenge
 * creation). Every other concern (creator becomes Accountable Steward) is
 * applied by the backend authority.
 *
 * Deliberately NOT offered (no Product Truth / no pipeline): cover imagery,
 * tagline, location, rules text, Charter editing, Council, invitations,
 * moderation, admin roles, advanced settings.
 *
 * On success the member lands directly inside the persisted Group Home
 * (`/v2/groups/:groupId` from the canonical returned identity) — never left
 * on the form, never merely returned to the list.
 */

/** Member-facing copy for governed failures (never raw provider internals). */
function createGroupErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.code === 'unknown_member' || error.code === 'not_signed_in') {
      return 'Please sign in again to create a Group.';
    }
    if (error.status === 503) {
      return 'We could not reach Tiizi just now. Please try again in a moment.';
    }
    if (error.status === 400) {
      return 'Please check the Group name and try again.';
    }
  }
  return 'We could not create your Group just now. Please try again.';
}

export function V2CreateGroupScreen() {
  const navigate = useNavigate();
  const createGroup = useCreateGroup();
  const [draft, setDraft] = useState<CreateGroupDraft>(EMPTY_GROUP_DRAFT);

  const issues = validateCreateGroupDraft(draft);
  const nameIssue = issues.find((issue) => issue.field === 'name');
  const canSubmit = isCreateGroupDraftSubmittable(draft) && !createGroup.isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      const created = await createGroup.mutateAsync(toCreateGroupInput(draft));
      // Canonical returned identity — the Home re-proves it from the server.
      navigate(`/v2/groups/${created.id}`, {
        replace: true,
        state: { createdGroupName: created.name },
      });
    } catch {
      // Failure is rendered from createGroup.error below.
    }
  };

  return (
    <V2Page>
      <p className="mb-2 text-sm font-bold">
        <Link to="/v2/groups" className="text-slate-500 hover:text-slate-800">
          ← Back to Groups
        </Link>
      </p>
      <V2SectionHeader
        eyebrow="Create a Group"
        title="Start a Group"
        description="Give your Group a name, then set how it runs. You will become its Accountable Steward."
      />

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <V2Card className="space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Section 1 — Identity
          </p>
          <V2Field label="Group name" hint="Something your people will recognise.">
            <V2TextInput
              value={draft.name}
              onChange={(name) => setDraft((current) => ({ ...current, name }))}
              placeholder="e.g. Karura Sunrise Runners"
              maxLength={GROUP_NAME_MAX_LENGTH}
            />
          </V2Field>
          {nameIssue && (
            <p role="alert" className="text-xs font-bold text-red-600">
              {nameIssue.code === 'name_too_long'
                ? `Keep the name under ${GROUP_NAME_MAX_LENGTH} characters.`
                : 'A Group name is required.'}
            </p>
          )}

          <V2Field label="Description (optional)" hint="A sentence about what this Group is for.">
            <V2TextArea
              value={draft.description}
              onChange={(description) => setDraft((current) => ({ ...current, description }))}
              placeholder="What brings this Group together?"
              rows={3}
              maxLength={GROUP_DESCRIPTION_MAX_LENGTH}
            />
          </V2Field>
        </V2Card>

        <V2Card className="space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
              Section 2 — Community setup
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              How people find, join, and create Challenges in your Group.
            </p>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-black text-slate-900">Who can find this Group?</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <V2ChoiceCard
                selected={!draft.isPrivate}
                onClick={() => setDraft((current) => ({ ...current, isPrivate: false }))}
                title="Discoverable"
                description="Anyone on Tiizi can find this Group."
              />
              <V2ChoiceCard
                selected={draft.isPrivate}
                onClick={() => setDraft((current) => ({ ...current, isPrivate: true }))}
                title="Private"
                description="Only invited people can find and join."
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-black text-slate-900">How do people join?</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <V2ChoiceCard
                selected={!draft.requireAdminApproval}
                onClick={() =>
                  setDraft((current) => ({ ...current, requireAdminApproval: false }))
                }
                title="Join directly"
                description="New members join right away."
              />
              <V2ChoiceCard
                selected={draft.requireAdminApproval}
                onClick={() =>
                  setDraft((current) => ({ ...current, requireAdminApproval: true }))
                }
                title="Requires approval"
                description="You approve new members before they join."
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-black text-slate-900">
              Who can create Challenges?
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <V2ChoiceCard
                selected={draft.allowMemberChallenges}
                onClick={() =>
                  setDraft((current) => ({ ...current, allowMemberChallenges: true }))
                }
                title="Members can create"
                description="Any member can host a Challenge here."
              />
              <V2ChoiceCard
                selected={!draft.allowMemberChallenges}
                onClick={() =>
                  setDraft((current) => ({ ...current, allowMemberChallenges: false }))
                }
                title="Steward creates"
                description="Only the Accountable Steward hosts new Challenges."
              />
            </div>
          </fieldset>
        </V2Card>

        {createGroup.isError && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            {createGroupErrorMessage(createGroup.error)}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <V2Button variant="ghost" onClick={() => navigate('/v2/groups')}>
            Cancel
          </V2Button>
          <V2Button type="submit" disabled={!canSubmit}>
            {createGroup.isPending ? 'Creating your Group…' : 'Create Group'}
          </V2Button>
        </div>
      </form>
    </V2Page>
  );
}
