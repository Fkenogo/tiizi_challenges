import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { fetchKnowledgeById } from '../../../api/knowledgeApi';
import { fetchOperatorTemplate, type OperatorTemplateVersion } from '../../../api/operatorTemplatesApi';
import { useAuth } from '../../../hooks/useAuth';
import { V2EmptyState, V2LoadingState, V2Page, V2SectionHeader } from '../../components/V2Primitives';
import { TemplatePreview } from './TemplatePreview';
import { derivePreview } from './templatePreviewModel';
import { useTemplateCapabilities } from './useTemplateCapabilities';

/**
 * TIIZI-FER-P5T-2-S4 — read-only Template preview route for authors and Console readers.
 * Uses only the existing read endpoints; the server decides who may read.
 */
export function TemplatePreviewPage() {
  const { templateId = '' } = useParams<{ templateId: string }>();
  const { user } = useAuth();
  const capabilities = useTemplateCapabilities();
  const canRead = capabilities.data?.canRead === true;

  const detail = useQuery({
    queryKey: ['operator-templates', 'preview', user?.uid ?? '', templateId],
    enabled: canRead && !!templateId,
    retry: false,
    staleTime: 0,
    queryFn: async () => {
      const found = await fetchOperatorTemplate(templateId);
      const shown: OperatorTemplateVersion | undefined = found.versions.find((entry) => entry.state === 'draft') ?? found.versions[found.versions.length - 1];
      const names: Record<string, string> = {};
      await Promise.all((shown?.content.composer.activities ?? []).map(async (config) => {
        try { names[config.activity] = (await fetchKnowledgeById(config.activity)).name; } catch { /* name stays unavailable; the preview says so */ }
      }));
      return { shown, names, lifecycle: found.lifecycle };
    },
  });

  const back = <Link to="/v2/operator/templates" className="text-sm font-bold text-primary underline">Back to the Template Library</Link>;
  const header = <V2SectionHeader eyebrow="Operator · Templates" title="Template preview" description="A read-only look at how this Template would read to members." />;

  if (!user?.uid) return <V2Page wide>{header}<V2EmptyState title="Sign in required" message="Sign in to preview Templates." action={back} /></V2Page>;
  if (capabilities.isError) return <V2Page wide>{header}<div role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-800">We could not confirm your access. Check your connection and reload.</div></V2Page>;
  if (!capabilities.isSuccess) return <V2Page wide>{header}<V2LoadingState label="Loading…" /></V2Page>;
  if (!canRead) return <V2Page wide>{header}<V2EmptyState title="Console access required" message="You do not have access to preview Templates." action={back} /></V2Page>;
  if (detail.isError) {
    const status = (detail.error as { status?: number }).status;
    const message = status === 404 ? 'This Template does not exist.' : status === 403 ? 'You do not have access to this Template.' : 'The preview could not be loaded. Try again.';
    return <V2Page wide>{header}<div role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-800">{message}</div><div className="mt-3">{back}</div></V2Page>;
  }
  if (!detail.data) return <V2Page wide>{header}<V2LoadingState label="Loading the preview…" /></V2Page>;
  if (!detail.data.shown) return <V2Page wide>{header}<V2EmptyState title="Nothing to preview" message="This Template has no versions." action={back} /></V2Page>;
  const { shown, names, lifecycle } = detail.data;
  return (
    <V2Page wide>
      {header}
      <p className="mb-3 text-xs font-bold text-slate-500">{shown.state === 'draft' ? `Saved draft, version ${shown.version}` : `Published version ${shown.version}`}</p>
      {lifecycle === 'retired' ? <p role="status" className="mb-3 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">This Template is retired and no longer offered to members.</p> : null}
      <TemplatePreview model={derivePreview(shown, names)} />
      <div className="mt-4">{back}</div>
    </V2Page>
  );
}
