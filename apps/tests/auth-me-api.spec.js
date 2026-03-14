// E2E 测试：获取当前登录用户信息功能 - API 测试
// 对应测试用例文档：specs/active/43-feature-account-registration-login-3-testcases.md (获取当前登录用户信息功能 - API 测试场景)

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('获取当前登录用户信息功能 - API 正常场景', () => {
  test('已登录用户调用接口,返回用户信息', async ({ request }) => {
    // 前置条件：注册并登录
    await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: 'metest@example.com',
        nickname: 'Me测试',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'metest@example.com',
        password: 'password123',
      },
    });

    // 获取 Session Cookie
    const setCookie = loginResponse.headers()['set-cookie'];

    // 调用 GET /api/auth/me
    const response = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: {
        Cookie: setCookie,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data).toHaveProperty('id');
    expect(body.data.email).toBe('metest@example.com');
    expect(body.data.nickname).toBe('Me测试');
    expect(body.data).toHaveProperty('createdAt');
    expect(body.data).not.toHaveProperty('passwordHash'); // 不包含密码哈希
    expect(body.message).toBe('获取用户信息成功');
  });
});

test.describe('获取当前登录用户信息功能 - API 异常场景', () => {
  test('未登录状态调用接口,返回 401', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/auth/me`);

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.data).toBeNull();
    expect(body.error).toBe('请先登录');
    expect(body.message).toBe('获取用户信息失败');
  });

  test('Session 已过期调用接口,返回 401', async ({ request }) => {
    // 注意：此测试需要模拟过期 Cookie
    test.skip();
  });

  test('Session 中的用户在数据库中已被删除,返回 401', async ({ request }) => {
    // 注意：此测试需要模拟用户记录被删除的场景
    // 实际实现需要在测试中手动删除数据库记录
    test.skip();
  });

  test('数据库异常时,返回 500 且不暴露内部错误', async ({ request }) => {
    // 注意：此测试需要模拟数据库不可用场景
    test.skip();
  });
});
