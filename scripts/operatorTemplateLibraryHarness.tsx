/** TIIZI-FER-P5T-2-S2 render harness: the Library over seeded, deterministic read data. */
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { OperatorTemplateLibrary } from '../src/v2/operator/templates/OperatorTemplateLibrary';
import { EMPTY_FILTERS } from '../src/v2/operator/templates/templateLibraryModel';
import type { OperatorTemplateDetail, OperatorTemplateSummary } from '../src/api/operatorTemplatesApi';

const A = '11111111-aaaa-4aaa-8aaa-111111111111';
const B = '22222222-bbbb-4bbb-8bbb-222222222222';
const M = '99999999-9999-4999-8999-999999999999';

const summaries: OperatorTemplateSummary[] = [
  { templateId: A, lifecycle: 'published', createdByMemberId: M, createdAt: '2026-10-30T08:00:00Z', latestPublishedVersion: 2, latestVersion: 3, openDraftVersion: 3, title: 'Hundred Rep Race', summary: 'A short race to a hundred reps.', challengeType: 'competitive', durationDays: 14, focusTags: ['Strength'] },
  { templateId: B, lifecycle: 'draft', createdByMemberId: M, createdAt: '2026-10-30T09:00:00Z', latestPublishedVersion: null, latestVersion: 1, openDraftVersion: 1, title: null, summary: null, challengeType: null, durationDays: null, focusTags: [] },
];

const version = (n: number, state: 'draft' | 'published', title: string) => ({
  version: n, state,
  content: { summary: 'A short race to a hundred reps.', focusTags: ['Strength'], sortOrder: 0, coverId: 'challenge-2', durationDays: 14, durationPresetDays: [7, 14],
    composer: { title, description: 'Race to one hundred.', challengeType: 'competitive', activities: [{ activity: 'FIT-TST-001', observedVersion: 3, metric: 'repetitions', unit: 'reps', targetValue: 100 }] } },
  authoredByMemberId: M, authoredAt: '2026-10-30T08:00:00Z', lastEditedByMemberId: M, lastEditedAt: '2026-10-30T08:00:00Z',
  publishedByMemberId: state === 'published' ? M : null, publishedAt: state === 'published' ? '2026-10-30T08:30:00Z' : null,
});

const detail: OperatorTemplateDetail = {
  templateId: A, lifecycle: 'published', createdByMemberId: M, createdAt: '2026-10-30T08:00:00Z', latestPublishedVersion: 2, latestPublishedAt: '2026-10-30T08:30:00Z',
  retiredByMemberId: null, retiredAt: null, retiredReason: null,
  versions: [version(1, 'published', 'Hundred Rep Race'), version(2, 'published', 'Hundred Rep Race v2'), version(3, 'draft', 'Hundred Rep Race v3')],
};

function render(seed: (client: QueryClient) => void): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seed(client);
  return renderToStaticMarkup(<QueryClientProvider client={client}><OperatorTemplateLibrary /></QueryClientProvider>);
}

function renderOffline(seed: (client: QueryClient) => void): string {
  onlineManager.setOnline(false);
  try { return render(seed); } finally { onlineManager.setOnline(true); }
}

export function renderCases(): Record<string, string> {
  return {
    // A paused (offline) query is pending with no data: it must render a state, never crash or go blank.
    offlineDetail: renderOffline((client) => {
      client.setQueryData(['operator-templates', 'list', EMPTY_FILTERS], { pages: [{ templates: summaries, nextCursor: null }], pageParams: [null] });
    }),
    offlineList: renderOffline(() => undefined),
    populated: render((client) => {
      client.setQueryData(['operator-templates', 'list', EMPTY_FILTERS], { pages: [{ templates: summaries, nextCursor: 'next-1' }], pageParams: [null] });
      client.setQueryData(['operator-templates', 'detail', A], detail);
      client.setQueryData(['operator-templates', 'adoption', A], [
        { templateId: A, version: 1, lifecycle: 'published', title: 'Hundred Rep Race', adoptions: 3 },
        { templateId: A, version: 2, lifecycle: 'published', title: 'Hundred Rep Race v2', adoptions: 0 },
      ]);
    }),
    emptyLibrary: render((client) => {
      client.setQueryData(['operator-templates', 'list', EMPTY_FILTERS], { pages: [{ templates: [], nextCursor: null }], pageParams: [null] });
    }),
    endOfList: render((client) => {
      client.setQueryData(['operator-templates', 'list', EMPTY_FILTERS], { pages: [{ templates: summaries, nextCursor: null }], pageParams: [null] });
      client.setQueryData(['operator-templates', 'detail', A], detail);
      client.setQueryData(['operator-templates', 'adoption', A], []);
    }),
  };
}
