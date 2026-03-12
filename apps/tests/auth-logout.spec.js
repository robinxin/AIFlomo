/**
 * E2E 测试：用户登出功能
 * 测试用例来源：specs/active/28-feature-account-registration-login-2-testcases.md
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const WEB_URL = process.env.WEB_URL || 'http://localhost:8082';

// 辅助函数：登录并获取 Session Cookie
async function loginAndGetSession(request) {
  // 先注册用户
  await request.post(`${API_URL}/api/auth/register`, {
    data: {
      email: 'logouttest@example.com',
      nickname: '登出测试',
      password: 'Pass123',
      agreePolicy: true,
    },
  }).catch(() => {
    // 用户已存在，忽略错误
  });

  // 登录
  const response = await request.post(`${API_URL}/api/auth/login`, {
    data: {
      email: 'logouttest@example.com',
      password: 'Pass123',
    },
  });

  const setCookie = response.headers()['set-cookie'];
  const sessionIdMatch = setCookie.match(/sessionId=([^;]+)/);
  return sessionIdMatch[1];
}

test.describe('用户登出 - 正常场景', () => {
  test('已登录用户登出成功', async ({ request }) => {
    const sessionId = await loginAndGetSession(request);

    // 发送登出请求
    const logoutResponse = await request.post(`${API_URL}/api/auth/logout`, {
      headers: {
        Cookie: `sessionId=${sessionId}`,
      },
    });

    // 验证返回 204
    expect(logoutResponse.status()).toBe(204);

    // 验证 Cookie 被清除（Set-Cookie 包含 Max-Age=0）
    const setCookie = logoutResponse.headers()['set-cookie'];
    expect(setCookie).toContain('Max-Age=0');

    // 验证 Session 已失效（无法访问 /api/auth/me）
    const meResponse = await request.get(`${API_URL}/api/auth/me`, {
      headers: {
        Cookie: `sessionId=${sessionId}`,
      },
    });

    expect(meResponse.status()).toBe(401);
  });
});

test.describe('用户登出 - 异常场景', () => {
  test('未登录时访问登出接口，返回 401', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/auth/logout`);

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toBe('请先登录');
  });

  test('Session 已过期时访问登出接口，返回 401', async ({ request }) => {
    // 使用一个无效的 Session ID
    const response = await request.post(`${API_URL}/api/auth/logout`, {
      headers: {
        Cookie: 'sessionId=invalid-session-id',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toBe('请先登录');
  });
});
