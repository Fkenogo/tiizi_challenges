import { ArrowLeft, Share2 } from 'lucide-react';

const heroFallback = 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1200&q=80';

type GroupHeroHeaderProps = {
  groupName: string;
  coverImageUrl?: string;
  memberCount: number;
  isPrivate: boolean;
  onBack: () => void;
};

export function GroupHeroHeader({ groupName, coverImageUrl, memberCount, isPrivate, onBack }: GroupHeroHeaderProps) {
  return (
    <>
      {/* App bar — sits above the hero image */}
      <div className="bg-white border-b border-slate-200 flex items-center justify-between px-2 h-[52px]">
        <button
          className="h-10 w-10 flex items-center justify-center text-slate-800"
          onClick={onBack}
        >
          <ArrowLeft size={22} />
        </button>
        <span className="text-[15px] leading-[20px] font-black text-slate-900 tracking-[0.04em] uppercase">
          Group Detail
        </span>
        <button className="h-10 w-10 flex items-center justify-center text-slate-500">
          <Share2 size={18} />
        </button>
      </div>

      {/* Hero image with gradient + badges + group name */}
      <section className="relative h-[200px]">
        <img src={coverImageUrl || heroFallback} alt={groupName} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-black/70" />

        <div className="absolute left-4 right-4 bottom-4">
          <div className="flex gap-2 mb-2">
            <span className="rounded-full bg-primary px-3 py-1 text-[11px] leading-[14px] font-bold uppercase tracking-[0.07em] text-white">
              {isPrivate ? 'Private Group' : 'Public Group'}
            </span>
            <span className="rounded-full border border-white/50 bg-black/40 px-3 py-1 text-[11px] leading-[14px] font-bold uppercase tracking-[0.07em] text-white">
              {memberCount.toLocaleString()} Members
            </span>
          </div>
          <h2 className="text-[20px] leading-[25px] font-black text-white drop-shadow-sm">{groupName}</h2>
        </div>
      </section>
    </>
  );
}
