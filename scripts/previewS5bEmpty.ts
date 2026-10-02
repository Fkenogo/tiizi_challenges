/**
 * S5b Today experience — Development NEW-MEMBER (empty Today) preview identity.
 *
 * Run: `npm run preview:s5b:empty`
 *
 * Purpose: ensure a legitimate LOCAL Development member with NO Challenge
 * participation, NO Today requirements, NO upcoming content and NO finalized
 * results, so the Founder can review the real product zero state
 * ("Nothing needs you today") alongside the populated Amara preview.
 *
 * Nothing is fabricated: the script creates ONLY the Auth identity and the
 * internal member row. It creates no Group, no Challenge, no participation
 * and no activity application, so `GET /api/today` for this member is the
 * server's own honest empty projection.
 *
 * Safety:
 * - refuses to run unless NODE_ENV is unset or 'development';
 * - refuses any non-loopback PostgreSQL host;
 * - refuses any non-loopback Auth emulator target;
 * - creates/updates exactly one preview identity and never prints a secret;
 * - idempotent: re-running reuses the same identity and member row.
 *
 * This does NOT replace the populated `preview:s5b:seed` Amara scenario; the
 * two identities coexist so both states stay reviewable.
 */
import 'dotenv/config';
import { config } from 'dotenv';
import { createPool, databaseUrl } from '../api/src/db.js';

config({ path: 'api/.env', override: false });

const PREVIEW_EMAIL = 'newmember@tiizi.local';

function assertLocalOnly(): string {
  if (process.env.NODE_ENV && process.env.NODE_ENV !== 'development') {
    throw new Error('Refusing to seed the local S5b empty preview outside NODE_ENV=development.');
  }
  const url = new URL(databaseUrl());
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new Error('S5b empty preview requires a loopback PostgreSQL host.');
  }
  return url.toString();
}

const AUTH_EMULATOR = 'http://127.0.0.1:9099';
const PREVIEW_PASSWORD = process.env.TIIZI_S5B_EMPTY_PREVIEW_PASSWORD ?? '';

async function ensurePreviewIdentity(): Promise<string> {
  if (new URL(AUTH_EMULATOR).hostname !== '127.0.0.1') {
    throw new Error('Auth emulator must be loopback.');
  }
  if (!PREVIEW_PASSWORD) {
    throw new Error(
      'Set TIIZI_S5B_EMPTY_PREVIEW_PASSWORD (export TIIZI_S5B_EMPTY_PREVIEW_PASSWORD=\'...\') before seeding. '
      + 'It is the local Development-only password for the empty-preview identity and is never printed.',
    );
  }
  const base = `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1`;

  const signInExisting = async (): Promise<string | null> => {
    const res = await fetch(`${base}/accounts:signInWithPassword?key=local-preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: PREVIEW_EMAIL, password: PREVIEW_PASSWORD, returnSecureToken: true }),
    });
    const body = (await res.json()) as { localId?: string };
    return body.localId ?? null;
  };

  const existing = await signInExisting();
  if (existing) return existing;

  const created = await fetch(`${base}/accounts:signUp?key=local-preview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: PREVIEW_EMAIL, password: PREVIEW_PASSWORD, returnSecureToken: true }),
  });
  const createdBody = (await created.json()) as { localId?: string; error?: { message?: string } };
  if (createdBody.localId) return createdBody.localId;

  throw new Error(
    `${PREVIEW_EMAIL} already exists in the local Auth emulator with a different password. `
    + 'Export TIIZI_S5B_EMPTY_PREVIEW_PASSWORD with that existing password, or delete the account and re-run. '
    + `(${createdBody.error?.message ?? 'unknown error'})`,
  );
}

async function main(): Promise<void> {
  const url = assertLocalOnly();
  const db = createPool(url, { max: 2 });
  try {
    const uid = await ensurePreviewIdentity();
    const existingMember = await db.query<{ member_id: string }>(
      `SELECT member_id FROM members WHERE auth_provider = 'firebase' AND auth_subject = $1`,
      [uid],
    );
    let memberId = existingMember.rows[0]?.member_id;
    if (memberId) {
      await db.query('UPDATE members SET updated_at = now() WHERE member_id = $1', [memberId]);
    } else {
      const inserted = await db.query<{ member_id: string }>(
        `INSERT INTO members (auth_provider, auth_subject) VALUES ('firebase', $1) RETURNING member_id`,
        [uid],
      );
      memberId = inserted.rows[0].member_id;
    }

    // Honesty check: this identity must own no participation, otherwise it is
    // not an empty-state preview. Report, do not repair — fixtures belong to
    // the populated Amara scenario, never to this member.
    const participations = await db.query<{ participation_id: string }>(
      'SELECT participation_id FROM challenge_participations WHERE member_id = $1',
      [memberId],
    );

    console.log('S5b Today empty preview identity (LOCAL Development only)');
    console.log(`  database  : ${new URL(url).pathname.replace(/^\//, '')}`);
    console.log(`  email     : ${PREVIEW_EMAIL}`);
    console.log(`  member    : ${memberId}`);
    console.log(`  participations: ${participations.rows.length} (expected 0)`);
    console.log('  password  : supplied via TIIZI_S5B_EMPTY_PREVIEW_PASSWORD (never printed)');
    if (participations.rows.length > 0) {
      console.error('  WARNING: this member owns participations; the zero state will NOT render.');
      process.exitCode = 1;
    }
  } finally {
    await db.close();
  }
}

main().catch((error: unknown) => {
  console.error(`S5b Today empty preview failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
