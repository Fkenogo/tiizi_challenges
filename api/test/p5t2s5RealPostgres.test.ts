/**
 * TIIZI-FER-P5T-2-S5A-001 — REAL PostgreSQL concurrency for publish, revise and retire.
 *
 * PGlite serializes transactions on one connection, so it cannot express a
 * roster revocation racing a write. This suite uses independent pooled
 * connections against a DISPOSABLE cluster and is skipped unless explicitly
 * pointed at one:
 *
 *   TIIZI_REAL_PG_URL=postgres://postgres@127.0.0.1:5549/tiizi_p5_preview_s5a \
 *   TIIZI_REAL_PG_DB=tiizi_p5_preview_s5a \
 *   TIIZI_DISPOSABLE_DB_HOST=127.0.0.1 TIIZI_DISPOSABLE_DB_PORT=5549 \
 *   npx vitest run test/p5t2s5RealPostgres.test.ts
 *
 * The target must pass the disposable-database guard (`disposableDbGuard.ts`):
 * explicit allowed host/port/name, an IP-literal host, a port other than 5432,
 * the disposable database name and the `tiizi-disposable-preview:*` database
 * comment, all checked before any mutation. It is never run in CI and never
 * against a shared, persistent or production database.
 *
 * DETERMINISM. Every interleaving below is coordinated on OBSERVED DATABASE
 * STATE — a lock wait visible in `pg_locks`/`pg_stat_activity`, a committed
 * row, an audit row — never on elapsed time. The single `setTimeout` below is
 * a polling interval for a state predicate; the deadline that bounds it is a
 * failure bound, never an assertion. No assertion in this file says "this must
 * happen within N ms".
 *
 * The discriminator. Before the in-transaction roster lock existed, the only
 * roster re-assertion on these paths was a NON-LOCKING trigger read, so a
 * write could not be held back by an open revocation: it would simply carry
 * on and commit. Interleaving 2 observes the write BLOCKED on the roster row
 * lock, which is only possible with the locking assertion, and then observes
 * the write refused once the revocation commits.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db.js';
import { createPool } from '../src/db.js';
import { disposableTargetSpecFromEnv, openGuardedDisposableDb } from '../src/disposableDbGuard.js';
import { runMigrations } from '../src/migrate.js';
import {
  createTemplateDraft,
  getOperatorTemplate,
  normalizeTemplateContent,
  publishTemplateVersion,
  retireTemplate,
  reviseTemplate,
  updateTemplateDraft,
} from '../src/challengeTemplates.js';
import {
  createKnowledgeItem,
  setKnowledgeLifecycle,
  setLoadReportingBases,
  setMeasurementCompatibility,
  type CreateKnowledgeInput,
} from '../src/knowledge.js';

const url = process.env.TIIZI_REAL_PG_URL;
const target = process.env.TIIZI_REAL_PG_DB;

/** The governed Activity code of the publishable fixture. */
const ACTIVITY_CODE = 'FIT-RPG-001';

/** A published, Challenge-ready Activity, so publish-time validation can pass. */
function knowledgeContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: 'fitness',
    name: 'S5a Real-PG Push-Up',
    category: 'Strength',
    subcategory: 'Push',
    difficulty: 'Intermediate',
    description: 'A governed movement used by the S5a real-PostgreSQL concurrency suite.',
    metricUnit: 'reps',
    contentClasses: ['U', 'Q', 'T'],
    measurementGuidance: 'Count each full controlled repetition.',
    unitSemantics: 'One repetition equals one complete down-and-up cycle.',
    setup: 'Adopt a stable start position.',
    execution: 'Move through the full range with control.',
    formCues: ['Keep a straight line'],
    adaptation: 'Reduce the range of motion to regress.',
    safetyNotes: ['Stop on sharp pain'],
    ...overrides,
  };
}

