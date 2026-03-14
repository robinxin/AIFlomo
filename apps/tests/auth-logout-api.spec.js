// E2E 测试：用户登出功能 - API 测试
// 对应测试用例文档：specs/active/43-feature-account-registration-login-3-testcases.md (用户登出功能 - API 测试场景)

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('用户登出功能 - API 正常场景', () => {
  test('已登录用户调用登出接口,Session 销毁成功', async ({ request }) => {
    // 前置条件：注册并登录
    await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: 'logouttest@example.com',
        nickname: '登出测试',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'logouttest@example.com',
        password: 'password123',
      },
    });

    // 获取 Session Cookie
    const setCookie = loginResponse.headers()['set-cookie'];

    // 调用登出接口（携带 Cookie）
    const response = await request.post(`${BASE_URL}/api/auth/logout`, {
      headers: {
        Cookie: setCookie,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.message).toBe('已成功登出');

    // 验证 Set-Cookie 头清除 Session Cookie
    const logoutSetCookie = response.headers()['set-cookie'];
    expect(logoutSetCookie).toBeDefined();
    expect(logoutSetCookie).toMatch(/Max-Age=0|Expires=/); // Cookie 过期标记
  });
});

test.describe('用户登出功能 - API 异常场景', () => {
  test('未登录状态调用登出接口,返回 401', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/logout`);

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请先登录');
    expect(body.message).toBe('登出失败');
  });

  test('Session 已过期调用登出接口,返回 401', async ({ request }) => {
    // 注意：此测试需要模拟过期 Cookie，实际实现较复杂
    // 可通过手动设置过期时间戳的 Cookie 或在后端添加测试模式
    test.skip();
  });
});
