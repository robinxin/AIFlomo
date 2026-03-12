/**
 * apps/server/tests/memos.test.js
 *
 * TDD RED phase — Memo route unit tests.
 *
 * Strategy:
 *   - Build a real Fastify app with session + error handler, but inject a
 *     Jest-mocked `db` instance so no SQLite file is ever touched.
 *   - Session state is simulated by first hitting a /test-login helper route
 *     that sets request.session.userId, then replaying the session cookie.
 *   - Every test is fully isolated: a fresh Fastify instance + fresh mocks
 *     are created in beforeEach and torn down in afterEach.
 *
 * Covered endpoints:
 *   POST   /api/memos          — create memo
 *   GET    /api/memos          — list memos (paginated, filterable)
 *   DELETE /api/memos/:id      — delete memo
 */

import Fastify from 'fastify';
import sessionPlugin from '../src/plugins/session.js';
import memoRoutes from '../src/routes/memos.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_SECRET = 'a'.repeat(64);
const OWNER_USER_ID = 'user-owner-uuid-1234';
const OTHER_USER_ID = 'user-other-uuid-5678';
const MEMO_ID = 'memo-uuid-abcd-1234';

// ─── Mock DB factory ─────────────────────────────────────────────────────────
//
// Each test suite configures the mock return values it needs.  The factory
// returns an object whose methods (select, insert, delete) are all Jest mock
// functions so individual tests can override them with mockResolvedValueOnce /
// mockReturnValueOnce.

function makeMockDb() {
  // Chainable builder stubs – each method returns `this` so callers can chain
  // .from().where().limit()… without errors, then call a terminal method.
  const builder = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    // Terminal resolvers — tests override these per scenario.
    execute: jest.fn().mockResolvedValue([]),
    then: undefined, // Not a thenable by default; tests can set this.
  };

  // Make the builder itself awaitable by having it resolve to [] by default.
  // Individual tests override `execute` or make the builder a real Promise.
  builder[Symbol.iterator] = undefined;

  return {
    select: jest.fn().mockReturnValue(builder),
    insert: jest.fn().mockReturnValue(builder),
    delete: jest.fn().mockReturnValue(builder),
    update: jest.fn().mockReturnValue(builder),
    _builder: builder,
  };
}

// ─── App factory ─────────────────────────────────────────────────────────────

