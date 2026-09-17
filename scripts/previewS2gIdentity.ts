/**
 * TIIZI S2-G — local Founder preview identity link (development only).
 *
 * Prepares ONLY the legitimate infrastructure the S2-G preview needs, and
 * deliberately manufactures NO product state:
 *
 *   A. resolves the deterministic Auth-emulator preview account
 *      (`founder1@tiizi.local`, created by `npm run preview:v2-auth:reset`);
 *   B. links it to a PostgreSQL `members` row (auth_provider 'firebase',
 *      auth_subject = the account's current emulator UID).
 *
 * It does NOT create a Group, a group membership, or any Firestore document.
 * The Group must be created by the Founder through `/v2/groups`, which
 * establishes the creator's Accountable Stewardship through the governed
 * authority. This removes the previous preview-only Group/membership
 * manufacture (S2-ORDER-CORR-001).
 *
 * Loopback-only, refuses NODE_ENV=production, idempotent, never touches
 * production Auth/Firestore/PostgreSQL.
 */
import 'dotenv/config';
import { createPool, databaseUrl } from '../api/src/db.js';
import {
  listPreviewAccounts,
  resolveEmulatorTarget,
  resolveProjectId,
  V2_PREVIEW_EMAIL,
} from './previewV2Auth.js';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing: the S2-G preview identity link must not run with NODE_ENV=production.');
  }
  const projectId = resolveProjectId({ cliProject: arg('--project') });
  const target = resolveEmulatorTarget({});

  const accounts = await listPreviewAccounts({ projectId, target });
  const account = accounts.find((candidate) => candidate.email === V2_PREVIEW_EMAIL);
  if (!account) {
    throw new Error(
      `Preview account ${V2_PREVIEW_EMAIL} was not found in the Auth emulator. Run \`npm run preview:v2-auth:reset\` first.`,
    );
  }

  const db = createPool(databaseUrl(), { max: 2 });
  try {
    const existing = await db.query<{ member_id: string }>(
      `SELECT member_id FROM members WHERE auth_provider = 'firebase' AND auth_subject = $1`,
      [account.uid],
    );
    const memberId = existing.rows[0]?.member_id
      ?? String(
        (await db.query<{ member_id: string }>(
          `INSERT INTO members (auth_provider, auth_subject) VALUES ('firebase', $1) RETURNING member_id`,
          [account.uid],
        )).rows[0].member_id,
      );

    // Deliberately NO Group or membership is created here.
    const groups = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM group_memberships
       WHERE member_id = $1 AND status IN ('joined', 'active')`,
      [memberId],
    );

    console.log('\nS2-G local Founder preview identity ready (local emulators only).');
    console.log(`  project        : ${projectId}`);
    console.log(`  auth emulator  : ${target.url}`);
    console.log(`  preview member : ${account.email} (uid ${account.uid})`);
    console.log(`  member uuid    : ${memberId}`);
    console.log(`  current Groups : ${groups.rows[0]?.count ?? '0'} (nothing was created for you)`);
    console.log('\nNo Group was seeded. Create one through the V2 journey at /v2/groups.\n');
  } finally {
    await db.close();
  }
}

void main().catch((error) => {
  console.error(`S2-G preview identity link failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
