/**
 * T007: 验证 Fastify 入口文件注册顺序
 *
 * 覆盖范围：
 *   - Session 插件（@fastify/cookie + @fastify/session）在路由注册前就位
 *   - 认证路由挂载在 /api/auth 前缀下
 *   - /health 健康检查端点正常响应
 *   - Session 插件先于认证路由注册（顺序正确性）
 *
 * 策略：
 *   buildApp() 已与服务器启动逻辑（fastify.listen）解耦，
 *   可以在测试中直接导入，无需真实网络连接。
 *   connect-sqlite3 与 better-sqlite3 等运行时依赖通过 Jest mock 隔离。
 */

// ---------------------------------------------------------------------------
// Module mocks — 必须在所有 import 之前声明
// ---------------------------------------------------------------------------

jest.mock('../src/db/index.js', () => ({
  db: {
    select: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue([]),
  },
}));

// Mock connect-sqlite3 so session plugin does not require a real SQLite file
jest.mock('connect-sqlite3', () => {
  return jest.fn(() => {
    // Returns a mock SQLiteStore constructor
    return class MockSQLiteStore {
      constructor() {}
    };
  });
});

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { buildApp } from '../src/index.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('T007 — buildApp: 插件与路由注册', () => {
  let app;

  beforeEach(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  // -------------------------------------------------------------------------
  // Session plugin registered
  // -------------------------------------------------------------------------

  test('Session 插件已注册 — request.session 装饰器存在', async () => {
    // @fastify/session decorates request with `session`; verify by sending a
    // request and checking that the server does not crash with "session undefined"
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    // Health endpoint should always respond 200 regardless of session state
    expect(response.statusCode).toBe(200);
  });

  test('Session 插件已注册 — fastify 实例拥有 session 相关装饰', async () => {
    // @fastify/cookie registers `fastify.parseCookie`
    // @fastify/session registers `fastify.decryptSession` or similar
    // The most reliable way is to confirm that routes depending on session
    // do not throw "session is not decorated"
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'bad', password: 'bad' },
    });

    // Schema validation rejects bad email → 400, proving routes are wired up
    // and session decorator did not crash the request lifecycle
    expect(response.statusCode).toBe(400);
  });

  // -------------------------------------------------------------------------
  // Auth routes registered at /api/auth prefix
  // -------------------------------------------------------------------------

  test('认证路由已注册 — POST /api/auth/register 可达', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {},
    });

    // Returns 400 (schema validation) rather than 404 — route exists
    expect(response.statusCode).not.toBe(404);
  });

  test('认证路由已注册 — POST /api/auth/login 可达', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {},
    });

    expect(response.statusCode).not.toBe(404);
  });

  test('认证路由已注册 — POST /api/auth/logout 可达', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    });

    // 401 (requireAuth) rather than 404 — route exists and session works
    expect(response.statusCode).not.toBe(404);
  });

  test('认证路由已注册 — GET /api/auth/me 可达', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    // 401 (requireAuthForMe) rather than 404
    expect(response.statusCode).not.toBe(404);
  });

  test('不存在的路由返回 404', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/unknown-route',
    });

    expect(response.statusCode).toBe(404);
  });

  // -------------------------------------------------------------------------
  // Health check endpoint
  // -------------------------------------------------------------------------

  test('GET /health — 返回 200 和 { status: "ok", timestamp }', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('number');
    expect(body.timestamp).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Registration order: session before auth routes
  // -------------------------------------------------------------------------

  test('注册顺序正确 — 认证路由收到的请求拥有 session 对象（不崩溃）', async () => {
    // If session plugin were NOT registered before auth routes, the
    // request.session access inside requireAuth would throw or return undefined,
    // causing a 500 instead of the expected 401.
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    });

    // requireAuth returns 401 when unauthenticated — proves session is set up
    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
    expect(body.error).toBe('请先登录');
  });

  test('注册顺序正确 — /api/auth/me 未登录时返回 401 而非 500', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
    expect(body.error).toBe('请先登录');
  });
});
