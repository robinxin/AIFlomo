/**
 * Tests for apps/server/src/db/index.js — default DB_PATH branch
 *
 * This file is intentionally separate from index.test.js so that Jest runs it
 * as a fresh worker process. ESM modules are cached per-process; splitting the
 * tests across files is the standard way to test different module
 * initialisation paths under Jest's `--experimental-vm-modules` mode.
 *
 * Coverage target: the `?? './data/aiflomo.db'` fallback branch in index.js
 * (line 26) which is only reached when DB_PATH is absent from the environment.
 */

import { existsSync, rmSync } from 'fs';
import { resolve } from 'path';

// Ensure DB_PATH is NOT set for this test suite so the fallback path is taken
delete process.env.DB_PATH;

// Import the module — it will use the default path
const { db } = await import('../../src/db/index.js');

// The default DB file is relative to the CWD when Jest runs (apps/server/)
const DEFAULT_DB_PATH = resolve('./data/aiflomo.db');

afterAll(() => {
  // Clean up the default data directory created during this test
  try {
    rmSync(resolve('./data'), { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors — directory may not exist if test failed early
  }
});

describe('db/index.js — default DB_PATH fallback branch', () => {
  test('exports a `db` object when DB_PATH env var is absent', () => {
    expect(db).toBeDefined();
    expect(typeof db).toBe('object');
    expect(db).not.toBeNull();
  });

  test('creates the default ./data directory when DB_PATH is not set', () => {
    expect(existsSync(resolve('./data'))).toBe(true);
  });

  test('creates the database file at the default path', () => {
    expect(existsSync(DEFAULT_DB_PATH)).toBe(true);
  });

  test('db object exposes standard Drizzle query methods via default path', () => {
    expect(typeof db.select).toBe('function');
    expect(typeof db.insert).toBe('function');
    expect(typeof db.update).toBe('function');
    expect(typeof db.delete).toBe('function');
  });
});
