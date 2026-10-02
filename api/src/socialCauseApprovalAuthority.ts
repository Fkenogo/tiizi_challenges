import type { Db } from './db.js';
import type { SocialCauseApprovalDeps } from './socialCauseApprovalRoutes.js';

/** Narrow, explicit Platform Operator capability used only for Cause review. */
export function createPostgresSocialCauseReviewerAuthority(db: Db): SocialCauseApprovalDeps {
  return {
    async isPlatformOperator(memberId: string): Promise<boolean> {
      const result = await db.query<{ permitted: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM platform_operator_cause_reviewers
           WHERE member_id=$1 AND revoked_at IS NULL
         ) AS permitted`,
        [memberId],
      );
      return result.rows[0]?.permitted === true;
    },
  };
}
