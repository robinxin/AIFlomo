/**
 * TDD Test: apps/server/src/routes/auth.js
 * Task T006 - 认证路由模块（Fastify Plugin）
 *
 * Tests cover:
 * - POST /register: 成功注册、邮箱已存在、参数校验、隐私协议
 * - POST /login: 成功登录、邮箱不存在、密码错误、参数校验
 * - POST /logout: 成功登出、未登录时拦截
 * - GET /me: 成功获取用户信息、未登录时拦截、用户不存在
 *
 * Mock 策略:
 * - jest.unstable_mockModule('../src/db/index.js') — ESM-safe db mock
 * - jest.unstable_mockModule('bcrypt') — ESM-safe bcrypt mock
 *
 * 测试框架: Jest (ESM via --experimental-vm-modules)
 */

import { jest } from '@jest/globals';

// ── ESM Mock Declarations ──────────────────────────────────────────────────────
// In Jest ESM mode, use jest.unstable_mockModule instead of jest.mock.
// These must be declared BEFORE any dynamic import of the mocked modules.

// Shared mock functions exposed for test-level configuration
const mockDbSelect = jest.fn();
const mockDbInsert = jest.fn();
const mockDbUpdate = jest.fn();

const mockBcryptHash = jest.fn();
const mockBcryptCompare = jest.fn();

// Mock the db module
jest.unstable_mockModule('../src/db/index.js', () => ({
  default: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
}));

// Mock bcrypt
jest.unstable_mockModule('bcrypt', () => ({
  default: {
    hash: mockBcryptHash,
    compare: mockBcryptCompare,
  },
}));

// ── Dynamic Imports (after mocks are declared) ─────────────────────────────────
// Use dynamic import so that Jest can intercept the mocked modules.

const { default: Fastify } = await import('fastify');
const { default: authRoutes } = await import('../src/routes/auth.js');

// ── Constants ──────────────────────────────────────────────────────────────────

const TEST_USER = {
  id: 'test-uuid-001',
  email: 'test@example.com',
  nickname: '测试用户',
  passwordHash: '$2b$10$hashedpassword',
  agreedAt: 1741824000000,
  createdAt: 1741824000000,
  updatedAt: 1741824000000,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Build a Fastify test instance with the auth routes registered.
 * Simulates an unauthenticated session (no userId).
 */
async function buildTestApp() {
  const app = Fastify({ logger: false });

  app.decorateRequest('session', null);

  app.addHook('preHandler', async (request) => {
    if (!request.session) {
      request.session = {
        destroy: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockResolvedValue(undefined),
      };
    }
  });

  await app.register(authRoutes);
  await app.ready();
  return app;
}

/**
 * Build a Fastify test instance where the session already contains a userId,
 * simulating a logged-in user.
 */
async function buildAuthenticatedApp(userId = TEST_USER.id) {
  const app = Fastify({ logger: false });

  app.decorateRequest('session', null);

  app.addHook('preHandler', async (request) => {
    request.session = {
      userId,
      destroy: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
    };
  });

  await app.register(authRoutes);
  await app.ready();
  return app;
}

/**
 * Reset all mocks before each test to avoid state leakage between tests.
 */
function resetMocks() {
  jest.clearAllMocks();
}

/**
 * Build a chainable Drizzle select mock that resolves to the given rows.
 * Supports the pattern: db.select().from(table).where(cond)
 */
function buildSelectMock(rows = []) {
  const chain = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue(rows),
  };
  mockDbSelect.mockReturnValue(chain);
  return chain;
}

/**
 * Build a chainable Drizzle insert mock that resolves successfully.
 * Supports: db.insert(table).values(data)
 */
function buildInsertMock() {
  const chain = {
    values: jest.fn().mockResolvedValue([]),
  };
  mockDbInsert.mockReturnValue(chain);
  return chain;
}

/**
 * Build a chainable Drizzle update mock that resolves successfully.
 * Supports: db.update(table).set(data).where(cond)
 */
function buildUpdateMock() {
  const chain = {
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue([]),
  };
  mockDbUpdate.mockReturnValue(chain);
  return chain;
}

