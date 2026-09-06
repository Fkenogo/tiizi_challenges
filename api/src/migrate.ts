import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db } from './db.js';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

export async function listMigrationFiles(): Promise<string[]> {
  const files = await readdir(migrationsDir);
  return files.filter((f) => f.endsWith('.sql')).sort();
}

export async function runMigrations(db: Db): Promise<string[]> {
  await db.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  );
  const applied = await db.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations',
  );
  const done = new Set(applied.rows.map((r) => r.filename));
  const pending: string[] = [];
  for (const file of await listMigrationFiles()) {
    if (done.has(file)) continue;
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    await db.transaction(async (tx) => {
      for (const statement of splitStatements(sql)) {
        await tx.query(statement);
      }
      await tx.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    });
    pending.push(file);
  }
  return pending;
}

/**
 * Splits a migration file into single statements. Drivers in prepared-statement
 * mode (and PGlite) reject multi-command strings, so each statement is sent
 * separately. Handles single/double-quoted strings, line/block comments and
 * dollar-quoted bodies.
 */
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let i = 0;
  const n = sql.length;

  const readDollarTag = (pos: number): string | null => {
    const match = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(pos));
    return match ? match[0] : null;
  };

  while (i < n) {
    const ch = sql[i];
    const next = sql[i + 1] ?? '';

    if (ch === '-' && next === '-') {
      while (i < n && sql[i] !== '\n') current += sql[i++];
      continue;
    }
    if (ch === '/' && next === '*') {
      current += ch + next;
      i += 2;
      while (i < n && !(sql[i] === '*' && sql[i + 1] === '/')) current += sql[i++];
      current += sql[i] ?? '';
      current += sql[i + 1] ?? '';
      i += 2;
      continue;
    }
    if (ch === "'") {
      current += ch;
      i += 1;
      while (i < n) {
        current += sql[i];
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            current += sql[i + 1];
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (ch === '"') {
      current += ch;
      i += 1;
      while (i < n && sql[i] !== '"') current += sql[i++];
      current += sql[i] ?? '';
      i += 1;
      continue;
    }
    const tag = ch === '$' ? readDollarTag(i) : null;
    if (tag) {
      const end = sql.indexOf(tag, i + tag.length);
      const stop = end === -1 ? n : end + tag.length;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === ';') {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = '';
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}
