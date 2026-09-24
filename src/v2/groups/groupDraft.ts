import type { CreateGroupInput } from '../../api/groupsApi';

/**
 * TIIZI S4a CORR-001 — Group draft contract (progressive wizard).
 *
 * React-free and side-effect-free so it can be asserted directly by the
 * boundary guards. Client validation here decides only basic UX
 * completeness per step; it is NEVER semantic or persistence authority. The
 * governed server authority (`POST /v1/groups` → `createGovernedGroup`)
 * remains the single authority for what a Group may be and who becomes its
 * Accountable Steward.
 */

/** Governing bounds, mirroring the governed authority exactly. */
export const GROUP_NAME_MIN_LENGTH = 1;
export const GROUP_NAME_MAX_LENGTH = 200;
export const GROUP_DESCRIPTION_MAX_LENGTH = 2000;
export const GROUP_TAGLINE_MAX_LENGTH = 140;
export const GROUP_LOCATION_MAX_LENGTH = 120;
export const GROUP_FOCUS_TAGS_MAX_COUNT = 8;
export const GROUP_FOCUS_TAG_MAX_LENGTH = 30;
export const GROUP_NORM_MAX_LENGTH = 200;

export interface CreateGroupDraft {
  name: string;
  description: string;
  /**
   * S4a Community Setup — governed fields only, in member-chosen form.
   * Defaults mirror the governed authority (open admission, permitted
   * creation) so an untouched form establishes exactly what S2-G did.
   */
  isPrivate: boolean;
  requireAdminApproval: boolean;
  allowMemberChallenges: boolean;
  /**
   * CORR-001 richer identity — all optional, all presentation-level.
   * coverId must be a catalogue key when set; tagline/location are short
   * purpose/context; focusTags are free-text chips; norm is the single core
   * community norm (becomes rules:[norm]; no versioning, no engine).
   */
  coverId: string | null;
  tagline: string;
  location: string;
  focusTags: string[];
  norm: string;
}

export const EMPTY_GROUP_DRAFT: CreateGroupDraft = {
  name: '',
  description: '',
  isPrivate: false,
  requireAdminApproval: false,
  allowMemberChallenges: true,
  coverId: null,
  tagline: '',
  location: '',
  focusTags: [],
  norm: '',
};

export type GroupDraftIssueCode =
  | 'name_required'
  | 'name_too_long'
  | 'description_too_long'
  | 'tagline_too_long'
  | 'location_too_long'
  | 'focus_tag_too_long'
  | 'too_many_focus_tags'
  | 'norm_too_long';

export interface GroupDraftIssue {
  code: GroupDraftIssueCode;
  field: 'name' | 'description' | 'tagline' | 'location' | 'focusTags' | 'norm';
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
  if (draft.tagline.trim().length > GROUP_TAGLINE_MAX_LENGTH) {
    issues.push({ code: 'tagline_too_long', field: 'tagline' });
  }
  if (draft.location.trim().length > GROUP_LOCATION_MAX_LENGTH) {
    issues.push({ code: 'location_too_long', field: 'location' });
  }
  if (draft.focusTags.length > GROUP_FOCUS_TAGS_MAX_COUNT) {
    issues.push({ code: 'too_many_focus_tags', field: 'focusTags' });
  } else if (draft.focusTags.some((tag) => tag.trim().length > GROUP_FOCUS_TAG_MAX_LENGTH)) {
    issues.push({ code: 'focus_tag_too_long', field: 'focusTags' });
  }
  if (draft.norm.trim().length > GROUP_NORM_MAX_LENGTH) {
    issues.push({ code: 'norm_too_long', field: 'norm' });
  }
  return issues;
}

export function isCreateGroupDraftSubmittable(draft: CreateGroupDraft): boolean {
  return validateCreateGroupDraft(draft).length === 0;
}

/**
 * CORR-001 wizard step gating (pure): only the fields that belong to the
 * step can block Continue. Identity blocks on name/description/tagline;
 * Look blocks on location/focus; Setup is always passable (choices, not
 * inputs); Culture blocks on the norm; Review requires the whole draft.
 */
export function stepBlockedFor(step: number, issues: GroupDraftIssue[]): boolean {
  if (step === 4) return issues.length > 0;
  const fields: Array<GroupDraftIssue['field']> =
    step === 0
      ? ['name', 'description', 'tagline']
      : step === 1
        ? ['location', 'focusTags']
        : step === 3
          ? ['norm']
          : [];
  return issues.some((issue) => fields.includes(issue.field));
}

/**
 * Map the draft onto the transport input (trimmed; optional richer fields
 * are omitted when empty so minimal payloads stay minimal and the server's
 * own defaults apply rather than client-invented values).
 */
export function toCreateGroupInput(draft: CreateGroupDraft): CreateGroupInput {
  const name = draft.name.trim();
  const description = draft.description.trim();
  const tagline = draft.tagline.trim();
  const location = draft.location.trim();
  const norm = draft.norm.trim();
  const focusTags = draft.focusTags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .filter((tag, index, all) => all.indexOf(tag) === index)
    .slice(0, GROUP_FOCUS_TAGS_MAX_COUNT);
  return {
    ...(description.length > 0 ? { name, description } : { name }),
    isPrivate: draft.isPrivate,
    requireAdminApproval: draft.requireAdminApproval,
    allowMemberChallenges: draft.allowMemberChallenges,
    ...(draft.coverId !== null ? { coverId: draft.coverId } : {}),
    ...(tagline.length > 0 ? { tagline } : {}),
    ...(location.length > 0 ? { location } : {}),
    ...(focusTags.length > 0 ? { focusTags } : {}),
    ...(norm.length > 0 ? { rules: [norm] } : {}),
  };
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

/**
 * CORR-001 — strict viewer badge from relationship truth, not a generic
 * role-label shortcut. Only the owner row (the Accountable Steward
 * attribution) reads as steward; a legacy delegated `admin` row reads as
 * Member until S4b reconciles delegated display against EOG §28.
 */
export function stewardBadgeFor(role: string): 'Accountable Steward' | 'Member' {
  return role.trim().toLowerCase() === 'owner' ? 'Accountable Steward' : 'Member';
}
