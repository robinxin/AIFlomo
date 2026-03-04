/**
 * 测试用例：POST /api/auth/logout（用户登出）
 * 对应测试用例文档：specs/active/25-feature-user-registration-login-testcases.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
const mockDb = {
  sessions: {
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
};

vi.mock('@/lib/db', () => ({ default: mockDb }));

describe('POST /api/auth/logout - 正常场景', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-034: 已登录用户登出成功', async () => {
    // Arrange
    mockDb.sessions.findFirst.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      expires: new Date(Date.now() + 86400000),
      data: JSON.stringify({ userId: 'user-1' }),
    });
    mockDb.sessions.delete.mockResolvedValue({ id: 'session-1' });

    // Act
    const response = await fetch('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: 'session=valid-session-token' },
    });

    // Assert
    expect(response.status).toBe(204);
    expect(response.body).toBeUndefined(); // 无响应 Body

    // 验证 Cookie 被清除
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toMatch(/maxAge=0|expires=.*1970/i); // Cookie 被清除

    // 验证数据库中 Session 被删除
    expect(mockDb.sessions.delete).toHaveBeenCalledWith({
      where: { id: 'session-1' },
    });
  });
});

describe('POST /api/auth/logout - 异常场景', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-035: 未登录时调用登出接口，返回 401', async () => {
    // Arrange
    mockDb.sessions.findFirst.mockResolvedValue(null);

    // Act
    const response = await fetch('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      // 不携带 Cookie
    });
    const body = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(body.data).toBeNull();
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toBe('请先登录');
    expect(mockDb.sessions.delete).not.toHaveBeenCalled(); // 不应删除 Session
  });
});
