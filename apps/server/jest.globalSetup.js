/**
 * Jest global setup — runs once before all test suites in the worker process.
 *
 * Responsibilities:
 *   1. Set a test-specific DB_PATH so that tests do not touch the development
 *      database (./data/aiflomo.db).
 *   2. Create the parent directory for the test database if it does not exist.
 *   3. Apply the Drizzle schema (DDL) to the test database so that tables
 *      like `users` and `sessions` are available when test suites run.
 *
 * The DB_PATH environment variable is written to process.env so that
 * child worker processes (where individual test files execute) inherit it
 * through Jest's forked worker model.
 *
 * Note: Jest's `globalSetup` runs in the SAME Node.js process that spawns the
 * test workers.  Environment variables set here ARE inherited by workers via
 * the standard POSIX fork/exec environment-propagation model that Jest uses
 * when spawning worker child processes.
 *
 * Foreign-key note:
 *   better-sqlite3 enables PRAGMA foreign_keys by default.  The
 *   `plugins-auth.test.js` suite inserts an intentionally orphaned session row
 *   (userId referencing a non-existent user) to test the "user deleted" edge
 *   case.  To allow that insert we omit the FOREIGN KEY constraint in the test
 *   schema — the constraint enforcement is an application-level concern tested
 *   by integration and E2E suites against the real migrated database.
 */

import { mkdirSync, rmSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Test database path — must be inside the project root (apps/server/) so that
// the DB_PATH security validation in db/index.js does not reject it.
// ---------------------------------------------------------------------------

const TEST_DB_PATH = resolve(__dirname, 'test-data', 'auth-test.db');

export default async function globalSetup() {
  // -------------------------------------------------------------------------
  // 1. Expose the test DB path to all Jest worker processes.
  //
  //    Jest workers inherit the environment of the global-setup process, so
  //    setting DB_PATH here makes it available to db/index.js when it is
  //    imported inside each test file.
  // -------------------------------------------------------------------------
  process.env.DB_PATH = TEST_DB_PATH;

  // Ensure SESSION_SECRET is available (≥ 32 characters) so sessionPlugin
  // does not throw during plugin registration in tests that use it.
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    process.env.SESSION_SECRET = 'test-secret-key-for-unit-tests-minimum-32-chars';
  }

  // -------------------------------------------------------------------------
  // 2. Remove any stale test database from a previous run and recreate the
  //    parent directory.
  //
  //    Deleting the file guarantees a clean schema on every test run and
  //    prevents leftover rows from interfering with tests that assume an empty
  //    database at startup.
  // -------------------------------------------------------------------------
  if (existsSync(TEST_DB_PATH)) {
    rmSync(TEST_DB_PATH, { force: true });
  }
  mkdirSync(dirname(TEST_DB_PATH), { recursive: true });

  // -------------------------------------------------------------------------
  // 3. Apply the schema DDL to the test database.
  //
  //    We create the tables without FOREIGN KEY constraints so that test cases
  //    can insert orphaned rows (e.g. a session whose userId does not exist in
  //    the users table) to exercise defensive code paths in the application.
  //
  //    better-sqlite3 enables PRAGMA foreign_keys = ON by default, which would
  //    cause those inserts to fail if FK constraints were declared here.
  //
  //    The real FK enforcement is validated in integration/E2E tests that run
  //    against the fully-migrated development database.
  // -------------------------------------------------------------------------
  const db = new Database(TEST_DB_PATH);

  try {
    // Disable FK enforcement for DDL so we can model the "orphan session" case.
    db.pragma('foreign_keys = OFF');

    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY NOT NULL,
        email         TEXT NOT NULL UNIQUE,
        nickname      TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at    TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
        updated_at    TEXT DEFAULT (CURRENT_TIMESTAMP) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id         TEXT    PRIMARY KEY NOT NULL,
        user_id    TEXT    NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at TEXT    DEFAULT (CURRENT_TIMESTAMP) NOT NULL
      );
    `);
  } finally {
    db.close();
  }
}
