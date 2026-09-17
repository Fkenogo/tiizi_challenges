import type { CreateGroupInput } from '../../api/groupsApi';

/**
 * TIIZI S2-G — pure Group-establishment draft contract.
 *
 * React-free and side-effect-free so it can be asserted directly by the
 * boundary guards. Client validation here decides only basic UX
 * completeness; it is NEVER semantic or persistence authority. The governed
 * server authority (`POST /v1/groups` → `createGovernedGroup`) remains the
 * single authority for what a Group may be and who becomes its Accountable
 * Steward.
 */

/** Governing bounds, mirroring the governed authority exactly. */
export const GROUP_NAME_MIN_LENGTH = 1;
export const GROUP_NAME_MAX_LENGTH = 200;
export const GROUP_DESCRIPTION_MAX_LENGTH = 2000;

export interface CreateGroupDraft {
  name: string;
  description: string;
}

export const EMPTY_GROUP_DRAFT: CreateGroupDraft = { name: '', description: '' };

export type GroupDraftIssueCode =
  | 'name_required'
  | 'name_too_long'
  | 'description_too_long';

export interface GroupDraftIssue {
  code: GroupDraftIssueCode;
  field: 'name' | 'description';
}

/**
 * UX completeness only. Returns the issues a member can fix before the form
 * is submittable; the server re-validates and remains authoritative.
 */
export function validateCreateGroupDraft(draft: CreateGroupDraft): GroupDraftIssue[] {
  const issues: GroupDraftIssue[] = [];
  const name = draft.name.trim();
  if (name.length < GROUP_NAME_MIN_LENGTH) {
    issues.push({ code: 'name_required', field: 'name' });
  } else if (name.length > GROUP_NAME_MAX_LENGTH) {
    issues.push({ code: 'name_too_long', field: 'name' });
  }
  if (draft.description.trim().length > GROUP_DESCRIPTION_MAX_LENGTH) {
    issues.push({ code: 'description_too_long', field: 'description' });
  }
  return issues;
}

export function isCreateGroupDraftSubmittable(draft: CreateGroupDraft): boolean {
  return validateCreateGroupDraft(draft).length === 0;
}

/** Map the draft onto the transport input (trimmed; empty description omitted). */
export function toCreateGroupInput(draft: CreateGroupDraft): CreateGroupInput {
  const name = draft.name.trim();
  const description = draft.description.trim();
  return description.length > 0 ? { name, description } : { name };
}

/**
 * Member-facing stewardship language. Owner/admin is the Accountable Steward
 * under Product Truth; every other active membership is a Member. Singular
 * stewardship is never implied to be plural.
 */
export function groupRoleLabel(role: string): string {
  const normalised = role.trim().toLowerCase();
  return normalised === 'owner' || normalised === 'admin' ? 'Accountable Steward' : 'Member';
}
