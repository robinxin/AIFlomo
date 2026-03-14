/**
 * tests/routes/auth.test.js — 认证路由单元测试
 *
 * 测试策略：
 *   - 使用 jest.unstable_mockModule（ESM 兼容的 mock 方式）替换数据库层和 bcrypt
 *   - 构造轻量 Fastify 请求/响应伪对象，避免启动真实服务器
 *   - 直接调用各处理函数进行白盒测试
 *   - 覆盖成功路径、各类错误场景和内部异常场景
 *
 * 注意：Jest ESM 中 jest.unstable_mockModule 必须在 import 之前调用
 *   且被测模块必须通过动态 import() 加载（模块注册 mock 后）
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// ─── ESM Mock 注册（必须在 dynamic import 之前） ────────────────────────────

// 数据库 mock
const mockDbSelect = jest.fn();
const mockDbInsert = jest.fn();
const mockDbUpdate = jest.fn();

jest.unstable_mockModule('../../src/db/index.js', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
  users: {},
}));

// bcrypt mock
const mockBcryptHash = jest.fn();
const mockBcryptCompare = jest.fn();

jest.unstable_mockModule('bcrypt', () => ({
  default: {
    hash: mockBcryptHash,
    compare: mockBcryptCompare,
  },
  hash: mockBcryptHash,
  compare: mockBcryptCompare,
}));

// drizzle-orm eq mock
jest.unstable_mockModule('drizzle-orm', () => ({
  eq: jest.fn((field, value) => ({ field, value })),
}));

// requireAuth mock（默认放行）
jest.unstable_mockModule('../../src/lib/auth.js', () => ({
  requireAuth: jest.fn((_req, _reply, done) => done()),
}));

// ─── 动态加载被测模块（mock 注册后执行）────────────────────────────────────

// 通过假 Fastify 实例注册路由并提取处理函数
let registerHandler;
let loginHandler;
let logoutHandler;
let getMeHandler;
let errorHandler;

// 模拟 Fastify 实例，收集路由注册信息
function createFakeFastify() {
  const routes = {};
  const errorHandlers = [];

  return {
    post(path, options) {
      routes[`POST:${path}`] = { options, handler: options.handler };
    },
    get(path, options) {
      routes[`GET:${path}`] = { options, handler: options.handler };
    },
    setErrorHandler(fn) {
      errorHandlers.push(fn);
    },
    _routes: routes,
    _errorHandlers: errorHandlers,
  };
}

// 在测试开始前一次性加载路由模块
// 使用顶层 await 确保 mock 已注册
const { default: authRoutesPlugin } = await import('../../src/routes/auth.js');
const fakeFastify = createFakeFastify();
await authRoutesPlugin(fakeFastify);

registerHandler = fakeFastify._routes['POST:/register']?.handler;
loginHandler = fakeFastify._routes['POST:/login']?.handler;
logoutHandler = fakeFastify._routes['POST:/logout']?.handler;
getMeHandler = fakeFastify._routes['GET:/me']?.handler;
errorHandler = fakeFastify._errorHandlers[0];

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

/** 构造模拟 request 对象 */
function makeRequest({ body = {}, session = {}, url = '/register', log = null } = {}) {
  return {
    body,
    session,
    url,
    log: log || {
      error: jest.fn(),
      info: jest.fn(),
    },
  };
}

/** 构造支持链式调用的 reply 对象 */
function makeReply() {
  const reply = {
    _code: null,
    _body: null,
    code(statusCode) {
      this._code = statusCode;
      return this;
    },
    send(body) {
      this._body = body;
      return this;
    },
  };
  return reply;
}

/** 构建 Drizzle select 链式查询 mock */
function buildSelectMock(result) {
  const whereMock = jest.fn().mockResolvedValue(result);
  const fromMock = jest.fn().mockReturnValue({ where: whereMock });
  mockDbSelect.mockReturnValueOnce({ from: fromMock });
  return { fromMock, whereMock };
}

