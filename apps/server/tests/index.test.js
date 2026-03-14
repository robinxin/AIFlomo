/**
 * TDD Test: apps/server/src/index.js
 * Task T007 - Fastify 应用入口文件
 *
 * Tests cover:
 * - Fastify 实例能够成功启动（ready 无异常）
 * - Session 插件已注册（request.session 可访问）
 * - 认证路由已注册（POST /api/auth/register, POST /api/auth/login,
 *                   POST /api/auth/logout, GET /api/auth/me）
 * - Session 插件在认证路由之前注册（依赖顺序正确）
 * - 健康检查端点 GET / 返回 200 和 { status: 'ok' }
 * - CORS 插件已注册
 *
 * Mock 策略:
 * - jest.unstable_mockModule('../src/db/index.js') — 阻止真实 DB 连接
 * - jest.unstable_mockModule('bcrypt')             — 阻止真实哈希
 *
 * 注意事项:
 * - 不在测试中硬编码端口；使用 Fastify inject（不启动 TCP 监听）
 * - 每个测试完成后关闭 app 实例，避免资源泄漏
 *
 * 测试框架: Jest (ESM via --experimental-vm-modules)
 */

import { jest } from '@jest/globals';
import Database from 'better-sqlite3';

// ── ESM Mock Declarations ──────────────────────────────────────────────────────
// Must be declared BEFORE any dynamic import of the mocked modules.

const mockDbSelect = jest.fn();
const mockDbInsert = jest.fn();
const mockDbUpdate = jest.fn();

jest.unstable_mockModule('../src/db/index.js', () => ({
  default: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
}));

jest.unstable_mockModule('bcrypt', () => ({
  default: {
    hash: jest.fn().mockResolvedValue('$2b$10$hashedpassword'),
    compare: jest.fn().mockResolvedValue(true),
  },
}));

// ── Constants ──────────────────────────────────────────────────────────────────

const TEST_SECRET = 'a-very-long-secret-key-for-testing-purposes-minimum-32-chars';

// ── Dynamic Imports (after mocks are declared) ─────────────────────────────────

const { buildApp } = await import('../src/index.js');

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Create a fresh in-memory SQLite DB for each test so sessions are isolated.
 */
function makeTestDb() {
  return new Database(':memory:');
}

/**
 * Build a test Fastify application with in-memory SQLite for session storage.
 * Does NOT bind to a real TCP port — relies on fastify.inject().
 */
async function createTestApp() {
  const db = makeTestDb();
  const app = await buildApp({
    secret: TEST_SECRET,
    db,
    logger: false,
  });
  await app.ready();
  return { app, db };
}

