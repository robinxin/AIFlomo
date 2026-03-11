/**
 * Tests for apps/server/src/db/index.js
 *
 * Verifies that the Drizzle instance is correctly initialized:
 *   1. The `db` export is defined and is an object
 *   2. The data directory is auto-created before the database file is opened
 *   3. The instance exposes standard Drizzle query methods (select, insert, update, delete)
 *
 * Test strategy:
 *   - Import the module once. Because DB_PATH is set before the test suite
 *     starts, all tests share the same `db` instance.
 *   - The directory-creation behaviour is tested by inspecting the file system
 *     after the module is loaded.
 *   - We rely on the fact that better-sqlite3 + Drizzle creates the DB file
 *     in the directory specified by DB_PATH (after mkdirSync creates it).
 *
 * ESM note:
 *   Jest ESM mode does not inject `jest` as a global. We do not use
 *   jest.resetModules() here — module isolation is achieved by pointing
 *   DB_PATH at a temporary directory that is unique per test run.
 */

import { mkdtempSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';

// ---------------------------------------------------------------------------
// Setup: point DB_PATH at a temporary location BEFORE the module is imported
// ---------------------------------------------------------------------------

const TMP_ROOT = mkdtempSync(join(tmpdir(), 'aiflomo-db-test-'));
// Nested path — the module must create the parent directories automatically
const TEST_DB_PATH = join(TMP_ROOT, 'nested', 'sub', 'test.db');

// Set env var before importing the module under test
process.env.DB_PATH = TEST_DB_PATH;

// Now import the module — it reads DB_PATH at import time
const { db } = await import('../../src/db/index.js');

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterAll(() => {
  rmSync(TMP_ROOT, { recursive: true, force: true });
  delete process.env.DB_PATH;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('db/index.js — Drizzle instance export', () => {
  // -------------------------------------------------------------------------
  // Test 1: exported `db` is defined and is an object
  // -------------------------------------------------------------------------
  test('exports a `db` object', () => {
    expect(db).toBeDefined();
    expect(typeof db).toBe('object');
    expect(db).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Test 2: auto-creates the database directory
  // -------------------------------------------------------------------------
  test('auto-creates the database directory when it does not exist', () => {
    const expectedDir = dirname(TEST_DB_PATH); // …/nested/sub
    expect(existsSync(expectedDir)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Test 3: database file is created on disk
  // -------------------------------------------------------------------------
  test('creates the SQLite database file at DB_PATH', () => {
    // better-sqlite3 creates the file when the Database constructor is called
    expect(existsSync(TEST_DB_PATH)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Test 4: db object exposes standard Drizzle query-builder methods
  // -------------------------------------------------------------------------
  test('db object exposes standard Drizzle query methods', () => {
    expect(typeof db.select).toBe('function');
    expect(typeof db.insert).toBe('function');
    expect(typeof db.update).toBe('function');
    expect(typeof db.delete).toBe('function');
  });
});
