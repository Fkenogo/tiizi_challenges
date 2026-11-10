import { describe, expect, it } from 'vitest';
import { handleFounderTemplateRequest } from './previewFounderTemplates';
import { apiPath } from '../../api/src/apiPrefix';

describe('Founder Preview member Template fixtures', () => {
  it('serves only the two local read-only templates needed by this preview', async () => {
    const response = handleFounderTemplateRequest('GET', apiPath('/challenge-templates'));
    expect(response?.status).toBe(200);
    const body = await response?.json() as { templates: Array<{ title: string; composer: { activities: Array<{ activity: string }> } }> };
    expect(body.templates.map((template) => template.title)).toEqual([
      '30-Day Push-Up Together Challenge',
      '7-Day Breathing Practice Streak',
    ]);
    expect(body.templates[0].composer.activities[0].activity).toBe('11111111-1111-4111-8111-111111111111');
    expect(body.templates[1].composer.activities[0].activity).toBe('22222222-2222-4222-8222-222222222222');
    expect(response?.headers.get('X-Tiizi-Preview-Simulated')).toBe('member-template-publication');
  });

  it('rejects writes and leaves unrelated API requests to the real local API', () => {
    expect(handleFounderTemplateRequest('POST', apiPath('/challenge-templates'))?.status).toBe(405);
    expect(handleFounderTemplateRequest('GET', apiPath('/members/bootstrap'))).toBeNull();
  });
});
