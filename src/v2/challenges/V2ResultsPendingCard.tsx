import type { V2ChallengeDetail } from '../../api/v2ChallengeApi';
import { V2Card } from '../components/V2Primitives';
import { formatDayRange } from './challengeCreationDraft';

/**
 * S3d — neutral ended / results-pending state (FD-S3D-1).
 *
 * Shown when a Challenge has ended but canonical finalization has not yet
 * completed, AND for a window-expired-but-unprocessed Challenge (the server
 * still reports `status: 'active'`). No provisional result, live standing or
 * live streak is ever presented as final here; logging is unavailable. The
 * sealed result replaces this state once finalization exists.
 */
export function V2ResultsPendingCard({ detail }: { detail: V2ChallengeDetail }) {
  return (
    <V2Card>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Challenge ended</p>
      <p className="mt-2 text-xl font-black text-slate-900">Final results are being confirmed</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        This Challenge has finished. Its final results are being confirmed and will appear here once
        they are saved. Logging is closed.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Ran {formatDayRange(detail.config.period.startDate, detail.config.period.endDate)}.
      </p>
    </V2Card>
  );
}
