import 'dotenv/config';
import { createFirebaseVerifier } from './auth.js';
import { buildApp } from './app.js';
import { createPool, databaseUrl } from './db.js';

async function main(): Promise<void> {
  const db = createPool(databaseUrl());
  const app = buildApp({ db, verifier: createFirebaseVerifier() });
  const port = Number(process.env.PORT ?? 4000);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`tiizi-api listening on :${port}`);
}

const invokedAsCli =
  process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (invokedAsCli) void main();
