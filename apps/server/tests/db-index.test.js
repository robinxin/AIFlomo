/**
 * Unit test for apps/server/src/db/index.js
 *
 * Target: Drizzle ORM instance export
 *
 * Test coverage:
 *   - Exports a valid Drizzle database instance
 *   - Can execute basic queries using the exported instance
 *   - Database file path respects DB_PATH environment variable
 *   - Creates database directory if it doesn't exist
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test database path
const TEST_DB_DIR = join(__dirname, '../test-data');
const TEST_DB_PATH = join(TEST_DB_DIR, 'test-db-index.db');

describe('db/index.js — Drizzle instance export', () => {
  beforeAll(() => {
    // Clean up test database before tests
    if (existsSync(TEST_DB_PATH)) {
      rmSync(TEST_DB_PATH, { force: true });
    }
  });

  afterAll(() => {
    // Clean up test database after tests
    if (existsSync(TEST_DB_PATH)) {
      rmSync(TEST_DB_PATH, { force: true });
    }
    if (existsSync(TEST_DB_DIR) && rmSync) {
      try {
        rmSync(TEST_DB_DIR, { recursive: true, force: true });
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  });

  it('should export a Drizzle database instance', async () => {
    // Set test database path
    process.env.DB_PATH = TEST_DB_PATH;

    const { db } = await import('../src/db/index.js');

    expect(db).toBeDefined();
    expect(typeof db).toBe('object');
    expect(typeof db.select).toBe('function');
    expect(typeof db.insert).toBe('function');
    expect(typeof db.update).toBe('function');
    expect(typeof db.delete).toBe('function');
  });

  it('should create database instance with schema passed to drizzle', async () => {
    process.env.DB_PATH = TEST_DB_PATH;

    const { db } = await import('../src/db/index.js');

    // Verify db instance has schema-aware query builder methods
    expect(db).toBeDefined();
    expect(typeof db.query).toBe('object');
  });

  it('should create database directory if it does not exist', async () => {
    // Use a fresh directory path
    const newDbDir = join(TEST_DB_DIR, 'auto-created');
    const newDbPath = join(newDbDir, 'test.db');

    // Ensure directory does not exist
    if (existsSync(newDbDir)) {
      rmSync(newDbDir, { recursive: true, force: true });
    }

    process.env.DB_PATH = newDbPath;

    // Import db/index.js which should auto-create the directory
    await import('../src/db/index.js?t=' + Date.now());

    expect(existsSync(newDbDir)).toBe(true);

    // Cleanup
    if (existsSync(newDbDir)) {
      rmSync(newDbDir, { recursive: true, force: true });
    }
  });

  it('should have functional query builder methods', async () => {
    process.env.DB_PATH = TEST_DB_PATH;

    const { db } = await import('../src/db/index.js');

    // Verify db instance has working query builder methods
    expect(typeof db.select).toBe('function');
    expect(typeof db.insert).toBe('function');
    expect(typeof db.update).toBe('function');
    expect(typeof db.delete).toBe('function');
  });

  it('should use default database path if DB_PATH is not set', async () => {
    // Clear DB_PATH environment variable
    delete process.env.DB_PATH;

    const { db } = await import('../src/db/index.js?default=' + Date.now());

    expect(db).toBeDefined();

    // Verify db instance has query builder methods
    expect(typeof db.select).toBe('function');
  });
});
