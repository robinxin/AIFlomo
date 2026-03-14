import { test, expect } from '@playwright/test';

/**
 * 用户登录功能 - API 测试
 * 关联测试用例：specs/active/43-feature-account-registration-login-3-testcases.md
 */

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';

test.describe('用户登录 - API 正常场景', () => {
  test.beforeEach(async ({ request }) => {
    // 先注册一个测试用户
    await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: 'user@example.com',
        nickname: '小明',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });
  });

  test('有效邮箱和密码，用户登录成功', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/login`, {
      data: {
        email: 'user@example.com',
        password: 'password123',
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      data: {
        email: 'user@example.com',
        nickname: '小明',
      },
      message: '登录成功',
    });

    expect(body.data.id).toBeTruthy();
    expect(body.data.createdAt).toBeGreaterThan(0);

    // 验证 Set-Cookie 包含 Session
    const cookies = response.headers()['set-cookie'];
    expect(cookies).toBeTruthy();
  });
});

test.describe('用户登录 - API 异常场景', () => {
  test('邮箱字段缺失，返回 400', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/login`, {
      data: {
        password: 'password123',
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toMatchObject({
      data: null,
      error: '请求参数格式错误',
      message: '登录失败',
    });
  });

  test('密码字段缺失，返回 400', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/login`, {
      data: {
        email: 'user@example.com',
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toMatchObject({
      data: null,
      error: '请求参数格式错误',
      message: '登录失败',
    });
  });

  test('邮箱不存在，返回 401 且不泄露具体原因', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/auth/login`, {
      data: {
        email: 'nonexistent@example.com',
        password: 'password123',
      },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body).toMatchObject({
      data: null,
      error: '邮箱或密码错误,请重试',
      message: '登录失败',
    });
  });

  test('密码错误，返回 401 且不泄露具体原因', async ({ request }) => {
    // 先注册用户
    await request.post(`${API_BASE}/api/auth/register`, {
      data: {
        email: 'user2@example.com',
        nickname: '测试',
        password: 'password123',
        agreedToPrivacy: true,
      },
    });

    // 使用错误密码登录
    const response = await request.post(`${API_BASE}/api/auth/login`, {
      data: {
        email: 'user2@example.com',
        password: 'wrongpassword',
      },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body).toMatchObject({
      data: null,
      error: '邮箱或密码错误，请重试',
      message: '登录失败',
    });
  });

  test('数据库异常时，返回 500 且不暴露内部错误', async ({ request }) => {
    // 此测试需要手动停止数据库服务，或通过 mock 模拟
    // 这里使用占位测试，实际执行时需配合数据库控制
    test.skip();
  });
});