// ── Test Suites ────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Fastify 实例启动
// ─────────────────────────────────────────────────────────────────────────────
describe('Fastify 应用入口', () => {
  describe('实例启动', () => {
    let app;
    let db;

    beforeEach(async () => {
      const result = await createTestApp();
      app = result.app;
      db = result.db;
    });

    afterEach(async () => {
      await app.close();
      db.close();
    });

    it('should build and start the Fastify app without throwing', async () => {
      // app.ready() was already called in createTestApp — this verifies the exported
      // buildApp factory resolves successfully.
      expect(app).toBeDefined();
      expect(typeof app.inject).toBe('function');
    });

    it('should export a buildApp function', async () => {
      const mod = await import('../src/index.js');
      expect(typeof mod.buildApp).toBe('function');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 健康检查端点
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /', () => {
  let app;
  let db;

  beforeEach(async () => {
    const result = await createTestApp();
    app = result.app;
    db = result.db;
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('should return 200 on GET /', async () => {
    const response = await app.inject({ method: 'GET', url: '/' });
    expect(response.statusCode).toBe(200);
  });

  it('should return { status: "ok" } on GET /', async () => {
    const response = await app.inject({ method: 'GET', url: '/' });
    const body = JSON.parse(response.body);
    expect(body).toEqual({ status: 'ok' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Session 插件注册验证
// ─────────────────────────────────────────────────────────────────────────────
describe('Session 插件注册', () => {
  // Note: Fastify 5 does NOT allow adding routes after app.ready() / listen().
  // Each test that needs probe routes must build its own app instance and add
  // the probe routes BEFORE calling app.ready().

  it('should expose request.session on every request', async () => {
    const db = makeTestDb();
    const app = await buildApp({ secret: TEST_SECRET, db, logger: false });

    // Add probe route BEFORE ready()
    app.get('/probe-session', async (request, reply) => {
      const hasSession = request.session !== undefined && request.session !== null;
      return reply.send({ hasSession });
    });

    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/probe-session' });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.hasSession).toBe(true);

    await app.close();
    db.close();
  });

  it('should allow writing and reading session data within the same request', async () => {
    const db = makeTestDb();
    const app = await buildApp({ secret: TEST_SECRET, db, logger: false });

    app.get('/probe-session-write', async (request, reply) => {
      request.session.testKey = 'testValue';
      await request.session.save();
      return reply.send({ saved: true });
    });

    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/probe-session-write' });
    expect(response.statusCode).toBe(200);

    await app.close();
    db.close();
  });

  it('should persist session data between two requests using the same cookie', async () => {
    const db = makeTestDb();
    const app = await buildApp({ secret: TEST_SECRET, db, logger: false });

    // Write session
    app.post('/session-set', async (request, reply) => {
      request.session.marker = 'hello';
      await request.session.save();
      return reply.send({ ok: true });
    });

    // Read session
    app.get('/session-get', async (request, reply) => {
      return reply.send({ marker: request.session.marker ?? null });
    });

    await app.ready();

    const setRes = await app.inject({ method: 'POST', url: '/session-set' });
    expect(setRes.statusCode).toBe(200);

    const rawCookie = setRes.headers['set-cookie'];
    const cookieValue = (Array.isArray(rawCookie) ? rawCookie[0] : rawCookie).split(';')[0];

    const getRes = await app.inject({
      method: 'GET',
      url: '/session-get',
      headers: { cookie: cookieValue },
    });
    expect(getRes.statusCode).toBe(200);
    const body = JSON.parse(getRes.body);
    expect(body.marker).toBe('hello');

    await app.close();
    db.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 认证路由注册验证
// ─────────────────────────────────────────────────────────────────────────────
describe('认证路由注册 (prefix: /api/auth)', () => {
  let app;
  let db;

  beforeEach(async () => {
    jest.clearAllMocks();
    const result = await createTestApp();
    app = result.app;
    db = result.db;
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('POST /api/auth/register should be registered (not 404)', async () => {
    // Simulate a valid-format request — the handler may return other errors
    // (e.g., 400/409), but should NOT return 404.
    const chain = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([]),
    };
    mockDbSelect.mockReturnValue(chain);

    const insertChain = { values: jest.fn().mockResolvedValue([]) };
    mockDbInsert.mockReturnValue(insertChain);

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'test@example.com',
        nickname: '测试用户',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.statusCode).not.toBe(404);
  });

  it('POST /api/auth/login should be registered (not 404)', async () => {
    const chain = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([]),
    };
    mockDbSelect.mockReturnValue(chain);

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'password123',
      },
    });

    expect(response.statusCode).not.toBe(404);
  });

  it('POST /api/auth/logout should be registered (not 404)', async () => {
    // No session → 401, not 404
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    });

    expect(response.statusCode).not.toBe(404);
  });

  it('GET /api/auth/me should be registered (not 404)', async () => {
    // No session → 401, not 404
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(response.statusCode).not.toBe(404);
  });

  it('POST /api/auth/register with valid data should return 201', async () => {
    const chain = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([]),
    };
    mockDbSelect.mockReturnValue(chain);

    const insertChain = { values: jest.fn().mockResolvedValue([]) };
    mockDbInsert.mockReturnValue(insertChain);

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'newuser@example.com',
        nickname: '新用户',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('注册成功');
    expect(body.data).toBeDefined();
    expect(body.data.email).toBe('newuser@example.com');
  });

  it('POST /api/auth/login with invalid credentials should return 401', async () => {
    const chain = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([]),
    };
    mockDbSelect.mockReturnValue(chain);

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
      },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('邮箱或密码错误，请重试');
  });

  it('POST /api/auth/logout without session should return 401', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('请先登录');
    expect(body.message).toBe('未授权访问');
  });

  it('GET /api/auth/me without session should return 401', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('请先登录');
    expect(body.message).toBe('未授权访问');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Session 插件在认证路由之前注册（依赖顺序）
// ─────────────────────────────────────────────────────────────────────────────
describe('Session 插件注册顺序', () => {
  it('should have session available when auth route handler is invoked', async () => {
    // If session plugin is NOT registered before the auth routes, then
    // POST /api/auth/register would fail with a "session is not a function" or
    // "Cannot set properties of null" type error → 500 instead of expected status.
    //
    // We verify by calling register and then accessing a session-dependent route.
    jest.clearAllMocks();

    const db = makeTestDb();
    const app = await buildApp({ secret: TEST_SECRET, db, logger: false });
    await app.ready();

    // Setup mocks for a successful register flow
    const chain = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([]),
    };
    mockDbSelect.mockReturnValue(chain);
    mockDbInsert.mockReturnValue({ values: jest.fn().mockResolvedValue([]) });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'order@example.com',
        nickname: '顺序测试',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    // 201 proves that session.userId was set successfully inside the handler,
    // which would only be possible if the session plugin was already registered.
    expect(response.statusCode).toBe(201);

    await app.close();
    db.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CORS 插件注册验证
// ─────────────────────────────────────────────────────────────────────────────
describe('CORS 插件注册', () => {
  let app;
  let db;

  beforeEach(async () => {
    const result = await createTestApp();
    app = result.app;
    db = result.db;
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('should include CORS headers in the response', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/',
      headers: { origin: 'http://localhost:8082' },
    });

    // @fastify/cors adds Access-Control-Allow-Origin header
    expect(response.headers['access-control-allow-origin']).toBeDefined();
  });

  it('should respond to OPTIONS preflight requests', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/',
      headers: {
        origin: 'http://localhost:8082',
        'access-control-request-method': 'POST',
      },
    });

    // A 204 or 200 is typical for preflight; the key is it's not 404/405.
    expect(response.statusCode).not.toBe(404);
    expect(response.statusCode).not.toBe(405);
  });
});
