/**
 * Tests for DB_PATH validation in apps/server/src/db/index.js (security: HIGH-3)
 *
 * The module performs a path-traversal check at load time: when DB_PATH is set
 * it must resolve to a path inside the project root (apps/server/).  A path
 * that escapes the project tree causes the module to throw immediately.
 *
 * Test strategy:
 *   - Rejection cases: set DB_PATH to a forbidden path before importing the
 *     module with a unique cache-busting query string, then assert the import
 *     rejects with the expected error message.
 *   - Acceptance case: validate the path-checking logic directly by running
 *     the same predicate used in db/index.js (PROJECT_ROOT prefix check),
 *     avoiding the need to open an actual database in this test file.
 *
 * ESM note:
 *   Jest's --experimental-vm-modules mode evaluates each import URL once per
 *   process. Using `?t=<unique>` suffixes forces a fresh module evaluation for
 *   every test case, which is the standard isolation technique in this project
 *   (see db/index.test.js and db/index-default-path.test.js).
 */

import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Derive the project root the same way index.js does:
//   This file lives at apps/server/tests/db/
//   Go up: ../../  → apps/server/src/db/  (same structure mirrored)
//   But more precisely: tests/db/../../src/db/../../ → apps/server/
// The canonical path: resolve from tests/db/ up 4 levels gives apps/server/.
// ---------------------------------------------------------------------------

// PROJECT_ROOT as seen from db/index.js (apps/server/src/db/ → ../../ → apps/server/)
// From this test file location (tests/db/), we go up two levels to reach apps/server/
const PROJECT_ROOT = resolve(__dirname, '../../');

// A path guaranteed to be outside the project root (one level above apps/server/)
const OUTSIDE_PATH = resolve(PROJECT_ROOT, '../outside.db');

// A classic path-traversal attempt that resolves outside the project root
const TRAVERSAL_PATH = join(PROJECT_ROOT, '..', '..', 'etc', 'passwd');

// ---------------------------------------------------------------------------
// Helper: replicates the exact validation predicate from db/index.js
// ---------------------------------------------------------------------------

/**
 * Returns true when resolvedPath is inside projectRoot (same predicate as db/index.js).
 *
 * @param {string} resolvedPath - Absolute resolved path to check.
 * @param {string} projectRoot  - Absolute project root path.
 * @returns {boolean}
 */
function isInsideProjectRoot(resolvedPath, projectRoot) {
  return resolvedPath.startsWith(projectRoot + '/') || resolvedPath === projectRoot;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterAll(() => {
  delete process.env.DB_PATH;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('db/index.js — DB_PATH validation (security: HIGH-3)', () => {
  // -------------------------------------------------------------------------
  // Test 1: path outside the project root must be rejected at module load time
  // -------------------------------------------------------------------------
  test('throws when DB_PATH resolves to a path outside the project root', async () => {
    process.env.DB_PATH = OUTSIDE_PATH;

    const t = Date.now() + Math.random();
    await expect(
      import(`../../src/db/index.js?reject=${t}`),
    ).rejects.toThrow(/DB_PATH must be inside the project directory/);
  });

  // -------------------------------------------------------------------------
  // Test 2: classic path-traversal attempt must be rejected
  // -------------------------------------------------------------------------
  test('throws when DB_PATH contains a path-traversal sequence escaping the project', async () => {
    process.env.DB_PATH = TRAVERSAL_PATH;

    const t = Date.now() + Math.random();
    await expect(
      import(`../../src/db/index.js?traversal=${t}`),
    ).rejects.toThrow(/DB_PATH must be inside the project directory/);
  });

  // -------------------------------------------------------------------------
  // Test 3: path-checking predicate accepts paths inside the project root
  //
  // We validate the predicate logic directly rather than importing the module,
  // avoiding better-sqlite3 side effects (file creation) in this test file.
  // The predicate in db/index.js is:
  //   !dbPath.startsWith(PROJECT_ROOT + '/') && dbPath !== PROJECT_ROOT
  // -------------------------------------------------------------------------
  test('accepts DB_PATH that resolves inside the project root (predicate check)', () => {
    const insidePaths = [
      join(PROJECT_ROOT, 'data', 'aiflomo.db'),
      join(PROJECT_ROOT, 'test-data', 'test.db'),
      join(PROJECT_ROOT, 'data', 'nested', 'deep', 'db.sqlite'),
    ];

    for (const p of insidePaths) {
      expect(isInsideProjectRoot(resolve(p), PROJECT_ROOT)).toBe(true);
    }
  });

  // -------------------------------------------------------------------------
  // Test 4: path-checking predicate rejects paths outside the project root
  // -------------------------------------------------------------------------
  test('rejects DB_PATH that resolves outside the project root (predicate check)', () => {
    const outsidePaths = [
      OUTSIDE_PATH,
      TRAVERSAL_PATH,
      '/tmp/evil.db',
      '/etc/passwd',
      resolve(PROJECT_ROOT, '../../somewhere.db'),
    ];

    for (const p of outsidePaths) {
      expect(isInsideProjectRoot(resolve(p), PROJECT_ROOT)).toBe(false);
    }
  });

  // -------------------------------------------------------------------------
  // Test 5: default path (no DB_PATH set) must not trigger the rejection guard
  // -------------------------------------------------------------------------
  test('skips validation when DB_PATH is not set (default path is always safe)', async () => {
    delete process.env.DB_PATH;

    const t = Date.now() + Math.random();
    // Should NOT throw when DB_PATH is absent — the fallback './data/aiflomo.db'
    // is not validated because the guard is `if (process.env.DB_PATH !== undefined)`.
    const mod = await import(`../../src/db/index.js?default=${t}`);
    expect(mod.db).toBeDefined();

    if (mod.sqlite && typeof mod.sqlite.close === 'function') {
      mod.sqlite.close();
    }
  });
});
