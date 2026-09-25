/** Local-only identity links for the S4b Founder preview. Creates no Group or membership. */
import 'dotenv/config';
import { createPool, databaseUrl, type Db } from '../api/src/db.js';
import { resolveEmulatorTarget, resolveProjectId } from './previewV2Auth.js';

const STEWARD_EMAIL = 's4b.steward@tiizi.local';
const MEMBER_EMAIL = 's4b.member@tiizi.local';
const OWNER = 'Bearer owner';

async function linkMember(db: Db, uid: string): Promise<string> {
  const existing = await db.query<{ member_id: string }>("SELECT member_id FROM members WHERE auth_provider='firebase' AND auth_subject=$1", [uid]);
  if (existing.rows[0]) return String(existing.rows[0].member_id);
  const inserted = await db.query<{ member_id: string }>("INSERT INTO members (auth_provider, auth_subject) VALUES ('firebase',$1) RETURNING member_id", [uid]);
  return String(inserted.rows[0].member_id);
}

async function ensureAuthAccount(target: string, projectId: string, email: string, password: string): Promise<string> {
  const lookupUrl = `${target}/identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:lookup`;
  const lookup = await fetch(lookupUrl, { method: 'POST', headers: { authorization: OWNER, 'content-type': 'application/json' }, body: JSON.stringify({ email: [email] }) });
  const lookupBody = await lookup.json() as { users?: Array<{ localId: string }> };
  if (!lookup.ok) throw new Error('Could not inspect the ordinary-member account in the local Auth emulator.');
  let uid = lookupBody.users?.[0]?.localId;
  if (!uid) {
    const created = await fetch(`${target}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=local-preview`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
    const body = await created.json() as { localId?: string };
    if (!created.ok || !body.localId) throw new Error(`Could not create ${email} in the local Auth emulator.`);
    uid = body.localId;
  } else {
    const signedIn = await fetch(`${target}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-preview`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
    if (!signedIn.ok) throw new Error(`The configured local password does not sign in ${email}.`);
  }
  return uid;
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to prepare preview identities in production.');
  const target = resolveEmulatorTarget({ port: 19099 });
  if (target.host !== '127.0.0.1') throw new Error('Preview Auth must use loopback.');
  const projectId = resolveProjectId({});
  const stewardPassword = process.env.TIIZI_S4B_STEWARD_PASSWORD;
  const memberPassword = process.env.TIIZI_S4B_MEMBER_PASSWORD;
  if (!stewardPassword || !memberPassword) throw new Error('Provide local-only TIIZI_S4B_STEWARD_PASSWORD and TIIZI_S4B_MEMBER_PASSWORD values.');
  const stewardUid = await ensureAuthAccount(target.url, projectId, STEWARD_EMAIL, stewardPassword);
  const memberUid = await ensureAuthAccount(target.url, projectId, MEMBER_EMAIL, memberPassword);
  const db = createPool(databaseUrl(), { max: 2 });
  try {
    const stewardMemberId = await linkMember(db, stewardUid);
    const ordinaryMemberId = await linkMember(db, memberUid);
    console.log('S4b local preview identities linked; no Group or Group membership was created.');
    console.log(`Founder/Steward: ${STEWARD_EMAIL} (${stewardMemberId})`);
    console.log(`Ordinary Member: ${MEMBER_EMAIL} (${ordinaryMemberId})`);
    console.log('Create the Group as the Founder in the V2 UI, then join it as the ordinary Member.');
  } finally { await db.close(); }
}

void main().catch((error: unknown) => { console.error(`S4b preview identity setup failed: ${(error as Error).message}`); process.exitCode = 1; });
