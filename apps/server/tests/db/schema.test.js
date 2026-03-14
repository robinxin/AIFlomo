/**
 * TDD Test: apps/server/src/db/schema.js
 * Verifies the users table definition in Drizzle ORM schema.
 *
 * Tests cover:
 * - users table export exists
 * - All required columns are defined with correct types and constraints
 * - email field has UNIQUE constraint
 * - id field is primary key
 */

import { users } from '../../src/db/schema.js';

describe('Drizzle Schema - users table', () => {
  describe('users table definition exists', () => {
    it('should export users table', () => {
      expect(users).toBeDefined();
    });

    it('should be a Drizzle table object', () => {
      // Drizzle SQLite tables have a Symbol(drizzle:Name) or table name property
      expect(users).not.toBeNull();
      expect(typeof users).toBe('object');
    });
  });

  describe('users table column definitions', () => {
    let columns;

    beforeAll(() => {
      // Drizzle tables expose column definitions via the table object's columns
      // The internal structure uses Symbol keys but columns are also accessible
      // via the table's own enumerable properties or via getTableColumns helper
      columns = users;
    });

    it('should have id column defined', () => {
      expect(users.id).toBeDefined();
    });

    it('should have email column defined', () => {
      expect(users.email).toBeDefined();
    });

    it('should have nickname column defined', () => {
      expect(users.nickname).toBeDefined();
    });

    it('should have passwordHash column defined', () => {
      expect(users.passwordHash).toBeDefined();
    });

    it('should have agreedAt column defined', () => {
      expect(users.agreedAt).toBeDefined();
    });

    it('should have createdAt column defined', () => {
      expect(users.createdAt).toBeDefined();
    });

    it('should have updatedAt column defined', () => {
      expect(users.updatedAt).toBeDefined();
    });
  });

  describe('users table column types', () => {
    it('id column should be text type', () => {
      expect(users.id.columnType).toBe('SQLiteText');
    });

    it('email column should be text type', () => {
      expect(users.email.columnType).toBe('SQLiteText');
    });

    it('nickname column should be text type', () => {
      expect(users.nickname.columnType).toBe('SQLiteText');
    });

    it('passwordHash column should be text type', () => {
      expect(users.passwordHash.columnType).toBe('SQLiteText');
    });

    it('agreedAt column should be integer type', () => {
      expect(users.agreedAt.columnType).toBe('SQLiteInteger');
    });

    it('createdAt column should be integer type', () => {
      expect(users.createdAt.columnType).toBe('SQLiteInteger');
    });

    it('updatedAt column should be integer type', () => {
      expect(users.updatedAt.columnType).toBe('SQLiteInteger');
    });
  });

  describe('users table column constraints', () => {
    it('id column should be primary key', () => {
      expect(users.id.primary).toBe(true);
    });

    it('email column should have notNull constraint', () => {
      expect(users.email.notNull).toBe(true);
    });

    it('nickname column should have notNull constraint', () => {
      expect(users.nickname.notNull).toBe(true);
    });

    it('passwordHash column should have notNull constraint', () => {
      expect(users.passwordHash.notNull).toBe(true);
    });

    it('agreedAt column should have notNull constraint', () => {
      expect(users.agreedAt.notNull).toBe(true);
    });

    it('createdAt column should have notNull constraint', () => {
      expect(users.createdAt.notNull).toBe(true);
    });

    it('updatedAt column should have notNull constraint', () => {
      expect(users.updatedAt.notNull).toBe(true);
    });
  });

  describe('users table column database names', () => {
    it('id column should map to database column "id"', () => {
      expect(users.id.name).toBe('id');
    });

    it('email column should map to database column "email"', () => {
      expect(users.email.name).toBe('email');
    });

    it('nickname column should map to database column "nickname"', () => {
      expect(users.nickname.name).toBe('nickname');
    });

    it('passwordHash column should map to database column "password_hash"', () => {
      expect(users.passwordHash.name).toBe('password_hash');
    });

    it('agreedAt column should map to database column "agreed_at"', () => {
      expect(users.agreedAt.name).toBe('agreed_at');
    });

    it('createdAt column should map to database column "created_at"', () => {
      expect(users.createdAt.name).toBe('created_at');
    });

    it('updatedAt column should map to database column "updated_at"', () => {
      expect(users.updatedAt.name).toBe('updated_at');
    });
  });

  describe('users table unique constraints', () => {
    it('email column should have isUnique property set to true', () => {
      expect(users.email.isUnique).toBe(true);
    });

    it('id column should not have isUnique set (primary key implies uniqueness)', () => {
      // Primary key already enforces uniqueness, isUnique may be undefined or true
      expect(users.id.primary).toBe(true);
    });
  });

  describe('users table name', () => {
    it('should have correct table name "users"', () => {
      // Drizzle exposes table name via Symbol or internal property
      // Access through the table configuration
      const tableConfig = users[Symbol.for('drizzle:Name')];
      expect(tableConfig).toBe('users');
    });
  });
});
