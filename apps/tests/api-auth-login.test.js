/**
 * 测试用例：POST /api/auth/login（用户登录）
 * 对应测试用例文档：specs/active/25-feature-user-registration-login-testcases.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database and bcrypt
const mockDb = {
  users: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  sessions: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
};

const mockBcrypt = {
  compare: vi.fn(),
};

vi.mock('@/lib/db', () => ({ default: mockDb }));
vi.mock('bcrypt', () => ({ default: mockBcrypt }));

describe('POST /api/auth/login - 正常场景', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-023: 有效邮箱和密码，登录成功', async () => {
    // Arrange
    const now = new Date();
    mockDb.users.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'login@example.com',
      nickname: '测试用户',
      passwordHash: '$2b$10$hash',
      createdAt: new Date('2024-01-01'),
      lastLoginAt: null,
    });
    mockBcrypt.compare.mockResolvedValue(true);
    mockDb.users.update.mockResolvedValue({
      id: 'user-1',
      email: 'login@example.com',
      nickname: '测试用户',
      lastLoginAt: now,
    });
    mockDb.sessions.create.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      data: JSON.stringify({ userId: 'user-1' }),
    });

    // Act
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'login@example.com',
        password: 'Password123',
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.data).toBeDefined();
    expect(body.data.email).toBe('login@example.com');
    expect(body.data.lastLoginAt).toBeDefined(); // ISO 8601 格式
    expect(body.message).toBe('登录成功');

    // 验证数据库操作
    expect(mockDb.users.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { lastLoginAt: expect.any(Date) },
      })
    );
    expect(mockDb.sessions.create).toHaveBeenCalled();

    // 验证 Cookie
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toContain('httpOnly=true');
    expect(setCookie).toContain('sameSite=strict');
  });

  it('TC-024: 邮箱大小写不敏感，登录成功', async () => {
    // Arrange
    mockDb.users.findFirst.mockResolvedValue({
      id: 'user-2',
      email: 'casetest@example.com', // 数据库中是小写
      nickname: '大小写测试',
      passwordHash: '$2b$10$hash',
      createdAt: new Date(),
      lastLoginAt: null,
    });
    mockBcrypt.compare.mockResolvedValue(true);
    mockDb.users.update.mockResolvedValue({
      id: 'user-2',
      email: 'casetest@example.com',
      nickname: '大小写测试',
      lastLoginAt: new Date(),
    });
    mockDb.sessions.create.mockResolvedValue({ id: 'session-2', userId: 'user-2' });

    // Act
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'CaseTest@Example.COM', // 输入大写
        password: 'Password123',
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.data.email).toBe('casetest@example.com'); // 返回小写
    expect(mockDb.users.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'casetest@example.com' }, // 查询时转小写
      })
    );
  });

  it('TC-025: Session 有效期内再次访问，无需重新登录', async () => {
    // Arrange
    const validSession = {
      id: 'session-1',
      userId: 'user-1',
      expires: new Date(Date.now() + 86400000), // 未过期
      data: JSON.stringify({ userId: 'user-1' }),
    };
    mockDb.sessions.findFirst.mockResolvedValue(validSession);
    mockDb.users.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      nickname: '测试',
      createdAt: new Date(),
      lastLoginAt: new Date(),
    });

    // Act
    const response = await fetch('http://localhost:3000/api/auth/me', {
      method: 'GET',
      headers: { Cookie: 'session=valid-session-token' },
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.data).toBeDefined();
    expect(body.data.email).toBe('test@example.com');
    expect(body.message).toBe('ok');
  });
});

describe('POST /api/auth/login - 异常场景', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-026: 邮箱不存在，返回 401', async () => {
    // Arrange
    mockDb.users.findFirst.mockResolvedValue(null); // 用户不存在

    // Act
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'notexist@example.com',
        password: 'Password123',
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(body.data).toBeNull();
    expect(body.error).toBe('INVALID_CREDENTIALS');
    expect(body.message).toBe('邮箱或密码错误'); // 不暴露"邮箱不存在"
    expect(mockBcrypt.compare).not.toHaveBeenCalled(); // 不应尝试比对密码
  });

  it('TC-027: 密码错误，返回 401', async () => {
    // Arrange
    mockDb.users.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'wrongpass@example.com',
      passwordHash: '$2b$10$correcthash',
    });
    mockBcrypt.compare.mockResolvedValue(false); // 密码不匹配

    // Act
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'wrongpass@example.com',
        password: 'WrongPass456',
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(body.data).toBeNull();
    expect(body.error).toBe('INVALID_CREDENTIALS');
    expect(body.message).toBe('邮箱或密码错误');
  });

  it('TC-028: 邮箱为空字符串，返回 400', async () => {
    // Act
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: '',
        password: 'Password123',
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('请求参数不合法');
  });

  it('TC-029: 密码为空字符串，返回 400', async () => {
    // Act
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: '',
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('TC-030: 缺少 email 字段，返回 400', async () => {
    // Act
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: 'Password123',
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('TC-031: 缺少 password 字段，返回 400', async () => {
    // Act
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('TC-032: 未携带 Cookie，访问受保护端点，返回 401', async () => {
    // Arrange
    mockDb.sessions.findFirst.mockResolvedValue(null);

    // Act
    const response = await fetch('http://localhost:3000/api/auth/me', {
      method: 'GET',
      // 不携带 Cookie
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toBe('请先登录');
  });

  it('TC-033: Session 过期后访问受保护端点，返回 401', async () => {
    // Arrange
    const expiredSession = {
      id: 'session-expired',
      userId: 'user-1',
      expires: new Date(Date.now() - 86400000), // 已过期
      data: JSON.stringify({ userId: 'user-1' }),
    };
    mockDb.sessions.findFirst.mockResolvedValue(expiredSession);

    // Act
    const response = await fetch('http://localhost:3000/api/auth/me', {
      method: 'GET',
      headers: { Cookie: 'session=expired-session-token' },
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toBe('请先登录');
  });
});
