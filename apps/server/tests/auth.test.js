/**
 * Integration tests for POST /api/auth/register
 *
 * File path: apps/server/src/routes/auth.js
 *
 * TDD phase: RED — apps/server/src/routes/auth.js does not exist yet.
 * All tests below are expected to FAIL until the route file is created.
 *
 * What is tested:
 *   1. Successful registration (201 Created, user info returned, no passwordHash)
 *   2. Duplicate email (409 Conflict, EMAIL_ALREADY_EXISTS)
 *   3. Invalid email format (400, VALIDATION_ERROR)
 *   4. Password too short (< 6 chars) (400, VALIDATION_ERROR)
 *   5. Password too long (> 128 chars) (400, VALIDATION_ERROR)
 *   6. agreePolicy not true (400, VALIDATION_ERROR)
 *   7. Nickname too short (< 1 char) (400, VALIDATION_ERROR)
 *   8. Nickname too long (> 50 chars) (400, VALIDATION_ERROR)
 *   9. Missing required fields (400, VALIDATION_ERROR)
 *  10. Email is lowercased before persistence
 *  11. Session cookie is set on successful registration
 *  12. passwordHash is never returned in any response
 *  13. Concurrent duplicate registration race condition
 *  14. Special characters in nickname (Unicode/emoji)
 *  15. Email at boundary length (255 characters)
 *  16. Email exceeding max length (256 characters)
 *
 * Test isolation strategy:
 *   - globalSetup (jest.globalSetup.js) creates a fresh test SQLite database
 *     at apps/server/test-data/auth-test.db before the suite runs.
 *   - DB_PATH and SESSION_SECRET environment variables are set in globalSetup
 *     and inherited by these worker processes.
 *   - Each test cleans up rows it inserted via afterEach hooks to prevent
 *     cross-test contamination.
 *   - The Fastify app is created fresh in beforeEach and closed in afterEach
 *     to guarantee plugin isolation.
 *
 * Architecture assumptions (matching the design doc):
 *   - The route plugin is the default export of src/routes/auth.js.
 *   - The plugin registers POST /api/auth/register.
 *   - Fastify JSON Schema validation rejects malformed bodies with 400.
 *   - On duplicate email the handler returns 409 with error 'EMAIL_ALREADY_EXISTS'.
 *   - On server-side errors the handler returns 500 with error 'INTERNAL_ERROR'.
 *   - The response envelope on success is: { data: { id, email, nickname, createdAt }, message }
 *   - The response envelope on failure is: { data: null, error, message }
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import Fastify from 'fastify';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../src/db/index.js';
import { users, sessions } from '../src/db/schema.js';
import sessionPlugin from '../src/plugins/session.js';
import authPlugin from '../src/plugins/auth.js';

// ---------------------------------------------------------------------------
// App factory — creates a minimal Fastify instance with the auth route
// registered under the expected prefix.
//
// The session plugin must be registered before authPlugin and the route plugin
// because:
//   1. Session plugin registers @fastify/cookie (required by requireAuth).
//   2. authPlugin decorates fastify with requireAuth (required by logout route).
//   3. Route plugin registers all /api/auth/* handlers.
// ---------------------------------------------------------------------------

async function buildApp() {
  const app = Fastify({ logger: false });

  // Register session plugin (registers @fastify/cookie internally)
  await app.register(sessionPlugin);

  // Register the requireAuth decorator used by protected routes
  await app.register(authPlugin);

  // Register the auth route plugin (the module under test)
  // The plugin must export its routes under the /api/auth prefix.
  await app.register(import('../src/routes/auth.js'), { prefix: '/api/auth' });

  return app;
}

// ---------------------------------------------------------------------------
// Setup — run DB migrations once before all tests in this file.
// The globalSetup script creates the raw SQLite schema; the migrate() call
// here ensures the Drizzle migration state is also applied to avoid table-
// creation errors when Drizzle queries run inside handler code.
// ---------------------------------------------------------------------------

describe('POST /api/auth/register', () => {
  let app;

  beforeAll(() => {
    // Apply Drizzle migrations to the test database.
    // globalSetup already created the tables via raw SQL, but migrate() is
    // idempotent and ensures the migration journal is consistent.
    migrate(db, { migrationsFolder: './src/db/migrations' });
  });

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    // Remove all test data in dependency order (sessions reference users).
    await db.delete(sessions);
    await db.delete(users);

    if (app) {
      await app.close();
    }
  });

  // =========================================================================
  // 1. Successful registration
  // =========================================================================

  describe('성공 케이스: successful registration', () => {
    it('should return 201 with user data when all fields are valid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'alice@example.com',
          nickname: '爱丽丝',
          password: 'secure123',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(body.message).toBe('注册成功');
    });

    it('should return the new user id, email, nickname and createdAt in data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'bob@example.com',
          nickname: '鲍勃',
          password: 'secure123',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.body);
      expect(body.data.id).toBeDefined();
      expect(typeof body.data.id).toBe('string');
      expect(body.data.email).toBe('bob@example.com');
      expect(body.data.nickname).toBe('鲍勃');
      expect(body.data.createdAt).toBeDefined();
    });

    it('should NEVER return passwordHash in the response', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'charlie@example.com',
          nickname: 'Charlie',
          password: 'secure123',
          agreePolicy: true,
        },
      });

      const body = JSON.parse(response.body);

      // passwordHash must not appear anywhere in the response envelope
      expect(body.data?.passwordHash).toBeUndefined();
      expect(body.data?.password_hash).toBeUndefined();
      expect(JSON.stringify(body)).not.toMatch(/password_hash/i);
      expect(JSON.stringify(body)).not.toMatch(/passwordHash/i);
    });

    it('should set a sessionId cookie on successful registration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'diana@example.com',
          nickname: 'Diana',
          password: 'secure123',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(201);

      const setCookieHeader = response.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();

      // Cookie value must contain the session identifier
      const cookieStr = Array.isArray(setCookieHeader)
        ? setCookieHeader.join('; ')
        : setCookieHeader;
      expect(cookieStr).toMatch(/sessionId=/);
    });

    it('should store the user in the database after registration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'eve@example.com',
          nickname: 'Eve',
          password: 'secure123',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.body);
      const userId = body.data.id;

      const rows = await db.select().from(users);
      const inserted = rows.find((u) => u.id === userId);

      expect(inserted).toBeDefined();
      expect(inserted.email).toBe('eve@example.com');
      expect(inserted.nickname).toBe('Eve');
      // passwordHash must exist in the database (stored as a bcrypt hash)
      expect(inserted.passwordHash).toBeDefined();
      expect(inserted.passwordHash).toMatch(/^\$2[aby]\$/);
    });
  });

  // =========================================================================
  // 2. Email lowercasing
  // =========================================================================

  describe('email normalisation', () => {
    it('should lowercase the email before storing it', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'Frank@EXAMPLE.COM',
          nickname: 'Frank',
          password: 'secure123',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.body);
      // Returned email must be lowercase
      expect(body.data.email).toBe('frank@example.com');

      // Database must store lowercase email
      const rows = await db.select().from(users);
      const inserted = rows.find((u) => u.id === body.data.id);
      expect(inserted.email).toBe('frank@example.com');
    });

    it('should treat mixed-case email as duplicate when the lowercase version already exists', async () => {
      // Register with lowercase first
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'grace@example.com',
          nickname: 'Grace',
          password: 'secure123',
          agreePolicy: true,
        },
      });

      // Attempt registration with the same email in different case
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'GRACE@EXAMPLE.COM',
          nickname: 'Grace2',
          password: 'secure456',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('EMAIL_ALREADY_EXISTS');
    });
  });

  // =========================================================================
  // 3. Duplicate email — 409
  // =========================================================================

  describe('409 Conflict: duplicate email', () => {
    it('should return 409 when the email is already registered', async () => {
      const payload = {
        email: 'heidi@example.com',
        nickname: 'Heidi',
        password: 'secure123',
        agreePolicy: true,
      };

      // First registration — must succeed
      const first = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload,
      });
      expect(first.statusCode).toBe(201);

      // Second registration with the same email — must fail
      const second = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload,
      });

      expect(second.statusCode).toBe(409);
    });

    it('should return error EMAIL_ALREADY_EXISTS and Chinese message on 409', async () => {
      const payload = {
        email: 'ivan@example.com',
        nickname: 'Ivan',
        password: 'secure123',
        agreePolicy: true,
      };

      await app.inject({ method: 'POST', url: '/api/auth/register', payload });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload,
      });

      const body = JSON.parse(response.body);
      expect(body.error).toBe('EMAIL_ALREADY_EXISTS');
      expect(body.message).toBe('该邮箱已被注册');
      expect(body.data).toBeNull();
    });
  });

  // =========================================================================
  // 4. Validation errors — 400
  // =========================================================================

  describe('400 Bad Request: validation errors', () => {
    // -----------------------------------------------------------------------
    // Missing required fields
    // -----------------------------------------------------------------------

    it('should return 400 when email is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          nickname: 'Judy',
          password: 'secure123',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when nickname is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'judy@example.com',
          password: 'secure123',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when password is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'judy@example.com',
          nickname: 'Judy',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when agreePolicy is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'judy@example.com',
          nickname: 'Judy',
          password: 'secure123',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when the request body is empty', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    // -----------------------------------------------------------------------
    // Email format validation
    // -----------------------------------------------------------------------

    it('should return 400 when email has no @ symbol', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'notanemail',
          nickname: 'Kate',
          password: 'secure123',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when email has no domain part', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'kate@',
          nickname: 'Kate',
          password: 'secure123',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when email has no TLD (local@domain only)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'kate@domain',
          nickname: 'Kate',
          password: 'secure123',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when email is an empty string', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: '',
          nickname: 'Kate',
          password: 'secure123',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when email exceeds 255 characters', async () => {
      // Create an email whose total length is 256: local@<domain>
      // local part = 244 chars, @ = 1, domain = 11 chars → total = 256
      const localPart = 'a'.repeat(244);
      const email = `${localPart}@example.com`; // 244 + 1 + 11 = 256

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          nickname: 'Leo',
          password: 'secure123',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should accept a valid email at exactly 255 characters', async () => {
      // local part = 243 chars, @ = 1, domain = 11 chars → total = 255
      const localPart = 'a'.repeat(243);
      const email = `${localPart}@example.com`;
      expect(email.length).toBe(255);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email,
          nickname: 'Maxemail',
          password: 'secure123',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(201);
    });

    // -----------------------------------------------------------------------
    // Password length validation
    // -----------------------------------------------------------------------

    it('should return 400 when password has fewer than 6 characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'mike@example.com',
          nickname: 'Mike',
          password: 'abc',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when password is exactly 5 characters (one below minimum)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'mike@example.com',
          nickname: 'Mike',
          password: 'abcde',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should accept a password of exactly 6 characters (minimum boundary)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'nancy@example.com',
          nickname: 'Nancy',
          password: 'abcdef',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it('should return 400 when password exceeds 128 characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'oscar@example.com',
          nickname: 'Oscar',
          password: 'a'.repeat(129),
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when password is exactly 129 characters (one above maximum)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'oscar@example.com',
          nickname: 'Oscar',
          password: 'x'.repeat(129),
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should accept a password of exactly 128 characters (maximum boundary)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'petra@example.com',
          nickname: 'Petra',
          password: 'a'.repeat(128),
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it('should return 400 when password is an empty string', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'quinn@example.com',
          nickname: 'Quinn',
          password: '',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    // -----------------------------------------------------------------------
    // agreePolicy validation
    // -----------------------------------------------------------------------

    it('should return 400 when agreePolicy is false', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'rachel@example.com',
          nickname: 'Rachel',
          password: 'secure123',
          agreePolicy: false,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when agreePolicy is the string "true" instead of boolean true', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'sam@example.com',
          nickname: 'Sam',
          password: 'secure123',
          agreePolicy: 'true',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when agreePolicy is 1 instead of boolean true', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'tina@example.com',
          nickname: 'Tina',
          password: 'secure123',
          agreePolicy: 1,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when agreePolicy is null', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'uma@example.com',
          nickname: 'Uma',
          password: 'secure123',
          agreePolicy: null,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    // -----------------------------------------------------------------------
    // Nickname length validation
    // -----------------------------------------------------------------------

    it('should return 400 when nickname is an empty string (length 0, below minimum of 1)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'victor@example.com',
          nickname: '',
          password: 'secure123',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should accept a nickname of exactly 1 character (minimum boundary)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'wendy@example.com',
          nickname: 'W',
          password: 'secure123',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it('should accept a nickname of exactly 50 characters (maximum boundary)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'xavier@example.com',
          nickname: 'X'.repeat(50),
          password: 'secure123',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it('should return 400 when nickname exceeds 50 characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'yara@example.com',
          nickname: 'Y'.repeat(51),
          password: 'secure123',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when nickname is exactly 51 characters (one above maximum)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'zara@example.com',
          nickname: 'Z'.repeat(51),
          password: 'secure123',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    // -----------------------------------------------------------------------
    // Validation error response shape
    // -----------------------------------------------------------------------

    it('should include VALIDATION_ERROR code and null data in the 400 response body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'bad-email',
          nickname: 'Test',
          password: 'secure123',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.data).toBeNull();
      expect(typeof body.message).toBe('string');
      expect(body.message.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 5. Edge cases: special characters in nickname
  // =========================================================================

  describe('edge cases: special inputs', () => {
    it('should accept a nickname with Unicode characters (CJK, Arabic, etc.)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'unicode@example.com',
          nickname: '张三李四مرحبا',
          password: 'secure123',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.nickname).toBe('张三李四مرحبا');
    });

    it('should accept a nickname that contains emoji characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'emoji@example.com',
          nickname: '😀 Cool User',
          password: 'secure123',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it('should accept a password with special characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'special@example.com',
          nickname: 'Special',
          password: '!@#$%^&*()_+-=[]{}|;\':\",./<>?`~',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it('should correctly store the session in the sessions table after registration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'session-check@example.com',
          nickname: 'SessionCheck',
          password: 'secure123',
          agreePolicy: true,
        },
      });

      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.body);
      const userId = body.data.id;

      // Check that a session row was created for this user
      const sessionRows = await db.select().from(sessions);
      const userSession = sessionRows.find((s) => s.userId === userId);

      expect(userSession).toBeDefined();
      // Session should expire roughly 7 days in the future (allow 60s tolerance)
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(userSession.expiresAt).toBeGreaterThan(Date.now() + sevenDaysMs - 60_000);
    });
  });

  // =========================================================================
  // 6. Concurrent duplicate registration (race condition)
  // =========================================================================

  describe('race condition: concurrent registration with same email', () => {
    it('should ensure only one registration succeeds when two requests arrive simultaneously', async () => {
      const payload = {
        email: 'race@example.com',
        nickname: 'Racer',
        password: 'secure123',
        agreePolicy: true,
      };

      // Fire two requests concurrently
      const [response1, response2] = await Promise.all([
        app.inject({ method: 'POST', url: '/api/auth/register', payload }),
        app.inject({ method: 'POST', url: '/api/auth/register', payload }),
      ]);

      const statuses = [response1.statusCode, response2.statusCode].sort();

      // Exactly one must succeed (201) and exactly one must fail (409)
      expect(statuses).toEqual([201, 409]);
    });
  });

  // =========================================================================
  // 7. HTTP method and content-type guards
  // =========================================================================

  describe('HTTP method and routing guards', () => {
    it('should return 404 for GET /api/auth/register (route not registered for GET)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/register',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 415 or 400 when Content-Type is not application/json', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        headers: { 'content-type': 'text/plain' },
        payload: 'email=test@example.com',
      });

      // Fastify rejects non-JSON bodies for routes with JSON schema validation
      expect([400, 415]).toContain(response.statusCode);
    });
  });
});