/** 构建 Drizzle insert mock */
function buildInsertMock(result = undefined) {
  const valuesMock = jest.fn().mockResolvedValue(result);
  mockDbInsert.mockReturnValueOnce({ values: valuesMock });
  return { valuesMock };
}

/** 构建 Drizzle update mock */
function buildUpdateMock(result = undefined) {
  const whereMock = jest.fn().mockResolvedValue(result);
  const setMock = jest.fn().mockReturnValue({ where: whereMock });
  mockDbUpdate.mockReturnValueOnce({ set: setMock });
  return { setMock, whereMock };
}

// 每次测试前清空所有 mock 调用记录
beforeEach(() => {
  jest.clearAllMocks();
});

// ─── POST /register 测试套件 ─────────────────────────────────────────────────

describe('POST /register — 用户注册', () => {
  describe('成功注册', () => {
    test('有效参数注册成功，返回 201 + 用户信息（不含 passwordHash）', async () => {
      buildSelectMock([]);
      mockBcryptHash.mockResolvedValueOnce('hashed_password_123');
      buildInsertMock();

      const request = makeRequest({
        body: {
          email: 'user@example.com',
          nickname: '小明',
          password: 'password123',
          agreedToPrivacy: true,
        },
        session: {},
        url: '/register',
      });
      const reply = makeReply();

      await registerHandler(request, reply);

      expect(reply._code).toBe(201);
      expect(reply._body.data).toBeDefined();
      expect(reply._body.data.email).toBe('user@example.com');
      expect(reply._body.data.nickname).toBe('小明');
      expect(reply._body.data.id).toBeDefined();
      expect(reply._body.data.createdAt).toBeDefined();
      expect(reply._body.data.passwordHash).toBeUndefined();
      expect(reply._body.message).toBe('注册成功');
    });

    test('注册成功后，session.userId 被赋值', async () => {
      buildSelectMock([]);
      mockBcryptHash.mockResolvedValueOnce('hashed_password');
      buildInsertMock();

      const session = {};
      const request = makeRequest({
        body: {
          email: 'session@example.com',
          nickname: '会话用户',
          password: 'password123',
          agreedToPrivacy: true,
        },
        session,
        url: '/register',
      });
      const reply = makeReply();

      await registerHandler(request, reply);

      expect(session.userId).toBeDefined();
      expect(typeof session.userId).toBe('string');
      expect(session.userId.length).toBeGreaterThan(0);
    });

    test('昵称包含前后空格时，trim 后存储并在响应中返回', async () => {
      buildSelectMock([]);
      mockBcryptHash.mockResolvedValueOnce('hashed_password');

      let capturedValues;
      const valuesMock = jest.fn().mockImplementation((vals) => {
        capturedValues = vals;
        return Promise.resolve();
      });
      mockDbInsert.mockReturnValueOnce({ values: valuesMock });

      const request = makeRequest({
        body: {
          email: 'trim@example.com',
          nickname: '  小红  ',
          password: 'password123',
          agreedToPrivacy: true,
        },
        session: {},
        url: '/register',
      });
      const reply = makeReply();

      await registerHandler(request, reply);

      expect(reply._code).toBe(201);
      expect(reply._body.data.nickname).toBe('小红');
      expect(capturedValues.nickname).toBe('小红');
    });

    test('bcrypt.hash 以 saltRounds=10 调用', async () => {
      buildSelectMock([]);
      mockBcryptHash.mockResolvedValueOnce('hashed_pw');
      buildInsertMock();

      const request = makeRequest({
        body: {
          email: 'bcrypt@example.com',
          nickname: '测试',
          password: 'mypassword1',
          agreedToPrivacy: true,
        },
        session: {},
        url: '/register',
      });
      const reply = makeReply();

      await registerHandler(request, reply);

      expect(mockBcryptHash).toHaveBeenCalledWith('mypassword1', 10);
    });

    test('生成的 id 是 UUID 格式', async () => {
      buildSelectMock([]);
      mockBcryptHash.mockResolvedValueOnce('hash');
      buildInsertMock();

      const request = makeRequest({
        body: {
          email: 'uuid@example.com',
          nickname: 'UUID用户',
          password: 'password123',
          agreedToPrivacy: true,
        },
        session: {},
        url: '/register',
      });
      const reply = makeReply();

      await registerHandler(request, reply);

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(uuidRegex.test(reply._body.data.id)).toBe(true);
    });

    test('插入数据库时包含 agreedAt、createdAt、updatedAt 字段', async () => {
      buildSelectMock([]);
      mockBcryptHash.mockResolvedValueOnce('hash');

      let capturedValues;
      const valuesMock = jest.fn().mockImplementation((vals) => {
        capturedValues = vals;
        return Promise.resolve();
      });
      mockDbInsert.mockReturnValueOnce({ values: valuesMock });

      const request = makeRequest({
        body: {
          email: 'timestamps@example.com',
          nickname: '时间戳',
          password: 'password123',
          agreedToPrivacy: true,
        },
        session: {},
        url: '/register',
      });
      const reply = makeReply();

      await registerHandler(request, reply);

      expect(typeof capturedValues.agreedAt).toBe('number');
      expect(typeof capturedValues.createdAt).toBe('number');
      expect(typeof capturedValues.updatedAt).toBe('number');
    });
  });

  describe('邮箱已被注册 — 409 冲突', () => {
    test('邮箱已存在，返回 409 + 错误信息', async () => {
      buildSelectMock([{ id: 'existing-id', email: 'user@example.com' }]);

      const request = makeRequest({
        body: {
          email: 'user@example.com',
          nickname: '小红',
          password: 'password456',
          agreedToPrivacy: true,
        },
        session: {},
        url: '/register',
      });
      const reply = makeReply();

      await registerHandler(request, reply);

      expect(reply._code).toBe(409);
      expect(reply._body).toEqual({
        data: null,
        error: '该邮箱已被注册',
        message: '注册失败',
      });
    });

    test('邮箱已存在时，不调用 bcrypt.hash', async () => {
      buildSelectMock([{ id: 'existing-id', email: 'user@example.com' }]);

      const request = makeRequest({
        body: {
          email: 'user@example.com',
          nickname: '重复注册',
          password: 'password123',
          agreedToPrivacy: true,
        },
        session: {},
        url: '/register',
      });
      const reply = makeReply();

      await registerHandler(request, reply);

      expect(mockBcryptHash).not.toHaveBeenCalled();
    });

    test('数据库 UNIQUE 约束错误（SQLITE_CONSTRAINT_UNIQUE），返回 409', async () => {
      buildSelectMock([]);
      mockBcryptHash.mockResolvedValueOnce('hashed');

      const uniqueError = new Error('UNIQUE constraint failed: users.email');
      uniqueError.code = 'SQLITE_CONSTRAINT_UNIQUE';
      const valuesMock = jest.fn().mockRejectedValueOnce(uniqueError);
      mockDbInsert.mockReturnValueOnce({ values: valuesMock });

      const request = makeRequest({
        body: {
          email: 'concurrent@example.com',
          nickname: '并发用户',
          password: 'password123',
          agreedToPrivacy: true,
        },
        session: {},
        url: '/register',
      });
      const reply = makeReply();

      await registerHandler(request, reply);

      expect(reply._code).toBe(409);
      expect(reply._body.error).toBe('该邮箱已被注册');
    });

    test('错误消息包含 "UNIQUE constraint failed"，返回 409', async () => {
      buildSelectMock([]);
      mockBcryptHash.mockResolvedValueOnce('hashed');

      const uniqueError = new Error('UNIQUE constraint failed: users.email');
      const valuesMock = jest.fn().mockRejectedValueOnce(uniqueError);
      mockDbInsert.mockReturnValueOnce({ values: valuesMock });

      const request = makeRequest({
        body: {
          email: 'another@example.com',
          nickname: '另一个',
          password: 'password123',
          agreedToPrivacy: true,
        },
        session: {},
        url: '/register',
      });
      const reply = makeReply();

      await registerHandler(request, reply);

      expect(reply._code).toBe(409);
      expect(reply._body.error).toBe('该邮箱已被注册');
    });
  });

  describe('数据库异常 — 500 内部错误', () => {
    test('数据库 select 抛出未知错误，返回 500', async () => {
      const dbError = new Error('database connection failed');
      const whereMock = jest.fn().mockRejectedValueOnce(dbError);
      const fromMock = jest.fn().mockReturnValue({ where: whereMock });
      mockDbSelect.mockReturnValueOnce({ from: fromMock });

      const request = makeRequest({
        body: {
          email: 'error@example.com',
          nickname: '错误用户',
          password: 'password123',
          agreedToPrivacy: true,
        },
        session: {},
        url: '/register',
      });
      const reply = makeReply();

      await registerHandler(request, reply);

      expect(reply._code).toBe(500);
      expect(reply._body).toEqual({
        data: null,
        error: '服务器内部错误，请稍后重试',
        message: '注册失败',
      });
    });

    test('500 响应不包含数据库错误详情（不泄露内部信息）', async () => {
      const dbError = new Error('Internal sqlite error: table users has no column named hack');
      const whereMock = jest.fn().mockRejectedValueOnce(dbError);
      const fromMock = jest.fn().mockReturnValue({ where: whereMock });
      mockDbSelect.mockReturnValueOnce({ from: fromMock });

      const request = makeRequest({
        body: {
          email: 'leak@example.com',
          nickname: '泄露测试',
          password: 'password123',
          agreedToPrivacy: true,
        },
        session: {},
        url: '/register',
      });
      const reply = makeReply();

      await registerHandler(request, reply);

      const bodyStr = JSON.stringify(reply._body);
      expect(bodyStr).not.toContain('sqlite');
      expect(bodyStr).not.toContain('table');
    });
  });
});

