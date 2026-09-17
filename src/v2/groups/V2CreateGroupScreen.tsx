import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/apiClient';
import {
  V2Button,
  V2Card,
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
 * TIIZI S2-G — minimum Create Group journey.
 *
 * Two fields only: a required name and an optional description. Every other
 * concern (creator becomes Accountable Steward, admission, challenge-creation
 * capability) is a governed default applied by the backend authority — the
 * form never offers cover imagery, taglines, location, rules, admission-mode
 * controls, invitations, Charter, Council, creation permissions, moderation
 * or advanced settings; those belong to S4.
 *
 * Submission goes through `POST /v1/groups` only. There is no direct
 * Firestore/PostgreSQL write and no client-generated owner/steward authority.
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
      navigate('/v2/groups', {
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
        description="Give your Group a name. You will become its Accountable Steward and can invite people once it exists."
      />

      <V2Card className="space-y-4">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
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

          <V2Field
            label="Description (optional)"
            hint="A sentence about what this Group is for."
          >
            <V2TextArea
              value={draft.description}
              onChange={(description) => setDraft((current) => ({ ...current, description }))}
              placeholder="What brings this Group together?"
              rows={3}
              maxLength={GROUP_DESCRIPTION_MAX_LENGTH}
            />
          </V2Field>

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
      </V2Card>
    </V2Page>
  );
}
