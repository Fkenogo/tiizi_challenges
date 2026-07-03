import { ArrowLeft } from 'lucide-react';

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
    <section className="relative h-[270px]">
      <img src={coverImageUrl || heroFallback} alt={groupName} className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/70" />

      <div className="absolute left-4 right-4 top-5 flex items-center justify-between">
        <button
          className="h-11 w-11 rounded-full bg-white/25 backdrop-blur text-white flex items-center justify-center"
          onClick={onBack}
        >
          <ArrowLeft size={22} />
        </button>
      </div>

      <div className="absolute left-4 right-4 bottom-4">
        <h1 className="text-[20px] leading-[24px] font-black text-white">{groupName}</h1>
        <div className="mt-2 flex gap-2">
          <span className="rounded-full border border-white/60 bg-black/35 px-3 py-1 text-[12px] leading-[14px] font-bold uppercase tracking-[0.08em] text-white">
            {isPrivate ? 'Private Group' : 'Public Group'}
          </span>
          <span className="rounded-full border border-white/60 bg-black/35 px-3 py-1 text-[12px] leading-[14px] font-bold uppercase tracking-[0.08em] text-white">
            {memberCount.toLocaleString()} Members
          </span>
        </div>
      </div>
    </section>
  );
}
