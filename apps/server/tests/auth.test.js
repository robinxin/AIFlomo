/**
 * 认证 API 端点单元测试（Jest）
 *
 * 覆盖范围：
 *   - POST /api/auth/register — 注册
 *   - POST /api/auth/login    — 登录
 *   - POST /api/auth/logout   — 登出
 *   - GET  /api/auth/me       — 获取当前用户
 *
 * 所有外部依赖（DB、bcrypt、session）均使用 Jest mock 隔离。
 * 测试在 RED 阶段编写，实现代码尚未存在，预期全部失败。
 */

// ---------------------------------------------------------------------------
// Module mocks — 必须在所有 import 之前声明
// ---------------------------------------------------------------------------

jest.mock('../src/db/index.js', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import Fastify from 'fastify';
import authRoutes from '../src/routes/auth.js';
import { db } from '../src/db/index.js';
import bcrypt from 'bcryptjs';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const VALID_USER = {
  id: 'test-uuid-1234',
  email: 'test@example.com',
  nickname: '测试用户',
  createdAt: 1741824000000,
};

const VALID_USER_WITH_HASH = {
  ...VALID_USER,
  passwordHash: '$2b$10$hashedpassword',
  agreedAt: 1741824000000,
  updatedAt: 1741824000000,
};

/**
 * 构建一个带有 session 支持的 Fastify 测试实例。
 * session 插件在此处以内存模拟方式注册，无需真实数据库连接。
 */
async function buildApp(sessionData = {}) {
  const fastify = Fastify({ logger: false });

  // 模拟 session 插件（decorator + preHandler hook）
  fastify.decorateRequest('session', null);
  fastify.addHook('preHandler', (request, _reply, done) => {
    request.session = {
      userId: sessionData.userId || null,
      destroy: jest.fn((cb) => cb && cb()),
      ...sessionData,
    };
    done();
  });

  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.ready();
  return fastify;
}

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

describe('POST /api/auth/register', () => {
  let app;

  beforeEach(async () => {
    jest.clearAllMocks();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  test('注册成功 — 返回 201 和用户信息（不含密码哈希）', async () => {
    // DB: 邮箱未被注册（查询返回空数组）
    db.select.mockResolvedValueOnce([]);
    // bcrypt: 哈希成功
    bcrypt.hash.mockResolvedValueOnce('$2b$10$hashedpassword');
    // DB: 插入成功
    db.insert.mockResolvedValueOnce([VALID_USER_WITH_HASH]);

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

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('注册成功');
    expect(body.data).toBeTruthy();
    expect(body.data.email).toBe('test@example.com');
    expect(body.data.nickname).toBe('测试用户');
    expect(body.data.id).toBeTruthy();
    expect(body.data.createdAt).toBeTruthy();
    // 严禁返回密码哈希
    expect(body.data.passwordHash).toBeUndefined();
    expect(body.data.password_hash).toBeUndefined();
  });

  test('注册成功 — 响应包含 data 和 message 字段', async () => {
    db.select.mockResolvedValueOnce([]);
    bcrypt.hash.mockResolvedValueOnce('$2b$10$hashedpassword');
    db.insert.mockResolvedValueOnce([VALID_USER_WITH_HASH]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'newuser@example.com',
        nickname: '新用户AB',
        password: 'securePass1',
        agreedToPrivacy: true,
      },
    });

    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('message');
    expect(body.data).not.toBeNull();
  });

  test('注册成功 — 昵称前后空格被 trim 后存储', async () => {
    db.select.mockResolvedValueOnce([]);
    bcrypt.hash.mockResolvedValueOnce('$2b$10$hashedpassword');
    db.insert.mockResolvedValueOnce([{ ...VALID_USER_WITH_HASH, nickname: '空格用户' }]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'trimtest@example.com',
        nickname: '  空格用户  ',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.statusCode).toBe(201);
    // 验证 DB insert 被调用时昵称已被 trim
    expect(db.insert).toHaveBeenCalled();
    const insertCall = db.insert.mock.calls[0];
    // 昵称在插入时不应包含前后空格
    const insertedNickname = JSON.stringify(insertCall);
    expect(insertedNickname).not.toMatch(/^\s|\s$/);
  });

  // -------------------------------------------------------------------------
  // 邮箱已存在 — 409
  // -------------------------------------------------------------------------

  test('邮箱已被注册 — 返回 409 和错误信息', async () => {
    // DB: 邮箱已存在（返回有记录的数组）
    db.select.mockResolvedValueOnce([VALID_USER_WITH_HASH]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'test@example.com',
        nickname: '重复用户',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
    expect(body.error).toBe('该邮箱已被注册');
    expect(body.message).toBe('注册失败');
  });

  // -------------------------------------------------------------------------
  // 参数校验失败 — 400
  // -------------------------------------------------------------------------

  test('缺少 email 字段 — 返回 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nickname: '测试用户',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
    expect(body.error).toBeTruthy();
  });

  test('邮箱格式非法（不含 @）— 返回 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'invalid-email',
        nickname: '测试用户',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
  });

  test('邮箱格式非法（不完整域名）— 返回 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'test@',
        nickname: '测试用户',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  test('昵称少于 2 个字符 — 返回 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'test@example.com',
        nickname: 'A',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
  });

  test('昵称超过 20 个字符 — 返回 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'test@example.com',
        nickname: 'A'.repeat(21),
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
  });

  test('昵称为纯空格 — 返回 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'test@example.com',
        nickname: '   ',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
  });

  test('密码少于 8 个字符 — 返回 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'test@example.com',
        nickname: '测试用户',
        password: 'short',
        agreedToPrivacy: true,
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
  });

  test('密码超过 20 个字符 — 返回 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'test@example.com',
        nickname: '测试用户',
        password: 'a'.repeat(21),
        agreedToPrivacy: true,
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 隐私协议未勾选 — 400
  // -------------------------------------------------------------------------

  test('agreedToPrivacy 为 false — 返回 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'test@example.com',
        nickname: '测试用户',
        password: 'password123',
        agreedToPrivacy: false,
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
    expect(body.error).toBeTruthy();
  });

  test('agreedToPrivacy 缺失 — 返回 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'test@example.com',
        nickname: '测试用户',
        password: 'password123',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  // -------------------------------------------------------------------------
  // 数据库错误 — 500
  // -------------------------------------------------------------------------

  test('数据库写入异常 — 返回 500', async () => {
    db.select.mockResolvedValueOnce([]);
    bcrypt.hash.mockResolvedValueOnce('$2b$10$hashedpassword');
    db.insert.mockRejectedValueOnce(new Error('DB write error'));

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

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
    expect(body.error).toBe('服务器内部错误，请稍后重试');
  });

  // -------------------------------------------------------------------------
  // 边界值
  // -------------------------------------------------------------------------

  test('昵称恰好 2 个字符 — 注册成功', async () => {
    db.select.mockResolvedValueOnce([]);
    bcrypt.hash.mockResolvedValueOnce('$2b$10$hashedpassword');
    db.insert.mockResolvedValueOnce([{ ...VALID_USER_WITH_HASH, nickname: 'AB' }]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'boundary@example.com',
        nickname: 'AB',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.statusCode).toBe(201);
  });

  test('昵称恰好 20 个字符 — 注册成功', async () => {
    db.select.mockResolvedValueOnce([]);
    bcrypt.hash.mockResolvedValueOnce('$2b$10$hashedpassword');
    db.insert.mockResolvedValueOnce([{ ...VALID_USER_WITH_HASH, nickname: 'A'.repeat(20) }]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'boundary20@example.com',
        nickname: 'A'.repeat(20),
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.statusCode).toBe(201);
  });

  test('密码恰好 8 个字符 — 注册成功', async () => {
    db.select.mockResolvedValueOnce([]);
    bcrypt.hash.mockResolvedValueOnce('$2b$10$hashedpassword');
    db.insert.mockResolvedValueOnce([VALID_USER_WITH_HASH]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'pass8@example.com',
        nickname: '密码测试',
        password: 'pass1234',
        agreedToPrivacy: true,
      },
    });

    expect(response.statusCode).toBe(201);
  });

  test('密码恰好 20 个字符 — 注册成功', async () => {
    db.select.mockResolvedValueOnce([]);
    bcrypt.hash.mockResolvedValueOnce('$2b$10$hashedpassword');
    db.insert.mockResolvedValueOnce([VALID_USER_WITH_HASH]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'pass20@example.com',
        nickname: '密码测试',
        password: 'a'.repeat(20),
        agreedToPrivacy: true,
      },
    });

    expect(response.statusCode).toBe(201);
  });

  test('请求体包含额外字段 — 返回 400（additionalProperties: false）', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'test@example.com',
        nickname: '测试用户',
        password: 'password123',
        agreedToPrivacy: true,
        extraField: 'should not be allowed',
      },
    });

    expect(response.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

describe('POST /api/auth/login', () => {
  let app;

  beforeEach(async () => {
    jest.clearAllMocks();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  test('登录成功 — 返回 200 和用户信息（不含密码哈希）', async () => {
    db.select.mockResolvedValueOnce([VALID_USER_WITH_HASH]);
    bcrypt.compare.mockResolvedValueOnce(true);

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'password123',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('登录成功');
    expect(body.data).toBeTruthy();
    expect(body.data.email).toBe('test@example.com');
    expect(body.data.id).toBeTruthy();
    // 严禁返回密码哈希
    expect(body.data.passwordHash).toBeUndefined();
    expect(body.data.password_hash).toBeUndefined();
  });

  test('登录成功 — session 中写入了 userId', async () => {
    db.select.mockResolvedValueOnce([VALID_USER_WITH_HASH]);
    bcrypt.compare.mockResolvedValueOnce(true);

    // 用自定义 session spy 验证 userId 被写入
    let capturedSession;
    const fastify = Fastify({ logger: false });
    fastify.decorateRequest('session', null);
    fastify.addHook('preHandler', (request, _reply, done) => {
      request.session = { userId: null };
      capturedSession = request.session;
      done();
    });
    await fastify.register(authRoutes, { prefix: '/api/auth' });
    await fastify.ready();

    await fastify.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test@example.com', password: 'password123' },
    });

    expect(capturedSession.userId).toBe(VALID_USER.id);
    await fastify.close();
  });

  // -------------------------------------------------------------------------
  // 邮箱或密码错误 — 401
  // -------------------------------------------------------------------------

  test('邮箱不存在 — 返回 401，错误信息不泄露具体原因', async () => {
    db.select.mockResolvedValueOnce([]); // 用户不存在

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'notfound@example.com',
        password: 'password123',
      },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
    expect(body.error).toBe('登录信息有误，请重试');
    expect(body.message).toBe('登录失败');
    // 不应透露"用户不存在"
    expect(body.error).not.toContain('用户不存在');
  });

  test('密码错误 — 返回 401，错误信息不泄露具体原因', async () => {
    db.select.mockResolvedValueOnce([VALID_USER_WITH_HASH]);
    bcrypt.compare.mockResolvedValueOnce(false); // 密码比对失败

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'wrongpassword',
      },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
    expect(body.error).toBe('登录信息有误，请重试');
    // 不应透露"密码错误"
    expect(body.error).not.toContain('密码');
  });

  // -------------------------------------------------------------------------
  // 参数校验失败 — 400
  // -------------------------------------------------------------------------

  test('缺少 email 字段 — 返回 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: 'password123' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
  });

  test('缺少 password 字段 — 返回 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test@example.com' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
  });

  test('邮箱格式非法 — 返回 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'bad-email', password: 'password123' },
    });

    expect(response.statusCode).toBe(400);
  });

  test('password 为空字符串 — 返回 400（minLength: 1）', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test@example.com', password: '' },
    });

    expect(response.statusCode).toBe(400);
  });

  // -------------------------------------------------------------------------
  // 数据库错误 — 500
  // -------------------------------------------------------------------------

  test('数据库查询异常 — 返回 500', async () => {
    db.select.mockRejectedValueOnce(new Error('DB read error'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test@example.com', password: 'password123' },
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
    expect(body.error).toBe('服务器内部错误，请稍后重试');
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------

describe('POST /api/auth/logout', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 已登录 — 登出成功
  // -------------------------------------------------------------------------

  test('已登录用户登出 — 返回 200 和成功信息', async () => {
    const app = await buildApp({ userId: 'test-uuid-1234' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
    expect(body.message).toBe('已成功登出');

    await app.close();
  });

  test('已登录用户登出 — session.destroy() 被调用', async () => {
    const destroyMock = jest.fn((cb) => cb && cb());
    const fastify = Fastify({ logger: false });
    fastify.decorateRequest('session', null);
    fastify.addHook('preHandler', (request, _reply, done) => {
      request.session = { userId: 'test-uuid-1234', destroy: destroyMock };
      done();
    });
    await fastify.register(authRoutes, { prefix: '/api/auth' });
    await fastify.ready();

    await fastify.inject({ method: 'POST', url: '/api/auth/logout' });

    expect(destroyMock).toHaveBeenCalled();
    await fastify.close();
  });

  // -------------------------------------------------------------------------
  // 未登录 — 登出失败 401
  // -------------------------------------------------------------------------

  test('未登录用户登出 — requireAuth 拦截，返回 401', async () => {
    // buildApp 默认 session.userId = null，模拟未登录
    const app = await buildApp({ userId: null });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
    expect(body.error).toBe('请先登录');

    await app.close();
  });

  test('session 为空对象（无 userId）— 返回 401', async () => {
    const fastify = Fastify({ logger: false });
    fastify.decorateRequest('session', null);
    fastify.addHook('preHandler', (request, _reply, done) => {
      request.session = {}; // 没有 userId
      done();
    });
    await fastify.register(authRoutes, { prefix: '/api/auth' });
    await fastify.ready();

    const response = await fastify.inject({ method: 'POST', url: '/api/auth/logout' });

    expect(response.statusCode).toBe(401);
    await fastify.close();
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------

describe('GET /api/auth/me', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 已登录 — 返回用户信息
  // -------------------------------------------------------------------------

  test('已登录用户获取自身信息 — 返回 200 和用户信息', async () => {
    const app = await buildApp({ userId: 'test-uuid-1234' });
    db.select.mockResolvedValueOnce([VALID_USER_WITH_HASH]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('获取用户信息成功');
    expect(body.data).toBeTruthy();
    expect(body.data.email).toBe('test@example.com');
    expect(body.data.nickname).toBe('测试用户');
    expect(body.data.id).toBe('test-uuid-1234');
    // 不含密码哈希
    expect(body.data.passwordHash).toBeUndefined();
    expect(body.data.password_hash).toBeUndefined();

    await app.close();
  });

  // -------------------------------------------------------------------------
  // 未登录 — 401
  // -------------------------------------------------------------------------

  test('未登录用户访问 — requireAuth 拦截，返回 401', async () => {
    const app = await buildApp({ userId: null });

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
    expect(body.error).toBe('请先登录');
    expect(body.message).toBe('获取用户信息失败');

    await app.close();
  });

  // -------------------------------------------------------------------------
  // Session 中 userId 对应用户已被删除 — 401
  // -------------------------------------------------------------------------

  test('session userId 对应用户不存在（已删除）— 返回 401', async () => {
    const app = await buildApp({ userId: 'deleted-user-uuid' });
    db.select.mockResolvedValueOnce([]); // DB 查询无结果

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
    expect(body.error).toBe('用户不存在，请重新登录');

    await app.close();
  });

  // -------------------------------------------------------------------------
  // 数据库查询异常 — 500
  // -------------------------------------------------------------------------

  test('数据库查询异常 — 返回 500', async () => {
    const app = await buildApp({ userId: 'test-uuid-1234' });
    db.select.mockRejectedValueOnce(new Error('DB select error'));

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
    expect(body.error).toBe('服务器内部错误，请稍后重试');

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// 分支覆盖补充测试
// ---------------------------------------------------------------------------

describe('POST /api/auth/logout — session.destroy 失败', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('session.destroy 抛出错误 — 返回 500', async () => {
    const fastify = Fastify({ logger: false });
    fastify.decorateRequest('session', null);
    fastify.addHook('preHandler', (request, _reply, done) => {
      request.session = {
        userId: 'test-uuid-1234',
        destroy: jest.fn((cb) => cb && cb(new Error('Session destroy failed'))),
      };
      done();
    });
    await fastify.register(authRoutes, { prefix: '/api/auth' });
    await fastify.ready();

    const response = await fastify.inject({ method: 'POST', url: '/api/auth/logout' });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
    expect(body.error).toBe('服务器内部错误，请稍后重试');

    await fastify.close();
  });
});

describe('POST /api/auth/login — 额外字段', () => {
  let app;

  beforeEach(async () => {
    jest.clearAllMocks();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  test('login 请求体包含额外字段 — 返回 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'password123',
        extraField: 'should not be allowed',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
  });
});

