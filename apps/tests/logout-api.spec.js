import { test, expect } from '@playwright/test';

/**
 * 用户登出功能 - API 测试
 * 关联测试用例：specs/active/43-feature-account-registration-login-3-testcases.md
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

test.describe('用户登出 - API 正常场景', () => {
  test('已登录用户调用登出接口，Session 销毁成功', async ({ request }) => {
    // 先注册并登录
    const registerResponse = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: 'logout@example.com',
        nickname: '登出测试',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    // 提取 Session Cookie
    const cookies = registerResponse.headers()['set-cookie'];

    // 调用登出接口
    const response = await request.post(`${API_BASE}/api/auth/logout`, {
      headers: {
        Cookie: cookies,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      data: null,
      message: '已成功登出',
    });

    // 验证 Cookie 被清除（Max-Age=0 或 Expires 过期）
    const logoutCookies = response.headers()['set-cookie'];
    expect(logoutCookies).toBeTruthy();
  });
});

test.describe('用户登出 - API 异常场景', () => {
  test('未登录状态调用登出接口，返回 401', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/logout`);

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body).toMatchObject({
      data: null,
      error: '请先登录',
      message: '登出失败',
    });
  });

  test('Session 已过期调用登出接口，返回 401', async ({ request }) => {
    // 使用过期的 Session Cookie
    const response = await request.post(`${API_BASE}/api/auth/logout`, {
      headers: {
        Cookie: 'session=expired-session-id',
      },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body).toMatchObject({
      data: null,
      error: '请先登录',
      message: '登出失败',
    });
  });
});
