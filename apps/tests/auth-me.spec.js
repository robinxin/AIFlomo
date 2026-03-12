/**
 * E2E 测试：获取当前用户信息
 * 测试用例来源：specs/active/28-feature-account-registration-login-2-testcases.md
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:3000';

// 辅助函数：注册并登录用户
async function registerAndLogin(request, email = 'metest@example.com') {
  await request.post(`${API_URL}/api/auth/register`, {
    data: {
      email,
      nickname: '我的测试',
      password: 'Pass123',
      agreePolicy: true,
    },
  }).catch(() => {
    // 用户已存在，忽略错误
  });

  const loginResponse = await request.post(`${API_URL}/api/auth/login`, {
    data: {
      email,
      password: 'Pass123',
    },
  });

  const setCookie = loginResponse.headers()['set-cookie'];
  const sessionIdMatch = setCookie.match(/sessionId=([^;]+)/);
  return sessionIdMatch[1];
}

test.describe('获取当前用户信息 - 正常场景', () => {
  test('已登录用户获取信息成功', async ({ request }) => {
    const sessionId = await registerAndLogin(request);

    const response = await request.get(`${API_URL}/api/auth/me`, {
      headers: {
        Cookie: `sessionId=${sessionId}`,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    // 验证响应结构
    expect(body.data).toBeDefined();
    expect(body.data.id).toBeTruthy();
    expect(body.data.email).toBe('metest@example.com');
    expect(body.data.nickname).toBe('我的测试');
    expect(body.message).toBe('ok');

    // 验证不返回密码哈希（安全要求）
    expect(body.data.passwordHash).toBeUndefined();
  });
});

test.describe('获取当前用户信息 - 异常场景', () => {
  test('未登录时访问 /api/auth/me，返回 401', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/auth/me`);

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toBe('请先登录');
  });

  test('Session 已过期时访问 /api/auth/me，返回 401', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/auth/me`, {
      headers: {
        Cookie: 'sessionId=expired-or-invalid-session',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
    expect(body.message).toBe('请先登录');
  });
});
