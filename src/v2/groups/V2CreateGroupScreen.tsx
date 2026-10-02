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
  V2StepProgress,
  V2TextArea,
  V2TextInput,
} from '../components/V2Primitives';
import {
  EMPTY_GROUP_DRAFT,
  GROUP_DESCRIPTION_MAX_LENGTH,
  GROUP_FOCUS_TAGS_MAX_COUNT,
  GROUP_FOCUS_TAG_MAX_LENGTH,
  GROUP_LOCATION_MAX_LENGTH,
  GROUP_NAME_MAX_LENGTH,
  GROUP_NORM_MAX_LENGTH,
  GROUP_TAGLINE_MAX_LENGTH,
  isCreateGroupDraftSubmittable,
  stepBlockedFor,
  toCreateGroupInput,
  validateCreateGroupDraft,
  type CreateGroupDraft,
  type GroupDraftIssue,
} from './groupDraft';
import { GROUP_COVER_CATALOGUE, coverGradientFor, coverLabelFor, type GroupCoverId } from './groupCovers';
import { useCreateGroup, useV2GroupOptions } from './useV2Groups';
import { focusAreaMatchesSearch, GROUP_FOCUS_AREAS, GROUP_FOCUS_AREA_LABELS } from './groupFocusAreas';

/**
 * TIIZI S4a CORR-001 — progressive Group formation wizard.
 *
 * One logical step at a time over the EXISTING governed authority
 * (`POST /api/groups` — single submission at Review, no new mutation):
 *
 * 1. Identity — name (required), tagline + description (optional).
 * 2. Look & focus — curated cover (optional), location context (optional),
 *    focus chips (optional). Presentation only; location never drives
 *    access, filtering, or discovery; chips never confer authority.
 * 3. How the Group works — governed Group setup in human language.
 * 4. Our culture — approved Community Norm presets plus one optional custom
 *    expectation. These are descriptive and are not enforcement authority.
 * 5. Review & Create — clean summary, one submission.
 *
 * On success the member lands directly inside the persisted Group Home
 * (`/v2/groups/:groupId` from the canonical returned identity).
 */

const STEPS = [
  { id: 'identity', label: 'Identity' },
  { id: 'look', label: 'Look & focus' },
  { id: 'setup', label: 'How the Group works' },
  { id: 'culture', label: 'Our culture' },
  { id: 'review', label: 'Review' },
] as const;

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
      return 'Please check the highlighted fields and try again.';
    }
  }
  return 'We could not create your Group just now. Please try again.';
}

function issueFor(issues: GroupDraftIssue[], field: GroupDraftIssue['field']): string | null {
  const issue = issues.find((entry) => entry.field === field);
  if (!issue) return null;
  switch (issue.code) {
    case 'name_too_long':
      return `Keep the name under ${GROUP_NAME_MAX_LENGTH} characters.`;
    case 'name_required':
      return 'A Group name is required.';
    case 'description_too_long':
      return `Keep the description under ${GROUP_DESCRIPTION_MAX_LENGTH} characters.`;
    case 'tagline_too_long':
      return `Keep the tagline under ${GROUP_TAGLINE_MAX_LENGTH} characters.`;
    case 'location_too_long':
      return `Keep the location under ${GROUP_LOCATION_MAX_LENGTH} characters.`;
    case 'too_many_focus_tags':
      return `Select canonical Focus Areas, with up to one other area.`;
    case 'focus_tag_too_long':
      return `Keep each focus area under ${GROUP_FOCUS_TAG_MAX_LENGTH} characters.`;
    case 'norm_too_long':
      return `Keep the norm under ${GROUP_NORM_MAX_LENGTH} characters.`;
  }
}

/** Step gating: only the fields that belong to the step can block it. */
function stepBlocked(step: number, issues: GroupDraftIssue[]): boolean {
  return stepBlockedFor(step, issues);
}

