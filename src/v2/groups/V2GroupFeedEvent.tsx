import { ChevronRight, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { GroupFeedEvent } from '../../api/groupFeedApi';
import { formatGroupFeedTime } from './groupFeedTime';

export function V2GroupFeedEvent({ event, groupId }: { event: GroupFeedEvent; groupId: string }) {
  const time = formatGroupFeedTime(event.occurredAt);
  const destination = `/v2/challenges/${encodeURIComponent(event.navigationTarget.challengeId)}`;
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <Link
        to={destination}
        state={{ gf04FeedOriginGroupId: groupId }}
        className="group flex min-h-11 items-start gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label={`${event.presentationTitle}: ${event.challengeTitle}. Open Challenge.`}
      >
        <span aria-hidden className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-primary">
          <Radio size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black leading-5 text-slate-900">{event.presentationTitle}</span>
          <span className="mt-1 block break-words text-sm leading-5 text-slate-700">{event.challengeTitle}</span>
          <time className="mt-2 block text-xs text-slate-500" dateTime={event.occurredAt} aria-label={time.full} title={time.full}>
            {time.text}
          </time>
        </span>
        <ChevronRight aria-hidden size={20} className="mt-2 shrink-0 text-slate-400 group-hover:text-slate-700" />
      </Link>
    </li>
  );
}
