import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Screen } from '../../components/Layout';
import { EmptyState } from '../../components/Mobile';
import screenLayouts from '../../data/screenLayouts.json';

type ScreenLayout = {
  slug: string;
  title: string;
  source: string;
};

type MockupScreenProps = {
  slugOverride?: string;
};

function MockupScreen({ slugOverride }: MockupScreenProps) {
  const params = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const slug = slugOverride ?? params.slug;

  const layout = useMemo(() => {
    const list = screenLayouts as ScreenLayout[];
    return list.find((item) => item.slug === slug);
  }, [slug]);

  if (!layout) {
    return (
      <Screen>
        <EmptyState
          icon={<ArrowLeft size={48} />}
          title="Layout Not Found"
          message="Open /mockups to select a valid screen layout."
          action={
            <button
              onClick={() => navigate('/mockups')}
              className="h-11 px-4 rounded-xl bg-primary text-white text-sm font-bold"
            >
              Back To Layouts
            </button>
          }
        />
      </Screen>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-mobile mx-auto min-h-screen bg-white">
        <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/mockups')}
            className="h-11 px-3 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold"
          >
            Back
          </button>
          <p className="text-sm font-bold text-slate-900 truncate">{layout.title}</p>
        </div>
        <iframe
          title={layout.title}
          src={`/screen-layouts/${layout.slug}/code.html`}
          className="w-full border-0"
          style={{ minHeight: 'calc(100vh - 72px)' }}
        />
      </div>
    </div>
  );
}

export default MockupScreen;
