import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Must use unstable_mockModule before dynamic imports for ESM mocking
const mockSelect = jest.fn();
const mockSelectById = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockBcryptHash = jest.fn();
const mockBcryptCompare = jest.fn();

jest.unstable_mockModule('../src/db/index.js', () => ({
  select: mockSelect,
  selectById: mockSelectById,
  insert: mockInsert,
  update: mockUpdate,
}));

jest.unstable_mockModule('bcrypt', () => ({
  default: {
    hash: mockBcryptHash,
    compare: mockBcryptCompare,
  },
  hash: mockBcryptHash,
  compare: mockBcryptCompare,
}));

// Dynamic imports after mocking
const { default: Fastify } = await import('fastify');
const { default: authRoutes } = await import('../src/routes/auth.js');

const mockUUID = 'test-uuid-1234-5678-abcd-ef1234567890';

const mockUser = {
  id: mockUUID,
  email: 'test@example.com',
  nickname: '测试用户',
  password_hash: '$2b$10$hashedpassword',
  agreed_at: 1741824000000,
  created_at: 1741824000000,
  updated_at: 1741824000000,
};

function buildApp({ sessionUserId = null } = {}) {
  const fastify = Fastify({ logger: false });

  // Mock session decorator
  fastify.decorateRequest('session', null);
  fastify.addHook('onRequest', async (request) => {
    request.session = {
      userId: sessionUserId,
      destroy: jest.fn((cb) => { if (cb) cb(null); }),
    };
  });

  fastify.register(authRoutes, { prefix: '/api/auth' });
  return fastify;
}

describe('POST /api/auth/register', () => {
  let fastify;

  beforeEach(() => {
    jest.clearAllMocks();
    global.crypto = { randomUUID: jest.fn(() => mockUUID) };
    fastify = buildApp();
  });

  afterEach(async () => {
    await fastify.close();
  });

  test('registers a new user successfully (HTTP 201)', async () => {
    mockSelect.mockResolvedValueOnce([]);
    mockBcryptHash.mockResolvedValueOnce('$2b$10$hashedpassword');
    mockInsert.mockResolvedValueOnce([mockUser]);

    const response = await fastify.inject({
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
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('email', 'test@example.com');
    expect(body.data).toHaveProperty('nickname', '测试用户');
    expect(body.data).not.toHaveProperty('password_hash');
    expect(body.data).not.toHaveProperty('passwordHash');
  });

  test('returns 409 when email already exists', async () => {
    mockSelect.mockResolvedValueOnce([mockUser]);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'test@example.com',
        nickname: '测试用户',
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

  test('returns 400 when email is missing', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        nickname: '测试用户',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  test('returns 400 when nickname is too short (1 char)', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'test@example.com',
        nickname: 'a',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  test('returns 400 when password is too short (less than 8 chars)', async () => {
    const response = await fastify.inject({
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
  });

  test('returns 400 when agreedToPrivacy is false', async () => {
    const response = await fastify.inject({
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
  });

  test('returns 400 when email format is invalid', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'not-an-email',
        nickname: '测试用户',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  test('returns 500 when database insert fails', async () => {
    mockSelect.mockResolvedValueOnce([]);
    mockBcryptHash.mockResolvedValueOnce('$2b$10$hashedpassword');
    mockInsert.mockRejectedValueOnce(new Error('DB Error'));

    const response = await fastify.inject({
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
    expect(body.error).toBe('服务器内部错误，请稍后重试');
  });

  test('response does not expose password hash', async () => {
    mockSelect.mockResolvedValueOnce([]);
    mockBcryptHash.mockResolvedValueOnce('$2b$10$hashedpassword');
    mockInsert.mockResolvedValueOnce([mockUser]);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'test@example.com',
        nickname: '测试用户',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    const body = JSON.parse(response.body);
    const dataStr = JSON.stringify(body.data);
    expect(dataStr).not.toContain('hash');
    expect(dataStr).not.toContain('password');
  });

  test('trims whitespace from nickname before saving', async () => {
    mockSelect.mockResolvedValueOnce([]);
    mockBcryptHash.mockResolvedValueOnce('$2b$10$hashedpassword');
    mockInsert.mockResolvedValueOnce([{ ...mockUser, nickname: '测试用户' }]);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'test@example.com',
        nickname: '  测试用户  ',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.data.nickname).toBe('测试用户');
  });
});

describe('POST /api/auth/login', () => {
  let fastify;

  beforeEach(() => {
    jest.clearAllMocks();
    fastify = buildApp();
  });

  afterEach(async () => {
    await fastify.close();
  });

  test('logs in successfully with correct credentials (HTTP 200)', async () => {
    mockSelect.mockResolvedValueOnce([mockUser]);
    mockBcryptCompare.mockResolvedValueOnce(true);

    const response = await fastify.inject({
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
    expect(body.data).toHaveProperty('id');
    expect(body.data).toHaveProperty('email', 'test@example.com');
    expect(body.data).not.toHaveProperty('password_hash');
    expect(body.data).not.toHaveProperty('passwordHash');
  });

  test('returns 401 when user does not exist', async () => {
    mockSelect.mockResolvedValueOnce([]);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'nonexistent@example.com',
        password: 'password123',
      },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
    expect(body.error).toBe('邮箱或密码错误，请重试');
    expect(body.message).toBe('登录失败');
  });

  test('returns 401 when password is wrong', async () => {
    mockSelect.mockResolvedValueOnce([mockUser]);
    mockBcryptCompare.mockResolvedValueOnce(false);

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'wrongpassword',
      },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('邮箱或密码错误，请重试');
  });

  test('returns 400 when email is missing', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: 'password123' },
    });

    expect(response.statusCode).toBe(400);
  });

  test('returns 400 when password is missing', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test@example.com' },
    });

    expect(response.statusCode).toBe(400);
  });

  test('returns same 401 error for nonexistent user and wrong password (security)', async () => {
    mockSelect.mockResolvedValueOnce([]);
    const response1 = await fastify.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nouser@example.com', password: 'pass1234' },
    });

    mockSelect.mockResolvedValueOnce([mockUser]);
    mockBcryptCompare.mockResolvedValueOnce(false);
    const response2 = await fastify.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test@example.com', password: 'wrongpass' },
    });

    expect(response1.statusCode).toBe(401);
    expect(response2.statusCode).toBe(401);
    const body1 = JSON.parse(response1.body);
    const body2 = JSON.parse(response2.body);
    expect(body1.error).toBe(body2.error);
  });

  test('returns 500 when database throws during login', async () => {
    mockSelect.mockRejectedValueOnce(new Error('DB connection error'));

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'password123',
      },
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('服务器内部错误，请稍后重试');
  });
});