describe.skipIf(!url || !target)('P5T-2 S5a real PostgreSQL concurrency (disposable cluster only)', () => {
  let db: Db;
  let activityId = '';
  let activityVersion = 0;
  let counter = 0;

  beforeAll(async () => {
    const spec = { ...disposableTargetSpecFromEnv(url), databaseName: target };
    ({ db } = await openGuardedDisposableDb(spec, (u) => createPool(u, { max: 12 })));
    await runMigrations(db);
    await db.query('TRUNCATE challenge_templates, platform_operator_template_authors, members CASCADE');

    // The Activity fixture is REUSED when a previous run already created it,
    // so the suite is re-runnable against the same disposable database. The
    // fixture truncation above deliberately does not touch the Knowledge
    // catalogue.
    const existing = await db.query<{ knowledge_id: string; current_version: number }>(
      `SELECT knowledge_id, current_version FROM knowledge_items WHERE activity_code = $1`,
      [ACTIVITY_CODE],
    );
    if (existing.rows.length > 0) {
      activityId = String(existing.rows[0].knowledge_id);
      activityVersion = Number(existing.rows[0].current_version);
    } else {
      const created = await createKnowledgeItem(db, knowledgeContent({
        activityCode: ACTIVITY_CODE, name: 'S5a Real-PG Push-Up', metricUnit: 'reps',
      }) as CreateKnowledgeInput);
      await setMeasurementCompatibility(db, created.id, { primaryMetrics: ['repetitions'], secondaryMetrics: [], compatibleUnits: ['reps'] });
      await setLoadReportingBases(db, created.id, []);
      await setKnowledgeLifecycle(db, created.id, 'published');
      const fresh = await db.query<{ current_version: number }>(
        `SELECT current_version FROM knowledge_items WHERE knowledge_id = $1`,
        [created.id],
      );
      activityId = String(created.id);
      activityVersion = Number(fresh.rows[0].current_version);
    }
  });
  afterAll(async () => { if (db) await db.close(); });

  /* ---------------- fixtures ---------------- */

  const body = (title: string) => normalizeTemplateContent({
    summary: 'S5a concurrency fixture',
    durationDays: 14,
    composer: {
      title,
      challengeType: 'competitive',
      activities: [{ activity: activityId, observedVersion: activityVersion, metric: 'repetitions', unit: 'reps', targetValue: 100 }],
    },
  });

  async function seedAuthor(tag: string): Promise<string> {
    counter += 1;
    const member = await db.query<{ member_id: string }>(
      `INSERT INTO members (auth_provider, auth_subject) VALUES ('firebase', $1) RETURNING member_id`,
      [`pg-s5a-${tag}-${counter}-${Date.now()}`],
    );
    const id = String(member.rows[0].member_id);
    await db.query(`INSERT INTO platform_operator_template_authors (member_id, grant_reference) VALUES ($1, 'S5a real-PG disposable grant')`, [id]);
    return id;
  }

  async function freshDraft(author: string, title = 'Reviewed content') {
    const { templateId } = await createTemplateDraft(db, author, body(title));
    const detail = await getOperatorTemplate(db, templateId);
    return { templateId, token: String(detail.versions[0].revisionToken) };
  }

  async function freshPublished(author: string, title = 'Reviewed content') {
    const { templateId } = await createTemplateDraft(db, author, body(title));
    await publishTemplateVersion(db, author, templateId, 1);
    return { templateId };
  }

  const auditCount = async (templateId: string, action: string) =>
    Number((await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM challenge_template_audit_events WHERE template_id = $1 AND action = $2`,
      [templateId, action],
    )).rows[0].n);

  const versionState = async (templateId: string, version: number) =>
    String((await db.query<{ state: string }>(
      `SELECT state FROM challenge_template_versions WHERE template_id = $1 AND version = $2`,
      [templateId, version],
    )).rows[0].state);

  const versionCount = async (templateId: string) =>
    Number((await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM challenge_template_versions WHERE template_id = $1`,
      [templateId],
    )).rows[0].n);

  const lifecycleOf = async (templateId: string) =>
    String((await db.query<{ lifecycle: string }>(
      `SELECT lifecycle FROM challenge_templates WHERE template_id = $1`,
      [templateId],
    )).rows[0].lifecycle);

  const titleOf = async (templateId: string, version = 1) =>
    String((await db.query<{ title: string }>(
      `SELECT title FROM challenge_template_versions WHERE template_id = $1 AND version = $2`,
      [templateId, version],
    )).rows[0].title);

  const revokedAt = async (memberId: string) =>
    (await db.query<{ revoked_at: Date | null }>(
      `SELECT revoked_at FROM platform_operator_template_authors WHERE member_id = $1`,
      [memberId],
    )).rows[0].revoked_at;

  /** Run a write that must be refused and hand back the refusal. */
  async function failure(work: () => Promise<unknown>): Promise<{ code?: string; details?: { current?: { revisionToken?: string } } }> {
    try {
      await work();
    } catch (error) {
      return error as { code?: string };
    }
    throw new Error('the write was expected to be refused but it succeeded');
  }

  /** A deadlock or serialization failure is never an acceptable outcome. */
  function expectNoDatabaseFailure(error: unknown): void {
    const code = (error as { code?: string })?.code;
    expect(['40P01', '40001'], `unexpected database failure ${code}`).not.toContain(code);
  }

  /* ---------------- coordination ---------------- */

  /**
   * Commit the revocation. The roster UPDATE takes a FOR NO KEY UPDATE row
   * lock, which conflicts with the FOR SHARE the write path takes on the same
   * row, so the write cannot pass the roster assertion until this commits.
   */
  async function revoke(memberId: string, reference = 'S5a revocation'): Promise<void> {
    await db.query(
      `UPDATE platform_operator_template_authors SET revoked_at = now(), revoked_reference = $2 WHERE member_id = $1`,
      [memberId, reference],
    );
  }

  interface HeldRevocation {
    /** Release the held revocation so its transaction commits. */
    commit: () => void;
    /** Resolves once the revocation transaction has committed. */
    finished: Promise<void>;
  }

  /**
   * Open a revocation and HOLD it uncommitted on its own pooled connection.
   * The returned promise resolves only once the roster row lock is actually
   * held, so the caller can start the write knowing the lock is in place.
   */
  async function holdRevocationOpen(memberId: string): Promise<HeldRevocation> {
    let signalHeld!: () => void;
    const held = new Promise<void>((resolve) => { signalHeld = resolve; });
    let release!: () => void;
    const released = new Promise<void>((resolve) => { release = resolve; });
    const finished = db.transaction(async (tx) => {
      await tx.query(
        `UPDATE platform_operator_template_authors SET revoked_at = now(), revoked_reference = 'S5a held revocation' WHERE member_id = $1`,
        [memberId],
      );
      signalHeld(); // the roster row lock is held from here until COMMIT
      await released;
    });
    await held;
    return { commit: release, finished };
  }

  /**
   * Wait until a backend is genuinely blocked on the roster row lock.
   *
   * This observes DATABASE STATE, not elapsed time: it looks for a lock wait
   * the server itself reports. The deadline is a failure bound, so a writer
   * that never blocks fails the test instead of hanging.
   */
  async function waitForBlockedRosterLock(timeoutMs = 30_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const waiting = await db.query<{ pid: number }>(
        `SELECT a.pid
           FROM pg_stat_activity a
          WHERE a.wait_event_type = 'Lock'
            AND a.query ILIKE '%platform_operator_template_authors%'
         UNION
         SELECT l.pid
           FROM pg_locks l
           JOIN pg_class c ON c.oid = l.relation
          WHERE NOT l.granted
            AND c.relname = 'platform_operator_template_authors'`,
      );
      if (waiting.rows.length > 0) return;
      if (Date.now() >= deadline) throw new Error('the writer never blocked on the roster row lock');
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  /* ---------------- the four interleavings ---------------- */

  it('interleaving 1 — a revocation committed BEFORE the write refuses publish, revise and retire', async () => {
    // Publish.
    {
      const racer = await seedAuthor('first-publish');
      const { templateId } = await freshDraft(racer);
      await revoke(racer);
      const error = await failure(() => publishTemplateVersion(db, racer, templateId, 1));
      expect(error.code).toBe('template_author_required');
      expect(await versionState(templateId, 1)).toBe('draft');
      expect(await lifecycleOf(templateId)).toBe('draft');
      expect(await auditCount(templateId, 'publish')).toBe(0);
    }

    // Revise.
    {
      const racer = await seedAuthor('first-revise');
      const { templateId } = await freshPublished(racer);
      await revoke(racer);
      const error = await failure(() => reviseTemplate(db, racer, templateId));
      expect(error.code).toBe('template_author_required');
      expect(await versionCount(templateId)).toBe(1); // no new draft version
      expect(await auditCount(templateId, 'revise')).toBe(0);
    }

    // Retire.
    {
      const racer = await seedAuthor('first-retire');
      const { templateId } = await freshDraft(racer);
      await revoke(racer);
      const error = await failure(() => retireTemplate(db, racer, templateId, 'refused before the write'));
      expect(error.code).toBe('template_author_required');
      expect(await lifecycleOf(templateId)).toBe('draft');
      expect(await auditCount(templateId, 'retire')).toBe(0);
    }
  }, 120_000);

  it('interleaving 2 — a revocation HELD OPEN across the write refuses publish, revise and retire', async () => {
    // Publish: the write must BLOCK on the roster lock, then be refused.
    {
      const racer = await seedAuthor('held-publish');
      const { templateId } = await freshDraft(racer);
      const held = await holdRevocationOpen(racer);
      const write = publishTemplateVersion(db, racer, templateId, 1).then(() => null, (error: unknown) => error);
      await waitForBlockedRosterLock();
      held.commit();
      await held.finished;
      const error = await write;
      expect((error as { code?: string })?.code).toBe('template_author_required');
      expect(await versionState(templateId, 1)).toBe('draft');
      expect(await lifecycleOf(templateId)).toBe('draft');
      expect(await auditCount(templateId, 'publish')).toBe(0);
    }

    // Revise.
    {
      const racer = await seedAuthor('held-revise');
      const { templateId } = await freshPublished(racer);
      const held = await holdRevocationOpen(racer);
      const write = reviseTemplate(db, racer, templateId).then(() => null, (error: unknown) => error);
      await waitForBlockedRosterLock();
      held.commit();
      await held.finished;
      const error = await write;
      expect((error as { code?: string })?.code).toBe('template_author_required');
      expect(await versionCount(templateId)).toBe(1);
      expect(await auditCount(templateId, 'revise')).toBe(0);
    }

    // Retire.
    {
      const racer = await seedAuthor('held-retire');
      const { templateId } = await freshDraft(racer);
      const held = await holdRevocationOpen(racer);
      const write = retireTemplate(db, racer, templateId, 'refused while held').then(() => null, (error: unknown) => error);
      await waitForBlockedRosterLock();
      held.commit();
      await held.finished;
      const error = await write;
      expect((error as { code?: string })?.code).toBe('template_author_required');
      expect(await lifecycleOf(templateId)).toBe('draft');
      expect(await auditCount(templateId, 'retire')).toBe(0);
    }
  }, 120_000);

  it('interleaving 3 — a write that commits BEFORE the revocation keeps its effect, with no deadlock', async () => {
    // Publish.
    {
      const racer = await seedAuthor('write-first-publish');
      const { templateId } = await freshDraft(racer);
      const published = await publishTemplateVersion(db, racer, templateId, 1);
      expect(published.templateId).toBe(templateId);
      await revoke(racer);
      expect(await versionState(templateId, 1)).toBe('published');
      expect(await auditCount(templateId, 'publish')).toBe(1);
      expect(await revokedAt(racer)).not.toBeNull();
    }

    // Revise.
    {
      const racer = await seedAuthor('write-first-revise');
      const { templateId } = await freshPublished(racer);
      const revised = await reviseTemplate(db, racer, templateId);
      expect(revised.version).toBe(2);
      await revoke(racer);
      expect(await versionCount(templateId)).toBe(2);
      expect(await auditCount(templateId, 'revise')).toBe(1);
    }

    // Retire.
    {
      const racer = await seedAuthor('write-first-retire');
      const { templateId } = await freshDraft(racer);
      await retireTemplate(db, racer, templateId, 'retired first');
      await revoke(racer);
      expect(await lifecycleOf(templateId)).toBe('retired');
      expect(await auditCount(templateId, 'retire')).toBe(1);
    }
  }, 120_000);

  it('interleaving 3b — a write racing a revocation either commits before it or is refused, never both', async () => {
    for (const path of ['publish', 'revise', 'retire'] as const) {
      const racer = await seedAuthor(`racing-${path}`);
      const { templateId } = path === 'revise' ? await freshPublished(racer) : await freshDraft(racer);
      const write = path === 'publish'
        ? publishTemplateVersion(db, racer, templateId, 1)
        : path === 'revise'
          ? reviseTemplate(db, racer, templateId)
          : retireTemplate(db, racer, templateId, 'raced');
      const [result] = await Promise.allSettled([write, revoke(racer)]);
      if (result.status === 'rejected') {
        const error = result.reason as { code?: string };
        expectNoDatabaseFailure(error);
        expect(error.code).toBe('template_author_required');
        // Nothing was written.
        if (path === 'publish') {
          expect(await versionState(templateId, 1)).toBe('draft');
          expect(await auditCount(templateId, 'publish')).toBe(0);
        }
        if (path === 'revise') {
          expect(await versionCount(templateId)).toBe(1);
          expect(await auditCount(templateId, 'revise')).toBe(0);
        }
        if (path === 'retire') {
          expect(await lifecycleOf(templateId)).toBe('draft');
          expect(await auditCount(templateId, 'retire')).toBe(0);
        }
      } else {
        // The write committed first and the revocation ordered after it.
        if (path === 'publish') expect(await versionState(templateId, 1)).toBe('published');
        if (path === 'revise') expect(await versionCount(templateId)).toBe(2);
        if (path === 'retire') expect(await lifecycleOf(templateId)).toBe('retired');
      }
      expect(await revokedAt(racer)).not.toBeNull();
    }
  }, 120_000);

  it('interleaving 4 — a publish carrying a stale token loses to a concurrent save, and unreviewed content is never published', async () => {
    // The save has committed: the publish still carries the pre-save token.
    {
      const author = await seedAuthor('stale-publish');
      const saver = await seedAuthor('stale-save');
      const { templateId, token } = await freshDraft(author, 'Reviewed content');
      const saved = await updateTemplateDraft(db, saver, templateId, 1, body('Unreviewed content'), token);
      expect(saved.revisionToken).not.toBe(token);
      const error = await failure(() => publishTemplateVersion(db, author, templateId, 1, token));
      expect(error.code).toBe('template_draft_changed');
      expect(error.details?.current?.revisionToken).toBe(saved.revisionToken);
      expect(await versionState(templateId, 1)).toBe('draft');
      expect(await auditCount(templateId, 'publish')).toBe(0);
      expect(await titleOf(templateId, 1)).toBe('Unreviewed content');
    }

    // Genuinely concurrent: whichever order the database chooses, exactly one
    // write wins, and what is published is always the REVIEWED content.
    {
      const author = await seedAuthor('race-publish');
      const saver = await seedAuthor('race-save');
      const { templateId, token } = await freshDraft(author, 'Reviewed content');
      const results = await Promise.allSettled([
        publishTemplateVersion(db, author, templateId, 1, token),
        updateTemplateDraft(db, saver, templateId, 1, body('Unreviewed content'), token),
      ]);
      for (const result of results) {
        if (result.status === 'rejected') {
          const error = result.reason as { code?: string };
          expectNoDatabaseFailure(error);
          expect(['template_draft_changed', 'template_version_immutable']).toContain(error.code);
        }
      }
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      if (await versionState(templateId, 1) === 'published') {
        // The publish won: the content that was published is the reviewed one.
        expect(await titleOf(templateId, 1)).toBe('Reviewed content');
        expect(await auditCount(templateId, 'publish')).toBe(1);
      } else {
        // The save won: the publish was refused and nothing was published.
        expect(await auditCount(templateId, 'publish')).toBe(0);
        expect(await titleOf(templateId, 1)).toBe('Unreviewed content');
      }
    }
  }, 120_000);
});