// ─── POST /login 测试套件 ────────────────────────────────────────────────────

describe('POST /login — 用户登录', () => {
  describe('成功登录', () => {
    test('有效邮箱和密码，返回 200 + 用户信息（不含 passwordHash）', async () => {
      const fakeUser = {
        id: 'user-uuid-123',
        email: 'user@example.com',
        nickname: '小明',
        passwordHash: '$2b$10$hashedvalue',
        createdAt: 1741824000000,
        updatedAt: 1741824000000,
      };

      buildSelectMock([fakeUser]);
      mockBcryptCompare.mockResolvedValueOnce(true);
      buildUpdateMock();

      const session = {};
      const request = makeRequest({
        body: { email: 'user@example.com', password: 'password123' },
        session,
        url: '/login',
      });
      const reply = makeReply();

      await loginHandler(request, reply);

      expect(reply._code).toBe(200);
      expect(reply._body.data).toEqual({
        id: 'user-uuid-123',
        email: 'user@example.com',
        nickname: '小明',
        createdAt: 1741824000000,
      });
      expect(reply._body.data.passwordHash).toBeUndefined();
      expect(reply._body.message).toBe('登录成功');
    });

    test('登录成功后，session.userId 被赋值为用户 id', async () => {
      const fakeUser = {
        id: 'user-uuid-456',
        email: 'session@example.com',
        nickname: '会话测试',
        passwordHash: '$2b$10$hash',
        createdAt: 1000000,
        updatedAt: 1000000,
      };

      buildSelectMock([fakeUser]);
      mockBcryptCompare.mockResolvedValueOnce(true);
      buildUpdateMock();

      const session = {};
      const request = makeRequest({
        body: { email: 'session@example.com', password: 'password123' },
        session,
        url: '/login',
      });
      const reply = makeReply();

      await loginHandler(request, reply);

      expect(session.userId).toBe('user-uuid-456');
    });

    test('登录成功后更新用户 updatedAt', async () => {
      const fakeUser = {
        id: 'user-update-id',
        email: 'update@example.com',
        nickname: '更新测试',
        passwordHash: '$2b$10$hash',
        createdAt: 1000000,
        updatedAt: 1000000,
      };

      buildSelectMock([fakeUser]);
      mockBcryptCompare.mockResolvedValueOnce(true);
      const { setMock } = buildUpdateMock();

      const request = makeRequest({
        body: { email: 'update@example.com', password: 'password123' },
        session: {},
        url: '/login',
      });
      const reply = makeReply();

      await loginHandler(request, reply);

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ updatedAt: expect.any(Number) })
      );
    });

    test('bcrypt.compare 以明文密码和存储的哈希值调用', async () => {
      const fakeUser = {
        id: 'user-id',
        email: 'user@example.com',
        nickname: '小明',
        passwordHash: '$2b$10$storedHash',
        createdAt: 1000000,
        updatedAt: 1000000,
      };

      buildSelectMock([fakeUser]);
      mockBcryptCompare.mockResolvedValueOnce(true);
      buildUpdateMock();

      const request = makeRequest({
        body: { email: 'user@example.com', password: 'plaintext123' },
        session: {},
        url: '/login',
      });
      const reply = makeReply();

      await loginHandler(request, reply);

      expect(mockBcryptCompare).toHaveBeenCalledWith('plaintext123', '$2b$10$storedHash');
    });
  });

  describe('登录失败 — 401', () => {
    test('邮箱不存在，返回 401（统一错误提示，不泄露"用户不存在"）', async () => {
      buildSelectMock([]);

      const request = makeRequest({
        body: { email: 'nonexistent@example.com', password: 'password123' },
        session: {},
        url: '/login',
      });
      const reply = makeReply();

      await loginHandler(request, reply);

      expect(reply._code).toBe(401);
      expect(reply._body).toEqual({
        data: null,
        error: '邮箱或密码错误，请重试',
        message: '登录失败',
      });
    });

    test('密码错误，返回 401（统一错误提示，不泄露"密码错误"）', async () => {
      const fakeUser = {
        id: 'user-id',
        email: 'user@example.com',
        nickname: '小明',
        passwordHash: '$2b$10$correcthash',
        createdAt: 1000000,
        updatedAt: 1000000,
      };

      buildSelectMock([fakeUser]);
      mockBcryptCompare.mockResolvedValueOnce(false);

      const request = makeRequest({
        body: { email: 'user@example.com', password: 'wrongpassword' },
        session: {},
        url: '/login',
      });
      const reply = makeReply();

      await loginHandler(request, reply);

      expect(reply._code).toBe(401);
      expect(reply._body).toEqual({
        data: null,
        error: '邮箱或密码错误，请重试',
        message: '登录失败',
      });
    });

    test('邮箱不存在时，不调用 bcrypt.compare', async () => {
      buildSelectMock([]);

      const request = makeRequest({
        body: { email: 'ghost@example.com', password: 'password123' },
        session: {},
        url: '/login',
      });
      const reply = makeReply();

      await loginHandler(request, reply);

      expect(mockBcryptCompare).not.toHaveBeenCalled();
    });

    test('邮箱不存在时，session.userId 不被赋值', async () => {
      buildSelectMock([]);

      const session = {};
      const request = makeRequest({
        body: { email: 'ghost@example.com', password: 'password123' },
        session,
        url: '/login',
      });
      const reply = makeReply();

      await loginHandler(request, reply);

      expect(session.userId).toBeUndefined();
    });

    test('密码错误时，session.userId 不被赋值', async () => {
      const fakeUser = {
        id: 'user-id',
        email: 'user@example.com',
        nickname: '小明',
        passwordHash: '$2b$10$correcthash',
        createdAt: 1000000,
        updatedAt: 1000000,
      };

      buildSelectMock([fakeUser]);
      mockBcryptCompare.mockResolvedValueOnce(false);

      const session = {};
      const request = makeRequest({
        body: { email: 'user@example.com', password: 'wrongpassword' },
        session,
        url: '/login',
      });
      const reply = makeReply();

      await loginHandler(request, reply);

      expect(session.userId).toBeUndefined();
    });
  });

  describe('数据库异常 — 500', () => {
    test('数据库查询失败，返回 500（不暴露内部错误）', async () => {
      const dbError = new Error('Connection refused');
      const whereMock = jest.fn().mockRejectedValueOnce(dbError);
      const fromMock = jest.fn().mockReturnValue({ where: whereMock });
      mockDbSelect.mockReturnValueOnce({ from: fromMock });

      const request = makeRequest({
        body: { email: 'error@example.com', password: 'password123' },
        session: {},
        url: '/login',
      });
      const reply = makeReply();

      await loginHandler(request, reply);

      expect(reply._code).toBe(500);
      expect(reply._body).toEqual({
        data: null,
        error: '服务器内部错误，请稍后重试',
        message: '登录失败',
      });
    });
  });
});