export function V2CreateGroupScreen() {
  const navigate = useNavigate();
  const createGroup = useCreateGroup();
  const optionsQuery = useV2GroupOptions();
  const options = optionsQuery.data;
  const [draft, setDraft] = useState<CreateGroupDraft>(EMPTY_GROUP_DRAFT);
  const [step, setStep] = useState(0);
  const [tagInput, setTagInput] = useState('');
  const [focusSearch, setFocusSearch] = useState('');

  const issues = validateCreateGroupDraft(draft);
  const submittable = isCreateGroupDraftSubmittable(draft) && !createGroup.isPending;

  const addTag = () => {
    const tag = tagInput.trim();
    const hasCustomTag = draft.focusTags.some((entry) => !GROUP_FOCUS_AREA_LABELS.includes(entry));
    if (!tag || hasCustomTag
      || draft.focusTags.some((entry) => entry.toLowerCase() === tag.toLowerCase())) {
      setTagInput('');
      return;
    }
    setDraft((current) => ({ ...current, focusTags: [...current.focusTags, tag] }));
    setTagInput('');
  };

  const handleSubmit = async () => {
    if (!submittable) return;
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

  const go = (next: number) => setStep(Math.max(0, Math.min(STEPS.length - 1, next)));

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
        description="A few short steps. You will become its Accountable Steward."
      />
      <div className="mb-4">
        <V2StepProgress
          steps={STEPS.map((entry) => ({ id: entry.id, label: entry.label }))}
          current={step}
          onSelect={(index) => go(index)}
        />
      </div>

      {step === 0 && (
        <V2Card className="space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Step 1 — Identity
          </p>
          <V2Field label="Group name" hint="Something your people will recognise.">
            <V2TextInput
              value={draft.name}
              onChange={(name) => setDraft((current) => ({ ...current, name }))}
              placeholder="e.g. Karura Sunrise Runners"
              maxLength={GROUP_NAME_MAX_LENGTH}
            />
          </V2Field>
          {issueFor(issues, 'name') && (
            <p role="alert" className="text-xs font-bold text-red-600">{issueFor(issues, 'name')}</p>
          )}
          <V2Field label="Tagline (optional)" hint="One sentence that says what this Group is about.">
            <V2TextInput
              value={draft.tagline}
              onChange={(tagline) => setDraft((current) => ({ ...current, tagline }))}
              placeholder="e.g. Moving early, supporting each other."
              maxLength={GROUP_TAGLINE_MAX_LENGTH}
            />
          </V2Field>
          {issueFor(issues, 'tagline') && (
            <p role="alert" className="text-xs font-bold text-red-600">{issueFor(issues, 'tagline')}</p>
          )}
          <V2Field label="Description (optional)" hint="A fuller picture of what brings this Group together.">
            <V2TextArea
              value={draft.description}
              onChange={(description) => setDraft((current) => ({ ...current, description }))}
              placeholder="What brings this Group together?"
              rows={3}
              maxLength={GROUP_DESCRIPTION_MAX_LENGTH}
            />
          </V2Field>
          {issueFor(issues, 'description') && (
            <p role="alert" className="text-xs font-bold text-red-600">{issueFor(issues, 'description')}</p>
          )}
        </V2Card>
      )}

      {step === 1 && (
        <V2Card className="space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Step 2 — Look &amp; focus
          </p>
          <fieldset>
            <legend className="mb-2 text-sm font-black text-slate-900">Group cover (optional)</legend>
            <div className="grid grid-cols-4 gap-2">
              {GROUP_COVER_CATALOGUE.map((coverId: GroupCoverId) => {
                const selected = draft.coverId === coverId;
                return (
                  <button
                    key={coverId}
                    type="button"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        coverId: current.coverId === coverId ? null : coverId,
                      }))
                    }
                    aria-pressed={selected}
                    aria-label={`Cover ${coverLabelFor(coverId)}`}
                    title={coverLabelFor(coverId)}
                    className={`h-14 rounded-xl bg-gradient-to-br transition-all ${coverGradientFor(coverId)} ${
                      selected ? 'ring-2 ring-primary ring-offset-2' : 'opacity-80 hover:opacity-100'
                    }`}
                  />
                );
              })}
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {draft.coverId
                ? `Cover: ${coverLabelFor(draft.coverId as GroupCoverId)}. Tap again to clear.`
                : 'No cover yet — Tiizi picks a calm fallback until you choose one.'}
            </p>
          </fieldset>
          <V2Field label="Location (optional)" hint="Where this Group meets, in plain words. Never used for access or tracking.">
            <V2TextInput
              value={draft.location}
              onChange={(location) => setDraft((current) => ({ ...current, location }))}
              placeholder="e.g. Karura Forest, Nairobi · or Online"
              maxLength={GROUP_LOCATION_MAX_LENGTH}
            />
          </V2Field>
          {issueFor(issues, 'location') && (
            <p role="alert" className="text-xs font-bold text-red-600">{issueFor(issues, 'location')}</p>
          )}
          <div>
            <fieldset>
              <legend className="text-sm font-black text-slate-900">Focus areas (optional)</legend>
              <p className="mt-1 text-xs leading-5 text-slate-500">What this Group is interested in. Select any that fit.</p>
              <label className="mt-3 block text-xs font-bold text-slate-700">Search focus areas<V2TextInput value={focusSearch} onChange={setFocusSearch} placeholder="Search categories" maxLength={60} /></label>
              <div className="mt-3 space-y-3">
                {(['Fitness', 'Wellness'] as const).map((domain) => {
                  const options = GROUP_FOCUS_AREAS.filter((area) => area.domain === domain && focusAreaMatchesSearch(area.category, focusSearch));
                  if (!options.length) return null;
                  return <div key={domain}><p className="mb-1 text-xs font-bold text-slate-500">{domain}</p><div className="flex flex-wrap gap-2">{options.map(({ category }) => {
                    const selected = draft.focusTags.includes(category);
                    return <button key={category} type="button" aria-pressed={selected} onClick={() => setDraft((current) => ({ ...current, focusTags: selected ? current.focusTags.filter((tag) => tag !== category) : [...current.focusTags, category] }))} className={`min-h-10 rounded-full border px-3 py-2 text-xs font-bold ${selected ? 'border-primary bg-orange-50 text-primary' : 'border-slate-200 bg-white text-slate-700'}`}>{category}</button>;
                  })}</div></div>;
                })}
              </div>
              <div className="mt-3 rounded-xl border border-dashed border-slate-300 p-3">
                <p className="text-xs font-bold text-slate-700">Other focus area (optional)</p>
                <p className="mt-1 text-[11px] text-slate-500">Add one area that is not listed.</p>
                <div className="mt-2 flex gap-2"><V2TextInput value={tagInput} onChange={setTagInput} placeholder="Add one other area" maxLength={GROUP_FOCUS_TAG_MAX_LENGTH} /><V2Button variant="secondary" disabled={!tagInput.trim() || draft.focusTags.some((tag) => !GROUP_FOCUS_AREA_LABELS.includes(tag))} onClick={addTag}>Add</V2Button></div>
              </div>
            </fieldset>
            {draft.focusTags.length > 0 && (
              <div aria-label="Selected focus areas" className="mt-3 flex flex-wrap gap-1.5">
                {draft.focusTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700"
                  >
                    {tag}
                    <button
                      type="button"
                      aria-label={`Remove ${tag}`}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          focusTags: current.focusTags.filter((entry) => entry !== tag),
                        }))
                      }
                      className="font-black text-slate-400 hover:text-slate-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            {issueFor(issues, 'focusTags') && (
              <p role="alert" className="mt-1 text-xs font-bold text-red-600">{issueFor(issues, 'focusTags')}</p>
            )}
          </div>
          <fieldset>
            <legend className="text-sm font-black text-slate-900">Group goals (optional)</legend>
            <p className="mt-1 text-xs text-slate-500">What would this Group like to work towards?</p>
            {optionsQuery.isLoading ? <p className="mt-2 text-xs text-slate-500">Loading goals…</p> : optionsQuery.isError ? <p role="alert" className="mt-2 text-xs text-red-700">Goals are unavailable right now. {optionsQuery.error instanceof Error ? optionsQuery.error.message : ''}</p> : <div className="mt-2 flex flex-wrap gap-2">{(options?.goals ?? []).map(({ id, label }) => { const selected = draft.goalIds.includes(id); return <button key={id} type="button" aria-pressed={selected} onClick={() => setDraft(current => ({ ...current, goalIds: selected ? current.goalIds.filter(value => value !== id) : [...current.goalIds, id] }))} className={`min-h-10 rounded-full border px-3 py-2 text-xs font-bold ${selected ? 'border-primary bg-orange-50 text-primary' : 'border-slate-200 bg-white text-slate-700'}`}>{label}</button>; })}</div>}
            <div className="mt-3"><V2Field label="One other goal (optional)" hint="A short outcome; it will not create a new standard Goal." ><V2TextInput value={draft.customGoal} onChange={customGoal => setDraft(current => ({ ...current, customGoal }))} maxLength={80} placeholder="Add one other outcome" /></V2Field></div>
          </fieldset>
        </V2Card>
      )}

      {step === 2 && (
        <V2Card className="space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Step 3 — How the group works
          </p>
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
                onClick={() => setDraft((current) => ({ ...current, requireAdminApproval: false }))}
                title="Join directly"
                description="New members join right away."
              />
              <V2ChoiceCard
                selected={draft.requireAdminApproval}
                onClick={() => setDraft((current) => ({ ...current, requireAdminApproval: true }))}
                title="Requires approval"
                description="You approve new members before they join."
              />
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-black text-slate-900">Who can create Challenges?</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <V2ChoiceCard
                selected={draft.allowMemberChallenges}
                onClick={() => setDraft((current) => ({ ...current, allowMemberChallenges: true }))}
                title="Members can create"
                description="Any member can host a Challenge here."
              />
              <V2ChoiceCard
                selected={!draft.allowMemberChallenges}
                onClick={() => setDraft((current) => ({ ...current, allowMemberChallenges: false }))}
                title="Steward creates"
                description="Only the Accountable Steward hosts new Challenges."
              />
            </div>
          </fieldset>
        </V2Card>
      )}

      {step === 3 && (
        <V2Card className="space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Step 4 — Our culture
          </p>
          <fieldset>
            <legend className="text-sm font-black text-slate-900">Community norms (optional)</legend>
            <p className="mt-1 text-xs text-slate-500">Choose the expectations that fit your Group.</p>
            {optionsQuery.isLoading ? <p className="mt-2 text-xs text-slate-500">Loading community norms…</p> : optionsQuery.isError ? <p role="alert" className="mt-2 text-xs text-red-700">Community norms are unavailable right now.</p> : <div className="mt-2 space-y-2">{(options?.communityNorms ?? []).map(({ id, label }) => { const selected = draft.communityNormIds.includes(id); return <label key={id} className="flex min-h-11 items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm"><input type="checkbox" checked={selected} onChange={() => setDraft(current => ({ ...current, communityNormIds: selected ? current.communityNormIds.filter(value => value !== id) : [...current.communityNormIds, id] }))} /><span>{label}</span></label>; })}</div>}
          </fieldset>
          <V2Field label="Add your own (optional)" hint="One additional expectation, shown to Group members.">
            <V2TextInput
              value={draft.customCommunityNorm}
              onChange={(customCommunityNorm) => setDraft((current) => ({ ...current, customCommunityNorm }))}
              placeholder="Write one community expectation"
              maxLength={GROUP_NORM_MAX_LENGTH}
            />
          </V2Field>
        </V2Card>
      )}

      {step === 4 && (
        <V2Card className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Step 5 — Review &amp; Create
          </p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="font-bold text-slate-500">Name</dt>
              <dd className="text-right font-black text-slate-900">{draft.name.trim() || '—'}</dd>
            </div>
            {draft.tagline.trim() && (
              <div className="flex justify-between gap-3">
                <dt className="font-bold text-slate-500">Tagline</dt>
                <dd className="text-right text-slate-800">{draft.tagline.trim()}</dd>
              </div>
            )}
            {draft.location.trim() && (
              <div className="flex justify-between gap-3">
                <dt className="font-bold text-slate-500">Location</dt>
                <dd className="text-right text-slate-800">{draft.location.trim()}</dd>
              </div>
            )}
            {draft.focusTags.length > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="font-bold text-slate-500">Focus</dt>
                <dd className="text-right text-slate-800">{draft.focusTags.join(' · ')}</dd>
              </div>
            )}
            {draft.goalIds.length > 0 && <div className="flex justify-between gap-3"><dt className="font-bold text-slate-500">Goals</dt><dd className="text-right text-slate-800">{(options?.goals ?? []).filter(goal => draft.goalIds.includes(goal.id)).map(goal => goal.label).join(' · ')}</dd></div>}
            {draft.customGoal.trim() && <div className="flex justify-between gap-3"><dt className="font-bold text-slate-500">Other goal</dt><dd className="text-right text-slate-800">{draft.customGoal.trim()}</dd></div>}
            <div className="flex justify-between gap-3">
              <dt className="font-bold text-slate-500">Discoverability</dt>
              <dd className="text-right text-slate-800">{draft.isPrivate ? 'Private' : 'Discoverable'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-bold text-slate-500">Joining</dt>
              <dd className="text-right text-slate-800">{draft.requireAdminApproval ? 'Requires approval' : 'Direct join'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-bold text-slate-500">Challenges</dt>
              <dd className="text-right text-slate-800">{draft.allowMemberChallenges ? 'Members can create' : 'Steward creates'}</dd>
            </div>
            {(draft.communityNormIds.length > 0 || draft.customCommunityNorm.trim()) && (
              <div className="flex justify-between gap-3">
                <dt className="font-bold text-slate-500">Community norms</dt>
                <dd className="text-right text-slate-800">{[...(options?.communityNorms ?? []).filter(norm => draft.communityNormIds.includes(norm.id)).map(norm => norm.label), ...(draft.customCommunityNorm.trim() ? [draft.customCommunityNorm.trim()] : [])].join(' · ')}</dd>
              </div>
            )}
          </dl>
          <p className="rounded-xl bg-orange-50 px-3 py-2 text-xs leading-5 text-slate-600">
            Creating establishes the Group through Tiizi governance. You become
            its Accountable Steward.
          </p>
        </V2Card>
      )}

      {createGroup.isError && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          {createGroupErrorMessage(createGroup.error)}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <V2Button variant="ghost" onClick={() => (step === 0 ? navigate('/v2/groups') : go(step - 1))}>
          {step === 0 ? 'Cancel' : 'Back'}
        </V2Button>
        {step < STEPS.length - 1 ? (
          <V2Button onClick={() => go(step + 1)} disabled={stepBlocked(step, issues)}>
            Continue
          </V2Button>
        ) : (
          <V2Button onClick={() => void handleSubmit()} disabled={!submittable}>
            {createGroup.isPending ? 'Creating your Group…' : 'Establish Group'}
          </V2Button>
        )}
      </div>
    </V2Page>
  );
}
