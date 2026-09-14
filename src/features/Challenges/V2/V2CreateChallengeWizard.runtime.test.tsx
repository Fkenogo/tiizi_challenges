/**
 * PF-05-CORR-001 runtime Wizard integration test (vitest, node env).
 *
 * Real component rendering (react-test-renderer) through the actual
 * Wizard flow with ONLY the API transport mocked (global fetch) and a
 * stubbed Firebase Auth identity. The Wizard's identity/cache behavior,
 * stage progression, preview handling and establishment mapping all run
 * unmocked.
 *
 * - Start from scratch → type → Activity picker → select coded Activity
 *   → Measurement options visible (proves the code-identity cache fix);
 * - stale preview → explicit refresh → options still available.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react-test-renderer';
import TestRenderer from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const PUSH_UP = {
  id: '11111111-1111-4111-8111-111111111111',
  activityCode: 'FIT-STR-001',
  name: 'Push-Up',
  kind: 'fitness',
  category: 'Strength',
  knowledgeVersion: 2,
};

const PUSH_UP_OPTIONS = {
  knowledgeId: PUSH_UP.id,
  activityCode: 'FIT-STR-001',
  kind: 'fitness',
  currentVersion: 2,
  primaryMetrics: ['repetitions'],
  secondaryMetrics: [],
  compatibleUnits: ['reps'],
  components: [],
  supportedLoadBases: [],
};

const GROUP_UUID = '22222222-2222-4222-8222-222222222222';

interface FetchCall {
  url: string;
  init?: RequestInit;
}

let fetchCalls: FetchCall[] = [];
let previewMode: 'ok' | 'stale' = 'ok';

const OK_DEFINITION = {
  definitionKind: 'pf03-v1',
  challengeType: 'competitive',
  title: 'Runtime check',
  description: '',
  instructions: '',
  window: { startDate: '2026-10-01', endDate: '2026-10-31', timezone: 'UTC' },
  temporalConditions: null,
  goalValue: null,
  goalUnit: null,
  requiredConsecutiveDays: null,
  resetOnMiss: true,
  cadence: null,
  activities: [{
    canonicalKey: 'FIT-STR-001',
    knowledgeId: PUSH_UP.id,
    activityCode: 'FIT-STR-001',
    knowledgeVersion: 2,
    kind: 'fitness',
    metric: 'repetitions',
    unit: 'reps',
    targetValue: 50,
    requiredComponents: [],
    componentRelationship: null,
    loadReportingBasis: null,
    durationMode: null,
    completionOccurrence: null,
    position: 0,
    activityVariant: null,
  }],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function installFetch(): void {
  fetchCalls = [];
  vi.stubGlobal('fetch', async (input: unknown, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    fetchCalls.push({ url, init });
    if (url.includes('/v1/compat/group-ids')) {
      return jsonResponse({ mappings: [{ legacyId: 'legacy-group-1', id: GROUP_UUID }] });
    }
    if (url.includes('/v1/knowledge?')) {
      return jsonResponse({
        items: [{
          id: PUSH_UP.id,
          activityCode: PUSH_UP.activityCode,
          name: PUSH_UP.name,
          kind: PUSH_UP.kind,
          category: PUSH_UP.category,
          knowledgeVersion: PUSH_UP.knowledgeVersion,
        }],
      });
    }
    if (url.includes('/options')) {
      return jsonResponse(PUSH_UP_OPTIONS);
    }
    if (url.includes('/challenge-definitions/preview')) {
      if (previewMode === 'stale') {
        return jsonResponse({
          ok: false,
          issues: [{
            code: 'STALE_ACTIVITY',
            activityIndex: 0,
            field: 'activities[].observedVersion',
            message: "activity 'FIT-STR-001' observed v1 but current is v2",
          }],
        }, 422);
      }
      return jsonResponse({ ok: true, definition: OK_DEFINITION });
    }
    if (url.endsWith('/v1/challenges')) {
      return jsonResponse({
        challengeId: '33333333-3333-4333-8333-333333333333',
        groupId: GROUP_UUID,
        status: 'active',
        configVersion: 1,
        activated: true,
        creatorParticipationId: null,
        idempotentReplay: false,
      }, 201);
    }
    return jsonResponse({ error: { code: 'not_found', message: 'unexpected' } }, 404);
  });
}

async function installAuth(): Promise<void> {
  const { auth } = await import('../../../lib/firebaseAuth.js');
  Object.defineProperty(auth, 'currentUser', {
    value: { getIdToken: async () => 'runtime-test-token' },
    configurable: true,
  });
}

type TestNode = TestRenderer.ReactTestInstance;

function nodeText(node: TestNode): string {
  return node.children
    .map((child) => (typeof child === 'string' ? child : nodeText(child as TestNode)))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buttonTexts(root: TestNode): string[] {
  return root.findAllByType('button').map(nodeText);
}

function clickButton(root: TestNode, text: string): void {
  const button = root.findAllByType('button').find((candidate) => nodeText(candidate).includes(text));
  if (!button) throw new Error(`button containing '${text}' not found (have: ${buttonTexts(root).join(' | ')})`);
  (button.props as { onClick: () => void }).onClick();
}

function changeByLabel(root: TestNode, label: string, value: string): void {
  const node = root.findByProps({ 'aria-label': label });
  (node.props as { onChange: (event: { target: { value: string } }) => void })
    .onChange({ target: { value } });
}

async function renderWizard(): Promise<TestNode> {
  const { default: Wizard } = await import('./V2CreateChallengeWizard.js');
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    renderer = TestRenderer.create(
      <MemoryRouter initialEntries={['/app/challenges/v2/create?groupId=legacy-group-1']}>
        <Wizard />
      </MemoryRouter>,
    );
  });
  if (!renderer) throw new Error('renderer not created');
  return renderer.root;
}

async function advanceToReview(root: TestNode): Promise<void> {
  clickButton(root, 'Start from scratch');
  await act(async () => {});
  clickButton(root, 'Competitive');
  await act(async () => {});
  // TYPE -> BASICS
  clickButton(root, 'Continue');
  await act(async () => {});
  changeByLabel(root, 'Challenge name', 'Runtime check');
  await act(async () => {});
  // BASICS -> ACTIVITIES (catalogue loads via effect)
  clickButton(root, 'Continue');
  await act(async () => {});
  await act(async () => {});
  // Select the coded Activity; identity stored as the Activity Code.
  clickButton(root, 'Push-Up');
  await act(async () => {});
  await act(async () => {});
  // ACTIVITIES -> MEASUREMENT (options resolved for the code identity)
  clickButton(root, 'Continue');
  await act(async () => {});
  await act(async () => {});
}

describe('PF-05-CORR wizard runtime flow', () => {
  beforeEach(async () => {
    previewMode = 'ok';
    installFetch();
    await installAuth();
    vi.clearAllMocks();
  });

  it('coded Activity selection flows to Measurement with server options, then establishes', async () => {
    const root = await renderWizard();
    await advanceToReview(root);
    // Measurement shows the metric select populated from Knowledge options.
    const metricSelect = root.findByProps({ 'aria-label': 'Metric for Push-Up' });
    const metricOptions = (metricSelect.findAllByType('option') as TestNode[])
      .map((option) => option.props.value as string);
    expect(metricOptions).toContain('repetitions');
    changeByLabel(root, 'Metric for Push-Up', 'repetitions');
    await act(async () => {});
    changeByLabel(root, 'Unit for Push-Up', 'reps');
    await act(async () => {});
    // MEASUREMENT -> REQUIREMENT
    clickButton(root, 'Continue');
    await act(async () => {});
    changeByLabel(root, 'Target for Push-Up', '50');
    await act(async () => {});
    // REQUIREMENT -> SCHEDULE
    clickButton(root, 'Continue');
    await act(async () => {});
    changeByLabel(root, 'Start date', '2026-10-01');
    changeByLabel(root, 'End date', '2026-10-31');
    await act(async () => {});
    // SCHEDULE -> RULES (competitive: nothing configurable)
    clickButton(root, 'Continue');
    await act(async () => {});
    // RULES -> REVIEW (server preview runs)
    clickButton(root, 'Continue');
    await act(async () => {});
    await act(async () => {});
    expect(buttonTexts(root)).toContain('Finish & Create Challenge');
    // Review renders the real normalized definition fields.
    const reviewText = root.findAllByType('p').map((p) => p.children.join('')).join(' ');
    expect(reviewText).toContain('Runtime check');
    // Finish establishes through the V2 route with the Tiizi Group UUID
    // (translated from the legacy Group context) and the Activity Code.
    clickButton(root, 'Finish & Create Challenge');
    await act(async () => {});
    await act(async () => {});
    const posts = fetchCalls.filter((call) => call.url.endsWith('/v1/challenges'));
    expect(posts).toHaveLength(1);
    const body = JSON.parse(posts[0].init?.body as string) as Record<string, unknown>;
    expect(body.group_id).toBe(GROUP_UUID);
    const activities = body.activities as Array<Record<string, unknown>>;
    expect(activities[0].canonical_key).toBe('FIT-STR-001');
    expect(activities[0].version).toBe(2);
  });

  it('stale preview surfaces explicit refresh and options stay available', async () => {
    previewMode = 'stale';
    const root = await renderWizard();
    await advanceToReview(root);
    changeByLabel(root, 'Metric for Push-Up', 'repetitions');
    await act(async () => {});
    changeByLabel(root, 'Unit for Push-Up', 'reps');
    await act(async () => {});
    clickButton(root, 'Continue');
    await act(async () => {});
    changeByLabel(root, 'Target for Push-Up', '50');
    await act(async () => {});
    clickButton(root, 'Continue');
    await act(async () => {});
    changeByLabel(root, 'Start date', '2026-10-01');
    changeByLabel(root, 'End date', '2026-10-31');
    await act(async () => {});
    clickButton(root, 'Continue');
    await act(async () => {});
    clickButton(root, 'Continue');
    await act(async () => {});
    await act(async () => {});
    // Stale issue with an explicit refresh action (no silent upgrade).
    expect(buttonTexts(root)).toContain('Refresh activity to current version');
    expect(buttonTexts(root)).not.toContain('Finish & Create Challenge');
    clickButton(root, 'Refresh activity to current version');
    await act(async () => {});
    await act(async () => {});
    // Options remain available after refresh: back to MEASUREMENT shows
    // the server-derived metric select (same canonical cache key).
    // REVIEW -> RULES -> SCHEDULE -> REQUIREMENT -> MEASUREMENT.
    for (let step = 0; step < 4; step += 1) {
      clickButton(root, 'Back');
      await act(async () => {});
    }
    const metricSelect = root.findByProps({ 'aria-label': 'Metric for Push-Up' });
    const metricOptions = (metricSelect.findAllByType('option') as TestNode[])
      .map((option) => option.props.value as string);
    expect(metricOptions).toContain('repetitions');
    // Forward to REVIEW again; fresh preview now succeeds.
    clickButton(root, 'Continue');
    await act(async () => {});
    clickButton(root, 'Continue');
    await act(async () => {});
    clickButton(root, 'Continue');
    await act(async () => {});
    clickButton(root, 'Continue');
    await act(async () => {});
    await act(async () => {});
    previewMode = 'ok';
    clickButton(root, 'Check again');
    await act(async () => {});
    await act(async () => {});
    expect(buttonTexts(root)).toContain('Finish & Create Challenge');
  });
});
