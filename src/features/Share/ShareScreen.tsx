import { useMemo, useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Screen, Section } from '../../components/Layout';
import { Card } from '../../components/Mobile';

function ShareScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const challengeId = params.get('challengeId') ?? undefined;
  const groupId = params.get('groupId') ?? undefined;
  const [copied, setCopied] = useState(false);

  const shareText = useMemo(() => {
    const challengePart = challengeId ? `Challenge: ${challengeId}` : 'Challenge progress';
    const groupPart = groupId ? ` • Group: ${groupId}` : '';
    return `${challengePart}${groupPart} • Shared from Tiizi`;
  }, [challengeId, groupId]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Screen>
      <Section title="Share Progress">
        <Card>
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-primary" />
            <p className="text-sm font-bold text-slate-900">Share Composer</p>
          </div>
          <p className="text-xs text-slate-600 mt-2">Preview the message and share to your community.</p>
          <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3">
            <p className="text-sm text-slate-800">{shareText}</p>
          </div>
          <div className="mt-3 space-y-2">
            <button className="w-full h-11 rounded-xl bg-primary text-white text-sm font-bold" onClick={handleCopy}>
              {copied ? <Check size={14} className="inline-block mr-1" /> : <Copy size={14} className="inline-block mr-1" />}
              {copied ? 'Copied' : 'Copy Text'}
            </button>
            <button className="w-full h-11 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/challenges/preview')}>
              Open Challenge Preview
            </button>
            <button className="w-full h-11 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate('/app/challenges')}>
              Back to Challenges
            </button>
          </div>
        </Card>
      </Section>
    </Screen>
  );
}

export default ShareScreen;
