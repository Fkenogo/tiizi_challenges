import { X } from 'lucide-react';
import type { Group } from '../../../types';

type Props = {
  group: Group;
  ownerDisplayName?: string;
  onClose: () => void;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] font-black uppercase tracking-widest text-slate-400 mb-2">{title}</p>
      {children}
    </div>
  );
}

function Chip({ label, color = 'slate' }: { label: string; color?: 'primary' | 'emerald' | 'amber' | 'slate' }) {
  const cls: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  return (
    <span className={`inline-flex items-center h-7 rounded-full px-3 text-[12px] font-bold capitalize ${cls[color]}`}>
      {label.replace(/-/g, ' ')}
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

export function GroupDetailsModal({ group, ownerDisplayName, onClose }: Props) {
  const createdDate = group.createdAt
    ? new Date(group.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  const hasAbout =
    group.description ||
    group.groupType ||
    group.locationScope ||
    createdDate ||
    ownerDisplayName;

  const hasFocus =
    (group.activityInterests?.length ?? 0) > 0 ||
    (group.wellnessTopics?.length ?? 0) > 0 ||
    (group.groupGoals?.length ?? 0) > 0;

  const hasRules =
    (group.groupRules?.length ?? 0) > 0 ||
    group.isPrivate !== undefined ||
    group.allowMemberChallenges !== undefined ||
    group.requireAdminApproval !== undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-mobile mx-auto bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <p className="text-[17px] font-black text-slate-900">Group Details</p>
          <button
            className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100"
            onClick={onClose}
          >
            <X size={16} className="text-slate-600" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-6">
          {/* ── About ── */}
          {hasAbout && (
            <Section title="About">
              <div className="bg-slate-50 rounded-2xl px-4 py-1">
                {group.description && (
                  <MetaRow label="Description" value={group.description} />
                )}
                {group.groupType && (
                  <MetaRow label="Type" value={group.groupType.replace(/-/g, ' ')} />
                )}
                {group.locationScope && (
                  <MetaRow label="Scope" value={group.locationScope.replace(/-/g, ' ')} />
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

          {/* ── Focus Areas ── */}
          {hasFocus && (
            <Section title="Focus Areas">
              <div className="space-y-3">
                {(group.activityInterests?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-[12px] font-bold text-slate-500 mb-1.5">Activities</p>
                    <div className="flex flex-wrap gap-2">
                      {group.activityInterests?.map((a) => (
                        <Chip key={a} label={a} color="primary" />
                      ))}
                    </div>
                  </div>
                )}
                {(group.wellnessTopics?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-[12px] font-bold text-slate-500 mb-1.5">Wellness</p>
                    <div className="flex flex-wrap gap-2">
                      {group.wellnessTopics?.map((w) => (
                        <Chip key={w} label={w} color="emerald" />
                      ))}
                    </div>
                  </div>
                )}
                {(group.groupGoals?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-[12px] font-bold text-slate-500 mb-1.5">Goals</p>
                    <div className="flex flex-wrap gap-2">
                      {group.groupGoals?.map((g) => (
                        <Chip key={g} label={g} color="amber" />
                      ))}
                    </div>
                  </div>
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
          {!hasAbout && !hasFocus && !hasRules && (
            <p className="text-[14px] text-slate-500 text-center py-4">No additional details for this group.</p>
          )}
        </div>

        {/* Bottom safe-area pad */}
        <div className="h-6" />
      </div>
    </div>
  );
}
