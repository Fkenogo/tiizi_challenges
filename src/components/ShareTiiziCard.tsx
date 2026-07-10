import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

const INSTALL_URL = 'https://www.tiizichallenges.com/install';

interface ShareTiiziCardProps {
  variant?: 'card' | 'button';
}

export function ShareTiiziCard({ variant = 'card' }: ShareTiiziCardProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on Tiizi',
          text: 'Tiizi helps you build healthy habits with group challenges. Add it to your home screen!',
          url: INSTALL_URL,
        });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(INSTALL_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* nothing */ }
  };

  if (variant === 'button') {
    return (
      <button
        onClick={handleShare}
        className="flex items-center gap-2 text-[14px] font-semibold text-slate-500 active:opacity-70"
      >
        {copied ? <Check size={16} className="text-emerald-500" /> : <Share2 size={16} />}
        {copied ? 'Link copied!' : 'Share Tiizi'}
      </button>
    );
  }

  return (
    <div className="st-card p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Share2 size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] leading-[18px] font-bold text-slate-900">Enjoying Tiizi?</p>
          <p className="text-[12px] leading-[16px] text-slate-500 mt-0.5">Invite friends to join the challenge</p>
        </div>
        <button
          onClick={handleShare}
          className="shrink-0 h-9 px-4 rounded-xl bg-primary text-white text-[13px] font-bold active:opacity-80 flex items-center gap-1.5"
        >
          {copied ? <Check size={14} /> : <Share2 size={14} />}
          {copied ? 'Copied!' : 'Share'}
        </button>
      </div>
    </div>
  );
}
