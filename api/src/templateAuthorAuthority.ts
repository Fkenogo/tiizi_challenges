import type { Db } from './db.js';

export interface TemplateAuthorAuthority {
  canAuthorTemplates(memberId: string): Promise<boolean>;
}

/**
 * Explicit, revocable Template-author authority (migration 030). Console
 * read access and Cause-review grants are separate rosters and never confer
 * Template authorship. The database re-asserts the same roster on every
 * Template write (assert_active_template_author), so this check is not the
 * only enforcement point.
 */
export function createPostgresTemplateAuthorAuthority(db: Db): TemplateAuthorAuthority {
  return {
    async canAuthorTemplates(memberId: string): Promise<boolean> {
      const result = await db.query<{ authorized: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM platform_operator_template_authors
           WHERE member_id=$1 AND revoked_at IS NULL
         ) AS authorized`,
        [memberId],
      );
      return result.rows[0]?.authorized === true;
    },
  };
}
