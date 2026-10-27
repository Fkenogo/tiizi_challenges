import { useNavigate } from 'react-router-dom';
import { V2Button, V2Card } from '../components/V2Primitives';
import { SUPPORT_PATH, SUPPORT_PROFILE_CARD } from './supportContent';

/**
 * TIIZI — V2 Experience Recovery 001: permanent Profile entry point for
 * Support Tiizi (Product Truth T1 §V.3 / FR-V2-155). Navigation only: it opens
 * the information screen and starts no contribution.
 */
export function V2SupportTiiziCard() {
  const navigate = useNavigate();
  return (
    <V2Card>
      <section aria-label={SUPPORT_PROFILE_CARD.title}>
        <h2 className="text-base font-black text-slate-900">{SUPPORT_PROFILE_CARD.title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">{SUPPORT_PROFILE_CARD.body}</p>
        <div className="mt-3">
          <V2Button variant="secondary" onClick={() => navigate(SUPPORT_PATH)}>
            {SUPPORT_PROFILE_CARD.action}
          </V2Button>
        </div>
      </section>
    </V2Card>
  );
}
