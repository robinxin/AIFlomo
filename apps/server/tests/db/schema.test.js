/**
 * Tests for apps/server/src/db/schema.js
 *
 * Verifies that the users and sessions table definitions match the
 * technical design specified in:
 * specs/active/28-feature-account-registration-login-2-design.md § 2.1
 *
 * Test strategy: inspect the Drizzle column descriptors and table-level
 * metadata directly — no live database required. All assertions target the
 * well-known Drizzle internal symbols that the ORM itself relies on.
 */

import { users, sessions } from '../../src/db/schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return the Drizzle column descriptor for a given camelCase field name.
 * Drizzle stores column metadata under Symbol('drizzle:Columns').
 */
function getColumn(table, fieldName) {
  const col = table[Symbol.for('drizzle:Columns')][fieldName];
  if (!col) {
    throw new Error(
      `Column "${fieldName}" not found in table "${table[Symbol.for('drizzle:Name')]}"`,
    );
  }
  return col;
}

/**
 * Return the array of inline ForeignKey objects attached to a table.
 * Each element has: { reference: Function, onDelete, onUpdate, table }
 */
function getInlineForeignKeys(table) {
  return table[Symbol.for('drizzle:SQLiteInlineForeignKeys')] ?? [];
}

// ---------------------------------------------------------------------------
// users table
// ---------------------------------------------------------------------------

describe('users table schema', () => {
  test('table name is "users"', () => {
    expect(users[Symbol.for('drizzle:Name')]).toBe('users');
  });

  test('id column: text type, primary key, has default UUID generator', () => {
    const col = getColumn(users, 'id');
    expect(col.columnType).toBe('SQLiteText');
    expect(col.primary).toBe(true);
    // $defaultFn registers a runtime default function
    expect(typeof col.defaultFn).toBe('function');
    // The generated value must be a valid UUID v4
    const generated = col.defaultFn();
    expect(generated).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  test('email column: text type, not null, unique constraint', () => {
    const col = getColumn(users, 'email');
    expect(col.columnType).toBe('SQLiteText');
    expect(col.notNull).toBe(true);
    expect(col.isUnique).toBe(true);
  });

  test('nickname column: text type, not null', () => {
    const col = getColumn(users, 'nickname');
    expect(col.columnType).toBe('SQLiteText');
    expect(col.notNull).toBe(true);
  });

  test('passwordHash column: text type, not null, DB column name is password_hash', () => {
    const col = getColumn(users, 'passwordHash');
    expect(col.columnType).toBe('SQLiteText');
    expect(col.notNull).toBe(true);
    expect(col.name).toBe('password_hash');
  });

  test('createdAt column: text type, not null, SQL-level default, DB column name is created_at', () => {
    const col = getColumn(users, 'createdAt');
    expect(col.columnType).toBe('SQLiteText');
    expect(col.notNull).toBe(true);
    // sql`(CURRENT_TIMESTAMP)` produces a Drizzle SQL object as the default
    expect(col.default).toBeDefined();
    expect(col.name).toBe('created_at');
  });

  test('updatedAt column: text type, not null, SQL-level default, DB column name is updated_at', () => {
    const col = getColumn(users, 'updatedAt');
    expect(col.columnType).toBe('SQLiteText');
    expect(col.notNull).toBe(true);
    expect(col.default).toBeDefined();
    expect(col.name).toBe('updated_at');
  });

  test('updatedAt column: has $onUpdateFn that returns an ISO 8601 timestamp string', () => {
    const col = getColumn(users, 'updatedAt');
    // $onUpdateFn is stored on col.onUpdateFn by the Drizzle Column base class
    expect(typeof col.onUpdateFn).toBe('function');
    const before = Date.now();
    const result = col.onUpdateFn();
    const after = Date.now();
    // Must be a valid ISO 8601 date-time string
    expect(typeof result).toBe('string');
    expect(new Date(result).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(result).getTime()).toBeLessThanOrEqual(after);
  });

  test('users table exports exactly the expected fields', () => {
    const columnNames = Object.keys(users[Symbol.for('drizzle:Columns')]);
    expect(columnNames.sort()).toEqual(
      ['id', 'email', 'nickname', 'passwordHash', 'createdAt', 'updatedAt'].sort(),
    );
  });
});

// ---------------------------------------------------------------------------
// sessions table
// ---------------------------------------------------------------------------

describe('sessions table schema', () => {
  test('table name is "sessions"', () => {
    expect(sessions[Symbol.for('drizzle:Name')]).toBe('sessions');
  });

  test('id column: text type, primary key, has default UUID generator', () => {
    const col = getColumn(sessions, 'id');
    expect(col.columnType).toBe('SQLiteText');
    expect(col.primary).toBe(true);
    expect(typeof col.defaultFn).toBe('function');
    const generated = col.defaultFn();
    expect(generated).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  test('userId column: text type, not null, DB column name is user_id', () => {
    const col = getColumn(sessions, 'userId');
    expect(col.columnType).toBe('SQLiteText');
    expect(col.notNull).toBe(true);
    expect(col.name).toBe('user_id');
  });

  test('userId column has a foreign key referencing users.id', () => {
    const fks = getInlineForeignKeys(sessions);
    expect(fks.length).toBeGreaterThanOrEqual(1);

    // Find the FK whose source column is user_id
    const fk = fks.find((f) => {
      const ref = f.reference();
      return ref.columns.some((c) => c.name === 'user_id');
    });

    expect(fk).toBeDefined();

    const ref = fk.reference();
    // Foreign table must be users
    expect(ref.foreignTable[Symbol.for('drizzle:Name')]).toBe('users');
    // Referenced column must be id
    expect(ref.foreignColumns.some((c) => c.name === 'id')).toBe(true);
  });

  test('userId foreign key has onDelete: cascade', () => {
    const fks = getInlineForeignKeys(sessions);
    const fk = fks.find((f) => {
      const ref = f.reference();
      return ref.columns.some((c) => c.name === 'user_id');
    });

    expect(fk).toBeDefined();
    expect(fk.onDelete).toBe('cascade');
  });

  test('expiresAt column: integer type, not null, DB column name is expires_at', () => {
    const col = getColumn(sessions, 'expiresAt');
    expect(col.columnType).toBe('SQLiteInteger');
    expect(col.notNull).toBe(true);
    expect(col.name).toBe('expires_at');
  });

  test('createdAt column: text type, not null, SQL-level default, DB column name is created_at', () => {
    const col = getColumn(sessions, 'createdAt');
    expect(col.columnType).toBe('SQLiteText');
    expect(col.notNull).toBe(true);
    expect(col.default).toBeDefined();
    expect(col.name).toBe('created_at');
  });

  test('sessions table exports exactly the expected fields', () => {
    const columnNames = Object.keys(sessions[Symbol.for('drizzle:Columns')]);
    expect(columnNames.sort()).toEqual(
      ['id', 'userId', 'expiresAt', 'createdAt'].sort(),
    );
  });
});
