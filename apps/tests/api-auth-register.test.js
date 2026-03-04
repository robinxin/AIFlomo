/**
 * 测试用例：POST /api/auth/register（用户注册）
 * 对应测试用例文档：specs/active/25-feature-user-registration-login-testcases.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock database and bcrypt
const mockDb = {
  users: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  sessions: {
    create: vi.fn(),
  },
};

const mockBcrypt = {
  hash: vi.fn(),
};

vi.mock('@/lib/db', () => ({ default: mockDb }));
vi.mock('bcrypt', () => ({ default: mockBcrypt }));

describe('POST /api/auth/register - 正常场景', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-001: 有效输入且勾选隐私协议，注册成功并自动登录', async () => {
    // Arrange
    const hashedPassword = '$2b$10$abcdefghijklmnopqrstuvwxyz123456';
    mockBcrypt.hash.mockResolvedValue(hashedPassword);
    mockDb.users.findFirst.mockResolvedValue(null); // 邮箱不存在
    mockDb.users.create.mockResolvedValue({
      id: 'user-1',
      email: 'newuser@example.com',
      nickname: '小明',
      passwordHash: hashedPassword,
      createdAt: new Date(),
      lastLoginAt: null,
    });
    mockDb.sessions.create.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      data: JSON.stringify({ userId: 'user-1' }),
    });

    // Act
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'newuser@example.com',
        password: 'Password123',
        nickname: '小明',
        agreePrivacy: true,
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(201);
    expect(body.data).toBeDefined();
    expect(body.data.email).toBe('newuser@example.com');
    expect(body.data.nickname).toBe('小明');
    expect(body.data.id).toBe('user-1');
    expect(body.message).toBe('注册成功');
    expect(body.data.passwordHash).toBeUndefined(); // 不返回密码哈希

    // 验证数据库操作
    expect(mockDb.users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'newuser@example.com',
        nickname: '小明',
        passwordHash: hashedPassword,
      })
    );
    expect(mockDb.sessions.create).toHaveBeenCalled();

    // 验证 Cookie
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toContain('httpOnly=true');
    expect(setCookie).toContain('sameSite=strict');
  });

  it('TC-002: 邮箱包含大写字母，系统自动转为小写存储', async () => {
    // Arrange
    mockBcrypt.hash.mockResolvedValue('$2b$10$hash');
    mockDb.users.findFirst.mockResolvedValue(null);
    mockDb.users.create.mockResolvedValue({
      id: 'user-2',
      email: 'user@example.com',
      nickname: '测试用户',
      passwordHash: '$2b$10$hash',
      createdAt: new Date(),
    });
    mockDb.sessions.create.mockResolvedValue({ id: 'session-2', userId: 'user-2' });

    // Act
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'User@Example.COM',
        password: 'Password123',
        nickname: '测试用户',
        agreePrivacy: true,
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(201);
    expect(body.data.email).toBe('user@example.com'); // 全小写
    expect(mockDb.users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com', // 存储为小写
      })
    );
  });

  it('TC-003: 密码为边界值 8 位字符，包含字母和数字，注册成功', async () => {
    // Arrange
    mockBcrypt.hash.mockResolvedValue('$2b$10$hash8');
    mockDb.users.findFirst.mockResolvedValue(null);
    mockDb.users.create.mockResolvedValue({
      id: 'user-3',
      email: 'test8char@example.com',
      nickname: '边界测试',
      passwordHash: '$2b$10$hash8',
      createdAt: new Date(),
    });
    mockDb.sessions.create.mockResolvedValue({ id: 'session-3', userId: 'user-3' });

    // Act
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test8char@example.com',
        password: 'Pass1234', // 8 位
        nickname: '边界测试',
        agreePrivacy: true,
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(201);
    expect(body.data).toBeDefined();
    expect(body.message).toBe('注册成功');
  });

  it('TC-004: 密码为边界值 20 位字符，包含字母和数字，注册成功', async () => {
    // Arrange
    mockBcrypt.hash.mockResolvedValue('$2b$10$hash20');
    mockDb.users.findFirst.mockResolvedValue(null);
    mockDb.users.create.mockResolvedValue({
      id: 'user-4',
      email: 'test20char@example.com',
      nickname: '边界测试',
      passwordHash: '$2b$10$hash20',
      createdAt: new Date(),
    });
    mockDb.sessions.create.mockResolvedValue({ id: 'session-4', userId: 'user-4' });

    // Act
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test20char@example.com',
        password: 'Pass12345678901234567', // 20 位
        nickname: '边界测试',
        agreePrivacy: true,
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(201);
    expect(body.data).toBeDefined();
  });

  it('TC-005: 昵称为边界值 1 个字符，注册成功', async () => {
    // Arrange
    mockBcrypt.hash.mockResolvedValue('$2b$10$hash');
    mockDb.users.findFirst.mockResolvedValue(null);
    mockDb.users.create.mockResolvedValue({
      id: 'user-5',
      email: 'testnick1@example.com',
      nickname: 'A',
      passwordHash: '$2b$10$hash',
      createdAt: new Date(),
    });
    mockDb.sessions.create.mockResolvedValue({ id: 'session-5', userId: 'user-5' });

    // Act
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testnick1@example.com',
        password: 'Password123',
        nickname: 'A',
        agreePrivacy: true,
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(201);
    expect(body.data.nickname).toBe('A');
  });

  it('TC-006: 昵称为边界值 20 个字符，注册成功', async () => {
    // Arrange
    mockBcrypt.hash.mockResolvedValue('$2b$10$hash');
    mockDb.users.findFirst.mockResolvedValue(null);
    mockDb.users.create.mockResolvedValue({
      id: 'user-6',
      email: 'testnick20@example.com',
      nickname: '12345678901234567890',
      passwordHash: '$2b$10$hash',
      createdAt: new Date(),
    });
    mockDb.sessions.create.mockResolvedValue({ id: 'session-6', userId: 'user-6' });

    // Act
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testnick20@example.com',
        password: 'Password123',
        nickname: '12345678901234567890',
        agreePrivacy: true,
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(201);
    expect(body.data.nickname).toBe('12345678901234567890');
  });
});

describe('POST /api/auth/register - 异常场景', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-007: 邮箱已存在，返回 409', async () => {
    // Arrange
    mockDb.users.findFirst.mockResolvedValue({
      id: 'existing-user',
      email: 'existing@example.com',
      nickname: '已存在',
    });

    // Act
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'existing@example.com',
        password: 'NewPass456',
        nickname: '新昵称',
        agreePrivacy: true,
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(409);
    expect(body.data).toBeNull();
    expect(body.error).toBe('EMAIL_EXISTS');
    expect(body.message).toBe('该邮箱已注册,请直接登录');
    expect(mockDb.users.create).not.toHaveBeenCalled(); // 不应创建用户
  });

  it('TC-008: 邮箱为空字符串，返回 400', async () => {
    // Act
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: '',
        password: 'Password123',
        nickname: '测试',
        agreePrivacy: true,
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.data).toBeNull();
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('请求参数不合法');
    expect(mockDb.users.create).not.toHaveBeenCalled();
  });

  it('TC-009: 邮箱格式不正确（缺少 @），返回 400', async () => {
    // Act
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalidemailexample.com',
        password: 'Password123',
        nickname: '测试',
        agreePrivacy: true,
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('请求参数不合法');
  });

  it('TC-010: 邮箱格式不正确（缺少域名），返回 400', async () => {
    // Act
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@',
        password: 'Password123',
        nickname: '测试',
        agreePrivacy: true,
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('TC-011: 缺少 email 字段，返回 400', async () => {
    // Act
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: 'Password123',
        nickname: '测试',
        agreePrivacy: true,
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('请求参数不合法');
  });

  it('TC-012: 密码少于 8 位，返回 400', async () => {
    // Act
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'short@example.com',
        password: 'Pass123', // 7 位
        nickname: '测试',
        agreePrivacy: true,
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('TC-013: 密码超过 20 位，返回 400', async () => {
    // Act
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'long@example.com',
        password: 'Password123456789012345', // 25 位
        nickname: '测试',
        agreePrivacy: true,
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('TC-014: 密码只包含字母不包含数字，返回 400', async () => {
    // Act
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'letteronly@example.com',
        password: 'PasswordOnly',
        nickname: '测试',
        agreePrivacy: true,
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('TC-015: 密码只包含数字不包含字母，返回 400', async () => {
    // Act
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'numberonly@example.com',
        password: '12345678',
        nickname: '测试',
        agreePrivacy: true,
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('TC-016: 密码为空字符串，返回 400', async () => {
    // Act
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'emptypass@example.com',
        password: '',
        nickname: '测试',
        agreePrivacy: true,
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('TC-017: 缺少 password 字段，返回 400', async () => {
    // Act
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nopass@example.com',
        nickname: '测试',
        agreePrivacy: true,
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('TC-018: 昵称为空字符串，返回 400', async () => {
    // Act
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'emptynick@example.com',
        password: 'Password123',
        nickname: '',
        agreePrivacy: true,
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('TC-019: 昵称超过 20 字符，返回 400', async () => {
    // Act
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'longnick@example.com',
        password: 'Password123',
        nickname: '123456789012345678901', // 21 字符
        agreePrivacy: true,
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('TC-020: 缺少 nickname 字段，返回 400', async () => {
    // Act
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonick@example.com',
        password: 'Password123',
        agreePrivacy: true,
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('TC-021: agreePrivacy 为 false，返回 400', async () => {
    // Act
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'disagree@example.com',
        password: 'Password123',
        nickname: '测试',
        agreePrivacy: false,
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('TC-022: 缺少 agreePrivacy 字段，返回 400', async () => {
    // Act
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'noagree@example.com',
        password: 'Password123',
        nickname: '测试',
      }),
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });
});
