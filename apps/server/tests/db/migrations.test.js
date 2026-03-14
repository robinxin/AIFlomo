/**
 * TDD Test: Database Migration Verification
 * Task T003 - Verify users table migration has been generated and applied
 *
 * Tests verify:
 * 1. Migration files exist in apps/server/src/db/migrations/
 * 2. users table exists in the SQLite database
 * 3. email UNIQUE index exists on users table
 * 4. All required fields exist (id, email, nickname, password_hash, agreed_at, created_at, updated_at)
 * 5. id is the primary key
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const SERVER_ROOT = join(__dirname, '../../');
const MIGRATIONS_DIR = join(SERVER_ROOT, 'src/db/migrations');
const DB_PATH = join(SERVER_ROOT, 'data/aiflomo.db');

describe('T003 - Database Migration Verification', () => {
  let db;

  beforeAll(() => {
    // Open the actual database to inspect its structure
    db = new Database(DB_PATH, { readonly: true });
  });

  afterAll(() => {
    if (db) {
      db.close();
    }
  });

  // Test 1: Verify migration files have been generated
  describe('Migration files exist', () => {
    it('should have migration files in apps/server/src/db/migrations/ directory', () => {
      expect(existsSync(MIGRATIONS_DIR)).toBe(true);

      const files = readdirSync(MIGRATIONS_DIR);
      const sqlFiles = files.filter((f) => f.endsWith('.sql'));

      expect(sqlFiles.length).toBeGreaterThan(0);
    });

    it('should have a migration file containing users table DDL', () => {
      const files = readdirSync(MIGRATIONS_DIR);
      const sqlFiles = files.filter((f) => f.endsWith('.sql'));

      expect(sqlFiles.length).toBeGreaterThan(0);

      // At least one migration file should reference the users table
      const hasusersMigration = sqlFiles.some((file) => {
        const content = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
        return (
          content.toLowerCase().includes('create table') &&
          content.toLowerCase().includes('users')
        );
      });

      expect(hasusersMigration).toBe(true);
    });
  });

  // Test 2: Verify users table exists in the database
  describe('users table exists in database', () => {
    it('should have users table in sqlite_master', () => {
      const row = db
        .prepare(
          `SELECT name FROM sqlite_master
           WHERE type = 'table' AND name = 'users'`
        )
        .get();

      expect(row).toBeDefined();
      expect(row.name).toBe('users');
    });
  });

  // Test 3: Verify UNIQUE index on email exists
  describe('email UNIQUE index exists', () => {
    it('should have a unique index on the email column', () => {
      const indexes = db
        .prepare(
          `SELECT name, tbl_name, sql
           FROM sqlite_master
           WHERE type = 'index' AND tbl_name = 'users'`
        )
        .all();

      // Find an index that is UNIQUE and covers email
      const uniqueEmailIndex = indexes.find((idx) => {
        if (!idx.sql) return false;
        const sql = idx.sql.toUpperCase();
        return sql.includes('UNIQUE') && sql.includes('EMAIL');
      });

      expect(uniqueEmailIndex).toBeDefined();
    });
  });

  // Test 4: Verify all required columns exist
  describe('All required columns exist in users table', () => {
    let columns;

    beforeAll(() => {
      columns = db.prepare('PRAGMA table_info(users)').all();
    });

    const requiredColumns = [
      'id',
      'email',
      'nickname',
      'password_hash',
      'agreed_at',
      'created_at',
      'updated_at',
    ];

    requiredColumns.forEach((colName) => {
      it(`should have column: ${colName}`, () => {
        const col = columns.find((c) => c.name === colName);
        expect(col).toBeDefined();
      });
    });

    it('should have exactly the required columns (no missing, schema-defined only)', () => {
      const actualColumnNames = columns.map((c) => c.name).sort();
      const expectedColumnNames = [...requiredColumns].sort();
      expect(actualColumnNames).toEqual(expectedColumnNames);
    });
  });

  // Test 5: Verify id is primary key
  describe('id column is primary key', () => {
    it('should have id as primary key (pk = 1)', () => {
      const columns = db.prepare('PRAGMA table_info(users)').all();
      const idColumn = columns.find((c) => c.name === 'id');

      expect(idColumn).toBeDefined();
      expect(idColumn.pk).toBe(1);
    });

    it('id column should be TEXT type', () => {
      const columns = db.prepare('PRAGMA table_info(users)').all();
      const idColumn = columns.find((c) => c.name === 'id');

      expect(idColumn).toBeDefined();
      expect(idColumn.type.toUpperCase()).toBe('TEXT');
    });
  });

  // Bonus: Verify NOT NULL constraints on critical fields
  describe('NOT NULL constraints on critical columns', () => {
    let columns;

    beforeAll(() => {
      columns = db.prepare('PRAGMA table_info(users)').all();
    });

    const notNullColumns = [
      'email',
      'nickname',
      'password_hash',
      'agreed_at',
      'created_at',
      'updated_at',
    ];

    notNullColumns.forEach((colName) => {
      it(`should have NOT NULL constraint on: ${colName}`, () => {
        const col = columns.find((c) => c.name === colName);
        expect(col).toBeDefined();
        // notnull = 1 means NOT NULL constraint is set
        expect(col.notnull).toBe(1);
      });
    });
  });
});