// ── Test Suites ────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// POST /register — 用户注册
// ────────────────────────────────────────────────────────────────────────────
describe('POST /register', () => {
  let app;

  beforeEach(async () => {
    resetMocks();
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('成功注册', () => {
    it('should return 201 and user data on successful registration', async () => {
      buildSelectMock([]);
      mockBcryptHash.mockResolvedValue('$2b$10$newhash');
      buildInsertMock();

      const response = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'new@example.com',
          nickname: '新用户',
          password: 'password123',
          agreedToPrivacy: true,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('注册成功');
      expect(body.data).toBeDefined();
      expect(body.data.email).toBe('new@example.com');
      expect(body.data.nickname).toBe('新用户');
      expect(body.data.id).toBeDefined();
      expect(body.data.createdAt).toBeDefined();
    });

    it('should not return passwordHash in the response', async () => {
      buildSelectMock([]);
      mockBcryptHash.mockResolvedValue('$2b$10$newhash');
      buildInsertMock();

      const response = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'nohash@example.com',
          nickname: '安全用户',
          password: 'securepass1',
          agreedToPrivacy: true,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.passwordHash).toBeUndefined();
      expect(body.data.password).toBeUndefined();
    });

    it('should call bcrypt.hash with saltRounds=10', async () => {
      buildSelectMock([]);
      mockBcryptHash.mockResolvedValue('$2b$10$newhash');
      buildInsertMock();

      await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'salt@example.com',
          nickname: '盐测试',
          password: 'password123',
          agreedToPrivacy: true,
        },
      });

      expect(mockBcryptHash).toHaveBeenCalledWith('password123', 10);
    });

    it('should trim nickname before saving', async () => {
      buildSelectMock([]);
      mockBcryptHash.mockResolvedValue('$2b$10$newhash');
      const insertMock = buildInsertMock();

      await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'trim@example.com',
          nickname: '  昵称带空格  ',
          password: 'password123',
          agreedToPrivacy: true,
        },
      });

      expect(insertMock.values).toHaveBeenCalledWith(
        expect.objectContaining({ nickname: '昵称带空格' })
      );
    });

    it('should write userId to session after registration', async () => {
      buildSelectMock([]);
      mockBcryptHash.mockResolvedValue('$2b$10$newhash');
      buildInsertMock();

      const app2 = Fastify({ logger: false });
      let capturedSession = null;

      app2.decorateRequest('session', null);
      app2.addHook('preHandler', async (request) => {
        request.session = {
          destroy: jest.fn().mockResolvedValue(undefined),
          save: jest.fn().mockResolvedValue(undefined),
        };
        capturedSession = request.session;
      });

      await app2.register(authRoutes);
      await app2.ready();

      await app2.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'session@example.com',
          nickname: '会话测试',
          password: 'password123',
          agreedToPrivacy: true,
        },
      });

      expect(capturedSession.userId).toBeDefined();
      await app2.close();
    });
  });

  describe('邮箱已存在', () => {
    it('should return 409 when email is already registered', async () => {
      buildSelectMock([TEST_USER]);

      const response = await app.inject({
        method: 'POST',
        url: '/register',
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

    it('should not call bcrypt.hash when email already exists', async () => {
      buildSelectMock([TEST_USER]);

      await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'test@example.com',
          nickname: '重复用户',
          password: 'password123',
          agreedToPrivacy: true,
        },
      });

      expect(mockBcryptHash).not.toHaveBeenCalled();
    });
  });

  describe('参数校验', () => {
    it('should return 400 when email is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          nickname: '用户',
          password: 'password123',
          agreedToPrivacy: true,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should return 400 when email format is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'not-an-email',
          nickname: '用户',
          password: 'password123',
          agreedToPrivacy: true,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should return 400 when nickname is too short (less than 2 chars)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'valid@example.com',
          nickname: 'A',
          password: 'password123',
          agreedToPrivacy: true,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should return 400 when nickname is too long (more than 20 chars)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'valid@example.com',
          nickname: 'A'.repeat(21),
          password: 'password123',
          agreedToPrivacy: true,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should return 400 when password is too short (less than 8 chars)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'valid@example.com',
          nickname: '用户名',
          password: 'short',
          agreedToPrivacy: true,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should return 400 when password is too long (more than 20 chars)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'valid@example.com',
          nickname: '用户名',
          password: 'a'.repeat(21),
          agreedToPrivacy: true,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should return 400 when nickname is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'valid@example.com',
          password: 'password123',
          agreedToPrivacy: true,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when password is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'valid@example.com',
          nickname: '用户名',
          agreedToPrivacy: true,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('隐私协议校验', () => {
    it('should return 400 when agreedToPrivacy is false', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'valid@example.com',
          nickname: '用户名',
          password: 'password123',
          agreedToPrivacy: false,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
      expect(body.error).toBeDefined();
    });

    it('should return 400 when agreedToPrivacy is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'valid@example.com',
          nickname: '用户名',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('服务器错误处理', () => {
    it('should return 500 when database insert throws', async () => {
      buildSelectMock([]);
      mockBcryptHash.mockResolvedValue('$2b$10$newhash');
      // Simulate DB insert failure
      const failChain = {
        values: jest.fn().mockRejectedValue(new Error('DB insert error')),
      };
      mockDbInsert.mockReturnValue(failChain);

      const response = await app.inject({
        method: 'POST',
        url: '/register',
        payload: {
          email: 'fail@example.com',
          nickname: '失败用户',
          password: 'password123',
          agreedToPrivacy: true,
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
      expect(body.error).toBe('服务器内部错误，请稍后重试');
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// POST /login — 用户登录
// ────────────────────────────────────────────────────────────────────────────
describe('POST /login', () => {
  let app;

  beforeEach(async () => {
    resetMocks();
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('成功登录', () => {
    it('should return 200 and user data on successful login', async () => {
      buildSelectMock([TEST_USER]);
      mockBcryptCompare.mockResolvedValue(true);
      buildUpdateMock();

      const response = await app.inject({
        method: 'POST',
        url: '/login',
        payload: {
          email: 'test@example.com',
          password: 'correctpassword',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('登录成功');
      expect(body.data).toBeDefined();
      expect(body.data.email).toBe(TEST_USER.email);
      expect(body.data.nickname).toBe(TEST_USER.nickname);
      expect(body.data.id).toBe(TEST_USER.id);
    });

    it('should not return passwordHash in the login response', async () => {
      buildSelectMock([TEST_USER]);
      mockBcryptCompare.mockResolvedValue(true);
      buildUpdateMock();

      const response = await app.inject({
        method: 'POST',
        url: '/login',
        payload: {
          email: 'test@example.com',
          password: 'correctpassword',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.passwordHash).toBeUndefined();
    });

    it('should write userId to session on successful login', async () => {
      buildSelectMock([TEST_USER]);
      mockBcryptCompare.mockResolvedValue(true);
      buildUpdateMock();

      const app2 = Fastify({ logger: false });
      let capturedSession = null;

      app2.decorateRequest('session', null);
      app2.addHook('preHandler', async (request) => {
        request.session = {
          destroy: jest.fn().mockResolvedValue(undefined),
          save: jest.fn().mockResolvedValue(undefined),
        };
        capturedSession = request.session;
      });

      await app2.register(authRoutes);
      await app2.ready();

      await app2.inject({
        method: 'POST',
        url: '/login',
        payload: {
          email: 'test@example.com',
          password: 'correctpassword',
        },
      });

      expect(capturedSession.userId).toBe(TEST_USER.id);
      await app2.close();
    });

    it('should call bcrypt.compare with provided password and stored hash', async () => {
      buildSelectMock([TEST_USER]);
      mockBcryptCompare.mockResolvedValue(true);
      buildUpdateMock();

      await app.inject({
        method: 'POST',
        url: '/login',
        payload: {
          email: 'test@example.com',
          password: 'mypassword',
        },
      });

      expect(mockBcryptCompare).toHaveBeenCalledWith('mypassword', TEST_USER.passwordHash);
    });
  });

  describe('邮箱不存在', () => {
    it('should return 401 with unified error when email does not exist', async () => {
      buildSelectMock([]);

      const response = await app.inject({
        method: 'POST',
        url: '/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'somepassword',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
      expect(body.error).toBe('邮箱或密码错误，请重试');
      expect(body.message).toBe('登录失败');
    });

    it('should not call bcrypt.compare when user is not found', async () => {
      buildSelectMock([]);

      await app.inject({
        method: 'POST',
        url: '/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'somepassword',
        },
      });

      expect(mockBcryptCompare).not.toHaveBeenCalled();
    });
  });

  describe('密码错误', () => {
    it('should return 401 with unified error when password is wrong', async () => {
      buildSelectMock([TEST_USER]);
      mockBcryptCompare.mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/login',
        payload: {
          email: 'test@example.com',
          password: 'wrongpassword',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
      expect(body.error).toBe('邮箱或密码错误，请重试');
      expect(body.message).toBe('登录失败');
    });

    it('should use same error message for wrong password and non-existent user (no info leak)', async () => {
      // Non-existent user
      buildSelectMock([]);
      const noUserResponse = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email: 'ghost@example.com', password: 'pass' },
      });

      resetMocks();

      // Wrong password
      buildSelectMock([TEST_USER]);
      mockBcryptCompare.mockResolvedValue(false);
      const wrongPassResponse = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email: 'test@example.com', password: 'wrongpass' },
      });

      const noUserBody = JSON.parse(noUserResponse.body);
      const wrongPassBody = JSON.parse(wrongPassResponse.body);

      expect(noUserBody.error).toBe(wrongPassBody.error);
      expect(noUserBody.error).toBe('邮箱或密码错误，请重试');
    });
  });

  describe('参数校验', () => {
    it('should return 400 when email is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { password: 'password123' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should return 400 when password is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email: 'test@example.com' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it('should return 400 when email format is invalid', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/login',
        payload: {
          email: 'invalid-email',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when body is empty', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/login',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('服务器错误处理', () => {
    it('should return 500 when database query throws', async () => {
      const failChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockRejectedValue(new Error('DB query error')),
      };
      mockDbSelect.mockReturnValue(failChain);

      const response = await app.inject({
        method: 'POST',
        url: '/login',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
      expect(body.error).toBe('服务器内部错误，请稍后重试');
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// POST /logout — 用户登出
// ────────────────────────────────────────────────────────────────────────────
describe('POST /logout', () => {
  describe('成功登出', () => {
    let app;

    beforeEach(async () => {
      resetMocks();
      app = await buildAuthenticatedApp();
    });

    afterEach(async () => {
      await app.close();
    });

    it('should return 200 on successful logout', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/logout',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
      expect(body.message).toBe('已成功登出');
    });

    it('should call session.destroy() on logout', async () => {
      let destroySpy = null;

      const app2 = Fastify({ logger: false });
      app2.decorateRequest('session', null);
      app2.addHook('preHandler', async (request) => {
        destroySpy = jest.fn().mockResolvedValue(undefined);
        request.session = {
          userId: TEST_USER.id,
          destroy: destroySpy,
          save: jest.fn().mockResolvedValue(undefined),
        };
      });

      await app2.register(authRoutes);
      await app2.ready();

      await app2.inject({
        method: 'POST',
        url: '/logout',
      });

      expect(destroySpy).toHaveBeenCalledTimes(1);
      await app2.close();
    });
  });

  describe('未登录时拦截', () => {
    it('should return 401 when not authenticated', async () => {
      resetMocks();
      const app = await buildTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/logout',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
      expect(body.error).toBe('请先登录');

      await app.close();
    });

    it('should return 401 with message "未授权访问" when not authenticated', async () => {
      resetMocks();
      const app = await buildTestApp();

      const response = await app.inject({
        method: 'POST',
        url: '/logout',
      });

      const body = JSON.parse(response.body);
      expect(body.message).toBe('未授权访问');

      await app.close();
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// GET /me — 获取当前用户信息
// ────────────────────────────────────────────────────────────────────────────
describe('GET /me', () => {
  describe('成功获取用户信息', () => {
    let app;

    beforeEach(async () => {
      resetMocks();
      app = await buildAuthenticatedApp(TEST_USER.id);
    });

    afterEach(async () => {
      await app.close();
    });

    it('should return 200 and user data for authenticated user', async () => {
      buildSelectMock([TEST_USER]);

      const response = await app.inject({
        method: 'GET',
        url: '/me',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('获取用户信息成功');
      expect(body.data).toBeDefined();
      expect(body.data.id).toBe(TEST_USER.id);
      expect(body.data.email).toBe(TEST_USER.email);
      expect(body.data.nickname).toBe(TEST_USER.nickname);
      expect(body.data.createdAt).toBe(TEST_USER.createdAt);
    });

    it('should not return passwordHash in the /me response', async () => {
      buildSelectMock([TEST_USER]);

      const response = await app.inject({
        method: 'GET',
        url: '/me',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.passwordHash).toBeUndefined();
      expect(body.data.password_hash).toBeUndefined();
    });

    it('should query user by userId from session', async () => {
      buildSelectMock([TEST_USER]);

      await app.inject({
        method: 'GET',
        url: '/me',
      });

      expect(mockDbSelect).toHaveBeenCalled();
    });
  });

  describe('未登录时拦截', () => {
    it('should return 401 when not authenticated', async () => {
      resetMocks();
      const app = await buildTestApp();

      const response = await app.inject({
        method: 'GET',
        url: '/me',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
      expect(body.error).toBe('请先登录');
      expect(body.message).toBe('未授权访问');

      await app.close();
    });
  });

  describe('用户不存在（异常情况）', () => {
    it('should return 401 when userId in session does not correspond to any user', async () => {
      resetMocks();
      const app = await buildAuthenticatedApp('nonexistent-user-id');
      buildSelectMock([]);

      const response = await app.inject({
        method: 'GET',
        url: '/me',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
      expect(body.error).toBe('用户不存在，请重新登录');

      await app.close();
    });

    it('should destroy session when user is not found', async () => {
      resetMocks();
      let destroySpy = null;

      const app2 = Fastify({ logger: false });
      app2.decorateRequest('session', null);
      app2.addHook('preHandler', async (request) => {
        destroySpy = jest.fn().mockResolvedValue(undefined);
        request.session = {
          userId: 'ghost-user-id',
          destroy: destroySpy,
          save: jest.fn().mockResolvedValue(undefined),
        };
      });

      await app2.register(authRoutes);
      await app2.ready();

      buildSelectMock([]);

      await app2.inject({
        method: 'GET',
        url: '/me',
      });

      expect(destroySpy).toHaveBeenCalledTimes(1);
      await app2.close();
    });
  });

  describe('服务器错误处理', () => {
    it('should return 500 when database query throws on /me', async () => {
      resetMocks();
      const app = await buildAuthenticatedApp(TEST_USER.id);

      const failChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockRejectedValue(new Error('DB error')),
      };
      mockDbSelect.mockReturnValue(failChain);

      const response = await app.inject({
        method: 'GET',
        url: '/me',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
      expect(body.error).toBe('服务器内部错误，请稍后重试');

      await app.close();
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Plugin structure tests
// ────────────────────────────────────────────────────────────────────────────
describe('authRoutes plugin', () => {
  it('should be a valid Fastify plugin (function)', () => {
    expect(typeof authRoutes).toBe('function');
  });

  it('should register all 4 routes without error', async () => {
    resetMocks();
    const app = Fastify({ logger: false });
    app.decorateRequest('session', null);
    app.addHook('preHandler', async (request) => {
      if (!request.session) {
        request.session = {
          destroy: jest.fn().mockResolvedValue(undefined),
          save: jest.fn().mockResolvedValue(undefined),
        };
      }
    });

    await expect(app.register(authRoutes)).resolves.not.toThrow();
    await expect(app.ready()).resolves.not.toThrow();
    await app.close();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Branch coverage — remaining uncovered paths
// ────────────────────────────────────────────────────────────────────────────
describe('Branch coverage — edge cases', () => {
  describe('POST /logout — session.destroy() failure', () => {
    it('should return 500 when session.destroy() throws', async () => {
      resetMocks();
      const app2 = Fastify({ logger: false });
      app2.decorateRequest('session', null);
      app2.addHook('preHandler', async (request) => {
        request.session = {
          userId: TEST_USER.id,
          destroy: jest.fn().mockRejectedValue(new Error('session store unavailable')),
          save: jest.fn().mockResolvedValue(undefined),
        };
      });

      await app2.register(authRoutes);
      await app2.ready();

      const response = await app2.inject({
        method: 'POST',
        url: '/logout',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
      expect(body.error).toBe('服务器内部错误，请稍后重试');

      await app2.close();
    });
  });

  describe('Custom error handler — non-validation errors', () => {
    it('should handle 4xx errors with proper format via error handler', async () => {
      // This tests the err.statusCode < 500 branch in the custom error handler
      resetMocks();
      const app2 = Fastify({ logger: false });
      app2.decorateRequest('session', null);
      app2.addHook('preHandler', async (request) => {
        request.session = {
          destroy: jest.fn().mockResolvedValue(undefined),
          save: jest.fn().mockResolvedValue(undefined),
        };
      });

      await app2.register(authRoutes);

      // Add a test route that throws a 4xx error to exercise the error handler branch
      app2.post('/test-4xx-error', async () => {
        const err = new Error('Custom 4xx error');
        err.statusCode = 403;
        throw err;
      });

      await app2.ready();

      const response = await app2.inject({
        method: 'POST',
        url: '/test-4xx-error',
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();

      await app2.close();
    });

    it('should return 500 for unhandled non-validation errors via error handler', async () => {
      resetMocks();
      const app2 = Fastify({ logger: false });
      app2.decorateRequest('session', null);
      app2.addHook('preHandler', async (request) => {
        request.session = {
          destroy: jest.fn().mockResolvedValue(undefined),
          save: jest.fn().mockResolvedValue(undefined),
        };
      });

      await app2.register(authRoutes);

      // Add a test route that throws an unexpected error (no statusCode)
      app2.post('/test-unhandled-error', async () => {
        throw new Error('Completely unexpected error');
      });

      await app2.ready();

      const response = await app2.inject({
        method: 'POST',
        url: '/test-unhandled-error',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
      expect(body.error).toBe('服务器内部错误，请稍后重试');

      await app2.close();
    });
  });
});
