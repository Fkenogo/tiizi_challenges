import { describe, expect, it } from 'vitest';
import { splitStatements } from '../src/migrate.js';

describe('splitStatements', () => {
  it('splits simple statements and drops empties', () => {
    expect(splitStatements('SELECT 1;\n\nSELECT 2;')).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('ignores semicolons inside strings and comments', () => {
    const sql = `-- first; comment
CREATE TABLE t (note TEXT DEFAULT 'a;b'); /* block; comment */
SELECT 1;`;
    expect(splitStatements(sql)).toHaveLength(2);
  });

  it('keeps dollar-quoted bodies intact', () => {
    const sql = `CREATE FUNCTION f() RETURNS void AS $$ BEGIN RAISE NOTICE 'x;y'; END; $$ LANGUAGE plpgsql;
SELECT 1;`;
    expect(splitStatements(sql)).toHaveLength(2);
  });
});
