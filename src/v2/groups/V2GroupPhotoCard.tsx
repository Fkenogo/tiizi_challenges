import type { ReactNode } from 'react';
import { V2GroupCover } from './V2GroupCover';

export function V2GroupPhotoCard({
  groupId,
  name,
  coverId,
  location,
  description,
  status,
  tags,
  goals,
  context,
  memberCount,
  activeChallengeCount,
  onOpen,
  action,
  actionError,
}: {
  groupId: string;
  name: string;
  coverId?: string | null;
  location?: string | null;
  description: string;
  status: string;
  tags: string[];
  goals?: string[];
  context?: string[];
  memberCount?: number | null;
  activeChallengeCount?: number;
  onOpen: () => void;
  action: ReactNode;
  actionError?: string | null;
}) {
  return (
    <li className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Open ${name}`}>
        <V2GroupCover groupId={groupId} title={name} coverId={coverId} heightClass="h-44 sm:h-48" className="w-full">
          {location?.trim() && <span className="absolute left-4 top-4 max-w-[75%] truncate rounded-full border border-white/20 bg-slate-950/65 px-3 py-1 text-xs font-bold text-white">⌖ {location.trim()}</span>}
          <span className="absolute bottom-4 left-4 right-4">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-white/80">Tiizi Group</span>
            <span className="block truncate text-xl font-black tracking-tight text-white sm:text-2xl">{name}</span>
          </span>
        </V2GroupCover>
      </button>
      <div className="space-y-3 p-4">
        {description && <p className="line-clamp-2 text-sm leading-6 text-slate-600">{description}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-primary">{status}</span>
          {tags.slice(0, 4).map((tag) => <span key={tag} className="max-w-full truncate rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">#{tag}</span>)}
          {goals?.slice(0, 2).map((goal) => <span key={goal} className="max-w-full truncate rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">{goal}</span>)}
        </div>
        {context && context.length > 0 && <p className="text-xs font-bold text-emerald-800">{context.join(' · ')}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
            {typeof memberCount === 'number' && <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>}
            {activeChallengeCount !== undefined && <span>{activeChallengeCount} active {activeChallengeCount === 1 ? 'Challenge' : 'Challenges'}</span>}
          </div>
          <div onClick={(event) => event.stopPropagation()}>{action}</div>
        </div>
        {actionError && <p role="alert" className="text-xs font-bold text-red-700">{actionError}</p>}
      </div>
    </li>
  );
}
