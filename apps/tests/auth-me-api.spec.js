import { test, expect } from '@playwright/test';

/**
 * 获取当前登录用户信息功能 - API 测试
 * 关联测试用例：specs/active/43-feature-account-registration-login-3-testcases.md
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

test.describe('获取当前登录用户信息 - API 正常场景', () => {
  test('已登录用户调用接口，返回用户信息', async ({ request }) => {
    // 先注册用户
    const registerResponse = await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: 'me@example.com',
        nickname: '我的信息',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    // 提取 Session Cookie
    const cookies = registerResponse.headers()['set-cookie'];

    // 调用 /me 接口
    const response = await request.get(`${API_BASE}/api/auth/me`, {
      headers: {
        Cookie: cookies,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      data: {
        email: 'me@example.com',
        nickname: '我的信息',
      },
      message: '获取用户信息成功',
    });

    expect(body.data.id).toBeTruthy();
    expect(body.data.createdAt).toBeGreaterThan(0);

    // 验证不包含 passwordHash 字段
    expect(body.data.passwordHash).toBeUndefined();
  });
});

test.describe('获取当前登录用户信息 - API 异常场景', () => {
  test('未登录状态调用接口，返回 401', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/auth/me`);

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body).toMatchObject({
      data: null,
      error: '请先登录',
      message: '获取用户信息失败',
    });
  });

  test('Session 已过期调用接口，返回 401', async ({ request }) => {
    // 使用过期的 Session Cookie
    const response = await request.get(`${API_BASE}/api/auth/me`, {
      headers: {
        Cookie: 'session=expired-session-id',
      },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body).toMatchObject({
      data: null,
      error: '请先登录',
      message: '获取用户信息失败',
    });
  });

  test('Session 中的用户在数据库中已被删除，返回 401', async ({ request }) => {
    // 此测试需要手动删除数据库中的用户记录
    // 这里使用占位测试，实际执行时需配合数据库操作
    test.skip();
  });

  test('数据库异常时，返回 500 且不暴露内部错误', async ({ request }) => {
    // 此测试需要手动停止数据库服务，或通过 mock 模拟
    // 这里使用占位测试，实际执行时需配合数据库控制
    test.skip();
  });
});