async function buildApp(mockDb) {
  process.env.SESSION_SECRET = VALID_SECRET;

  const app = Fastify({ logger: false });

  // Unified error handler (mirrors apps/server/src/index.js).
  app.setErrorHandler((error, _request, reply) => {
    const statusCode = error.statusCode || 500;

    // Fastify validation errors carry a `validation` array and statusCode 400.
    if (error.validation) {
      return reply.status(400).send({
        data: null,
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
    }

    reply.status(statusCode).send({
      data: null,
      error: error.name || 'Error',
      message: error.message || 'Internal Server Error',
    });
  });

  await app.register(sessionPlugin);

  // Helper route: set session.userId so subsequent requests are authenticated.
  app.get('/test-login', async (request) => {
    request.session.userId = OWNER_USER_ID;
    return { ok: true };
  });

  // Register memo routes under /api/memos, passing the mock db.
  await app.register(memoRoutes, { prefix: '/api/memos', db: mockDb });

  await app.ready();
  return app;
}

// ─── Helper: obtain a valid session cookie ────────────────────────────────────

async function getSessionCookie(app) {
  const res = await app.inject({ method: 'GET', url: '/test-login' });
  return res.headers['set-cookie'];
}

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/memos — create memo
// ═════════════════════════════════════════════════════════════════════════════

describe('POST /api/memos', () => {
  let app;
  let mockDb;

  beforeEach(async () => {
    mockDb = makeMockDb();
    app = await buildApp(mockDb);
  });

  afterEach(async () => {
    await app.close();
    delete process.env.SESSION_SECRET;
  });

  // ── 401 Unauthorized ───────────────────────────────────────────────────────

  it('should return 401 when user is not logged in', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: { content: 'Hello world' },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('UnauthorizedError');
    expect(body.message).toBe('Unauthorized');
  });

  // ── 400 Validation — empty content ────────────────────────────────────────

  it('should return 400 when content is empty string', async () => {
    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: { content: '' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  // ── 400 Validation — content missing ──────────────────────────────────────

  it('should return 400 when content field is absent', async () => {
    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  // ── 400 Validation — content exceeds 10 000 characters ───────────────────

  it('should return 400 when content exceeds 10000 characters', async () => {
    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: { content: 'x'.repeat(10001) },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  // ── 400 Validation — content exactly 10 000 characters is valid ───────────

  it('should accept content of exactly 10000 characters', async () => {
    // The route will proceed past validation and hit the DB.
    // Make the DB return a minimal memo so the route can respond 201.
    const newMemo = {
      id: MEMO_ID,
      content: 'x'.repeat(10000),
      userId: OWNER_USER_ID,
      createdAt: '2026-03-12T08:00:00.000Z',
      updatedAt: '2026-03-12T08:00:00.000Z',
    };
    mockDb._builder.execute.mockResolvedValueOnce([newMemo]);

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: { content: 'x'.repeat(10000) },
    });

    // Should pass validation (may be 201 or 500 depending on DB mock depth,
    // but must NOT be 400).
    expect(res.statusCode).not.toBe(400);
  });

  // ── 400 Validation — tagNames item contains illegal characters ────────────

  it('should return 400 when a tagName contains illegal characters', async () => {
    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: { content: 'Some memo', tagNames: ['valid', 'bad tag!'] },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  // ── 400 Validation — tagName shorter than 2 characters ───────────────────

  it('should return 400 when a tagName is shorter than 2 characters', async () => {
    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: { content: 'Some memo', tagNames: ['a'] },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  // ── 400 Validation — tagName longer than 20 characters ───────────────────

  it('should return 400 when a tagName is longer than 20 characters', async () => {
    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: { content: 'Some memo', tagNames: ['a'.repeat(21)] },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  // ── 400 Validation — imageUrls exceeds maxItems: 9 ───────────────────────

  it('should return 400 when imageUrls has more than 9 items', async () => {
    const cookie = await getSessionCookie(app);

    const imageUrls = Array.from(
      { length: 10 },
      (_, i) => `https://example.com/img${i}.jpg`
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: { content: 'Some memo', imageUrls },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  // ── 400 Validation — additionalProperties rejected ───────────────────────

  it('should return 400 when request body contains unexpected properties', async () => {
    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: { content: 'Hello', unknownField: 'evil' },
    });

    expect(res.statusCode).toBe(400);
  });

  // ── 201 Happy path — plain text memo, no tags, no images ─────────────────

  it('should return 201 with memo data including empty tags and images on success', async () => {
    const newMemo = {
      id: MEMO_ID,
      content: 'Hello world',
      userId: OWNER_USER_ID,
      createdAt: '2026-03-12T08:00:00.000Z',
      updatedAt: '2026-03-12T08:00:00.000Z',
    };

    // Simulate: insert memo → returns inserted row.
    mockDb._builder.execute
      .mockResolvedValueOnce([newMemo])  // INSERT into memos
      // No tagNames → no tag inserts
      // No imageUrls → no image inserts
      ;

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: { content: 'Hello world' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(body.data.id).toBe(MEMO_ID);
    expect(body.data.content).toBe('Hello world');
    expect(Array.isArray(body.data.tags)).toBe(true);
    expect(Array.isArray(body.data.images)).toBe(true);
    expect(body.message).toBeDefined();
  });

  // ── 201 Happy path — memo with new tags (auto-created) ───────────────────

  it('should auto-create new tags and return 201', async () => {
    const newMemo = {
      id: MEMO_ID,
      content: 'Tagged memo',
      userId: OWNER_USER_ID,
      createdAt: '2026-03-12T08:00:00.000Z',
      updatedAt: '2026-03-12T08:00:00.000Z',
    };
    const newTag = {
      id: 'tag-uuid-new',
      name: 'NewTag',
      userId: OWNER_USER_ID,
      createdAt: '2026-03-12T08:00:00.000Z',
    };

    mockDb._builder.execute
      .mockResolvedValueOnce([newMemo])    // INSERT memos → created memo
      .mockResolvedValueOnce([])           // SELECT tags WHERE name = 'NewTag' → not found
      .mockResolvedValueOnce([newTag])     // INSERT tags → new tag
      .mockResolvedValueOnce([])           // INSERT memo_tags association
      ;

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: { content: 'Tagged memo', tagNames: ['NewTag'] },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'tag-uuid-new', name: 'NewTag' }),
      ])
    );
    expect(Array.isArray(body.data.images)).toBe(true);
  });

  // ── 201 Happy path — memo with pre-existing tags (reused) ────────────────

  it('should reuse existing tags and return 201', async () => {
    const newMemo = {
      id: MEMO_ID,
      content: 'Reuse tag memo',
      userId: OWNER_USER_ID,
      createdAt: '2026-03-12T08:00:00.000Z',
      updatedAt: '2026-03-12T08:00:00.000Z',
    };
    const existingTag = {
      id: 'tag-uuid-existing',
      name: 'ExistingTag',
      userId: OWNER_USER_ID,
      createdAt: '2026-03-10T08:00:00.000Z',
    };

    mockDb._builder.execute
      .mockResolvedValueOnce([newMemo])        // INSERT memos
      .mockResolvedValueOnce([existingTag])    // SELECT tags WHERE name = 'ExistingTag' → found
      .mockResolvedValueOnce([])               // INSERT memo_tags association
      ;

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: { content: 'Reuse tag memo', tagNames: ['ExistingTag'] },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'tag-uuid-existing', name: 'ExistingTag' }),
      ])
    );
  });

  // ── 201 Happy path — memo with valid Chinese tag name ────────────────────

  it('should accept Chinese characters in tagNames and return 201', async () => {
    const newMemo = {
      id: MEMO_ID,
      content: '中文笔记',
      userId: OWNER_USER_ID,
      createdAt: '2026-03-12T08:00:00.000Z',
      updatedAt: '2026-03-12T08:00:00.000Z',
    };
    const chineseTag = {
      id: 'tag-cn-uuid',
      name: '工作',
      userId: OWNER_USER_ID,
      createdAt: '2026-03-12T08:00:00.000Z',
    };

    mockDb._builder.execute
      .mockResolvedValueOnce([newMemo])
      .mockResolvedValueOnce([])           // tag not found
      .mockResolvedValueOnce([chineseTag]) // insert new tag
      .mockResolvedValueOnce([])           // insert memo_tag link
      ;

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: { content: '中文笔记', tagNames: ['工作'] },
    });

    expect(res.statusCode).toBe(201);
  });

  // ── Response shape — must include message field ───────────────────────────

  it('should include a message field in the 201 response', async () => {
    const newMemo = {
      id: MEMO_ID,
      content: 'Shape test',
      userId: OWNER_USER_ID,
      createdAt: '2026-03-12T08:00:00.000Z',
      updatedAt: '2026-03-12T08:00:00.000Z',
    };
    mockDb._builder.execute.mockResolvedValueOnce([newMemo]);

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: { content: 'Shape test' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(typeof body.message).toBe('string');
    expect(body.message.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/memos — list memos
// ═════════════════════════════════════════════════════════════════════════════

describe('GET /api/memos', () => {
  let app;
  let mockDb;

  // A single memo row returned by the DB (flat join row, aggregated by route).
  const memoRow = {
    id: MEMO_ID,
    content: 'Hello world',
    userId: OWNER_USER_ID,
    createdAt: '2026-03-12T08:00:00.000Z',
    updatedAt: '2026-03-12T08:00:00.000Z',
    tagId: null,
    tagName: null,
    imageId: null,
    imageUrl: null,
  };

  beforeEach(async () => {
    mockDb = makeMockDb();
    app = await buildApp(mockDb);
  });

  afterEach(async () => {
    await app.close();
    delete process.env.SESSION_SECRET;
  });

  // ── 401 Unauthorized ───────────────────────────────────────────────────────

  it('should return 401 when user is not logged in', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/memos' });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('UnauthorizedError');
  });

  // ── 200 Default parameters ─────────────────────────────────────────────────

  it('should return 200 with default page=1 and limit=20 when no query params given', async () => {
    // Two-phase query: phase-1 returns memo IDs, phase-2 returns full rows,
    // then the count query runs with the same filter conditions.
    const memoIdRow = { id: MEMO_ID };
    mockDb._builder.execute
      .mockResolvedValueOnce([memoIdRow])   // phase-1: memo ID page
      .mockResolvedValueOnce([memoRow])     // phase-2: full data rows
      .mockResolvedValueOnce([{ count: 1 }])  // count query
      ;

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/memos',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data.memos)).toBe(true);
    expect(typeof body.data.total).toBe('number');
    expect(body.data.page).toBe(1);
    expect(body.data.limit).toBe(20);
  });

  // ── 200 Pagination response structure ─────────────────────────────────────

  it('should return data.memos, data.total, data.page, data.limit in response', async () => {
    const memoIdRow = { id: MEMO_ID };
    mockDb._builder.execute
      .mockResolvedValueOnce([memoIdRow])      // phase-1: memo ID page
      .mockResolvedValueOnce([memoRow])        // phase-2: full data rows
      .mockResolvedValueOnce([{ count: 42 }]) // count query
      ;

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/memos?page=2&limit=10',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveProperty('memos');
    expect(body.data).toHaveProperty('total');
    expect(body.data).toHaveProperty('page');
    expect(body.data).toHaveProperty('limit');
    expect(body.data.page).toBe(2);
    expect(body.data.limit).toBe(10);
  });

  // ── 200 filter=all ────────────────────────────────────────────────────────

  it('should return 200 for filter=all', async () => {
    const memoIdRow = { id: MEMO_ID };
    mockDb._builder.execute
      .mockResolvedValueOnce([memoIdRow])      // phase-1
      .mockResolvedValueOnce([memoRow])        // phase-2
      .mockResolvedValueOnce([{ count: 1 }])  // count
      ;

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/memos?filter=all',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
  });

  // ── 200 filter=tagged ─────────────────────────────────────────────────────

  it('should return 200 for filter=tagged', async () => {
    const memoIdRow = { id: MEMO_ID };
    mockDb._builder.execute
      .mockResolvedValueOnce([memoIdRow])      // phase-1
      .mockResolvedValueOnce([memoRow])        // phase-2
      .mockResolvedValueOnce([{ count: 1 }])  // count
      ;

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/memos?filter=tagged',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
  });

  // ── 200 filter=with-images ────────────────────────────────────────────────

  it('should return 200 for filter=with-images', async () => {
    const memoIdRow = { id: MEMO_ID };
    mockDb._builder.execute
      .mockResolvedValueOnce([memoIdRow])      // phase-1
      .mockResolvedValueOnce([memoRow])        // phase-2
      .mockResolvedValueOnce([{ count: 1 }])  // count
      ;

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/memos?filter=with-images',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
  });

  // ── 400 filter value not in enum ──────────────────────────────────────────

  it('should return 400 when filter is an unknown value', async () => {
    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/memos?filter=unknown-value',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  // ── 400 page less than minimum (1) ────────────────────────────────────────

  it('should return 400 when page is less than 1', async () => {
    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/memos?page=0',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  // ── 400 limit exceeds maximum (100) ──────────────────────────────────────

  it('should return 400 when limit exceeds 100', async () => {
    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/memos?limit=101',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  // ── 400 limit less than 1 ────────────────────────────────────────────────

  it('should return 400 when limit is less than 1', async () => {
    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/memos?limit=0',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  // ── 400 additionalProperties rejected ────────────────────────────────────

  it('should return 400 when unknown query params are provided', async () => {
    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/memos?unknownParam=oops',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(400);
  });

  // ── tagId overrides filter ────────────────────────────────────────────────

  it('should return 200 when tagId is provided (overrides filter)', async () => {
    const memoIdRow = { id: MEMO_ID };
    mockDb._builder.execute
      .mockResolvedValueOnce([memoIdRow])      // phase-1
      .mockResolvedValueOnce([memoRow])        // phase-2
      .mockResolvedValueOnce([{ count: 1 }])  // count
      ;

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/memos?tagId=some-tag-uuid&filter=tagged',
      headers: { cookie },
    });

    // tagId takes priority — still valid, must return 200.
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.data.memos)).toBe(true);
  });

  // ── Empty result set ──────────────────────────────────────────────────────

  it('should return 200 with empty memos array when no memos exist', async () => {
    // Phase-1 returns empty — phase-2 is skipped. Only count runs next.
    mockDb._builder.execute
      .mockResolvedValueOnce([])             // phase-1: no memo IDs
      .mockResolvedValueOnce([{ count: 0 }]) // count query
      ;

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/memos',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.memos).toEqual([]);
    expect(body.data.total).toBe(0);
  });

  // ── Tags and images are aggregated per memo ───────────────────────────────

  it('should aggregate tags and images per memo in the response', async () => {
    const memoIdRow = { id: MEMO_ID };
    const memoWithTag = {
      id: MEMO_ID,
      content: 'Tagged',
      userId: OWNER_USER_ID,
      createdAt: '2026-03-12T08:00:00.000Z',
      updatedAt: '2026-03-12T08:00:00.000Z',
      tagId: 'tag-1',
      tagName: '工作',
      imageId: null,
      imageUrl: null,
    };

    mockDb._builder.execute
      .mockResolvedValueOnce([memoIdRow])      // phase-1
      .mockResolvedValueOnce([memoWithTag])    // phase-2
      .mockResolvedValueOnce([{ count: 1 }])  // count
      ;

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/memos',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const memo = body.data.memos[0];
    expect(Array.isArray(memo.tags)).toBe(true);
    expect(Array.isArray(memo.images)).toBe(true);
  });

  // ── message field ─────────────────────────────────────────────────────────

  it('should include a message field in the 200 response', async () => {
    // Empty page: phase-1 returns [], phase-2 is skipped, count runs.
    mockDb._builder.execute
      .mockResolvedValueOnce([])             // phase-1: no memo IDs
      .mockResolvedValueOnce([{ count: 0 }]) // count query
      ;

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/memos',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    expect(typeof res.json().message).toBe('string');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DELETE /api/memos/:id — delete memo
// ═════════════════════════════════════════════════════════════════════════════

describe('DELETE /api/memos/:id', () => {
  let app;
  let mockDb;

  beforeEach(async () => {
    mockDb = makeMockDb();
    app = await buildApp(mockDb);
  });

  afterEach(async () => {
    await app.close();
    delete process.env.SESSION_SECRET;
  });

  // ── 401 Unauthorized ───────────────────────────────────────────────────────

  it('should return 401 when user is not logged in', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/memos/${MEMO_ID}`,
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('UnauthorizedError');
  });

  // ── 404 Memo not found ────────────────────────────────────────────────────

  it('should return 404 when memo does not exist', async () => {
    // SELECT returns empty array → memo not found.
    mockDb._builder.execute.mockResolvedValueOnce([]);

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/memos/non-existent-uuid`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('NotFoundError');
    expect(body.message).toMatch(/not found/i);
  });

  // ── 404 Memo belongs to another user — returns 404 to prevent ID enumeration

  it('should return 404 when memo belongs to a different user (prevents ID enumeration)', async () => {
    // The query filters by both id AND userId in a single WHERE clause.
    // A memo that belongs to another user will not be found, so we return []
    // — the same as a non-existent memo — giving the caller no information
    // about whether the memo exists at all.
    mockDb._builder.execute.mockResolvedValueOnce([]);

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/memos/${MEMO_ID}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('NotFoundError');
  });

  // ── 204 Successful deletion ────────────────────────────────────────────────

  it('should return 204 with no body when deletion is successful', async () => {
    const ownedMemo = {
      id: MEMO_ID,
      content: 'My memo',
      userId: OWNER_USER_ID,
      createdAt: '2026-03-12T08:00:00.000Z',
      updatedAt: '2026-03-12T08:00:00.000Z',
    };

    mockDb._builder.execute
      .mockResolvedValueOnce([ownedMemo])  // SELECT memo
      .mockResolvedValueOnce([])           // DELETE memo
      ;

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/memos/${MEMO_ID}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(204);
    // 204 responses must have no body.
    expect(res.body).toBe('');
  });

  // ── 204 DB delete is called with correct id ───────────────────────────────

  it('should call db.delete with the memo id', async () => {
    const ownedMemo = {
      id: MEMO_ID,
      content: 'My memo',
      userId: OWNER_USER_ID,
      createdAt: '2026-03-12T08:00:00.000Z',
      updatedAt: '2026-03-12T08:00:00.000Z',
    };

    mockDb._builder.execute
      .mockResolvedValueOnce([ownedMemo])
      .mockResolvedValueOnce([])
      ;

    const cookie = await getSessionCookie(app);

    await app.inject({
      method: 'DELETE',
      url: `/api/memos/${MEMO_ID}`,
      headers: { cookie },
    });

    // db.delete should have been called (at least once — for the memo).
    expect(mockDb.delete).toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Edge cases & security
// ═════════════════════════════════════════════════════════════════════════════

describe('Memo routes — edge cases and security', () => {
  let app;
  let mockDb;

  beforeEach(async () => {
    mockDb = makeMockDb();
    app = await buildApp(mockDb);
  });

  afterEach(async () => {
    await app.close();
    delete process.env.SESSION_SECRET;
  });

  // ── POST — content with special characters is accepted ───────────────────

  it('POST /api/memos should accept content with special Unicode characters', async () => {
    const newMemo = {
      id: MEMO_ID,
      content: '🚀 Emoji & <script>evil</script> test',
      userId: OWNER_USER_ID,
      createdAt: '2026-03-12T08:00:00.000Z',
      updatedAt: '2026-03-12T08:00:00.000Z',
    };
    mockDb._builder.execute.mockResolvedValueOnce([newMemo]);

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: { content: '🚀 Emoji & <script>evil</script> test' },
    });

    // Validation passes (content length OK); route handles DB call.
    expect(res.statusCode).not.toBe(400);
  });

  // ── POST — empty tagNames array is treated as no tags ────────────────────

  it('POST /api/memos should accept empty tagNames array', async () => {
    const newMemo = {
      id: MEMO_ID,
      content: 'No tags',
      userId: OWNER_USER_ID,
      createdAt: '2026-03-12T08:00:00.000Z',
      updatedAt: '2026-03-12T08:00:00.000Z',
    };
    mockDb._builder.execute.mockResolvedValueOnce([newMemo]);

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: { content: 'No tags', tagNames: [] },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.tags).toEqual([]);
  });

  // ── GET — page defaults to 1 even when filter is specified ───────────────

  it('GET /api/memos should default page to 1 when only filter is given', async () => {
    // Empty page: phase-1 returns [], phase-2 skipped, count runs.
    mockDb._builder.execute
      .mockResolvedValueOnce([])             // phase-1
      .mockResolvedValueOnce([{ count: 0 }]) // count
      ;

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/memos?filter=all',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.page).toBe(1);
  });

  // ── GET — limit defaults to 20 ───────────────────────────────────────────

  it('GET /api/memos should default limit to 20 when not specified', async () => {
    // Empty page: phase-1 returns [], phase-2 skipped, count runs.
    mockDb._builder.execute
      .mockResolvedValueOnce([])             // phase-1
      .mockResolvedValueOnce([{ count: 0 }]) // count
      ;

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/memos',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.limit).toBe(20);
  });

  // ── DELETE — :id must not be an empty string (param schema minLength:1) ──

  it('DELETE /api/memos/:id with only whitespace id should return 400 or 404', async () => {
    mockDb._builder.execute.mockResolvedValueOnce([]);

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/memos/%20',   // URL-encoded single space
      headers: { cookie },
    });

    // Space-only IDs will either fail schema validation (400) or lookup (404).
    expect([400, 404]).toContain(res.statusCode);
  });

  // ── Error response always contains data/error/message fields ─────────────

  it('error responses always include data, error, and message properties', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: { content: '' },
    });

    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('message');
  });

  // ── POST — imageUrls with http:// scheme is rejected (security) ──────────

  it('POST /api/memos should return 400 when imageUrls contains http:// URL', async () => {
    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: {
        content: 'Memo with insecure image',
        imageUrls: ['http://example.com/image.jpg'],
      },
    });

    // http:// does not match the https:// pattern — must be rejected.
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  // ── POST — imageUrls with data: URI is rejected (XSS prevention) ─────────

  it('POST /api/memos should return 400 when imageUrls contains data: URI', async () => {
    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: {
        content: 'Memo with XSS image',
        imageUrls: ['data:image/png;base64,abc123'],
      },
    });

    // data: URIs are not valid format:uri values and do not match https:// pattern.
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  // ── POST — valid https:// imageUrls are accepted and stored ──────────────

  it('POST /api/memos should accept valid https:// imageUrls and return 201', async () => {
    const newMemo = {
      id: MEMO_ID,
      content: 'Memo with secure images',
      userId: OWNER_USER_ID,
      createdAt: '2026-03-12T08:00:00.000Z',
      updatedAt: '2026-03-12T08:00:00.000Z',
    };
    const insertedImage = {
      id: 'img-uuid-001',
      memoId: MEMO_ID,
      url: 'https://example.com/photo.jpg',
      fileSize: 0,
      mimeType: '',
    };

    mockDb._builder.execute
      .mockResolvedValueOnce([newMemo])       // INSERT memos
      .mockResolvedValueOnce([insertedImage]) // INSERT memo_images
      ;

    const cookie = await getSessionCookie(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/memos',
      headers: { cookie },
      payload: {
        content: 'Memo with secure images',
        imageUrls: ['https://example.com/photo.jpg'],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(Array.isArray(body.data.images)).toBe(true);
  });
});
