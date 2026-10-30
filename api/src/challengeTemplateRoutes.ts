/**
 * TIIZI-FER-P5T-1-001 — Template HTTP boundary.
 *
 * Operator (`/api/operator/templates/*`):
 *   writes   → explicit Template-author roster only (Console read access is
 *              NOT enough); the database re-asserts the roster on every write.
 *   reads    → Template authors or Console readers (audit, adoption, library).
 * Member (`/api/challenge-templates/*`): authenticated, published, non-retired,
 *   adoptable versions only. Nothing here creates a Challenge, a membership or
 *   a participation, and nothing here counts an adoption.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { apiPath } from './apiPrefix.js';
import { authenticatedMember } from './auth.js';
import type { Db } from './db.js';
import { createPostgresOperatorConsoleReaderAuthority } from './operatorConsoleAuthority.js';
import { createPostgresTemplateAuthorAuthority } from './templateAuthorAuthority.js';
import {
  TemplateError,
  createTemplateDraft,
  getMemberTemplate,
  getOperatorTemplate,
  isTemplateUuid,
  listMemberTemplates,
  listOperatorTemplates,
  listTemplateAdoption,
  listTemplateAudit,
  normalizeTemplateContent,
  pageLimit,
  REVISION_TOKEN_PATTERN,
  publishTemplateVersion,
  retireTemplate,
  reviseTemplate,
  updateTemplateDraft,
  validateTemplateVersion,
} from './challengeTemplates.js';

function query(request: FastifyRequest, key: string): string | undefined {
  const value = (request.query as Record<string, unknown> | undefined)?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function templateIdParam(request: FastifyRequest): string {
  const { templateId } = request.params as { templateId: string };
  if (!isTemplateUuid(templateId)) throw new TemplateError(400, 'invalid_template_id', 'Template id must be a UUID');
  return templateId;
}

function versionParam(request: FastifyRequest): number {
  const { version } = request.params as { version: string };
  const parsed = Number(version);
  if (!/^\d{1,9}$/.test(version) || parsed < 1) throw new TemplateError(400, 'invalid_template_version', 'version must be an integer >= 1');
  return parsed;
}

/**
 * `If-Match: "<revisionToken>"` is REQUIRED to save a draft. Absent: 428.
 * Present but not a single strong quoted token (including `*` and weak
 * validators): 400, so a wildcard can never defeat the lost-update guard.
 */
function ifMatchToken(request: FastifyRequest): string {
  const raw = request.headers['if-match'];
  if (raw === undefined) {
    throw new TemplateError(428, 'precondition_required', 'If-Match with the draft revisionToken is required to save a Template draft');
  }
  const value = (Array.isArray(raw) ? raw.join(',') : raw).trim();
  const match = /^"([0-9a-f]{64})"$/.exec(value);
  if (!match || !REVISION_TOKEN_PATTERN.test(match[1])) {
    throw new TemplateError(400, 'invalid_precondition', 'If-Match must be a single quoted revisionToken');
  }
  return match[1];
}

/** Backstop for database-boundary refusals (roster/immutability triggers). */
function mapDatabaseError(error: unknown): never {
  if (error instanceof TemplateError) throw error;
  const code = (error as { code?: string })?.code;
  const message = (error as Error)?.message ?? '';
  if (code === '42501' || message.includes('template_author_required')) {
    throw new TemplateError(403, 'template_author_required', 'Template authoring authority is required');
  }
  if (message.includes('template_version_immutable') || message.includes('template_retired') || message.includes('template_immutable')) {
    throw new TemplateError(409, 'template_immutable', 'The Template version cannot be changed');
  }
  if (code === '23505') {
    throw new TemplateError(409, 'template_conflict', 'Template state conflicts with a concurrent change');
  }
  throw error;
}

