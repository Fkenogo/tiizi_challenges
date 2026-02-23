import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MonitorSmartphone, Search } from 'lucide-react';
import { Screen, Section } from '../../components/Layout';
import { Card, EmptyState } from '../../components/Mobile';
import screenLayouts from '../../data/screenLayouts.json';

type ScreenLayout = {
  slug: string;
  title: string;
  source: string;
  hasPreview?: boolean;
};

function formatTitle(title: string) {
  return title
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function MockupCatalogScreen() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const layouts = useMemo(
    () =>
      (screenLayouts as ScreenLayout[]).map((layout) => ({
        ...layout,
        displayTitle: formatTitle(layout.title),
      })),
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return layouts;
    return layouts.filter(
      (layout) =>
        layout.displayTitle.toLowerCase().includes(q) ||
        layout.source.toLowerCase().includes(q) ||
        layout.slug.toLowerCase().includes(q),
    );
  }, [layouts, query]);

  return (
    <Screen>
      <Section title="Provided Layouts" spacing="normal" className="mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search mockups..."
            className="w-full h-11 border border-slate-200 rounded-xl bg-white pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </Section>

      {filtered.length === 0 ? (
        <EmptyState icon={<MonitorSmartphone size={48} />} title="No Layouts Found" />
      ) : (
        <div className="grid grid-cols-1 gap-3 pb-8">
          {filtered.map((layout) => (
            <Card
              key={layout.slug}
              interactive
              onClick={() => navigate(`/mockups/${layout.slug}`)}
              className="overflow-hidden"
            >
              <div className="flex gap-3">
                {layout.hasPreview ? (
                  <img
                    src={`/screen-layouts/${layout.slug}/screen.png`}
                    alt={layout.displayTitle}
                    className="w-20 h-20 rounded-md border border-slate-200 object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 flex-shrink-0">
                    <MonitorSmartphone size={18} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{layout.displayTitle}</p>
                  <p className="text-xs text-slate-500 mt-1 truncate">{layout.source}</p>
                  <p className="text-xs text-primary font-bold mt-2">Open Layout</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Screen>
  );
}

export default MockupCatalogScreen;
