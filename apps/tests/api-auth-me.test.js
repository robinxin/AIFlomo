/**
 * 测试用例：GET /api/auth/me（获取当前用户信息）
 * 对应测试用例文档：specs/active/25-feature-user-registration-login-testcases.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
const mockDb = {
  sessions: {
    findFirst: vi.fn(),
  },
  users: {
    findFirst: vi.fn(),
  },
};

vi.mock('@/lib/db', () => ({ default: mockDb }));

describe('GET /api/auth/me - 正常场景', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-036: 已登录用户获取当前用户信息成功', async () => {
    // Arrange
    mockDb.sessions.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      expires: new Date(Date.now() + 86400000),
      data: JSON.stringify({ userId: 'user-1' }),
    });
    mockDb.users.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      nickname: '测试用户',
      passwordHash: '$2b$10$hash', // 应在响应中过滤掉
      createdAt: new Date('2024-01-01'),
      lastLoginAt: new Date('2024-01-02'),
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
    expect(body.data.id).toBe('user-1');
    expect(body.data.email).toBe('test@example.com');
    expect(body.data.nickname).toBe('测试用户');
    expect(body.data.createdAt).toBeDefined();
    expect(body.data.lastLoginAt).toBeDefined();
    expect(body.data.passwordHash).toBeUndefined(); // 不返回密码哈希
    expect(body.message).toBe('ok');
  });
});

describe('GET /api/auth/me - 异常场景', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-037: 未登录时访问，返回 401', async () => {
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
    expect(body.data).toBeNull();
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toBe('请先登录');
  });
});