export function registerChallengeTemplateRoutes(app: FastifyInstance, db: Db): void {
  const authors = createPostgresTemplateAuthorAuthority(db);
  const readers = createPostgresOperatorConsoleReaderAuthority(db);

  async function requireAuthor(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
    const member = authenticatedMember(request);
    if (await authors.canAuthorTemplates(member.memberId)) return member.memberId;
    reply.code(403).send({ error: { code: 'template_author_required', message: 'Template authoring authority is required' } });
    return null;
  }

  async function requireOperatorRead(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
    const member = authenticatedMember(request);
    if (await authors.canAuthorTemplates(member.memberId) || await readers.canReadOperatorConsole(member.memberId)) {
      return member.memberId;
    }
    reply.code(403).send({ error: { code: 'operator_console_access_required', message: 'Platform Operator Console access required' } });
    return null;
  }

  async function guarded<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      mapDatabaseError(error);
    }
  }

  /* ---------------- Operator writes ---------------- */

  app.post(apiPath('/operator/templates'), async (request, reply) => {
    const actor = await requireAuthor(request, reply);
    if (!actor) return;
    const content = normalizeTemplateContent(request.body ?? {});
    const created = await guarded(() => createTemplateDraft(db, actor, content));
    return reply.code(201).send(created);
  });

  app.put(apiPath('/operator/templates/:templateId/versions/:version'), async (request, reply) => {
    const actor = await requireAuthor(request, reply);
    if (!actor) return;
    const templateId = templateIdParam(request);
    const version = versionParam(request);
    const expectedToken = ifMatchToken(request);
    const content = normalizeTemplateContent(request.body ?? {});
    const saved = await guarded(() => updateTemplateDraft(db, actor, templateId, version, content, expectedToken));
    return reply.code(200).send({ templateId, version, revisionToken: saved.revisionToken });
  });

  app.post(apiPath('/operator/templates/:templateId/versions/:version/validate'), async (request, reply) => {
    const actor = await requireAuthor(request, reply);
    if (!actor) return;
    const result = await guarded(() => validateTemplateVersion(db, templateIdParam(request), versionParam(request)));
    return reply.code(200).send(result);
  });

  app.post(apiPath('/operator/templates/:templateId/versions/:version/publish'), async (request, reply) => {
    const actor = await requireAuthor(request, reply);
    if (!actor) return;
    const published = await guarded(() => publishTemplateVersion(db, actor, templateIdParam(request), versionParam(request)));
    return reply.code(200).send(published);
  });

  app.post(apiPath('/operator/templates/:templateId/revisions'), async (request, reply) => {
    const actor = await requireAuthor(request, reply);
    if (!actor) return;
    const revised = await guarded(() => reviseTemplate(db, actor, templateIdParam(request)));
    return reply.code(201).send(revised);
  });

  app.post(apiPath('/operator/templates/:templateId/retire'), async (request, reply) => {
    const actor = await requireAuthor(request, reply);
    if (!actor) return;
    const body = (request.body ?? {}) as Record<string, unknown>;
    for (const key of Object.keys(body)) {
      if (key !== 'reason') throw new TemplateError(400, 'invalid_template_request', `field '${key}' is not accepted`);
    }
    const reason = body.reason === undefined ? null : body.reason;
    if (reason !== null && (typeof reason !== 'string' || reason.trim().length === 0 || reason.length > 500)) {
      throw new TemplateError(400, 'invalid_template_request', 'reason must be 1..500 characters when present');
    }
    const templateId = templateIdParam(request);
    await guarded(() => retireTemplate(db, actor, templateId, reason === null ? null : (reason as string).trim()));
    return reply.code(200).send({ templateId, lifecycle: 'retired' });
  });

  /* ---------------- Operator reads ---------------- */

  app.get(apiPath('/operator/templates'), async (request, reply) => {
    if (!await requireOperatorRead(request, reply)) return;
    const result = await guarded(() => listOperatorTemplates(db, {
      q: query(request, 'q'), type: query(request, 'type'), activity: query(request, 'activity'),
      tag: query(request, 'tag'), lifecycle: query(request, 'lifecycle'),
    }, pageLimit(query(request, 'limit')), query(request, 'cursor')));
    return reply.code(200).send(result);
  });

  // Static segments: registered before the :templateId parameter route.
  /**
   * Caller-scoped, read-only. Reports only the AUTHENTICATED caller's own
   * effective standing (existing roster / Console-reader authority); grants
   * nothing and reveals nothing about anyone else.
   */
  app.get(apiPath('/operator/templates/capabilities'), async (request, reply) => {
    const member = authenticatedMember(request);
    const canAuthor = await authors.canAuthorTemplates(member.memberId);
    const canRead = canAuthor || await readers.canReadOperatorConsole(member.memberId);
    return reply.code(200).send({ canAuthor, canRead });
  });

  app.get(apiPath('/operator/templates/adoption'), async (request, reply) => {
    if (!await requireOperatorRead(request, reply)) return;
    const templateId = query(request, 'templateId') ?? null;
    if (templateId !== null && !isTemplateUuid(templateId)) {
      throw new TemplateError(400, 'invalid_template_id', 'templateId must be a UUID');
    }
    const result = await guarded(() => listTemplateAdoption(db, templateId, pageLimit(query(request, 'limit')), query(request, 'cursor')));
    return reply.code(200).send(result);
  });

  app.get(apiPath('/operator/templates/:templateId'), async (request, reply) => {
    if (!await requireOperatorRead(request, reply)) return;
    return reply.code(200).send(await guarded(() => getOperatorTemplate(db, templateIdParam(request))));
  });

  app.get(apiPath('/operator/templates/:templateId/audit'), async (request, reply) => {
    if (!await requireOperatorRead(request, reply)) return;
    const result = await guarded(() => listTemplateAudit(db, templateIdParam(request), pageLimit(query(request, 'limit')), query(request, 'cursor')));
    return reply.code(200).send(result);
  });

  /* ---------------- Member published reads ---------------- */

  app.get(apiPath('/challenge-templates'), async (request, reply) => {
    authenticatedMember(request);
    const result = await guarded(() => listMemberTemplates(db, {
      q: query(request, 'q'), type: query(request, 'type'), activity: query(request, 'activity'), tag: query(request, 'tag'),
    }, pageLimit(query(request, 'limit')), query(request, 'cursor')));
    return reply.code(200).send(result);
  });

  app.get(apiPath('/challenge-templates/:templateId'), async (request, reply) => {
    authenticatedMember(request);
    return reply.code(200).send(await guarded(() => getMemberTemplate(db, templateIdParam(request))));
  });

  app.get(apiPath('/challenge-templates/:templateId/versions/:version'), async (request, reply) => {
    authenticatedMember(request);
    return reply.code(200).send(await guarded(() => getMemberTemplate(db, templateIdParam(request), versionParam(request))));
  });
}
