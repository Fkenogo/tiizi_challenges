import { useNavigate } from 'react-router-dom';

interface TemplateCardProps {
  item: {
    id: string;
    name: string;
    level: string;
    image: string;
  };
  groupId?: string;
}

export function TemplateCard({ item, groupId }: TemplateCardProps) {
  const navigate = useNavigate();

  return (
    <article key={item.id} className="w-[200px] shrink-0 rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="relative h-24">
        <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <span className="absolute left-2 bottom-2 rounded px-2 py-0.5 text-[10px] font-bold uppercase bg-primary text-white">
          {item.level}
        </span>
      </div>
      <div className="p-2">
        <h3 className="text-sm font-bold text-slate-900 truncate">{item.name}</h3>
        <button
          className="mt-2 h-8 w-full rounded-lg bg-primary text-white text-xs font-semibold"
          onClick={() => navigate(`/app/challenges/suggested?previewTemplateId=${item.id}${groupId ? `&groupId=${groupId}` : ''}`)}
        >
          Preview
        </button>
      </div>
    </article>
  );
}
