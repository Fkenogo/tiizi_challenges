import type { Db } from './db.js';

export interface OperatorConsoleReaderAuthority {
  canReadOperatorConsole(memberId: string): Promise<boolean>;
}

/** Explicit, revocable, read-only Console authority. Cause decisions use their separate roster. */
export function createPostgresOperatorConsoleReaderAuthority(db: Db): OperatorConsoleReaderAuthority {
  return {
    async canReadOperatorConsole(memberId: string): Promise<boolean> {
      const result = await db.query<{ authorized: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM platform_operator_console_readers
           WHERE member_id=$1 AND revoked_at IS NULL
         ) AS authorized`,
        [memberId],
      );
      return result.rows[0]?.authorized === true;
    },
  };
}
