/** Prepare one explicitly authorized, loopback-only Development operator identity. */
import 'dotenv/config';
import { createPool, databaseUrl } from '../api/src/db.js';
import { resolveEmulatorTarget, resolveProjectId } from './previewV2Auth.js';

const EMAIL = 'social-cause-operator@tiizi.local';
const GRANT_REFERENCE = 'Founder-authorized Social Cause Approval Assembly 001 local Development preview';
const OWNER = 'Bearer owner';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function localAuthAccount(target: string, projectId: string, password: string): Promise<string> {
  const lookup = await fetch(`${target}/identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:lookup`, {
    method: 'POST', headers: { authorization: OWNER, 'content-type': 'application/json' }, body: JSON.stringify({ email: [EMAIL] }),
  });
  const lookupBody = await lookup.json() as { users?: Array<{ localId: string }> };
  if (!lookup.ok) throw new Error('Could not inspect the account in the loopback Auth emulator.');
  let uid = lookupBody.users?.[0]?.localId;
  if (!uid) {
    const created = await fetch(`${target}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=local-preview`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password, returnSecureToken: true }),
    });
    const body = await created.json() as { localId?: string };
    if (!created.ok || !body.localId) throw new Error('Could not create the local Development Operator account.');
    uid = body.localId;
  } else {
    // This bootstrap is restricted above to the loopback emulator. Treat the
    // supplied secret as the desired current password so rotation is
    // repeatable even when emulator state outlives a previous preview run.
    const rotated = await fetch(`${target}/identitytoolkit.googleapis.com/v1/accounts:update?key=local-preview`, {
      method: 'POST', headers: { authorization: OWNER, 'content-type': 'application/json' },
      body: JSON.stringify({ localId: uid, password, returnSecureToken: false }),
    });
    if (!rotated.ok) throw new Error('Could not rotate the local Development Operator password.');
    const signedIn = await fetch(`${target}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-preview`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password, returnSecureToken: true }),
    });
    if (!signedIn.ok) throw new Error('The supplied local password does not sign in the existing Operator account.');
  }
  return uid;
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to prepare a Development operator in production.');
  const target = resolveEmulatorTarget({ host: arg('--host'), port: arg('--port'), nodeEnv: process.env.NODE_ENV });
  if (target.host !== '127.0.0.1') throw new Error('The Operator identity must use the loopback Auth emulator.');
  const projectId = resolveProjectId({ cliProject: arg('--project') });
  const password = process.env.TIIZI_SOCIAL_CAUSE_OPERATOR_PASSWORD;
  if (!password || password.length < 6) throw new Error('Set TIIZI_SOCIAL_CAUSE_OPERATOR_PASSWORD to a local-only password of at least 6 characters.');
  const url = new URL(databaseUrl());
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) throw new Error('Development Operator provisioning requires a loopback PostgreSQL database.');

  const uid = await localAuthAccount(target.url, projectId, password);
  const db = createPool(databaseUrl(), { max: 2 });
  try {
    const existing = await db.query<{ member_id: string }>(
      `SELECT member_id FROM members WHERE auth_provider='firebase' AND auth_subject=$1`, [uid]);
    const memberId = existing.rows[0]?.member_id ?? String((await db.query<{ member_id: string }>(
      `INSERT INTO members (auth_provider,auth_subject) VALUES ('firebase',$1) RETURNING member_id`, [uid])).rows[0].member_id);
    await db.query(
      `INSERT INTO platform_operator_cause_reviewers (member_id,grant_reference)
       VALUES ($1,$2) ON CONFLICT (member_id) DO NOTHING`,
      [memberId, GRANT_REFERENCE],
    );
    const grant = await db.query<{ revoked_at: string | null }>(
      `SELECT revoked_at FROM platform_operator_cause_reviewers WHERE member_id=$1`, [memberId]);
    if (!grant.rows.length || grant.rows[0].revoked_at !== null) {
      throw new Error('This Development Operator grant is revoked; reauthorization requires a new explicit decision.');
    }
    console.log('Local Development Social Cause Operator ready.');
    console.log(`  email       : ${EMAIL}`);
    console.log(`  member      : ${memberId}`);
    console.log(`  auth target : ${target.url} (${projectId})`);
    console.log('  grant       : Social Cause review only; no Group, Challenge, or participant state was created.');
    console.log('  password    : supplied through TIIZI_SOCIAL_CAUSE_OPERATOR_PASSWORD (not shown)');
  } finally {
    await db.close();
  }
}

void main().catch((error: unknown) => {
  console.error(`Development Social Cause Operator setup failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
