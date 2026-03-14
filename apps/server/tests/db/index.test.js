/**
 * TDD Test: apps/server/src/db/index.js
 * Task T005 - DB 访问层
 *
 * Tests verify:
 * 1. db module exports a default db instance (Drizzle)
 * 2. db instance exposes a select() method
 * 3. db instance exposes an insert() method
 * 4. db instance exposes an update() method
 * 5. db.select() returns a query builder (chainable object with from())
 * 6. db.insert() returns a query builder (chainable object with values())
 * 7. db.update() returns a query builder (chainable object with set())
 * 8. Module exports are consistent with jest.mock('../src/db/index.js') convention
 *    used by route-layer tests (auth.test.js)
 *
 * Design contract:
 *   import db from '../../src/db/index.js'
 *   db.select()  -> Drizzle select query builder
 *   db.insert()  -> Drizzle insert query builder
 *   db.update()  -> Drizzle update query builder
 */

import db from '../../src/db/index.js';
import { users } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

describe('T005 - DB 访问层 (apps/server/src/db/index.js)', () => {
  // ── module export ────────────────────────────────────────────────────────────

  describe('module export', () => {
    it('should export a default db instance', () => {
      expect(db).toBeDefined();
      expect(db).not.toBeNull();
    });

    it('should export db as an object', () => {
      expect(typeof db).toBe('object');
    });
  });

  // ── select method ────────────────────────────────────────────────────────────

  describe('db.select()', () => {
    it('should expose a select method', () => {
      expect(typeof db.select).toBe('function');
    });

    it('should return a query builder with a from() method', () => {
      const builder = db.select();
      expect(builder).toBeDefined();
      expect(typeof builder.from).toBe('function');
    });

    it('should allow chaining: db.select().from(table)', () => {
      const builder = db.select().from(users);
      expect(builder).toBeDefined();
    });

    it('should allow querying users table and return an array', async () => {
      const rows = await db.select().from(users);
      expect(Array.isArray(rows)).toBe(true);
    });
  });

  // ── insert method ────────────────────────────────────────────────────────────

  describe('db.insert()', () => {
    it('should expose an insert method', () => {
      expect(typeof db.insert).toBe('function');
    });

    it('should return a query builder with a values() method', () => {
      const builder = db.insert(users);
      expect(builder).toBeDefined();
      expect(typeof builder.values).toBe('function');
    });

    it('should allow chaining: db.insert(table).values(data)', () => {
      const nowMs = Date.now();
      const testUser = {
        id: 'test-id-insert-' + nowMs,
        email: 'insert-test-' + nowMs + '@example.com',
        nickname: 'InsertTest',
        passwordHash: 'hashed-password',
        agreedAt: nowMs,
        createdAt: nowMs,
        updatedAt: nowMs,
      };

      const builder = db.insert(users).values(testUser);
      expect(builder).toBeDefined();
    });

    it('should insert a record and return it on subsequent select', async () => {
      const nowMs = Date.now();
      const testId = 'test-id-flow-' + nowMs;
      const testEmail = 'flow-test-' + nowMs + '@example.com';

      await db.insert(users).values({
        id: testId,
        email: testEmail,
        nickname: 'FlowTest',
        passwordHash: 'hashed-password',
        agreedAt: nowMs,
        createdAt: nowMs,
        updatedAt: nowMs,
      });

      const rows = await db.select().from(users);
      const inserted = rows.find((r) => r.id === testId);
      expect(inserted).toBeDefined();
      expect(inserted.email).toBe(testEmail);
    });
  });

  // ── update method ────────────────────────────────────────────────────────────

  describe('db.update()', () => {
    it('should expose an update method', () => {
      expect(typeof db.update).toBe('function');
    });

    it('should return a query builder with a set() method', () => {
      const builder = db.update(users);
      expect(builder).toBeDefined();
      expect(typeof builder.set).toBe('function');
    });

    it('should allow chaining: db.update(table).set(data).where(condition)', () => {
      const builder = db.update(users).set({ nickname: 'Updated' }).where(eq(users.id, 'some-id'));
      expect(builder).toBeDefined();
    });

    it('should update a record and reflect change on subsequent select', async () => {
      const nowMs = Date.now();
      const testId = 'test-id-update-' + nowMs;
      const testEmail = 'update-test-' + nowMs + '@example.com';

      // Insert first
      await db.insert(users).values({
        id: testId,
        email: testEmail,
        nickname: 'BeforeUpdate',
        passwordHash: 'hashed-password',
        agreedAt: nowMs,
        createdAt: nowMs,
        updatedAt: nowMs,
      });

      // Update the nickname
      const updatedAt = nowMs + 1000;
      await db.update(users)
        .set({ nickname: 'AfterUpdate', updatedAt })
        .where(eq(users.id, testId));

      // Verify the update
      const rows = await db.select().from(users);
      const updated = rows.find((r) => r.id === testId);
      expect(updated).toBeDefined();
      expect(updated.nickname).toBe('AfterUpdate');
      expect(updated.updatedAt).toBe(updatedAt);
    });
  });

  // ── mock convention compatibility ────────────────────────────────────────────

  describe('mock convention compatibility', () => {
    it('db should be the default export (compatible with jest.mock convention)', () => {
      // Route layer tests use: jest.mock('../src/db/index.js')
      // This confirms the default export is a single db object with select/insert/update
      expect(db.select).toBeDefined();
      expect(db.insert).toBeDefined();
      expect(db.update).toBeDefined();
    });

    it('db.select should be mockable (is a function)', () => {
      expect(db.select).toBeInstanceOf(Function);
    });

    it('db.insert should be mockable (is a function)', () => {
      expect(db.insert).toBeInstanceOf(Function);
    });

    it('db.update should be mockable (is a function)', () => {
      expect(db.update).toBeInstanceOf(Function);
    });
  });
});