describe('POST /api/auth/logout', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when not authenticated (no session userId)', async () => {
    const fastify = buildApp({ sessionUserId: null });

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/auth/logout',
    });

    await fastify.close();
    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('请先登录');
  });

  test('logs out successfully when authenticated', async () => {
    const fastify = buildApp({ sessionUserId: 'user-123' });

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/auth/logout',
    });

    await fastify.close();
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('已成功登出');
    expect(body.data).toBeNull();
  });

  test('returns 500 when session destroy fails', async () => {
    // Build a special app where session.destroy fails
    const fastify = Fastify({ logger: false });
    fastify.decorateRequest('session', null);
    fastify.addHook('onRequest', async (request) => {
      request.session = {
        userId: 'user-123',
        destroy: jest.fn((cb) => { if (cb) cb(new Error('Session destroy failed')); }),
      };
    });
    fastify.register(authRoutes, { prefix: '/api/auth' });

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/auth/logout',
    });

    await fastify.close();
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('服务器内部错误，请稍后重试');
  });
});

describe('GET /api/auth/me', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('returns 401 when not authenticated', async () => {
    const fastify = buildApp({ sessionUserId: null });

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    await fastify.close();
    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('请先登录');
    expect(body.message).toBe('未授权访问');
  });

  test('returns user info when authenticated', async () => {
    mockSelectById.mockResolvedValueOnce([mockUser]);
    const fastify = buildApp({ sessionUserId: mockUUID });

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    await fastify.close();
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('获取用户信息成功');
    expect(body.data).toHaveProperty('id', mockUUID);
    expect(body.data).toHaveProperty('email', 'test@example.com');
    expect(body.data).not.toHaveProperty('password_hash');
    expect(body.data).not.toHaveProperty('passwordHash');
  });

  test('returns 401 when user not found in database (account deleted)', async () => {
    mockSelectById.mockResolvedValueOnce([]);
    const fastify = buildApp({ sessionUserId: 'deleted-user-id' });

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    await fastify.close();
    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('用户不存在，请重新登录');
  });

  test('returns 500 when database throws during /me', async () => {
    mockSelectById.mockRejectedValueOnce(new Error('DB error'));
    const fastify = buildApp({ sessionUserId: mockUUID });

    const response = await fastify.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    await fastify.close();
    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('服务器内部错误，请稍后重试');
  });
});