// ─── POST /logout 测试套件 ───────────────────────────────────────────────────

describe('POST /logout — 用户登出', () => {
  describe('成功登出', () => {
    test('已登录用户登出，Session 销毁，返回 200', async () => {
      const destroyMock = jest.fn().mockResolvedValueOnce(undefined);
      const request = makeRequest({
        session: { userId: 'user-id-123', destroy: destroyMock },
        url: '/logout',
      });
      const reply = makeReply();

      await logoutHandler(request, reply);

      expect(destroyMock).toHaveBeenCalledTimes(1);
      expect(reply._code).toBe(200);
      expect(reply._body).toEqual({
        data: null,
        message: '已成功登出',
      });
    });

    test('登出响应不包含 error 字段', async () => {
      const destroyMock = jest.fn().mockResolvedValueOnce(undefined);
      const request = makeRequest({
        session: { userId: 'user-id-456', destroy: destroyMock },
        url: '/logout',
      });
      const reply = makeReply();

      await logoutHandler(request, reply);

      expect(reply._body.error).toBeUndefined();
    });
  });

  describe('Session 销毁失败 — 500', () => {
    test('session.destroy() 抛出错误，返回 500', async () => {
      const destroyMock = jest.fn().mockRejectedValueOnce(new Error('destroy failed'));
      const request = makeRequest({
        session: { userId: 'user-id-999', destroy: destroyMock },
        url: '/logout',
      });
      const reply = makeReply();

      await logoutHandler(request, reply);

      expect(reply._code).toBe(500);
      expect(reply._body).toEqual({
        data: null,
        error: '服务器内部错误，请稍后重试',
        message: '登出失败',
      });
    });
  });
});

