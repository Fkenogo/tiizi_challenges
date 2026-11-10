import { apiPath } from '../../api/src/apiPrefix';

/**
 * Read-only fictional member Templates for the disposable Founder Preview.
 * These two configurations use only the governed Activities installed by
 * migration 014 so the existing local API can resolve identity/options.
 */
export const FOUNDER_TEMPLATE_FIXTURES = [
  {
    templateId: 'founder-preview-push-up-together', version: 1,
    title: '30-Day Push-Up Together Challenge',
    summary: 'The whole Group adds Push-Ups towards one shared total.',
    description: 'Everyone logs Push-Up repetitions and every rep adds to the Group total. Reach 3,000 together within 30 days.',
    challengeType: 'collective', durationDays: 30, durationPresetDays: [14, 30], coverId: 'challenge-5',
    focusTags: ['Strength'], publishedAt: null, adoptable: true, unavailableReason: null, simulatedPublication: true,
    composer: {
      draftKind: 'pf04-v1', mode: 'CHALLENGE', challengeType: 'collective',
      title: '30-Day Push-Up Together Challenge',
      description: 'Everyone logs Push-Up repetitions and every rep adds to the Group total. Reach 3,000 together within 30 days.',
      activities: [{ activity: '11111111-1111-4111-8111-111111111111', observedVersion: 1, kind: 'fitness', metric: 'repetitions', unit: 'reps', targetValue: 3000, position: 0 }],
    },
  },
  {
    templateId: 'founder-preview-breathing-streak', version: 1,
    title: '7-Day Breathing Practice Streak',
    summary: 'Build a gentle daily breathing practice for one week.',
    description: 'Complete a five-minute guided Breathing Practice each day for seven days.',
    challengeType: 'streak', durationDays: 7, durationPresetDays: [7, 14], coverId: 'challenge-6',
    focusTags: ['Mind & Emotional Wellbeing'], publishedAt: null, adoptable: true, unavailableReason: null, simulatedPublication: true,
    composer: {
      draftKind: 'pf04-v1', mode: 'CHALLENGE', challengeType: 'streak',
      title: '7-Day Breathing Practice Streak',
      description: 'Complete a five-minute guided Breathing Practice each day for seven days.',
      activities: [{ activity: '22222222-2222-4222-8222-222222222222', observedVersion: 1, kind: 'wellness', metric: 'duration', unit: 'minutes', targetValue: 5, durationMode: 'CONTINUOUS', position: 0 }],
    },
  },
];

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json',
    'X-Tiizi-Preview-Simulated': 'member-template-publication',
  },
});

const TEMPLATES_LIST_PATH = apiPath('/challenge-templates');
const TEMPLATES_PREFIX = `${TEMPLATES_LIST_PATH}/`;
const TEMPLATES_DETAIL_REGEX = new RegExp(`^${apiPath('/challenge-templates')}/([^/]+)(?:/versions/(\\d+))?$`);

/** Handles only the member Template read contract. Every other API request falls through to the local API. */
export function handleFounderTemplateRequest(method: string, requestUrl: string): Response | null {
  const url = new URL(requestUrl, 'http://127.0.0.1');
  if (url.pathname !== TEMPLATES_LIST_PATH && !url.pathname.startsWith(TEMPLATES_PREFIX)) return null;
  if (method.toUpperCase() !== 'GET') return json(405, { error: { code: 'method_not_allowed', message: 'Founder Preview Templates are read-only.' } });

  if (url.pathname === TEMPLATES_LIST_PATH) {
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const type = url.searchParams.get('type');
    const tag = url.searchParams.get('tag');
    const activity = url.searchParams.get('activity');
    const templates = FOUNDER_TEMPLATE_FIXTURES.filter((template) =>
      (!type || template.challengeType === type)
      && (!tag || template.focusTags.includes(tag))
      && (!activity || template.composer.activities.some((entry) => entry.activity === activity))
      && (!q || [template.title, template.summary, template.description, ...template.focusTags].some((value) => value.toLowerCase().includes(q))),
    );
    return json(200, { templates, nextCursor: null });
  }

  const match = url.pathname.match(TEMPLATES_DETAIL_REGEX);
  if (!match) return json(404, { error: { code: 'not_found', message: 'Template not found.' } });
  const template = FOUNDER_TEMPLATE_FIXTURES.find((item) => item.templateId === decodeURIComponent(match[1])
    && (!match[2] || item.version === Number(match[2])));
  return template
    ? json(200, template)
    : json(404, { error: { code: 'template_not_found', message: 'Template not found.' } });
}
