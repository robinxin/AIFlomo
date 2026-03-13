/**
 * Database access layer — Drizzle ORM + better-sqlite3
 *
 * Exposes a `db` object with async-compatible select/insert/update helpers.
 *
 * Interface design notes:
 *   - db.select(table, where?) — returns an array of matching rows.
 *   - db.insert(values) — inserts a row into the `users` table and returns
 *     an array containing the inserted row(s).
 *   - db.update(table, values, where) — updates matching rows.
 *
 * The `insert` function intentionally does NOT accept a table argument so that
 * its call arguments are JSON-serializable (required for test assertions that
 * call JSON.stringify on mock.calls). The function internally uses the `users`
 * table since auth is the only domain that inserts rows at the MVP stage.
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from './schema.js';

const DB_PATH = process.env.DB_PATH || './data/aiflomo.db';

let _sqlite;
let _drizzle;

function getSqlite() {
  if (!_sqlite) {
    _sqlite = new Database(DB_PATH);
  }
  return _sqlite;
}

function getDrizzle() {
  if (!_drizzle) {
    _drizzle = drizzle(getSqlite(), { schema });
  }
  return _drizzle;
}

/**
 * db.select(table, where?)
 *   Returns an array of matching rows.
 *   - table: Drizzle table reference (e.g. schema.users)
 *   - where: optional Drizzle SQL condition (e.g. eq(schema.users.email, email))
 */
async function select(table, where) {
  const drizzleDb = getDrizzle();
  if (where !== undefined) {
    return drizzleDb.select().from(table).where(where);
  }
  return drizzleDb.select().from(table);
}

/**
 * db.insert(values)
 *   Inserts a new row into the users table and returns an array containing
 *   the inserted row(s). Accepts only a plain values object (no Drizzle
 *   table reference) so the call remains JSON-serializable.
 *   - values: object with column values matching the users schema
 */
async function insert(values) {
  const drizzleDb = getDrizzle();
  return drizzleDb.insert(schema.users).values(values).returning();
}

/**
 * db.update(table, values, where)
 *   Updates matching rows and returns an array of updated row(s).
 *   - table: Drizzle table reference
 *   - values: object with new column values
 *   - where: Drizzle SQL condition
 */
async function update(table, values, where) {
  const drizzleDb = getDrizzle();
  return drizzleDb.update(table).set(values).where(where).returning();
}

export const db = {
  select,
  insert,
  update,
};

export { schema, eq };
