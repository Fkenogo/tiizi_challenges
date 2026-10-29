import { useNavigate } from 'react-router-dom';
import { V2Button, V2Card } from '../components/V2Primitives';
import { SUPPORT_TIIZI } from './supportTiiziContent';

/** Profile entry to Support Tiizi (P8a). Navigation only. */
export function V2SupportTiiziCard() {
  const navigate = useNavigate();
  return (
    <V2Card>
      <h2 className="text-base font-black text-slate-900">{SUPPORT_TIIZI.copy.profileCard.heading}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">{SUPPORT_TIIZI.copy.profileCard.body}</p>
      <V2Button variant="secondary" className="mt-3 min-h-11 w-full" onClick={() => navigate('/v2/support', { state: { from: '/v2/profile' } })}>
        {SUPPORT_TIIZI.copy.profileCard.action}
      </V2Button>
    </V2Card>
  );
}
