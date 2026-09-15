/** Local PostgreSQL-only Member mappings for the PF-05 preview. */
import 'dotenv/config';
import { createPool, databaseUrl, type Db } from './db.js';

export const PREVIEW_MEMBER_UIDS = ['preview-founder-01', 'preview-founder-02'] as const;

export interface PreviewMemberSeedResult {
  created: string[];
  existing: string[];
  wouldCreate: string[];
}

export function assertLocalPreviewDatabaseUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('preview member seed DATABASE_URL is not a valid URL');
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== 'localhost' && host !== '127.0.0.1' && host !== '::1') {
    throw new Error(`preview member seed refuses a non-localhost PostgreSQL target (${host})`);
  }
  return value;
}

export async function seedPreviewMembers(db: Db, apply: boolean): Promise<PreviewMemberSeedResult> {
  const result: PreviewMemberSeedResult = { created: [], existing: [], wouldCreate: [] };
  for (const uid of PREVIEW_MEMBER_UIDS) {
    const existing = await db.query<{ member_id: string }>(
      `SELECT member_id FROM members WHERE auth_provider = 'firebase' AND auth_subject = $1`,
      [uid],
    );
    if (existing.rows[0]) {
      result.existing.push(uid);
      continue;
    }
    if (!apply) {
      result.wouldCreate.push(uid);
      continue;
    }
    await db.query<{ member_id: string }>(
      `INSERT INTO members (auth_provider, auth_subject) VALUES ('firebase', $1) RETURNING member_id`,
      [uid],
    );
    result.created.push(uid);
  }
  return result;
}

async function main(): Promise<void> {
  const apply = process.argv.slice(2).includes('--apply');
  const url = assertLocalPreviewDatabaseUrl(databaseUrl());
  const db = createPool(url);
  try {
    const result = await seedPreviewMembers(db, apply);
    for (const uid of result.existing) console.log(`preview:member: ${uid} already present`);
    for (const uid of result.created) console.log(`preview:member: created ${uid}`);
    for (const uid of result.wouldCreate) console.log(`preview:member: would create ${uid}`);
    if (!apply) console.log('preview:member: dry run (pass --apply to write)');
  } finally {
    await db.close();
  }
}

const invokedAsCli = process.argv[1]?.endsWith('previewMemberSeedCli.ts')
  || process.argv[1]?.endsWith('previewMemberSeedCli.js');
if (invokedAsCli) {
  main().catch((error: unknown) => {
    console.error(`preview:member: failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