// ─── GET /me 测试套件 ────────────────────────────────────────────────────────

describe('GET /me — 获取当前登录用户信息', () => {
  describe('成功获取', () => {
    test('已登录用户，返回 200 + 用户信息（不含 passwordHash）', async () => {
      const fakeUser = {
        id: 'me-user-id',
        email: 'me@example.com',
        nickname: '我',
        passwordHash: '$2b$10$secret',
        createdAt: 1741824000000,
        updatedAt: 1741824000000,
      };

      buildSelectMock([fakeUser]);

      const request = makeRequest({
        session: { userId: 'me-user-id' },
        url: '/me',
      });
      const reply = makeReply();

      await getMeHandler(request, reply);

      expect(reply._code).toBe(200);
      expect(reply._body.data).toEqual({
        id: 'me-user-id',
        email: 'me@example.com',
        nickname: '我',
        createdAt: 1741824000000,
      });
      expect(reply._body.data.passwordHash).toBeUndefined();
      expect(reply._body.message).toBe('获取用户信息成功');
    });

    test('响应 data 中不包含 updatedAt 字段', async () => {
      const fakeUser = {
        id: 'me-user-id',
        email: 'me@example.com',
        nickname: '我',
        passwordHash: '$2b$10$secret',
        createdAt: 1741824000000,
        updatedAt: 9999999999,
      };

      buildSelectMock([fakeUser]);

      const request = makeRequest({
        session: { userId: 'me-user-id' },
        url: '/me',
      });
      const reply = makeReply();

      await getMeHandler(request, reply);

      expect(reply._body.data.updatedAt).toBeUndefined();
    });
  });

  describe('用户已被删除 — 401', () => {
    test('session.userId 对应用户不存在，销毁 Session 并返回 401', async () => {
      buildSelectMock([]);

      const destroyMock = jest.fn().mockResolvedValueOnce(undefined);
      const request = makeRequest({
        session: { userId: 'deleted-user-id', destroy: destroyMock },
        url: '/me',
      });
      const reply = makeReply();

      await getMeHandler(request, reply);

      expect(destroyMock).toHaveBeenCalledTimes(1);
      expect(reply._code).toBe(401);
      expect(reply._body).toEqual({
        data: null,
        error: '用户不存在，请重新登录',
        message: '获取用户信息失败',
      });
    });

    test('用户不存在且 session.destroy 失败，仍返回 401（不抛出异常）', async () => {
      buildSelectMock([]);

      const destroyMock = jest.fn().mockRejectedValueOnce(new Error('destroy error'));
      const request = makeRequest({
        session: { userId: 'ghost-id', destroy: destroyMock },
        url: '/me',
      });
      const reply = makeReply();

      await getMeHandler(request, reply);

      expect(reply._code).toBe(401);
      expect(reply._body.error).toBe('用户不存在，请重新登录');
    });
  });

  describe('数据库异常 — 500', () => {
    test('数据库查询失败，返回 500（不暴露内部错误）', async () => {
      const dbError = new Error('DB unavailable');
      const whereMock = jest.fn().mockRejectedValueOnce(dbError);
      const fromMock = jest.fn().mockReturnValue({ where: whereMock });
      mockDbSelect.mockReturnValueOnce({ from: fromMock });

      const request = makeRequest({
        session: { userId: 'some-user-id' },
        url: '/me',
      });
      const reply = makeReply();

      await getMeHandler(request, reply);

      expect(reply._code).toBe(500);
      expect(reply._body).toEqual({
        data: null,
        error: '服务器内部错误，请稍后重试',
        message: '获取用户信息失败',
      });
    });
  });
});

