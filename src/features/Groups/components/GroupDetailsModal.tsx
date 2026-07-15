import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Group } from '../../../types';
import {
  getActivityLabel,
  getGroupGoalLabel,
  getGroupTypeLabel,
  getLocationScopeLabel,
  getWellnessLabel,
} from '../groupOptionLabels';
import { isGroupMetadataMateriallyIncomplete } from '../groupMetadataCompleteness';

type Props = {
  group: Group;
  ownerDisplayName?: string;
  onClose: () => void;
  /** Gates the incomplete-metadata prompt — only the group owner sees it. */
  isOwner?: boolean;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] font-black uppercase tracking-widest text-slate-400 mb-2">{title}</p>
      {children}
    </div>
  );
}

/** `label` must already be a human-readable string (resolved via groupOptionLabels helpers). */
function Chip({ label, color = 'slate' }: { label: string; color?: 'primary' | 'emerald' | 'amber' | 'slate' }) {
  const cls: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  return (
    <span className={`inline-flex items-center h-7 rounded-full px-3 text-[12px] font-bold ${cls[color]}`}>
      {label}
    </span>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-slate-100 last:border-0">
      <span className="text-[13px] text-slate-500 w-28 shrink-0">{label}</span>
      <span className="text-[13px] font-medium text-slate-800">{value}</span>
    </div>
  );
}

export function GroupDetailsModal({ group, ownerDisplayName, onClose, isOwner }: Props) {
  const navigate = useNavigate();
  const createdDate = group.createdAt
    ? new Date(group.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  const groupTypeLabel = getGroupTypeLabel(group.groupType);
  const locationScopeLabel = getLocationScopeLabel(group.locationScope);

  const hasAbout =
    group.description ||
    createdDate ||
    ownerDisplayName;

  const hasGroupFocus = !!groupTypeLabel || !!locationScopeLabel;

  const hasActivities = (group.activityInterests?.length ?? 0) > 0;
  const hasWellness = (group.wellnessTopics?.length ?? 0) > 0;
  const hasGoals = (group.groupGoals?.length ?? 0) > 0;
  const hasInterests = hasActivities || hasWellness || hasGoals;
  const isMetadataMateriallyIncomplete = isGroupMetadataMateriallyIncomplete(group);

  const hasRules =
    (group.groupRules?.length ?? 0) > 0 ||
    group.isPrivate !== undefined ||
    group.allowMemberChallenges !== undefined ||
    group.requireAdminApproval !== undefined;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-details-modal-heading"
        className="flex w-full max-w-mobile mx-auto max-h-[85vh] flex-col bg-white rounded-t-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar + Header — kept outside the scroll area so the close
            button stays visible and usable while the content scrolls. */}
        <div className="shrink-0">
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-slate-200" />
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <h2 id="group-details-modal-heading" className="text-[17px] font-black text-slate-900">Group Details</h2>
            <button
              className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100"
              onClick={onClose}
              aria-label="Close group details"
            >
              <X size={16} className="text-slate-600" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="px-5 py-5 space-y-6 overflow-y-auto">
          {/* ── Group Focus (type + scope) — shown first so purpose is clear
                before technical privacy details ── */}
          {hasGroupFocus && (
            <Section title="Group Focus">
              <div className="bg-slate-50 rounded-2xl px-4 py-1">
                {groupTypeLabel && <MetaRow label="Type" value={groupTypeLabel} />}
                {locationScopeLabel && <MetaRow label="Scope" value={locationScopeLabel} />}
              </div>
            </Section>
          )}

          {/* ── Activities ── */}
          {hasActivities && (
            <Section title="Activities">
              <div className="flex flex-wrap gap-2">
                {group.activityInterests?.map((a) => (
                  <Chip key={a} label={getActivityLabel(a)} color="primary" />
                ))}
              </div>
            </Section>
          )}

          {/* ── Wellness Topics ── */}
          {hasWellness && (
            <Section title="Wellness Topics">
              <div className="flex flex-wrap gap-2">
                {group.wellnessTopics?.map((w) => (
                  <Chip key={w} label={getWellnessLabel(w)} color="emerald" />
                ))}
              </div>
            </Section>
          )}

          {/* ── Group Goals ── */}
          {hasGoals && (
            <Section title="Group Goals">
              <div className="flex flex-wrap gap-2">
                {group.groupGoals?.map((g) => (
                  <Chip key={g} label={getGroupGoalLabel(g)} color="amber" />
                ))}
              </div>
            </Section>
          )}

          {/* Owner/admin-only nudge to fill in focus metadata — never shown
              to ordinary members, never blocks group usage. */}
          {isOwner && isMetadataMateriallyIncomplete && (
            <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3">
              <p className="text-[13px] leading-[19px] text-slate-600">
                Add group type, activities, wellness topics and goals in Edit Group to help members understand this group.
              </p>
              <button
                className="mt-2 text-[13px] font-bold text-primary"
                onClick={() => {
                  onClose();
                  navigate(`/app/group/${group.id}/edit`);
                }}
              >
                Edit Group →
              </button>
            </div>
          )}

          {/* ── About ── */}
          {hasAbout && (
            <Section title="About">
              <div className="bg-slate-50 rounded-2xl px-4 py-1">
                {group.description && (
                  <MetaRow label="Description" value={group.description} />
                )}
                <MetaRow
                  label="Privacy"
                  value={group.isPrivate ? 'Private group' : 'Public group'}
                />
                {createdDate && (
                  <MetaRow label="Founded" value={createdDate} />
                )}
                {ownerDisplayName && (
                  <MetaRow label="Admin" value={ownerDisplayName} />
                )}
              </div>
            </Section>
          )}

          {/* ── Rules & Privacy ── */}
          {hasRules && (
            <Section title="Rules & Privacy">
              <div className="bg-slate-50 rounded-2xl px-4 py-1">
                {(group.groupRules?.length ?? 0) > 0 && (
                  <div className="py-3 border-b border-slate-100">
                    <p className="text-[13px] text-slate-500 mb-2">Community rules</p>
                    <ul className="space-y-1.5">
                      {group.groupRules?.map((rule, i) => (
                        <li key={i} className="text-[13px] font-medium text-slate-700 flex gap-2">
                          <span className="text-primary shrink-0">•</span>
                          {rule}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {group.isPrivate !== undefined && (
                  <MetaRow
                    label="Visibility"
                    value={group.isPrivate ? 'Private — invite or approval required' : 'Public — anyone can join'}
                  />
                )}
                {group.requireAdminApproval !== undefined && (
                  <MetaRow
                    label="Approval"
                    value={group.requireAdminApproval ? 'Admin must approve new members' : 'Auto-approved on join'}
                  />
                )}
                {group.allowMemberChallenges !== undefined && (
                  <MetaRow
                    label="Challenges"
                    value={group.allowMemberChallenges ? 'All members can create challenges' : 'Only admins can create challenges'}
                  />
                )}
              </div>
            </Section>
          )}

          {/* Empty state for legacy groups with no metadata */}
          {!hasAbout && !hasGroupFocus && !hasInterests && !hasRules && (
            <p className="text-[14px] text-slate-500 text-center py-4">No additional details for this group.</p>
          )}
        </div>

        {/* Bottom safe-area pad */}
        <div className="h-6" />
      </div>
    </div>
  );
}