// ─── 校验错误处理器测试 ───────────────────────────────────────────────────────

describe('JSON Schema 校验错误处理器', () => {
  test('邮箱 format 校验失败，错误信息为"请输入有效的邮箱地址"', () => {
    const err = {
      validation: [{ instancePath: '/email', keyword: 'format', params: {} }],
    };
    const request = makeRequest({ url: '/register' });
    const reply = makeReply();

    errorHandler(err, request, reply);

    expect(reply._code).toBe(400);
    expect(reply._body.error).toBe('请输入有效的邮箱地址');
    expect(reply._body.message).toBe('注册失败');
  });

  test('nickname minLength 校验失败，错误信息为"昵称长度为 2-20 字符"', () => {
    const err = {
      validation: [{ instancePath: '/nickname', keyword: 'minLength', params: {} }],
    };
    const request = makeRequest({ url: '/register' });
    const reply = makeReply();

    errorHandler(err, request, reply);

    expect(reply._code).toBe(400);
    expect(reply._body.error).toBe('昵称长度为 2-20 字符');
    expect(reply._body.message).toBe('注册失败');
  });

  test('nickname maxLength 校验失败，错误信息为"昵称长度为 2-20 字符"', () => {
    const err = {
      validation: [{ instancePath: '/nickname', keyword: 'maxLength', params: {} }],
    };
    const request = makeRequest({ url: '/register' });
    const reply = makeReply();

    errorHandler(err, request, reply);

    expect(reply._body.error).toBe('昵称长度为 2-20 字符');
  });

  test('nickname pattern 校验失败（纯空格），错误信息为"昵称长度为 2-20 字符"', () => {
    const err = {
      validation: [{ instancePath: '/nickname', keyword: 'pattern', params: {} }],
    };
    const request = makeRequest({ url: '/register' });
    const reply = makeReply();

    errorHandler(err, request, reply);

    expect(reply._body.error).toBe('昵称长度为 2-20 字符');
  });

  test('password minLength 校验失败，错误信息为"密码长度为 8-20 字符"', () => {
    const err = {
      validation: [{ instancePath: '/password', keyword: 'minLength', params: {} }],
    };
    const request = makeRequest({ url: '/register' });
    const reply = makeReply();

    errorHandler(err, request, reply);

    expect(reply._code).toBe(400);
    expect(reply._body.error).toBe('密码长度为 8-20 字符');
    expect(reply._body.message).toBe('注册失败');
  });

  test('password maxLength 校验失败，错误信息为"密码长度为 8-20 字符"', () => {
    const err = {
      validation: [{ instancePath: '/password', keyword: 'maxLength', params: {} }],
    };
    const request = makeRequest({ url: '/register' });
    const reply = makeReply();

    errorHandler(err, request, reply);

    expect(reply._body.error).toBe('密码长度为 8-20 字符');
  });

  test('agreedToPrivacy enum 校验失败，错误信息为"请阅读并同意隐私协议"', () => {
    const err = {
      validation: [{ instancePath: '/agreedToPrivacy', keyword: 'enum', params: {} }],
    };
    const request = makeRequest({ url: '/register' });
    const reply = makeReply();

    errorHandler(err, request, reply);

    expect(reply._code).toBe(400);
    expect(reply._body.error).toBe('请阅读并同意隐私协议');
    expect(reply._body.message).toBe('注册失败');
  });

  test('required 字段缺失（email），返回 400 + 请求参数格式错误', () => {
    const err = {
      validation: [{ instancePath: '', keyword: 'required', params: { missingProperty: 'email' } }],
    };
    const request = makeRequest({ url: '/register' });
    const reply = makeReply();

    errorHandler(err, request, reply);

    expect(reply._code).toBe(400);
    expect(reply._body.error).toBe('请求参数格式错误');
    expect(reply._body.message).toBe('注册失败');
  });

  test('required 字段缺失（password），登录场景返回 message 为"登录失败"', () => {
    const err = {
      validation: [{ instancePath: '', keyword: 'required', params: { missingProperty: 'password' } }],
    };
    const request = makeRequest({ url: '/login' });
    const reply = makeReply();

    errorHandler(err, request, reply);

    expect(reply._code).toBe(400);
    expect(reply._body.error).toBe('请求参数格式错误');
    expect(reply._body.message).toBe('登录失败');
  });

  test('非校验错误（无 validation 属性），返回 500', () => {
    const unexpectedError = new Error('Unexpected internal error');
    const request = makeRequest({ url: '/register' });
    const reply = makeReply();

    errorHandler(unexpectedError, request, reply);

    expect(reply._code).toBe(500);
    expect(reply._body.error).toBe('服务器内部错误，请稍后重试');
  });

  test('additionalProperties 校验失败，返回 400 + 请求参数格式错误', () => {
    const err = {
      validation: [{ instancePath: '', keyword: 'additionalProperties', params: { additionalProperty: 'hack' } }],
    };
    const request = makeRequest({ url: '/register' });
    const reply = makeReply();

    errorHandler(err, request, reply);

    expect(reply._code).toBe(400);
    expect(reply._body.error).toBe('请求参数格式错误');
  });

  test('validation 为空数组时，返回 400 + 请求参数格式错误', () => {
    const err = { validation: [] };
    const request = makeRequest({ url: '/register' });
    const reply = makeReply();

    errorHandler(err, request, reply);

    expect(reply._code).toBe(400);
    expect(reply._body.error).toBe('请求参数格式错误');
  });
});

// ─── 路由注册结构验证 ─────────────────────────────────────────────────────────

describe('路由注册结构', () => {
  test('所有 4 个路由处理函数均已注册', () => {
    expect(typeof registerHandler).toBe('function');
    expect(typeof loginHandler).toBe('function');
    expect(typeof logoutHandler).toBe('function');
    expect(typeof getMeHandler).toBe('function');
  });

  test('错误处理器已注册', () => {
    expect(typeof errorHandler).toBe('function');
  });
});
